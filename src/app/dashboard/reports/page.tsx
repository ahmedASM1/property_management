'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AdminOnlyRoute } from '@/components/auth/RoleBasedRoute';

export default function ReportsPage() {
  return (
    <AdminOnlyRoute>
      <ReportsPageContent />
    </AdminOnlyRoute>
  );
}

function ReportsPageContent() {
  const [revenue, setRevenue] = useState<number | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'invoices'));
      let totalRevenue = 0;
      let totalOutstanding = 0;
      let totalPaid = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if (typeof data.totalAmount === 'number') {
          totalRevenue += data.totalAmount;
          if (data.isPaid) totalPaid += data.totalAmount;
          else totalOutstanding += data.totalAmount;
        }
      });
      setRevenue(totalRevenue);
      setOutstanding(totalOutstanding);
      setPaid(totalPaid);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold mb-2">Total Revenue</div>
          <div className="text-4xl font-bold text-green-700">
            {loading ? 'Loading...' : `RM${revenue?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold mb-2">Outstanding Payments</div>
          <div className="text-4xl font-bold text-red-600">
            {loading ? 'Loading...' : `RM${outstanding?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold mb-2">Total Paid Invoices</div>
          <div className="text-4xl font-bold text-blue-700">
            {loading ? 'Loading...' : `RM${paid?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`}
          </div>
        </div>
      </div>
    </div>
  );
} 