'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Tenant } from '@/types';
import { mockTenants, mockInvoices, isFirebaseConfigured } from '@/lib/mockData';
import toast from 'react-hot-toast';
import { FaChevronDown, FaArrowLeft } from 'react-icons/fa';

// Add Contract type for contract fetch
interface ContractDoc {
  id: string;
  expiryDate?: string;
  rentalPerMonth?: number | string;
}

const allStatusOptions: Invoice['status'][] = ['unpaid', 'paid', 'overdue', 'queried', 'pending_payment', 'pending_approval', 'rejected'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function safeDate(date: unknown): string {
  if (!date) return 'N/A';
  let dateObj: Date;
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    dateObj = (date as { toDate(): Date }).toDate();
  } else if (typeof date === 'object' && date !== null && 'seconds' in date) {
    dateObj = new Date((date as { seconds: number }).seconds * 1000);
  } else {
    dateObj = new Date(date as string | number | Date);
  }
  return dateObj.toLocaleDateString();
}

export default function InvoicesPage() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'tenant' | 'service'>('all');
  const [search, setSearch] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [lineItems, setLineItems] = useState<{ description: string; amount: number }[]>([
    { description: 'Rent', amount: 0 },
    { description: 'Water Bill', amount: 0 },
    { description: 'Electricity Bill', amount: 0 }
  ]);
  const [tax, setTax] = useState(0);
  const [dueDate, setDueDate] = useState('');

  const updateLineItem = useCallback((idx: number, field: string, value: string | number) =>
    setLineItems(currentLineItems =>
      currentLineItems.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    ), []);

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      // Check if Firebase is properly configured
      if (!isFirebaseConfigured()) {
        console.log('Firebase not configured, using mock data');
        setLoading(true);
        try {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          setTenants(mockTenants);
          setInvoices(mockInvoices);
          console.log('Mock data loaded:', mockTenants.length, 'tenants,', mockInvoices.length, 'invoices');
        } catch (error) {
          console.error('Failed to load mock data:', error);
          setTenants([]);
          setInvoices([]);
        } finally {
          setLoading(false);
        }
        return;
      }
      
      let retryCount = 0;
      const maxRetries = 3;
      
      const attemptFetch = async (): Promise<void> => {
        try {
          setLoading(true);
          console.log('Fetching tenants and invoices... (attempt', retryCount + 1, ')');
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 10000)
          );
          
          const fetchPromise = async () => {
            const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
            const tenantsSnap = await getDocs(tenantsQuery);
            const tenantsData = tenantsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Tenant[];
            console.log('Tenants loaded:', tenantsData.length);
            setTenants(tenantsData);

            const invoicesQuery = (user.role === 'admin' || user.role === 'agent')
              ? query(collection(db, 'invoices'))
              : query(collection(db, 'invoices'), where('tenantId', '==', user.id));
            const invoicesSnap = await getDocs(invoicesQuery);
            const invoicesData = invoicesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Invoice[];
            console.log('Invoices loaded:', invoicesData.length);
            setInvoices(invoicesData);
          };
          
          await Promise.race([fetchPromise(), timeoutPromise]);
          
        } catch (error) {
          console.error('Failed to fetch data (attempt', retryCount + 1, '):', error);
          
          if (retryCount < maxRetries) {
            retryCount++;
            console.log('Retrying in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return attemptFetch();
          } else {
            console.error('All retry attempts failed, falling back to mock data');
            toast.error('Failed to load data from Firebase. Using demo data instead.');
            // Fallback to mock data
            setTenants(mockTenants);
            setInvoices(mockInvoices);
          }
        } finally {
          setLoading(false);
        }
      };
      
      attemptFetch();
    }
    fetchData();
  }, [user]);

  // When tenant is selected, pre-fill Rent from their contract (monthly fixed rent); field stays editable
  useEffect(() => {
    if (!tenantId) return;
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const setRentFromValue = (rent: number) => {
      setLineItems(prev =>
        prev.map(item => (item.description === 'Rent' ? { ...item, amount: rent } : item))
      );
    };

    // Mock / no Firebase: use tenant's rentAmount from loaded tenants
    if (!isFirebaseConfigured()) {
      const rent = Number((tenant as Tenant).rentAmount) || 0;
      setRentFromValue(rent);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'contracts'),
          where('tenantId', '==', tenantId)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const contracts = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractDoc & { status?: string; createdAt?: unknown; rentalPerMonth?: number | string }));
        // Use any contract for this tenant (prefer active); sort by createdAt desc, take most recent
        const sorted = [...contracts].sort((a, b) => {
          const aT = a.createdAt != null ? (typeof a.createdAt === 'object' && a.createdAt !== null && 'toDate' in a.createdAt ? (a.createdAt as { toDate(): Date }).toDate().getTime() : new Date(a.createdAt as string).getTime()) : 0;
          const bT = b.createdAt != null ? (typeof b.createdAt === 'object' && b.createdAt !== null && 'toDate' in b.createdAt ? (b.createdAt as { toDate(): Date }).toDate().getTime() : new Date(b.createdAt as string).getTime()) : 0;
          return bT - aT;
        });
        const preferred = sorted.find(c => ['pending', 'signed', 'active'].includes(c.status ?? '')) ?? sorted[0];
        const contractRent = preferred ? Number(preferred.rentalPerMonth) || 0 : 0;
        const rent = contractRent || Number((tenant as Tenant).rentAmount) || 0;
        if (!cancelled) setRentFromValue(rent);
      } catch (err) {
        console.warn('Invoice rent pre-fill: contract fetch failed', err);
        if (!cancelled) {
          const fallbackRent = Number((tenant as Tenant).rentAmount) || 0;
          setRentFromValue(fallbackRent);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, tenants]);

  const addLineItem = () => setLineItems([...lineItems, { description: '', amount: 0 }]);
  const removeLineItem = (idx: number) => setLineItems(lineItems.length > 1 ? lineItems.filter((_, i) => i !== idx) : lineItems);

  const subtotal = lineItems.reduce((acc, item) => acc + Number(item.amount), 0);
  const totalAmount = subtotal + (subtotal * (tax / 100));

  // Default due date to 15th of the selected month (payment in the middle of the month)
  useEffect(() => {
    if (month && year) {
      const monthNum = MONTH_NAMES.indexOf(month) + 1;
      if (monthNum >= 1 && monthNum <= 12) {
        const padded = String(monthNum).padStart(2, '0');
        setDueDate(prev => {
          const proposed = `${year}-${padded}-15`;
          if (!prev || prev.slice(0, 7) !== `${year}-${padded}`) return proposed;
          return prev;
        });
      }
    }
  }, [month, year]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'tenantId') setTenantId(value);
    if (name === 'month') setMonth(value);
    if (name === 'year') setYear(Number(value));
    if (name === 'tax') setTax(Number(value));
    if (name === 'dueDate') setDueDate(value);
  };

  const handleAdminStatusChange = async (invoiceId: string, newStatus: string) => {
    const toastId = toast.loading('Updating status...');
    try {
        if (!isFirebaseConfigured()) {
          // Mock status update
          setInvoices(prev => prev.map(inv =>
              inv.id === invoiceId
                  ? { ...inv, status: newStatus as Invoice['status'], isPaid: newStatus === 'paid' }
                  : inv
          ));
          toast.success('Status updated. (Demo mode)', { id: toastId });
          return;
        }

        await updateDoc(doc(db, 'invoices', invoiceId), {
            status: newStatus,
            isPaid: newStatus === 'paid'
        });

        setInvoices(prev => prev.map(inv =>
            inv.id === invoiceId
                ? { ...inv, status: newStatus as Invoice['status'], isPaid: newStatus === 'paid' }
                : inv
        ));
        toast.success('Status updated.', { id: toastId });
    } catch {
        toast.error('Failed to update status.', { id: toastId });
    }
  };

  const handleStatusRequest = async (invoice: Invoice, approve: boolean) => {
    const requestedStatus = invoice.statusChangeRequest?.requestedStatus;
    if (!requestedStatus) return;

    const toastId = toast.loading(approve ? 'Approving...' : 'Rejecting...');

    try {
        if (!isFirebaseConfigured()) {
          // Mock status request handling
          setInvoices(prev => prev.map(inv => {
              if (inv.id === invoice.id) {
                  const updatedInv = { ...inv, statusChangeRequest: undefined };
                  if (approve) {
                      updatedInv.status = requestedStatus as Invoice['status'];
                      updatedInv.isPaid = requestedStatus === 'paid';
                  }
                  return updatedInv;
              }
              return inv;
          }));
          toast.success(approve ? 'Status change approved (Demo mode)' : 'Status change rejected (Demo mode)', { id: toastId });
          return;
        }

        const updateData: Partial<Invoice> = {
            statusChangeRequest: null 
        };

        if (approve) {
            updateData.status = requestedStatus as Invoice['status'];
            updateData.isPaid = requestedStatus === 'paid';
        }

        await updateDoc(doc(db, 'invoices', invoice.id), updateData);
        
        setInvoices(prev => prev.map(inv => {
            if (inv.id === invoice.id) {
                const updatedInv = { ...inv, statusChangeRequest: undefined };
                if (approve) {
                    updatedInv.status = requestedStatus as Invoice['status'];
                    updatedInv.isPaid = requestedStatus === 'paid';
                }
                return updatedInv;
            }
            return inv;
        }));
        
        toast.success(approve ? 'Status change approved' : 'Status change rejected', { id: toastId });
    } catch {
        toast.error('Failed to update invoice status');
    }
  };

  const handleNumberChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => setter(Number(e.target.value));

  const resetForm = () => {
    setIsEditing(null);
    setTenantId('');
    setMonth('');
    setYear(new Date().getFullYear());
    setLineItems([
      { description: 'Rent', amount: 0 },
      { description: 'Water Bill', amount: 0 },
      { description: 'Electricity Bill', amount: 0 },
    ]);
    setTax(0);
    setDueDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !month || !year) {
      alert('Please fill all fields.');
      return;
    }

    const newInvoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
      tenantId,
      month,
      year,
      lineItems,
      tax,
      subtotal,
      totalAmount,
      status: 'unpaid',
      isPaid: false,
      dueDate,
      utilities: {
        water: lineItems.find(i => i.description === 'Water Bill')?.amount || 0,
        electricity: lineItems.find(i => i.description === 'Electricity Bill')?.amount || 0,
        internet: lineItems.find(i => i.description === 'Internet Bill')?.amount || 0,
      },
      rentAmount: lineItems.find(i => i.description === 'Rent')?.amount || 0,
    };

    try {
      if (!isFirebaseConfigured()) {
        // Mock invoice creation
        const newInvoice: Invoice = {
          id: `inv_${Date.now()}`,
          ...newInvoiceData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setInvoices(prev => [...prev, newInvoice]);
        alert('Invoice created successfully! (Demo mode)');
        resetForm();
        setShowForm(false);
        return;
      }

      await addDoc(collection(db, 'invoices'), {
        ...newInvoiceData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert('Invoice created successfully!');
      resetForm();
      setShowForm(false);
      
      const invoicesQuery = (user?.role === 'admin' || user?.role === 'agent')
        ? query(collection(db, 'invoices'))
        : query(collection(db, 'invoices'), where('tenantId', '==', user?.id));
      const invoicesSnap = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Invoice[];
      setInvoices(invoicesData);
    } catch {
      console.error('Failed to create invoice');
      alert('Failed to create invoice.');
    }
  };

  const handleEdit = (inv: Invoice) => {
    setIsEditing(inv.id);
    setTenantId(inv.tenantId);
    setMonth(inv.month);
    setYear(inv.year);
    setLineItems(inv.lineItems);
    setTax(inv.tax);
    setDueDate(inv.dueDate as string);
    setShowForm(true);
  };

  const handleDelete = async (inv: Invoice) => {
    if (!user || user.role !== 'admin') return;
    if (!confirm(`Delete invoice #${String(inv.id).slice(-6).toUpperCase()}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'invoices', String(inv.id)));
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      toast.success('Invoice deleted');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Failed to delete invoice');
    }
  };

  const handleExportSingleInvoicePDF = async (invoice: Invoice) => {
    const tenant = tenants.find(t => t.id === invoice.tenantId);

    const isServiceInvoice = !!invoice.fromId;
    
    if (!isServiceInvoice && !tenant) {
      toast.error("Tenant details not found for this invoice.");
      return;
    }

    const [{ default: jsPDF }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.text(`Invoice: ${invoice.id}`, 14, 16);
    
    const from = isServiceInvoice ? invoice.from : 'Admin';
    const to = isServiceInvoice ? 'Admin' : tenant?.fullName || 'N/A';

    doc.text(`From: ${from}`, 14, 22);
    doc.text(`To: ${to}`, 14, 28);
    doc.text(`Date: ${safeDate(invoice.invoiceDate || invoice.createdAt)}`, 14, 34);
    
    const tableBody = invoice.lineItems?.map(item => [item.description, `RM ${isNaN(Number(item.amount)) ? '0.00' : Number(item.amount).toFixed(2)}`]) || [[invoice.description, `RM ${isNaN(Number(invoice.totalAmount)) ? '0.00' : Number(invoice.totalAmount).toFixed(2)}`]];
    
    (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
      startY: 45,
      head: [['Description', 'Amount']],
      body: tableBody,
      foot: [['Total', `RM ${isNaN(Number(invoice.totalAmount)) ? '0.00' : Number(invoice.totalAmount).toFixed(2)}`]]
    });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  // Filtering by type
  const filteredByType = invoices.filter(inv => {
    if (typeFilter === 'tenant') return !!inv.tenantId;
    if (typeFilter === 'service') return !!inv.fromId;
    return true;
  });
  // Search filter
  const searchedInvoices = filteredByType.filter(inv => {
    const idMatch = String(inv.id).toLowerCase().includes(search.toLowerCase());
    const payerName = inv.tenantId
      ? tenants.find(t => t.id === inv.tenantId)?.fullName || ''
      : inv.from || '';
    const nameMatch = payerName.toLowerCase().includes(search.toLowerCase());
    const statusMatch = (inv.status || '').toLowerCase().includes(search.toLowerCase());
    const dateStr = (inv.invoiceDate || inv.createdAt || '').toString();
    const dateMatch = dateStr.toLowerCase().includes(search.toLowerCase());
    return idMatch || nameMatch || statusMatch || dateMatch;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const isInvoiceStaff = user?.role === 'admin' || user?.role === 'agent';

  // Admin / agent UI (same data access as fetch)
  if (isInvoiceStaff) {
    return (
      <div className="w-full min-w-0 max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1">
              <FaArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Invoices</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 sm:px-6 rounded-lg shadow hover:bg-indigo-700 transition text-sm sm:text-base w-full sm:w-auto">
              {showForm ? 'Close Form' : 'Create New Invoice'}
            </button>
          </div>
        </div>
        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | 'tenant' | 'service')} className="border rounded px-3 py-2">
            <option value="all">All</option>
            <option value="tenant">Tenant Invoices</option>
            <option value="service">Service Provider Invoices</option>
          </select>
          <input
            type="text"
            placeholder="Search by ID, payer, status, date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full md:w-80"
          />
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold col-span-full">{isEditing ? 'Edit Invoice' : 'New Invoice'}</h2>
            
            <div className="col-span-1">
              <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
              <select id="tenantId" name="tenantId" value={tenantId} onChange={handleFormChange} className="w-full border-gray-300 rounded-lg shadow-sm">
                <option value="">Select Tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            </div>
            
            <div className="col-span-1">
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                id="month"
                name="month"
                value={month}
                onChange={handleFormChange}
                className="w-full border-gray-300 rounded-lg shadow-sm"
                required
              >
                <option value="">Select Month</option>
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>
            <div className="col-span-1">
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" id="year" name="year" value={year} onChange={handleFormChange} className="w-full border-gray-300 rounded-lg shadow-sm" />
            </div>

            <div className="col-span-full">
              <h3 className="text-lg font-semibold mb-2">Line Items</h3>
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 mb-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    className="flex-grow border-gray-300 rounded-lg shadow-sm"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => updateLineItem(idx, 'amount', Number(e.target.value))}
                    className="w-32 border-gray-300 rounded-lg shadow-sm"
                  />
                  <button type="button" onClick={() => removeLineItem(idx)} className="text-red-500 hover:text-red-700">&times;</button>
                </div>
              ))}
              <button type="button" onClick={addLineItem} className="text-sm text-indigo-600 hover:underline">+ Add Item</button>
            </div>
            
            <div className="col-span-1">
              <label htmlFor="tax" className="block text-sm font-medium text-gray-700 mb-1">Tax (%)</label>
              <input type="number" id="tax" name="tax" value={tax} onChange={handleNumberChange(setTax)} className="w-full border-gray-300 rounded-lg shadow-sm" />
            </div>
            <div className="col-span-1">
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" id="dueDate" name="dueDate" value={dueDate} onChange={handleFormChange} className="w-full border-gray-300 rounded-lg shadow-sm" />
            </div>
            
            <div className="col-span-full flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-4">
              <div className="font-bold text-lg sm:text-xl">Total: RM {isNaN(Number(totalAmount)) ? '0.00' : Number(totalAmount).toFixed(2)}</div>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 sm:px-8 sm:py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition text-sm sm:text-base">
                {isEditing ? 'Update Invoice' : 'Create Invoice'}
              </button>
        </div>
          </form>
        )}
        
        <div className="bg-white rounded-xl shadow-sm min-w-0">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 p-4 sm:p-6">Invoices</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] sm:min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchedInvoices.map(inv => {
                  const isServiceInvoice = !!inv.fromId;
                  const fromName = isServiceInvoice ? inv.from : 'Admin';
                  const toName = isServiceInvoice ? inv.to : tenants.find(t => t.id === inv.tenantId)?.fullName || 'N/A';
                  const description = isServiceInvoice ? inv.description : `Rent for ${inv.month}, ${inv.year}`;
                  const date = safeDate(inv.invoiceDate || inv.createdAt);
                  const request = inv.statusChangeRequest;
                  return (
                    <tr key={inv.id} className={`hover:bg-gray-50 transition ${request ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        {inv.tenantId && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Tenant</span>}
                        {inv.fromId && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Service Provider</span>}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap max-w-[80px] sm:max-w-none truncate" title={fromName}>{fromName}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap max-w-[80px] sm:max-w-none truncate" title={toName}>{toName}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 max-w-[100px] sm:max-w-none truncate" title={description}>{description}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-medium text-xs sm:text-sm">RM {isNaN(Number(inv.totalAmount)) ? '0.00' : Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="relative">
                          <select
                            value={inv.status}
                            onChange={(e) => handleAdminStatusChange(inv.id, e.target.value)}
                            className={`w-full appearance-none pl-3 pr-8 py-1 text-xs font-semibold rounded-full border-none focus:ring-0 cursor-pointer ${
                              inv.status === 'paid' || inv.isPaid ? 'bg-green-100 text-green-700' : 
                              inv.status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' : 
                              inv.status === 'pending_payment' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}
                          >
                            {allStatusOptions.map(status => (
                              <option key={status} value={status} className="bg-white text-gray-900">
                                {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <FaChevronDown className="h-3 w-3" />
                          </div>
                        </div>
                        {request && (
                            <div className="text-xs text-blue-600 mt-1 animate-pulse font-semibold">
                                Requesting: {request.requestedStatus}
                            </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">{date}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                        {request ? (
                            <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleStatusRequest(inv, true)} className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700">Approve</button>
                                <button onClick={() => handleStatusRequest(inv, false)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700">Reject</button>
                            </div>
                        ) : (
                            <>
                                <button 
                                  onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  View
                                </button>
                                {!isServiceInvoice && (
                                  <button onClick={() => handleEdit(inv)} className="text-gray-500 hover:text-gray-700 ml-4">Edit</button>
                                )}
                                <button onClick={() => handleExportSingleInvoicePDF(inv)} className="text-green-600 hover:text-green-800 ml-4">
                                  Export
                                </button>
                                {user?.role === 'admin' && (
                                  <button onClick={() => handleDelete(inv)} className="text-red-600 hover:text-red-800 ml-4">
                                    Delete
                                  </button>
                                )}
                            </>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {searchedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">No invoices found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Tenant UI: Card view on mobile, table on desktop
  return (
    <div className="w-full min-w-0 max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-xl sm:text-2xl font-bold truncate">My Invoices</h2>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="block md:hidden space-y-4">
            {invoices.map(inv => (
              <div key={inv.id} className="bg-white rounded-lg shadow p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="font-semibold">Invoice #{inv.id.slice(-6).toUpperCase()}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inv.isPaid ? 'bg-green-100 text-green-700' : inv.receiptUrl ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{inv.isPaid ? 'Paid' : inv.receiptUrl ? 'Pending Review' : 'Unpaid'}</span>
                </div>
                <div className="text-xs text-gray-500">Due: {inv.dueDate ? new Date(inv.dueDate as string).toLocaleDateString() : '-'}</div>
                <div className="text-xs text-gray-500">Total: RM{isNaN(Number(inv.totalAmount)) ? '0.00' : Number(inv.totalAmount).toFixed(2)}</div>
                <button onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="mt-2 bg-blue-600 text-white rounded px-3 py-1 text-sm w-full">View Details</button>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-[480px] sm:min-w-full w-full bg-white rounded shadow text-xs sm:text-sm md:text-base">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Invoice #</th>
                  <th className="py-2 px-4 border-b">Due Date</th>
                  <th className="py-2 px-4 border-b">Total</th>
                  <th className="py-2 px-4 border-b">Status</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={String(inv.id)}>
                    <td className="py-2 px-4 border-b">{String(inv.id).slice(-6).toUpperCase()}</td>
                    <td className="py-2 px-4 border-b">{safeDate(inv.dueDate)}</td>
                    <td className="py-2 px-4 border-b">RM{isNaN(Number(inv.totalAmount)) ? '0.00' : Number(inv.totalAmount).toFixed(2)}</td>
                    <td className="py-2 px-4 border-b">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inv.isPaid ? 'bg-green-100 text-green-700' : inv.receiptUrl ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{inv.isPaid ? 'Paid' : inv.receiptUrl ? 'Pending Review' : 'Unpaid'}</span>
                    </td>
                    <td className="py-2 px-4 border-b">
                      <button onClick={() => router.push(`/dashboard/invoices/${String(inv.id)}`)} className="bg-blue-600 text-white rounded px-3 py-1 text-xs">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
} 