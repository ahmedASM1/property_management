'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FaTools, FaCheckCircle, FaClock, FaExclamationTriangle, FaChevronDown, FaFilePdf, FaTimes } from 'react-icons/fa';
import Link from 'next/link';
import { MaintenanceRequest, RequestStatus, Invoice } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { Menu, Transition } from '@headlessui/react';

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  return date.toLocaleDateString();
};

const getStatusInfo = (status?: string) => {
    const defaultText = status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
    switch (status?.toLowerCase()) {
        case 'paid':
            return { text: 'Paid', style: 'bg-green-100 text-green-800' };
        case 'pending_payment':
            return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' };
        case 'queried':
            return { text: 'Queried', style: 'bg-blue-100 text-blue-800' };
        case 'rejected':
            return { text: 'Rejected', style: 'bg-red-100 text-red-800' };
        default:
            return { text: defaultText, style: 'bg-gray-100 text-gray-800' };
    }
};

const statusOptions: RequestStatus[] = ['pending', 'in progress', 'completed', 'delayed', 'faced an issue'];

const getStatusPillStyle = (status: RequestStatus) => {
    switch (status.toLowerCase()) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'in progress':
            return 'bg-blue-100 text-blue-800';
        case 'completed':
            return 'bg-green-100 text-green-800';
        case 'delayed':
            return 'bg-orange-100 text-orange-800';
        case 'faced an issue':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const StatusUpdater = ({ currentStatus, onStatusChange }: { currentStatus: RequestStatus, onStatusChange: (status: RequestStatus) => void }) => {
    return (
        <Menu as="div" className="relative inline-block text-left">
            <div>
                <Menu.Button className={`inline-flex justify-center w-full rounded-full border border-gray-300 shadow-sm px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${getStatusPillStyle(currentStatus)}`}>
                    {currentStatus}
                    <FaChevronDown className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" />
                </Menu.Button>
            </div>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute z-10 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                        {statusOptions.map((status) => (
                            <Menu.Item key={status}>
                                {({ active }) => (
                                    <button
                                        onClick={() => onStatusChange(status)}
                                        className={`${
                                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                        } group flex rounded-md items-center w-full px-4 py-2 text-sm`}
                                    >
                                        {status}
                                    </button>
                                )}
                            </Menu.Item>
                        ))}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};

const ServiceProviderDashboard = () => {
  const auth = useAuth();
  const user = auth?.user;
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    total: 0
  });

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    if (!user) return;

    try {
      const requestRef = doc(db, 'maintenance_requests', requestId);
      
      const systemMessage = {
        sender: 'system',
        senderName: 'System',
        text: `Status updated to "${newStatus}" by ${user.fullName}.`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(requestRef, {
        status: newStatus,
        messages: arrayUnion(systemMessage)
      });

      const requestToUpdate = requests.find(r => r.id === requestId);
      if (requestToUpdate) {
          // Notify admin and tenant
          addDoc(collection(db, 'notifications'), {
              userId: requestToUpdate.userId,
              message: `Status of your request for unit ${requestToUpdate.unitProperty} is now: ${newStatus}`,
              read: false,
              createdAt: serverTimestamp(),
          });
          addDoc(collection(db, 'notifications'), {
              role: 'admin',
              message: `Service provider ${user.fullName} updated request for unit ${requestToUpdate.unitProperty} to: ${newStatus}`,
              read: false,
              createdAt: serverTimestamp(),
          });
      }
      
      // Update local state
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));

    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'maintenance_requests'),
      where('assignedTo', '==', user.id)
    );

    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaintenanceRequest[];

      // Filter and sort client-side
      const filteredRequests = requestsData.filter(req => 
        ['pending', 'in progress', 'completed', 'delayed', 'faced an issue'].includes(req.status?.toLowerCase() || '')
      );
      
      filteredRequests.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setRequests(filteredRequests);
      
      // Calculate stats
      const stats = filteredRequests.reduce((acc, req) => {
        acc.total++;
        switch (req.status?.toLowerCase()) {
          case 'pending':
            acc.pending++;
            break;
          case 'in progress':
            acc.inProgress++;
            break;
          case 'completed':
            acc.completed++;
            break;
        }
        return acc;
      }, { pending: 0, inProgress: 0, completed: 0, total: 0 });
      
      setStats(stats);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching requests with real-time listener:', error);
      setLoading(false);
    });

    // Real-time listener for invoices
    const invoicesQuery = query(
        collection(db, 'invoices'),
        where('fromId', '==', user.id)
    );

    const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
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
    }, (error) => {
        console.error('Failed to fetch invoices with real-time listener:', error);
    });

    return () => {
        unsubscribeRequests();
        unsubscribeInvoices();
    };
  }, [user]);

  const handleCancelInvoice = async (invoiceId: string) => {
    if (window.confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'invoices', invoiceId));
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        toast.success('Invoice cancelled.');
      } catch (error) {
        toast.error('Failed to cancel invoice.');
        console.error(error);
      }
    }
  };

  const exportInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    doc.text(`Invoice from: ${invoice.from}`, 14, 16);
    doc.text(`Date: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}`, 14, 22);
    doc.text(`Status: ${getStatusInfo(invoice.status).text}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <FaTools className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.fullName || 'Service Provider'}
            </h2>
            <p className="text-gray-500">Service Type: {user?.serviceType || 'General Services'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaTools className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FaClock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{stats.inProgress}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaExclamationTriangle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.completed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold">My Assigned Requests</h3>
          <p className="text-gray-500 mt-1">Requests assigned to you by admin</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length > 0 ? requests.map(req => (
                <tr key={req.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{req.issueDescription}</div>
                    <div className="text-sm text-gray-500">{req.serviceType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.unitProperty}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      req.priority === 'High' ? 'bg-red-100 text-red-800' :
                      req.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {req.priority || 'Normal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusUpdater
                      currentStatus={req.status}
                      onStatusChange={(newStatus) => handleStatusChange(req.id, newStatus)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(req.assignedAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {req.status === 'completed' ? (
                      <Link href={`/dashboard/invoices/create?requestId=${req.id}`} className="text-indigo-600 hover:text-indigo-900">
                        Create Invoice
                      </Link>
                    ) : (
                      <Link href={`/dashboard/maintenance/request-item?id=${req.id}`} className="text-gray-600 hover:text-indigo-900">
                        Details
                      </Link>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    You have no assigned requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submitted Invoices */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold">My Submitted Invoices</h3>
          <p className="text-gray-500 mt-1">Invoices you have submitted to the admin</p>
        </div>
        <div className="overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FaFilePdf className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
              <p className="mt-1 text-sm text-gray-500">You haven't submitted any invoices yet.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{invoice.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">RM{invoice.totalAmount?.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        getStatusInfo(invoice.status).style
                      }`}>
                        {getStatusInfo(invoice.status).text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex flex-col items-end space-y-2">
                        <button
                          onClick={() => exportInvoicePDF(invoice)}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        >
                          <FaFilePdf className="mr-1.5" />
                          Export
                        </button>
                        {invoice.status === 'pending_payment' && (
                          <button
                            onClick={() => handleCancelInvoice(invoice.id)}
                            className="text-red-600 hover:text-red-900 flex items-center"
                          >
                            <FaTimes className="mr-1.5" />
                            Cancel
                          </button>
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
    </div>
  );
};

export default ServiceProviderDashboard; 