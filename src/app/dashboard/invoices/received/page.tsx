'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Invoice } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaFilePdf, FaCheck, FaTimes, FaArrowLeft } from 'react-icons/fa';

const statusOptions = ['pending_payment', 'paid', 'queried', 'rejected'];

export default function ReceivedInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInvoices() {
    try {
      const q = query(
        collection(db, 'invoices'),
        where('toId', '==', 'admin')
      );
      const snapshot = await getDocs(q);
      const invoicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
      
      invoicesData.sort((a, b) => {
        const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
        const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
        return dateB - dateA;
      });

      setInvoices(invoicesData);
    } catch (error) {
      toast.error('Failed to load invoices.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      const isPaid = newStatus === 'paid';
      const status = newStatus as Invoice['status'];
      await updateDoc(doc(db, 'invoices', invoiceId), {
        status: status,
        isPaid: isPaid,
      });
      setInvoices(prev => prev.map(inv => 
        inv.id === invoiceId ? { ...inv, status: status, isPaid: isPaid } : inv
      ));
      toast.success('Invoice status updated.');
    } catch (error) {
      toast.error('Failed to update status.');
      console.error(error);
    }
  };

  const exportPDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    doc.text(`Invoice from: ${invoice.from}`, 14, 16);
    doc.text(`Date: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}`, 14, 22);
    
    autoTable(doc, {
      startY: 28,
      head: [['Description', 'Amount']],
      body: [[
        invoice.description || '',
        `RM${invoice.totalAmount?.toFixed(2) || '0.00'}`
      ]],
      foot: [['Total', `RM${invoice.totalAmount?.toFixed(2) || '0.00'}`]]
    });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Invoices from Service Providers</h1>
        <Link href="/dashboard" className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
          <FaArrowLeft className="mr-2" />
          Back to Dashboard
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700">No Invoices Received</h2>
          <p className="text-gray-500 mt-2">There are currently no invoices from service providers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {invoices.map(invoice => (
            <div key={invoice.id} className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-gray-500">FROM</p>
                    <p className="font-bold text-lg text-gray-900">{invoice.from}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-500">AMOUNT</p>
                    <p className="font-bold text-lg text-green-600">RM{invoice.totalAmount?.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <p className="text-sm font-semibold text-gray-500">DESCRIPTION</p>
                  <p className="text-gray-700 mt-1">{invoice.description}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-500">DATE</p>
                  <p className="text-gray-700 mt-1">
                    {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="mt-auto bg-gray-50 p-4 flex justify-between items-center">
                 <div>
                  <button
                    onClick={() => exportPDF(invoice)}
                    className="flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition text-sm"
                  >
                    <FaFilePdf className="mr-1.5" />
                    Export
                  </button>
                </div>
                <div className="flex gap-3">
                  <select 
                    value={invoice.status || 'pending_payment'}
                    onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                    className="text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 