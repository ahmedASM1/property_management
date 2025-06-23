'use client';

import { Tenant, Invoice } from '@/types';
import Link from 'next/link';
import { 
  FaUsers, 
  FaFileInvoice, 
  FaMoneyBillWave, 
  FaClock, 
  FaExclamationTriangle, 
  FaFileContract, 
  FaBuilding,
  FaArrowUp,
  FaArrowDown,
  FaCalendarAlt,
  FaChartLine,
  FaHome,
  FaUserPlus,
  FaFileAlt,
  FaTools
} from 'react-icons/fa';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import { sendPaymentReminderEmail } from '@/lib/email';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AdminDashboardProps {
  data: {
    tenants?: Tenant[];
    invoices?: Invoice[];
  };
}

export default function AdminDashboard({ data }: AdminDashboardProps) {
  const { tenants = [], invoices = [] } = data;

  const totalTenants = tenants.length;
  const pendingApprovals = tenants.filter(t => !t.isApproved).length;
  const totalUnpaidInvoices = invoices.filter(i => !i.isPaid).length;
  const totalRevenue = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  const paidInvoices = invoices.filter(i => i.isPaid).length;

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentTenants = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Calculate revenue by month for the chart
  const revenueByMonth = invoices.reduce((acc, invoice) => {
    const date = new Date(invoice.createdAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[month] = (acc[month] || 0) + (invoice.totalAmount || 0);
    return acc;
  }, {} as Record<string, number>);
  const revenueChartData = Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue }));

  // Alerts logic
  const overdueInvoices = invoices.filter(i => !i.isPaid && i.dueDate && new Date(i.dueDate) < new Date());
  const expiringContracts = tenants.filter(t => t.contractExpiry && new Date(t.contractExpiry) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 30));

  // Occupancy rate
  const totalUnits = 100;
  const occupiedUnits = tenants.length;
  const occupancyRate = totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Tenant growth by month
  const tenantGrowthByMonth = tenants.reduce((acc, tenant) => {
    const date = new Date(tenant.createdAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const tenantGrowthChartData = Object.entries(tenantGrowthByMonth).map(([month, count]) => ({ month, count }));

  // Payment status data for pie chart
  const paymentStatusData = [
    { name: 'Paid', value: paidInvoices, color: '#10B981' },
    { name: 'Unpaid', value: totalUnpaidInvoices, color: '#F59E0B' },
    { name: 'Overdue', value: overdueInvoices.length, color: '#EF4444' }
  ];

  const [reminding, setReminding] = useState(false);
  const [maintenanceCount, setMaintenanceCount] = useState<number | null>(null);
  const [receivedInvoicesCount, setReceivedInvoicesCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchMaintenance() {
      const snap = await getDocs(collection(db, 'maintenance_requests'));
      setMaintenanceCount(snap.size);
    }
    
    async function fetchReceivedInvoices() {
      const q = query(collection(db, 'invoices'), where('toId', '==', 'admin'), where('status', '==', 'pending_payment'));
      const snap = await getDocs(q);
      setReceivedInvoicesCount(snap.size);
    }

    fetchMaintenance();
    fetchReceivedInvoices();
  }, []);

  async function handleBulkRemind() {
    setReminding(true);
    try {
      const unpaid = (data.invoices || []).filter(i => !i.isPaid);
      const tenantsToRemind = Array.from(new Set(unpaid.map(i => i.tenantId)));
      for (const tenantId of tenantsToRemind) {
        const tenant = (data.tenants || []).find(t => t.id === tenantId);
        if (tenant) {
          const amount = unpaid.filter(i => i.tenantId === tenantId).reduce((sum, i) => sum + (i.totalAmount || 0), 0);
          await sendPaymentReminderEmail(tenant.email, tenant.fullName, amount);
        }
      }
      alert('Reminders sent!');
    } catch {
      alert('Failed to send reminders.');
    } finally {
      setReminding(false);
    }
  }

  function exportTenantsCSV() {
    const tenants = data.tenants || [];
    let csv = 'Full Name,Email,Unit Number,Rental Type\n';
    tenants.forEach(t => {
      csv += `"${t.fullName}","${t.email}","${t.unitNumber}","${t.rentalType}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, 'tenants.csv');
  }

  function exportInvoicesCSV() {
    const invoices = data.invoices || [];
    let csv = 'Tenant,Unit,Month,Year,Amount,Status\n';
    invoices.forEach(i => {
      const tenant = (data.tenants || []).find(t => t.id === i.tenantId);
      csv += `"${tenant?.fullName || ''}","${i.unitNumber || ''}","${i.month}","${i.year}","${i.totalAmount}","${i.isPaid ? 'Paid' : 'Unpaid'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, 'invoices.csv');
  }

  function exportInvoicesPDF() {
    const invoices = data.invoices || [];
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Invoices Report', 14, 16);
    let y = 28;
    doc.setFontSize(10);
    doc.text('Tenant', 14, y);
    doc.text('Unit', 44, y);
    doc.text('Month', 64, y);
    doc.text('Year', 84, y);
    doc.text('Amount', 104, y);
    doc.text('Status', 134, y);
    y += 6;
    invoices.forEach(i => {
      const tenant = (data.tenants || []).find(t => t.id === i.tenantId);
      doc.text(tenant?.fullName || '', 14, y);
      doc.text(i.unitNumber || '', 44, y);
      doc.text(String(i.month), 64, y);
      doc.text(String(i.year), 84, y);
      doc.text(`RM${i.totalAmount?.toFixed(2) || '0.00'}`, 104, y);
      doc.text(i.isPaid ? 'Paid' : 'Unpaid', 134, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save('invoices.pdf');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening with your properties.</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs text-gray-500">Last updated</div>
              <div className="text-base font-semibold text-gray-900">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4 py-6 space-y-6">
        {/* Critical Alerts */}
        {(overdueInvoices.length > 0 || expiringContracts.length > 0) && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <FaExclamationTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Attention Required</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overdueInvoices.length > 0 && (
                    <div className="bg-white/70 rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-800">Overdue Invoices</p>
                          <p className="text-2xl font-bold text-red-900">{overdueInvoices.length}</p>
                        </div>
                        <Link href="/dashboard/invoices?filter=overdue" 
                              className="inline-flex items-center px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium transition-colors">
                          View All
                        </Link>
                      </div>
                    </div>
                  )}
                  {expiringContracts.length > 0 && (
                    <div className="bg-white/70 rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-800">Expiring Contracts</p>
                          <p className="text-2xl font-bold text-orange-900">{expiringContracts.length}</p>
                        </div>
                        <Link href="/dashboard/contracts?filter=expiring" 
                              className="inline-flex items-center px-3 py-1 rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 text-sm font-medium transition-colors">
                          Review
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/expenses" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <FaMoneyBillWave className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Expenses & Bills</h3>
                <p className="text-gray-500 text-sm">View and manage expenses and bills</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/invoices" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <FaFileInvoice className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Create Invoice</h3>
                <p className="text-gray-500 text-sm">Generate new invoice</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/units" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <FaBuilding className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Manage Units</h3>
                <p className="text-gray-500 text-sm">View all properties</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/reports" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-full">
                <FaChartLine className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reports</h3>
                <p className="text-gray-500 text-sm">Financial insights</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/maintenance/admin" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-semibold text-gray-800">Maintenance Requests</h4>
                <div className="p-2 bg-green-100 rounded-full">
                  <FaTools className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">View and manage maintenance</p>
              <div className="mt-auto">
                <div className="flex items-center text-sm text-gray-700">
                  {maintenanceCount !== null ? (
                    <span className="text-2xl font-bold text-gray-900">{maintenanceCount}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                  <span className="ml-2">Active Requests</span>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/invoices/received" className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-semibold text-gray-800">Received Invoices</h4>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <FaFileInvoice className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-4">Invoices from service providers</p>
              <div className="mt-auto">
                <div className="flex items-center text-sm text-gray-700">
                  {receivedInvoicesCount !== null ? (
                    <span className="text-2xl font-bold text-gray-900">{receivedInvoicesCount}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                  <span className="ml-2">Pending</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-3xl font-bold text-indigo-600 mb-2">{data.tenants?.length ?? 0}</div>
            <div className="text-gray-700 font-semibold">Total Tenants</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{100 /* TODO: Replace with real total units */}</div>
            <div className="text-gray-700 font-semibold">Total Units</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {data.tenants && 100 ? `${Math.round((data.tenants.length / 100) * 100)}%` : '0%'}
            </div>
            <div className="text-gray-700 font-semibold">Occupancy Rate</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              RM{data.invoices ? data.invoices.filter(i => !i.isPaid).reduce((sum, i) => sum + (i.totalAmount || 0), 0).toFixed(2) : '0.00'}
            </div>
            <div className="text-gray-700 font-semibold">Outstanding Payments</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
                <p className="text-sm text-gray-500">Monthly revenue trends</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Revenue</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Status Pie Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Payment Status</h3>
              <p className="text-sm text-gray-500">Invoice payment breakdown</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {paymentStatusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Occupancy and Tenant Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy Rate */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Occupancy Rate</h3>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    className="text-blue-600"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${occupancyRate}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-600">{occupancyRate}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{occupiedUnits} of {totalUnits} units occupied</p>
            </div>
          </div>

          {/* Tenant Growth */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Tenant Growth</h3>
              <p className="text-sm text-gray-500">New tenant registrations over time</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tenantGrowthChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#7c3aed" 
                  strokeWidth={3}
                  dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#7c3aed', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
                <Link href="/dashboard/invoices" 
                      className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View All
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {recentInvoices.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FaFileInvoice className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No recent invoices</p>
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600">
                            {invoice.unitNumber?.slice(-2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Unit {invoice.unitNumber}</p>
                          <p className="text-xs text-gray-500">{invoice.month} {invoice.year}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          RM {isNaN(invoice.totalAmount) ? '0.00' : invoice.totalAmount.toFixed(2)}
                        </p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.isPaid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Tenants */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Tenants</h3>
                <Link href="/dashboard/tenants" 
                      className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View All
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {recentTenants.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FaUsers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No recent tenants</p>
                </div>
              ) : (
                recentTenants.map((tenant) => (
                  <div key={tenant.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-semibold text-purple-600">
                            {tenant.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tenant.fullName}</p>
                          <p className="text-xs text-gray-500">Unit {tenant.unitNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">{tenant.rentalType}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tenant.isApproved
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tenant.isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={handleBulkRemind}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-6 py-2 rounded shadow disabled:opacity-50"
            disabled={reminding}
          >
            {reminding ? 'Sending Reminders...' : 'Send Payment Reminders'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={exportTenantsCSV} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded shadow">Export Tenants (CSV)</button>
          <button onClick={exportInvoicesCSV} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded shadow">Export Invoices (CSV)</button>
          <button onClick={exportInvoicesPDF} className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-4 py-2 rounded shadow">Export Invoices (PDF)</button>
        </div>
      </div>
    </div>
  );
}
