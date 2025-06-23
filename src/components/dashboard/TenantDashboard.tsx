import { Invoice } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { 
  FaFileInvoice, 
  FaFileContract, 
  FaMoneyBillWave, 
  FaClock, 
  FaUser,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaHome,
  FaChartLine,
  FaDownload,
  FaEye,
  FaBell,
  FaCreditCard,
  FaSignature
} from 'react-icons/fa';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

interface TenantDashboardProps {
  data: {
    invoices?: Invoice[];
  };
}

export default function TenantDashboard({ data }: TenantDashboardProps) {
  const auth = useAuth();
  const user = auth?.user;
  const { invoices = [] } = data;
  const unpaidInvoices = invoices.filter(i => !i.isPaid);
  const paidInvoices = invoices.filter(i => i.isPaid);
  const overdueInvoices = invoices.filter(i => !i.isPaid && i.dueDate && new Date(i.dueDate) < new Date());
  const totalDue = unpaidInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  const totalPaid = paidInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  // Payment progress calculation
  const paymentProgress = invoices.length ? Math.round((paidInvoices.length / invoices.length) * 100) : 0;

  // Helper for safe date formatting
  function safeDate(date: any) {
    const d = new Date(date);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  // Contract information
  const contractStatus = user?.contractStatus || (user?.contractUrl ? 'Active' : 'Pending');
  const contractStart = user?.contractStart ? safeDate(user.contractStart) : 'N/A';
  const contractEnd = user?.contractEnd ? safeDate(user.contractEnd) : 'N/A';
  const isContractExpiringSoon = user?.contractEnd && 
    new Date(user.contractEnd) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  // Next payment due
  const nextDueInvoice = unpaidInvoices
    .filter(inv => inv.dueDate)
    .sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime())[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.fullName ? getInitials(user.fullName) : 'T'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {user?.fullName?.split(' ')[0] || 'Tenant'}! <span className="inline-block align-middle">👋</span>
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                  {user?.unitNumber ? `Unit ${user.unitNumber}` : 'Your tenant dashboard'}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs text-gray-500">Today</div>
              <div className="text-base font-semibold text-gray-900">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4 py-6 space-y-6">
        {/* Outstanding Invoice Reminder */}
        {unpaidInvoices.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <FaBell className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Outstanding Invoices</h3>
                <p className="text-sm text-red-700 mb-2">
                  You have {unpaidInvoices.length} unpaid invoice(s) totaling RM {isNaN(totalDue) ? '0.00' : totalDue.toFixed(2)}.
                </p>
                <Link href="/dashboard/invoices?filter=unpaid"
                      className="inline-flex items-center px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium transition-colors">
                  Pay Now
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* Critical Alerts */}
        {(overdueInvoices.length > 0 || isContractExpiringSoon) && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <FaBell className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Action Required</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overdueInvoices.length > 0 && (
                    <div className="bg-white/70 rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-800">Overdue Payments</p>
                          <p className="text-2xl font-bold text-red-900">{overdueInvoices.length}</p>
                          <p className="text-sm text-red-700">
                            RM {isNaN(overdueInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)) ? '0.00' : overdueInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toFixed(2)} total
                          </p>
                        </div>
                        <Link href="/dashboard/invoices?filter=overdue"
                              className="inline-flex items-center px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium transition-colors">
                          Pay Now
                        </Link>
                      </div>
                    </div>
                  )}
                  {isContractExpiringSoon && (
                    <div className="bg-white/70 rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-800">Contract Expiring</p>
                          <p className="text-lg font-bold text-orange-900">Soon</p>
                          <p className="text-sm text-orange-700">Expires {safeDate(user?.contractEnd)}</p>
                        </div>
                        <Link href="/dashboard/contract"
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

        {/* Payment Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Payment Progress</h3>
              <p className="text-sm text-gray-500">Your payment completion rate</p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-3xl font-bold text-green-600">{paymentProgress}%</div>
              <div className="text-sm text-gray-500">{paidInvoices.length} of {invoices.length} paid</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${paymentProgress}%` }}
            ></div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between text-sm gap-2">
            <span className="text-gray-600">Outstanding: RM {isNaN(totalDue) ? '0.00' : totalDue.toFixed(2)}</span>
            <span className="text-green-600 font-medium">Paid: RM {isNaN(totalPaid) ? '0.00' : totalPaid.toFixed(2)}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Amount Due</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">RM {isNaN(totalDue) ? '0.00' : totalDue.toFixed(2)}</p>
                {nextDueInvoice && (
                  <p className="text-sm text-orange-600 mt-2">
                    Due {safeDate(nextDueInvoice.dueDate)}
                  </p>
                )}
              </div>
              <div className="p-4 bg-red-50 rounded-xl">
                <FaMoneyBillWave className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unpaid Invoices</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{unpaidInvoices.length}</p>
                {overdueInvoices.length > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    {overdueInvoices.length} overdue
                  </p>
                )}
              </div>
              <div className="p-4 bg-yellow-50 rounded-xl">
                <FaFileInvoice className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contract Status</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{contractStatus}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    contractStatus === 'Active' ? 'bg-green-100 text-green-800' :
                    contractStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {contractStatus}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <FaFileContract className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unit Number</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{user?.unitNumber || 'N/A'}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Since {safeDate(user?.createdAt)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <FaHome className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Contract Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <FaFileContract className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Rental Agreement</h3>
                  <p className="text-sm text-gray-500">Your current lease contract</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-600">Start Date</p>
                  <p className="text-lg font-semibold text-gray-900">{contractStart}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">End Date</p>
                  <p className="text-lg font-semibold text-gray-900">{contractEnd}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    contractStatus === 'Active' ? 'bg-green-100 text-green-800' :
                    contractStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                    contractStatus === 'Expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {contractStatus}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              {user?.contractUrl ? (
                <a
                  href={user.contractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <FaEye className="h-4 w-4 mr-2" />
                  View Contract
                </a>
              ) : (
                <button
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <FaSignature className="h-4 w-4 mr-2" />
                  Sign Contract
                </button>
              )}
              {user?.contractUrl && (
                <a
                  href={user.contractUrl}
                  download
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center"
                >
                  <FaDownload className="h-4 w-4 mr-2" />
                  Download
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Payment Timeline and Recent Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Timeline</h3>
                <p className="text-sm text-gray-500">Your payment history</p>
              </div>
              <Link href="/dashboard/invoices" 
                    className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FaFileInvoice className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No payment history yet</p>
                </div>
              ) : (
                invoices
                  .sort((a, b) => {
                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                    return dateB - dateA;
                  })
                  .slice(0, 6)
                  .map((invoice) => (
                    <div key={invoice.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        invoice.isPaid ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        {invoice.isPaid ? (
                          <FaCheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <FaExclamationCircle className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {invoice.month} {invoice.year}
                            </p>
                            <p className="text-xs text-gray-500">
                              Due: {safeDate(invoice.dueDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              RM {isNaN(invoice.totalAmount) ? '0.00' : invoice.totalAmount.toFixed(2)}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              invoice.isPaid 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invoice.isPaid ? 'Paid' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <Link
              href="/dashboard/invoices"
              className="group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all duration-200 block"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <FaFileInvoice className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    View All Invoices
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Check your complete payment history</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">{invoices.length}</div>
              </div>
            </Link>

            {/* Unified Requests Card */}
            <Link
              href="/dashboard/maintenance"
              className="group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all duration-200 block"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <span className="inline-block w-6 h-6 text-blue-600 text-2xl leading-none flex items-center justify-center">+</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Requests (Maintenance, Service, Item)
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Submit and track all your requests (repairs, services, items)</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
              <Link href="/dashboard/invoices" 
                    className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View All →
              </Link>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaFileInvoice className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h4>
                <p className="text-gray-500">When your landlord issues invoices, they'll appear here.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.month} {invoice.year}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          RM {isNaN(invoice.totalAmount) ? '0.00' : invoice.totalAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {safeDate(invoice.dueDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          invoice.isPaid
                            ? 'bg-green-100 text-green-800'
                            : overdueInvoices.some(oi => oi.id === invoice.id)
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.isPaid ? 'Paid' : overdueInvoices.some(oi => oi.id === invoice.id) ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          {invoice.receiptUrl && (
                            <a
                              href={invoice.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View Receipt
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payment History Table */}
        {invoices && invoices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">Invoice #</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Amount (RM)</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{inv.id.slice(-6).toUpperCase()}</td>
                      <td className="px-4 py-2">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2">{inv.totalAmount ? `RM${Number(inv.totalAmount).toFixed(2)}` : '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inv.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.isPaid ? 'Paid' : 'Unpaid'}</span>
                      </td>
                      <td className="px-4 py-2">
                        {inv.receiptUrl ? (
                          <a href={inv.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Download</a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}