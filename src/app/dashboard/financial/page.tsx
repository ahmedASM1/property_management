'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import Image from 'next/image';
import { FaCreditCard, FaWallet, FaHandHoldingUsd, FaPlus, FaTrash, FaDownload, FaFileInvoiceDollar } from 'react-icons/fa';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import { createAdminNotification } from '@/utils/notificationUtils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs for browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Unified categories & purposes
const expenseCategories = ['Maintenance', 'Utilities', 'Shopping', 'Healthcare', 'Entertainment', 'Rent', 'Marketing', 'Office Supplies', 'Insurance', 'Other'];
const expensePurposes = ['Maintenance', 'Repair', 'Utility Bills', 'Marketing', 'Supplies', 'Service', 'Other'];
// Category sets per tab (fallback to expense categories for business/personal)
const businessCategories = expenseCategories;
const personalCategories = expenseCategories;
const loanCategories = ['Personal Loan', 'Business Loan', 'Security Deposit', 'Utility Deposit', 'Other'];

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
  borrower?: string;
  lender?: string;
  interestRate?: number;
  dueDate?: Date;
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
    map[month][r.type] += r.amount;
  });
  return Object.entries(map).map(([month, v]) => ({ month, ...v }));
}

function getBalanceData(records: FinancialRecord[]) {
  const sorted = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let balance = 0;
  return sorted.map(r => {
    if (r.type === 'income' || r.type === 'loan_received') {
      balance += r.amount;
    } else {
      balance -= r.amount;
    }
    return { date: dayjs(r.createdAt).format('YYYY-MM-DD'), balance };
  });
}

export default function FinancialManagementPage() {
  const [activeTab, setActiveTab] = useState<'business' | 'personal' | 'lending'>('business');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [purpose, setPurpose] = useState('Maintenance');
  const [type, setType] = useState<'expense' | 'income' | 'loan_given' | 'loan_received'>('expense');
  const [receipts, setReceipts] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [recordDate, setRecordDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'loan_given' | 'loan_received'>('all');
  // Lending fields
  const [borrower, setBorrower] = useState('');
  const [lender, setLender] = useState('');
  const [interestRate, setInterestRate] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState<string>('');

  useEffect(() => {
    fetchRecords();
    fetchContracts();
  }, []);

  async function fetchRecords() {
    const snapshot = await getDocs(collection(db, 'financial_records'));
    setRecords(snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        amount: data.amount,
        description: data.description,
        category: data.category,
        type: (data.type || 'expense') as 'expense' | 'income',
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
      const data: any = d.data();
      return {
        id: d.id,
        tenantName: data.tenantName || 'Unknown Tenant',
        unitNumber: data.unitNumber,
        securityDeposit: Number(data.securityDeposit || 0),
        utilityDeposit: Number(data.utilityDeposit || 0),
        accessCardDeposit: Number(data.accessCardDeposit || 0),
        startDate: data.moveInDate,
        expiryDate: data.expiryDate,
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

    const recordData: any = {
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

  const totalExpenses = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Filter records
  const filteredRecords = records.filter(record => {
    if (filterCategory !== 'All' && record.category !== filterCategory) return false;
    if (filterType !== 'all' && record.type !== filterType) return false;
    if (search && !(`${record.description} ${record.purpose || ''}`.toLowerCase().includes(search.toLowerCase()))) return false;
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
            const img = new Image();
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
            
            // Render PDF page to canvas
            await page.render({ canvasContext: ctx, viewport }).promise;
            
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
        <div className="bg-white rounded-lg shadow-sm border p-1 flex">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">RM{totalExpenses.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaCreditCard className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        
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
              <p className="text-sm font-medium text-gray-600">Total Deposits Held</p>
              <p className="text-2xl font-bold text-blue-600">RM{contracts.reduce((s,c)=>s + (c.securityDeposit||0)+(c.utilityDeposit||0)+(c.accessCardDeposit||0),0).toFixed(2)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaFileInvoiceDollar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contracts Expiring This Month</p>
              <p className={`text-2xl font-bold text-amber-600`}>
                {contracts.filter(c => dayjs(c.expiryDate).isSame(dayjs(), 'month')).length}
              </p>
            </div>
            <div className={`p-3 rounded-full bg-yellow-100`}>
              <FaHandHoldingUsd className={`w-6 h-6 text-yellow-600`} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
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
              <Bar dataKey="expense" fill="#FF4444" name="Expenses" />
              <Bar dataKey="income" fill="#00C49F" name="Income" />
              <Bar dataKey="loan_given" fill="#0088FE" name="Loans Given" />
              <Bar dataKey="loan_received" fill="#FFBB28" name="Loans Received" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Add Record Form */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FaPlus className="w-5 h-5" />
          Add New {activeTab === 'business' ? 'Business' : activeTab === 'personal' ? 'Personal' : 'Loan'} Record
        </h3>
        
        <form onSubmit={handleAddRecord} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                onChange={e => setType(e.target.value as any)}
              >
                {activeTab === 'lending' ? (
                  <>
                    <option value="loan_given">Loan Given</option>
                    <option value="loan_received">Loan Received</option>
                  </>
                ) : (
                  <>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </>
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipts</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="Enter description..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>
          
          {/* Loan-specific fields */}
          {activeTab === 'lending' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {type === 'loan_given' ? 'Borrower Name' : 'Lender Name'}
                </label>
                <input
                  type="text"
                  placeholder="Enter name..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={type === 'loan_given' ? borrower : lender}
                  onChange={e => type === 'loan_given' ? setBorrower(e.target.value) : setLender(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>
          )}
          
          {error && <div className="text-red-600 text-sm">{error}</div>}
          
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
            disabled={uploading}
          >
            {uploading ? 'Adding...' : 'Add Record'}
          </button>
        </form>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold mb-4">Records</h3>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Search description..."
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
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="all">All Types</option>
              {activeTab === 'lending' ? (
                <>
                  <option value="loan_given">Loan Given</option>
                  <option value="loan_received">Loan Received</option>
                </>
              ) : (
                <>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </>
              )}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                {activeTab === 'lending' && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrower/Lender</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      record.type === 'income' ? 'bg-green-100 text-green-800' :
                      record.type === 'expense' ? 'bg-red-100 text-red-800' :
                      record.type === 'loan_given' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.type.replace('_', ' ').charAt(0).toUpperCase() + record.type.replace('_', ' ').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={record.type === 'income' || record.type === 'loan_received' ? 'text-green-600' : 'text-red-600'}>
                      RM{record.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {record.description}
                  </td>
                  {activeTab === 'lending' && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.borrower || record.lender || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.interestRate ? `${record.interestRate}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.dueDate ? formatDate(record.dueDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={record.status || 'active'}
                          onChange={e => handleUpdateLoanStatus(record.id, e.target.value as any)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="active">Active</option>
                          <option value="paid">Paid</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
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
            No records found. Add your first {activeTab} record above.
          </div>
        )}
      </div>
    </div>
  );
}

