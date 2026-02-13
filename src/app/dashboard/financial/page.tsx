'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { AdminOnlyRoute } from '@/components/auth/RoleBasedRoute';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { FaCreditCard, FaWallet, FaHandHoldingUsd, FaPlus, FaTrash, FaDownload, FaFileInvoiceDollar, FaBell } from 'react-icons/fa';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import { createAdminNotification } from '@/utils/notificationUtils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs for browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Unified categories & purposes
const expenseCategories = ['Maintenance', 'Utilities', 'Shopping', 'Healthcare', 'Entertainment', 'Rent', 'Marketing', 'Office Supplies', 'Insurance', 'Other'];
const expensePurposes = ['Maintenance', 'Repair', 'Utility Bills', 'Marketing', 'Supplies', 'Service', 'Other'];

interface FinancialRecord {
  id: string;
  amount: number;
  description: string;
  category?: string;
  type: 'expense' | 'income' | 'loan_given' | 'loan_received';
  purpose?: string;
  receiptUrls: string[];
  createdAt: Date;
  recordDate?: Date;
}

interface ContractRow {
  id: string;
  tenantName: string;
  unitNumber?: string;
  securityDeposit: number;
  utilityDeposit: number;
  accessCardDeposit: number;
  startDate: string | Date;
  expiryDate: string | Date;
}

const COLORS = ['#2563EB', '#16A34A', '#FFBB28', '#EF4444', '#A020F0', '#10B981', '#6366F1', '#F59E0B'];

