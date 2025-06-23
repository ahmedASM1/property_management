'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice } from '@/types';

export default function PaymentsPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      if (!user) return;
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'invoices'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setInvoices(data.filter(inv => inv.tenantId === user.id && !inv.isPaid));
      setLoading(false);
    }
    fetchInvoices();
  }, [user]);

  if (!user) return <div className="p-8">Please log in.</div>;
  if (loading) return <div className="p-8">Loading...</div>;

  const handlePayNow = async (invoice: Invoice) => {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: invoice.totalAmount, invoiceId: invoice.id }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Failed to initiate payment.');
    }
    await addDoc(collection(db, 'notifications'), {
      role: 'admin',
      message: `Invoice #${invoice.id.slice(-6).toUpperCase()} has been paid by ${user?.fullName || user?.email || 'Unknown'}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-2 sm:px-0">
      <h2 className="text-2xl font-bold mb-6 text-center">Outstanding Payments</h2>
      {invoices.length === 0 ? (
        <div className="text-center text-gray-500">No outstanding invoices.</div>
      ) : (
        <div className="space-y-4">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white rounded shadow p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-gray-900">Invoice #{inv.id.slice(-6).toUpperCase()}</div>
                <div className="text-sm text-gray-500">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</div>
                <div className="text-sm text-gray-500">Amount: <span className="font-bold text-green-700">RM{isNaN(Number(inv.totalAmount)) ? '0.00' : Number(inv.totalAmount).toFixed(2)}</span></div>
              </div>
              <button
                className="mt-3 sm:mt-0 px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                onClick={() => handlePayNow(inv)}
              >
                Pay Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 