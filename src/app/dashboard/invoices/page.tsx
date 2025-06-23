'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Tenant } from '@/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';
import { FaChevronDown, FaArrowLeft } from 'react-icons/fa';

// Add Contract type for contract fetch
interface ContractDoc {
  id: string;
  expiryDate?: string;
  rentalPerMonth?: number | string;
}

const allStatusOptions: Invoice['status'][] = ['unpaid', 'paid', 'overdue', 'queried', 'pending_payment', 'pending_approval', 'rejected'];

function safeDate(date: any): string {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return d.toLocaleDateString();
}

export default function InvoicesPage() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Filtering
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
      setLoading(true);
        const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
        const tenantsSnap = await getDocs(tenantsQuery);
        const tenantsData = tenantsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Tenant[];
        setTenants(tenantsData);

        const invoicesQuery = user.role === 'admin'
          ? query(collection(db, 'invoices'))
          : query(collection(db, 'invoices'), where('tenantId', '==', user.id));
        const invoicesSnap = await getDocs(invoicesQuery);
        const invoicesData = invoicesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Invoice[];

        setInvoices(invoicesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  useEffect(() => {
    async function fetchContract() {
      if (!tenantId) return;
      const tenant = tenants.find(t => t.id === tenantId);
      if (!tenant) return;
      
      try {
        const contractSnap = await getDoc(doc(db, 'contracts', tenant.id));
        if (contractSnap.exists()) {
          const contractData = contractSnap.data() as ContractDoc;
          const rent = Number(contractData.rentalPerMonth) || 0;
          updateLineItem(0, 'amount', rent);
        } else {
          updateLineItem(0, 'amount', 0);
        }
      } catch {
        updateLineItem(0, 'amount', 0);
      }
    }
    fetchContract();
  }, [tenantId, tenants]);

  const addLineItem = () => setLineItems([...lineItems, { description: '', amount: 0 }]);
  const removeLineItem = (idx: number) => setLineItems(lineItems.length > 1 ? lineItems.filter((_, i) => i !== idx) : lineItems);
  const updateLineItem = (idx: number, field: string, value: any) =>
    setLineItems(lineItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const subtotal = lineItems.reduce((acc, item) => acc + Number(item.amount), 0);
  const totalAmount = subtotal + (subtotal * (tax / 100));

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
    } catch (error) {
        toast.error('Failed to update status.', { id: toastId });
    }
  };

  const handleStatusRequest = async (invoice: Invoice, approve: boolean) => {
    const requestedStatus = invoice.statusChangeRequest?.requestedStatus;
    if (!requestedStatus) return;

    const toastId = toast.loading(approve ? 'Approving...' : 'Rejecting...');

    try {
        const updateData: any = {
            statusChangeRequest: null 
        };

        if (approve) {
            updateData.status = requestedStatus;
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
        
        toast.success(`Request ${approve ? 'approved' : 'rejected'}.`, { id: toastId });
    } catch (error) {
        toast.error('Action failed.', { id: toastId });
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
      await addDoc(collection(db, 'invoices'), {
        ...newInvoiceData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert('Invoice created successfully!');
      resetForm();
      setShowForm(false);
      
      const invoicesQuery = user?.role === 'admin'
        ? query(collection(db, 'invoices'))
        : query(collection(db, 'invoices'), where('tenantId', '==', user?.id));
      const invoicesSnap = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Invoice[];
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to create invoice:', error);
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

  const handleExportSingleInvoicePDF = (invoice: Invoice) => {
    const tenant = tenants.find(t => t.id === invoice.tenantId);

    const isServiceInvoice = !!invoice.fromId;
    
    if (!isServiceInvoice && !tenant) {
      toast.error("Tenant details not found for this invoice.");
      return;
    }

    const doc = new jsPDF();
    doc.text(`Invoice: ${invoice.id}`, 14, 16);
    
    const from = isServiceInvoice ? invoice.from : 'Admin';
    const to = isServiceInvoice ? 'Admin' : tenant?.fullName || 'N/A';

    doc.text(`From: ${from}`, 14, 22);
    doc.text(`To: ${to}`, 14, 28);
    doc.text(`Date: ${safeDate(invoice.invoiceDate || invoice.createdAt)}`, 14, 34);
    
    const tableBody = invoice.lineItems?.map(item => [item.description, `RM ${item.amount.toFixed(2)}`]) || [[invoice.description, `RM ${invoice.totalAmount.toFixed(2)}`]];
    
    (doc as any).autoTable({
      startY: 45,
      head: [['Description', 'Amount']],
      body: tableBody,
      foot: [['Total', `RM ${invoice.totalAmount.toFixed(2)}`]]
    });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Admin UI
  if (user?.role === 'admin') {
    const filteredInvoices = invoices.filter(inv => statusFilter === 'all' || inv.status === statusFilter);

    return (
      <div className="container mx-auto px-4 w-full max-w-7xl py-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              <FaArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold">Invoices</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-700 transition">
              {showForm ? 'Close Form' : 'Create New Invoice'}
            </button>
          </div>
        </div>
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <h2 className="text-2xl font-bold col-span-full">{isEditing ? 'Edit Invoice' : 'New Invoice'}</h2>
            
            <div className="col-span-1">
              <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
              <select id="tenantId" name="tenantId" value={tenantId} onChange={handleFormChange} className="w-full border-gray-300 rounded-lg shadow-sm">
                <option value="">Select Tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            </div>
            
            <div className="col-span-1">
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input type="text" id="month" name="month" value={month} onChange={handleFormChange} className="w-full border-gray-300 rounded-lg shadow-sm" />
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
            
            <div className="col-span-full flex justify-between items-center mt-4">
              <div className="font-bold text-xl">Total: RM {totalAmount.toFixed(2)}</div>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition">
                {isEditing ? 'Update Invoice' : 'Create Invoice'}
              </button>
        </div>
          </form>
        )}
        
        <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-100 rounded-lg">
          {(['all', 'paid', 'unpaid', 'overdue'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4 p-6">Invoices</h2>
          
          {/* Mobile Card View */}
          <div className="md:hidden">
            <div className="space-y-4 px-4 pb-4">
            {filteredInvoices.map(inv => {
                const isServiceInvoice = !!inv.fromId;
                const fromName = isServiceInvoice ? inv.from : 'Admin';
                const toName = isServiceInvoice ? inv.to : tenants.find(t => t.id === inv.tenantId)?.fullName || 'N/A';
                const description = isServiceInvoice ? inv.description : `Rent for ${inv.month}, ${inv.year}`;
                const date = safeDate(inv.invoiceDate || inv.createdAt);
                const request = inv.statusChangeRequest;

                return (
                  <div key={inv.id} className={`p-4 rounded-lg shadow-md border ${request ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-bold">{toName}</div>
                      <div className="text-sm font-semibold">RM {inv.totalAmount.toFixed(2)}</div>
                    </div>
                    <p className="text-sm text-gray-600 truncate mb-2">{description}</p>
                    <div className="text-xs text-gray-500 mb-3">From: {fromName} &bull; {date}</div>
                    
                    <div className="flex justify-between items-center">
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
                          <div className="text-xs text-blue-600 animate-pulse font-semibold">
                              Req: {request.requestedStatus}
                          </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      {request ? (
                          <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleStatusRequest(inv, true)} className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700">Approve</button>
                              <button onClick={() => handleStatusRequest(inv, false)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700">Reject</button>
                          </div>
                      ) : (
                          <div className="flex items-center justify-end gap-3">
                              <button 
                                onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                              >
                                View
                              </button>
                              {!isServiceInvoice && (
                                <button onClick={() => handleEdit(inv)} className="text-gray-500 hover:text-gray-700 text-sm">Edit</button>
                              )}
                              <button onClick={() => handleExportSingleInvoicePDF(inv)} className="text-green-600 hover:text-green-800 text-sm">
                                Export
                              </button>
                          </div>
                      )}
                    </div>
                  </div>
                )
            })}
            </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">From</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">To</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map(inv => {
                  const isServiceInvoice = !!inv.fromId;
                  const fromName = isServiceInvoice ? inv.from : 'Admin';
                  const toName = isServiceInvoice ? inv.to : tenants.find(t => t.id === inv.tenantId)?.fullName || 'N/A';
                  const description = isServiceInvoice ? inv.description : `Rent for ${inv.month}, ${inv.year}`;
                  const date = safeDate(inv.invoiceDate || inv.createdAt);
                  const request = inv.statusChangeRequest;
                  
                  return (
                    <tr key={inv.id} className={`hover:bg-gray-50 transition ${request ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">{fromName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{toName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{description}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">RM {inv.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
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
                            </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Tenant UI: Card view on mobile, table on desktop
  return (
    <div className="container mx-auto px-4 w-full max-w-3xl py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold">My Invoices</h2>
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
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-[600px] bg-white rounded shadow text-sm md:text-base">
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