function getCategoryData(records: FinancialRecord[], recordType: 'expense' | 'income') {
  const map: Record<string, number> = {};
  records.filter(r => r.type === recordType).forEach(r => {
    map[r.category || 'Other'] = (map[r.category || 'Other'] || 0) + r.amount;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function getMonthlyData(records: FinancialRecord[]) {
  const map: Record<string, { expense: number; income: number }> = {};
  records.forEach(r => {
    const month = dayjs(r.createdAt).format('YYYY-MM');
    if (!map[month]) map[month] = { expense: 0, income: 0 };
    // Map loan_given to expense and loan_received to income
    if (r.type === 'expense' || r.type === 'loan_given') {
      map[month].expense += r.amount;
    } else if (r.type === 'income' || r.type === 'loan_received') {
      map[month].income += r.amount;
    }
  });
  return Object.entries(map).map(([month, v]) => ({ month, ...v }));
}

export default function FinancialManagementPage() {
  return (
    <AdminOnlyRoute>
      <FinancialManagementContent />
    </AdminOnlyRoute>
  );
}

function FinancialManagementContent() {
  const [activeTab, setActiveTab] = useState<'expenses' | 'deposits' | 'rentals'>('expenses');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [purpose, setPurpose] = useState('Maintenance');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [receipts, setReceipts] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recordDate, setRecordDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [depositSearch, setDepositSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState<'all' | '30' | 'expired'>('all');
  const [refundModal, setRefundModal] = useState<{ open: boolean; contract?: ContractRow }>({ open: false });
  const [refundForm, setRefundForm] = useState<{ amount: string; date: string; notes: string }>({
    amount: '',
    date: dayjs().format('YYYY-MM-DD'),
    notes: '',
  });
  const [rentalIncome, setRentalIncome] = useState<Record<string, unknown>[]>([]);
  const [rentalSearch, setRentalSearch] = useState('');

  useEffect(() => {
    fetchRecords();
    fetchContracts();
    fetchRentalIncome();
  }, []);

  async function fetchRentalIncome() {
    try {
      // Fetch all contracts with rental information
      const contractsQuery = query(collection(db, 'contracts'), where('archived', '==', false));
      const contractsSnapshot = await getDocs(contractsQuery);
      
      // Fetch all invoices to calculate actual rental income
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const invoices = invoicesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];
      
      // Group rental income by unit/tenant
      const rentalDataMap: Record<string, Record<string, unknown>> = {};
      
      contractsSnapshot.docs.forEach(doc => {
        const contract = doc.data();
        const unitKey = contract.unitNumber || 'Unknown';
        const tenantName = contract.tenantName || 'Unknown Tenant';
        
        if (!rentalDataMap[unitKey]) {
          rentalDataMap[unitKey] = {
            unitNumber: unitKey,
            tenantName,
            monthlyRent: contract.rentalPerMonth || 0,
            contractStartDate: contract.moveInDate,
            contractExpiryDate: contract.expiryDate,
            totalPaid: 0,
            totalPending: 0,
            invoiceCount: 0,
            lastPaymentDate: null
          };
        }
        
        // Calculate income from invoices for this unit
        const unitInvoices = invoices.filter(inv => inv.unitNumber === unitKey);
        rentalDataMap[unitKey].invoiceCount = unitInvoices.length;
        rentalDataMap[unitKey].totalPaid = unitInvoices
          .filter(inv => inv.isPaid)
          .reduce((sum, inv) => sum + (Number(inv.rentAmount) || Number(inv.totalAmount) || 0), 0);
        rentalDataMap[unitKey].totalPending = unitInvoices
          .filter(inv => !inv.isPaid)
          .reduce((sum, inv) => sum + (Number(inv.rentAmount) || Number(inv.totalAmount) || 0), 0);
        
        // Find last payment date
        const paidInvoices = unitInvoices.filter(inv => inv.isPaid && inv.paidAt);
        if (paidInvoices.length > 0) {
          const lastPaid = paidInvoices.sort((a, b) => {
            const dateA = a.paidAt ? new Date(a.paidAt as string | number).getTime() : 0;
            const dateB = b.paidAt ? new Date(b.paidAt as string | number).getTime() : 0;
            return dateB - dateA;
          })[0];
          rentalDataMap[unitKey].lastPaymentDate = lastPaid.paidAt;
        }
      });
      
      setRentalIncome(Object.values(rentalDataMap));
    } catch (error) {
      console.error('Error fetching rental income:', error);
    }
  }

  async function fetchRecords() {
    const snapshot = await getDocs(collection(db, 'financial_records'));
    setRecords(snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount,
        description: data.description,
        category: data.category,
        type: (data.type || 'expense') as FinancialRecord['type'],
        purpose: data.purpose,
        receiptUrls: data.receiptUrls || [],
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        recordDate: data.recordDate?.toDate ? data.recordDate.toDate() : data.recordDate ? new Date(data.recordDate) : undefined,
      };
    }));
  }

  async function fetchContracts() {
    const contractsQuery = query(collection(db, 'contracts'), where('archived', '==', false));
    const snap = await getDocs(contractsQuery);
    const rows: ContractRow[] = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        tenantName: String(data.tenantName || 'Unknown Tenant'),
        unitNumber: data.unitNumber as string | undefined,
        securityDeposit: Number(data.securityDeposit || 0),
        utilityDeposit: Number(data.utilityDeposit || 0),
        accessCardDeposit: Number(data.accessCardDeposit || 0),
        startDate: data.moveInDate as string | Date,
        expiryDate: data.expiryDate as string | Date,
      };
    });
    setContracts(rows);

    // Alerts
    for (const c of rows) {
      const { status, daysRemaining } = getContractExpiryStatus(String(c.expiryDate));
      if (status === 'expiring_soon' && daysRemaining <= 30) {
        await createAdminNotification(`Contract expiring soon: ${c.tenantName} (Unit ${c.unitNumber || '-'}) in ${daysRemaining} days`, 'warning');
      }
      if (daysRemaining <= 7) {
        await createAdminNotification(`Prepare refund for ${c.tenantName} (Unit ${c.unitNumber || '-'}) — Contract expires on ${new Date(c.expiryDate).toLocaleDateString()}`, 'info');
      }
    }
  }

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!amount) {
      setError('Amount is required.');
      return;
    }

    setUploading(true);
    const receiptUrls: string[] = [];
    for (const file of receipts) {
      const storageRef = ref(storage, `financial_records/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      receiptUrls.push(url);
    }

    const recordData: Record<string, unknown> = {
      amount: Number(amount),
      description,
      category,
      type,
      purpose,
      receiptUrls,
      createdAt: serverTimestamp(),
      recordDate: recordDate ? new Date(recordDate) : serverTimestamp(),
    };

    await addDoc(collection(db, 'financial_records'), recordData);
    
    // Reset form
    setAmount('');
    setDescription('');
    setCategory('Other');
    setPurpose('Maintenance');
    setType('expense');
    setReceipts([]);
    setRecordDate(dayjs().format('YYYY-MM-DD'));
    setUploading(false);
    fetchRecords();
  }

  async function handleDeleteRecord(id: string) {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteDoc(doc(db, 'financial_records', id));
      fetchRecords();
    }
  }

  // no loan status in unified module

  const isExpenseType = (record: FinancialRecord) => record.type === 'expense' || record.type === 'loan_given';
  const isIncomeType = (record: FinancialRecord) => record.type === 'income' || record.type === 'loan_received';

  const totalExpenses = records.filter(isExpenseType).reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = records.filter(isIncomeType).reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpenses;
  const totalDepositsHeld = useMemo(() => contracts.reduce((sum, c) => sum + (c.securityDeposit || 0) + (c.utilityDeposit || 0) + (c.accessCardDeposit || 0), 0), [contracts]);
  const totalActiveTenants = useMemo(() => new Set(contracts.map(c => c.tenantName)).size, [contracts]);
  const contractsExpiringThisMonth = useMemo(
    () => contracts.filter(c => dayjs(c.expiryDate).isSame(dayjs(), 'month')).length,
    [contracts]
  );

  const depositAlerts = useMemo(() => {
    return contracts
      .map(contract => {
        const { status, daysRemaining } = getContractExpiryStatus(String(contract.expiryDate));
        if (status === 'expired') {
          return `Contract for ${contract.tenantName} (Unit ${contract.unitNumber || '-'}) has expired.`;
        }
        if (daysRemaining <= 7) {
          return `Prepare refund for ${contract.tenantName} (Unit ${contract.unitNumber || '-'}) — Contract expires in ${daysRemaining} days.`;
        }
        if (daysRemaining <= 30) {
          return `Contract for ${contract.tenantName} (Unit ${contract.unitNumber || '-'}) expires in ${daysRemaining} days.`;
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [contracts]);

  const unitOptions = useMemo(() => {
    const units = Array.from(new Set(contracts.map(c => c.unitNumber).filter(Boolean))) as string[];
    return ['All', ...units];
  }, [contracts]);

  const filteredDeposits = useMemo(() => {
    return contracts.filter(contract => {
      const haystack = `${contract.tenantName} ${contract.unitNumber || ''}`.toLowerCase();
      if (depositSearch && !haystack.includes(depositSearch.toLowerCase())) {
        return false;
      }
      if (unitFilter !== 'All' && contract.unitNumber !== unitFilter) {
        return false;
      }
      const { status, daysRemaining } = getContractExpiryStatus(String(contract.expiryDate));
      if (expiryFilter === '30' && (status === 'expired' || daysRemaining > 30)) {
        return false;
      }
      if (expiryFilter === 'expired' && status !== 'expired') {
        return false;
      }
      return true;
    });
  }, [contracts, depositSearch, unitFilter, expiryFilter]);

  const depositsByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    contracts.forEach(contract => {
      const unit = contract.unitNumber || 'Unassigned';
      const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
      map[unit] = (map[unit] || 0) + total;
    });
    return Object.entries(map).map(([unit, total]) => ({ unit, total }));
  }, [contracts]);

  // Filter records
  const filteredRecords = records.filter(record => {
    if (filterCategory !== 'All' && record.category !== filterCategory) return false;
    if (filterType === 'expense' && !isExpenseType(record)) return false;
    if (filterType === 'income' && !isIncomeType(record)) return false;
    if (search && !(`${record.description || ''} ${record.purpose || ''}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const currentCategories = expenseCategories;

  // Chart data
  const categoryData = getCategoryData(records, 'expense');
  const monthlyData = getMonthlyData(records);

  function formatDate(date: Date) {
    return dayjs(date).format('YYYY-MM-DD');
  }

  async function handleDownloadPDF(record: FinancialRecord) {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text('Financial Record Receipt', 105, y, { align: 'center' });
    y += 12;
    doc.setFontSize(12);
    doc.text(`Platform: Green Bridge`, 14, y); y += 8;
    doc.text(`Date: ${formatDate(record.createdAt)}`, 14, y); y += 8;
    doc.text(`Type: ${record.type.charAt(0).toUpperCase() + record.type.slice(1)}`, 14, y); y += 8;
    if (record.purpose) { doc.text(`Purpose: ${record.purpose}`, 14, y); y += 8; }
    doc.text(`Category: ${record.category || '-'}`, 14, y); y += 8;
    doc.text(`Amount: RM${record.amount.toFixed(2)}`, 14, y); y += 8;
    doc.text(`Description: ${record.description}`, 14, y); y += 8;

    
    y += 4;
    doc.setFontSize(14);
    doc.text('Receipts:', 14, y); y += 8;
    
    if (record.receiptUrls && record.receiptUrls.length > 0) {
      for (let i = 0; i < record.receiptUrls.length; i++) {
        const url = record.receiptUrls[i];
        doc.setFontSize(10);
        doc.text(`Receipt ${i + 1}:`, 14, y); y += 6;
        
        // Check if it's an image file
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          try {
            // Use proxy endpoint to avoid CORS issues
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Convert blob to data URL
            const dataURL = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            
            // Create image element to get dimensions
            const img = document.createElement('img') as HTMLImageElement;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = dataURL;
            });

            // Calculate image dimensions to fit within PDF page
            const maxWidth = 150;
            const maxHeight = 100;
            let imgWidth = img.width;
            let imgHeight = img.height;

            // Scale down if too large
            if (imgWidth > maxWidth) {
              imgHeight = (imgHeight * maxWidth) / imgWidth;
              imgWidth = maxWidth;
            }
            if (imgHeight > maxHeight) {
              imgWidth = (imgWidth * maxHeight) / imgHeight;
              imgHeight = maxHeight;
            }

            // Draw into a canvas to ensure JPEG encoding (avoids PNG/WEBP issues)
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, imgWidth, imgHeight);
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);

            // Add image to PDF
            doc.addImage(jpegDataUrl, 'JPEG', 14, y, imgWidth, imgHeight);
            y += imgHeight + 10;
            
            // Check if we need a new page
            if (y > 250) {
              doc.addPage();
              y = 20;
            }
          } catch (error) {
            console.error('Error loading image:', error);
            doc.text(`[Image could not be loaded: ${url}]`, 14, y);
            y += 8;
          }
        } else if (url.match(/\.pdf$/i)) {
          try {
            // Use proxy endpoint to avoid CORS issues
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const pdfBuffer = await response.arrayBuffer();
            
            // Load PDF and render first page
            const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Create canvas to render PDF page
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Failed to get canvas context');
            }
            
            // Render PDF page to canvas
            await page.render({ 
              canvasContext: ctx, 
              viewport: viewport,
              intent: 'display'
            } as Parameters<typeof page.render>[0]).promise;
            
            // Convert canvas to data URL
            const dataURL = canvas.toDataURL('image/jpeg', 0.9);
            
            // Calculate image dimensions to fit within PDF page
            const maxWidth = 150;
            const maxHeight = 100;
            let imgWidth = viewport.width;
            let imgHeight = viewport.height;
            
            // Scale down if too large
            if (imgWidth > maxWidth) {
              imgHeight = (imgHeight * maxWidth) / imgWidth;
              imgWidth = maxWidth;
            }
            if (imgHeight > maxHeight) {
              imgWidth = (imgWidth * maxHeight) / imgHeight;
              imgHeight = maxHeight;
            }
            
            // Add image to PDF
            doc.addImage(dataURL, 'JPEG', 14, y, imgWidth, imgHeight);
            y += imgHeight + 10;
            
            // Check if we need a new page
            if (y > 250) {
              doc.addPage();
              y = 20;
            }
          } catch (error) {
            console.error('Error rendering PDF receipt:', error);
            doc.text(`[PDF Receipt could not be rendered: ${url}]`, 14, y);
            y += 8;
          }
        } else {
          // For other files, add a link
          doc.textWithLink(`File Receipt ${i + 1}`, 14, y, { url });
          y += 8;
        }
      }
    } else {
      doc.text('No receipt uploaded.', 14, y); y += 8;
    }
    
    doc.save(`Financial_Record_${record.type}_${formatDate(record.createdAt)}.pdf`);
  }

  async function handleDownloadDepositPDF(contract: ContractRow) {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(18);
    doc.text('Deposit Record', 105, y, { align: 'center' });
    y += 12;
    doc.setFontSize(12);
    doc.text(`Tenant: ${contract.tenantName}`, 14, y); y += 8;
    doc.text(`Unit: ${contract.unitNumber || '-'}`, 14, y); y += 8;
    doc.text(`Security Deposit: RM${(contract.securityDeposit || 0).toFixed(2)}`, 14, y); y += 8;
    doc.text(`Utility Deposit: RM${(contract.utilityDeposit || 0).toFixed(2)}`, 14, y); y += 8;
    doc.text(`Key Deposit: RM${(contract.accessCardDeposit || 0).toFixed(2)}`, 14, y); y += 8;
    const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
    doc.text(`Total: RM${total.toFixed(2)}`, 14, y); y += 8;
    doc.text(`Start Date: ${new Date(contract.startDate).toLocaleDateString()}`, 14, y); y += 8;
    doc.text(`Expiry Date: ${new Date(contract.expiryDate).toLocaleDateString()}`, 14, y); y += 8;
    doc.text(`Generated: ${dayjs().format('YYYY-MM-DD HH:mm')}`, 14, y); y += 8;
    doc.save(`Deposit_${contract.tenantName}_${dayjs().format('YYYYMMDD')}.pdf`);
  }

  function exportExpensesToCSV() {
    const header = ['Date', 'Purpose', 'Category', 'Type', 'Amount', 'Description'];
    const rows = filteredRecords.map(record => [
      formatDate(record.recordDate || record.createdAt),
      record.purpose || '-',
      record.category || '-',
      record.type,
      record.amount.toFixed(2),
      `"${(record.description || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `expenses_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
  }

  function exportExpensesToPDF() {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Expenses & Deposits Management - Expenses Table', 14, y);
    y += 10;
    doc.setFontSize(10);
    filteredRecords.forEach(record => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${formatDate(record.recordDate || record.createdAt)} • ${record.purpose || '-'} • ${record.category || '-'} • ${record.type.toUpperCase()} • RM${record.amount.toFixed(2)} • ${record.description || '-'}`, 14, y);
      y += 6;
    });
    doc.save(`expenses_table_${dayjs().format('YYYYMMDD_HHmm')}.pdf`);
  }

  function exportDepositsToCSV() {
    const header = ['Tenant', 'Unit', 'Security', 'Utility', 'Key', 'Total', 'Start Date', 'Expiry Date', 'Days Remaining', 'Status'];
    const rows = filteredDeposits.map(contract => {
      const { status, daysRemaining } = getContractExpiryStatus(String(contract.expiryDate));
      const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
      return [
        contract.tenantName,
        contract.unitNumber || '-',
        contract.securityDeposit.toFixed(2),
        contract.utilityDeposit.toFixed(2),
        (contract.accessCardDeposit || 0).toFixed(2),
        total.toFixed(2),
        dayjs(contract.startDate).format('YYYY-MM-DD'),
        dayjs(contract.expiryDate).format('YYYY-MM-DD'),
        daysRemaining >= 0 ? daysRemaining : 0,
        status,
      ];
    });
    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `deposits_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
  }

  function exportDepositsToPDF() {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Deposits & Contracts Tracking - Table', 14, y);
    y += 10;
    doc.setFontSize(10);
    filteredDeposits.forEach(contract => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const { label, daysRemaining } = getContractExpiryStatus(String(contract.expiryDate));
      const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
      doc.text(
        `${contract.tenantName} (${contract.unitNumber || '-'}) • Total RM${total.toFixed(2)} • Expires ${dayjs(contract.expiryDate).format('YYYY-MM-DD')} • ${label} (${Math.max(daysRemaining, 0)} days)`,
        14,
        y
      );
      y += 6;
    });
    doc.save(`deposits_table_${dayjs().format('YYYYMMDD_HHmm')}.pdf`);
  }

  function openRefundModal(contract: ContractRow) {
    const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
    setRefundForm({
      amount: total.toFixed(2),
      date: dayjs().format('YYYY-MM-DD'),
      notes: '',
    });
    setRefundModal({ open: true, contract });
  }

  function closeRefundModal() {
    setRefundModal({ open: false });
  }

  function handleRefundSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Placeholder for integration with backend refund workflow
    closeRefundModal();
    alert(`Refund of RM${refundForm.amount} scheduled on ${refundForm.date}${refundForm.notes ? ` (${refundForm.notes})` : ''}.`);
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6 flex justify-start">
        <Link href="/dashboard">
          <span className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">&larr; Back to Dashboard</span>
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Financial Management</h1>
      
      {/* Tab Navigation */}
      <div className="mb-8 flex justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-1 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'expenses' 
                ? 'bg-green-100 text-green-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaCreditCard className="w-4 h-4" />
            Expenses Management
          </button>
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'deposits' 
                ? 'bg-green-100 text-green-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaHandHoldingUsd className="w-4 h-4" />
            Deposits & Contracts Tracking
          </button>
          <button
            onClick={() => setActiveTab('rentals')}
            className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'rentals' 
                ? 'bg-green-100 text-green-700 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaFileInvoiceDollar className="w-4 h-4" />
            Rental Income Tracking
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-3xl font-bold text-red-600">RM{totalExpenses.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaCreditCard className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits Held</p>
              <p className="text-3xl font-bold text-blue-600">RM{totalDepositsHeld.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaFileInvoiceDollar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Active Tenants</p>
              <p className="text-3xl font-bold text-green-700">{totalActiveTenants}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaWallet className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contracts Expiring This Month</p>
              <p className="text-3xl font-bold text-amber-600">{contractsExpiringThisMonth}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <FaHandHoldingUsd className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-green-600">RM{totalIncome.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaWallet className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Balance</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                RM{balance.toFixed(2)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <FaWallet className={`w-6 h-6 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'expenses' && (
        <>
          {/* Analytics */}
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie 
                    data={categoryData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`RM${value}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold mb-4">Monthly Financial Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Legend />
                  <RechartsTooltip formatter={(value) => [`RM${value}`, 'Amount']} />
                  <Bar dataKey="expense" fill="#EF4444" name="Expenses" />
                  <Bar dataKey="income" fill="#16A34A" name="Income" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'deposits' && (
        <section className="space-y-6">
          {depositAlerts.length > 0 && (
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FaBell className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Automated Alerts</h3>
                  <p className="text-sm text-gray-500">Upcoming contract expiries & refund reminders</p>
                </div>
              </div>
              <ul className="space-y-2">
                {depositAlerts.map((alertMessage, idx) => (
                  <li key={idx} className="text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-md px-4 py-2">
                    {alertMessage}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Deposits & Contracts Tracking</h3>
                <p className="text-sm text-gray-500">Monitor every tenant deposit, expiry, and refund readiness.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={exportDepositsToCSV} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
                  Export CSV
                </button>
                <button onClick={exportDepositsToPDF} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
                  Export PDF
                </button>
              </div>
            </div>
            <div className="p-6 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Search tenant or unit..."
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                value={depositSearch}
                onChange={e => setDepositSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
              >
                {unitOptions.map(unit => (
                  <option key={unit} value={unit}>{unit === 'All' ? 'All Units' : unit}</option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                value={expiryFilter}
                onChange={e => setExpiryFilter(e.target.value as 'all' | '30' | 'expired')}
              >
                <option value="all">All Contracts</option>
                <option value="30">Expiring in &lt; 30 days</option>
                <option value="expired">Expired</option>
              </select>
              <button
                onClick={() => {
                  setDepositSearch('');
                  setUnitFilter('All');
                  setExpiryFilter('all');
                }}
                className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Reset Filters
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Security Deposit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utility Deposit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key Deposit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDeposits.map(contract => {
                    const { status, daysRemaining, label } = getContractExpiryStatus(String(contract.expiryDate));
                    const total = (contract.securityDeposit || 0) + (contract.utilityDeposit || 0) + (contract.accessCardDeposit || 0);
                    return (
                      <tr key={contract.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{contract.tenantName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{contract.unitNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">RM{contract.securityDeposit.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">RM{contract.utilityDeposit.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">RM{(contract.accessCardDeposit || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">RM{total.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dayjs(contract.startDate).format('YYYY-MM-DD')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dayjs(contract.expiryDate).format('YYYY-MM-DD')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.max(daysRemaining, 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getExpiryBadgeClass(status)}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleDownloadDepositPDF(contract)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            >
                              <FaDownload className="w-3 h-3" />
                              PDF
                            </button>
                            <button
                              onClick={() => openRefundModal(contract)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Prepare Refund
                            </button>
                            <Link href="/dashboard/contracts" className="text-indigo-600 hover:text-indigo-900">
                              Renew Contract
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredDeposits.length === 0 && (
              <div className="text-center py-8 text-gray-500">No deposit records match the filters.</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {depositsByUnit.map(({ unit, total }) => (
              <div key={unit} className="bg-white border rounded-lg shadow-sm p-4">
                <p className="text-sm text-gray-500">{unit}</p>
                <p className="text-2xl font-semibold text-gray-900">RM{total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'rentals' && (
        <section className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Rental Income Tracking</h3>
                <p className="text-sm text-gray-500">Monitor rental income by unit and tenant.</p>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Search by unit or tenant..."
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={rentalSearch}
                  onChange={e => setRentalSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Rent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoices</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract Period</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rentalIncome
                    .filter(rental => {
                      if (!rentalSearch) return true;
                      const searchLower = rentalSearch.toLowerCase();
                      return (
                        String(rental.unitNumber || '').toLowerCase().includes(searchLower) ||
                        String(rental.tenantName || '').toLowerCase().includes(searchLower)
                      );
                    })
                    .map((rental, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{String(rental.unitNumber ?? '-')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{String(rental.tenantName ?? '-')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">RM{Number(rental.monthlyRent).toLocaleString() || '0.00'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">RM{Number(rental.totalPaid).toLocaleString() || '0.00'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">RM{Number(rental.totalPending).toLocaleString() || '0.00'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(rental.invoiceCount) || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {rental.lastPaymentDate ? dayjs(rental.lastPaymentDate as string | number).format('YYYY-MM-DD') : 'No payments yet'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {rental.contractStartDate && rental.contractExpiryDate ? (
                            <div>
                              <div>{dayjs(rental.contractStartDate as string | number).format('YYYY-MM-DD')}</div>
                              <div className="text-xs text-gray-500">to {dayjs(rental.contractExpiryDate as string | number).format('YYYY-MM-DD')}</div>
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {rentalIncome.filter(r => {
              if (!rentalSearch) return true;
              const searchLower = rentalSearch.toLowerCase();
              return (
                String(r.unitNumber || '').toLowerCase().includes(searchLower) ||
                String(r.tenantName || '').toLowerCase().includes(searchLower)
              );
            }).length === 0 && (
              <div className="text-center py-8 text-gray-500">No rental income records found.</div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <p className="text-sm font-medium text-gray-600">Total Monthly Rental Income</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                RM{rentalIncome.reduce((sum, r) => sum + (Number(r.monthlyRent) || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">From {rentalIncome.length} active rental{rentalIncome.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <p className="text-sm font-medium text-gray-600">Total Paid (All Time)</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                RM{rentalIncome.reduce((sum, r) => sum + (Number(r.totalPaid) || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Cumulative rental payments</p>
            </div>
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <p className="text-sm font-medium text-gray-600">Total Pending</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                RM{rentalIncome.reduce((sum, r) => sum + (Number(r.totalPending) || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Outstanding rental payments</p>
            </div>
          </div>
        </section>
      )}

      {refundModal.open && refundModal.contract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Prepare Refund</h3>
              <button onClick={closeRefundModal} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <form className="space-y-4" onSubmit={handleRefundSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                <p className="text-gray-900">{refundModal.contract.tenantName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount (RM)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={refundForm.amount}
                  onChange={e => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={refundForm.date}
                  onChange={e => setRefundForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Add any internal notes..."
                  value={refundForm.notes}
                  onChange={e => setRefundForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeRefundModal} className="px-4 py-2 border rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Save Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <>
          {/* Add Record Form */}
          <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaPlus className="w-5 h-5" />
              Record Expense / Deposit
            </h3>
            
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                  >
                    {expensePurposes.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {currentCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={type}
                    onChange={e => setType(e.target.value as 'expense' | 'income')}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={recordDate}
                    onChange={e => setRecordDate(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Upload</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    onChange={e => setReceipts(Array.from(e.target.files || []))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  placeholder="Add quick notes i.e. replaced foyer lighting..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              
              {error && <div className="text-red-600 text-sm">{error}</div>}
              
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                disabled={uploading}
              >
                {uploading ? 'Saving...' : 'Save Record'}
              </button>
            </form>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Expenses & Deposits Records</h3>
                  <p className="text-sm text-gray-500">Color-coded for quick visibility. Export anytime.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={exportExpensesToCSV} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
                    Export CSV
                  </button>
                  <button onClick={exportExpensesToPDF} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
                    Export PDF
                  </button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mt-4">
                <input
                  type="text"
                  placeholder="Search purpose or description..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {currentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as 'all' | 'expense' | 'income')}
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.recordDate || record.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isIncomeType(record) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {record.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.purpose || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className={isIncomeType(record) ? 'text-green-600' : 'text-red-600'}>
                          RM{record.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDownloadPDF(record)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          >
                            <FaDownload className="w-3 h-3" />
                            PDF
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1"
                          >
                            <FaTrash className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No records found. Add your first expense or income above.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

