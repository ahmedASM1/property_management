'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MaintenanceRequest } from '@/types';
import { FaTools, FaClock, FaCheckCircle, FaExclamationTriangle, FaCalendarAlt } from 'react-icons/fa';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  averageResponseTime: number;
}

export default function ServiceProviderDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    pendingRequests: 0,
    inProgressRequests: 0,
    completedRequests: 0,
    averageResponseTime: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState<MaintenanceRequest[]>([]);
  const [assignedRequests, setAssignedRequests] = useState<MaintenanceRequest[]>([]);
  // Mock invoices data for demonstration
  const [invoices] = useState([
    { id: '1', description: 'Invoice for service on unit D-11-1', amount: 132.0 },
    { id: '2', description: 'Invoice for service on unit D-11-2', amount: 99.5 },
  ]);
  const [showDetails, setShowDetails] = useState<MaintenanceRequest | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]); // Replace any with your message type
  const [newMessage, setNewMessage] = useState('');
  const [invoiceModal, setInvoiceModal] = useState<{ open: boolean, requestId?: string, editId?: string }>({ open: false });
  const [myInvoices, setMyInvoices] = useState<any[]>([]); // Replace any with your invoice type
  const [hideCompleted, setHideCompleted] = useState(false);
  // Add state for invoice form
  const [invoiceForm, setInvoiceForm] = useState({ description: '', amount: '' });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  // Add state for delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchMyInvoices();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const requestsSnapshot = await getDocs(collection(db, 'maintenance_requests'));
      let requests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceRequest));
      // Role-based filtering
      if (user?.role === 'service') {
        requests = requests.filter(req => req.assignedTo === user.id);
      } else if (user?.role === 'mixedProvider') {
        requests = requests.filter(req => req.assignedTo);
      }
      setAssignedRequests(requests);

      // Calculate stats
      const totalRequests = requests.length;
      const pendingRequests = requests.filter(req => req.status === 'pending').length;
      const inProgressRequests = requests.filter(req => req.status === 'in progress').length;
      const completedRequests = requests.filter(req => req.status === 'completed').length;

      // Calculate average response time (simplified)
      const completedWithDates = requests.filter(req => req.status === 'completed' && req.createdAt && req.completedAt);
      const totalResponseTime = completedWithDates.reduce((sum, req) => {
        const created = req.createdAt && typeof req.createdAt === 'object' && 'toDate' in req.createdAt 
          ? req.createdAt.toDate() 
          : new Date(req.createdAt);
        const completed = req.completedAt && typeof req.completedAt === 'object' && 'toDate' in req.completedAt 
          ? req.completedAt.toDate() 
          : req.completedAt ? new Date(req.completedAt) : new Date();
        return sum + (completed.getTime() - created.getTime());
      }, 0);
      const averageResponseTime = completedWithDates.length > 0 ? totalResponseTime / completedWithDates.length / (1000 * 60 * 60) : 0; // in hours

      setStats({
        totalRequests,
        pendingRequests,
        inProgressRequests,
        completedRequests,
        averageResponseTime
      });

      // Set recent requests
      setRecentRequests(requests.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyInvoices = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'invoices'), where('fromId', '==', user.id));
      const snapshot = await getDocs(q);
      const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Filter out invoices hidden for this user and those with invalid Firestore IDs (must be exactly 20 chars)
      const visibleInvoices = invoicesData.filter((inv: any) =>
        (!inv.hiddenFor || !inv.hiddenFor.includes(user.id)) && typeof inv.id === 'string' && inv.id.length === 20
      );
      setMyInvoices(visibleInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setAssignedRequests(prev => prev.map(req => req.id === id ? { ...req, status: newStatus as import('@/types').RequestStatus } : req));
    try {
      await updateDoc(doc(db, 'maintenance_requests', id), { status: newStatus });
    } catch (error) {
      console.error('Failed to update request status in Firestore:', error);
    }
  };

  // Handler for opening details modal
  const handleViewDetails = (request: MaintenanceRequest) => {
    setShowDetails(request);
    // TODO: Fetch chat messages for this request
    setChatMessages([
      // Example messages
      { sender: 'A', text: 'thanks for your patience', timestamp: new Date().toLocaleString() },
      { sender: 'S', text: 'hi there', timestamp: new Date().toLocaleString() },
      { sender: 'S', text: 'Status updated to "completed" by Service Provider 2.', timestamp: new Date().toLocaleString() },
    ]);
  };

  // Handler for sending a chat message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setChatMessages([...chatMessages, { sender: 'S', text: newMessage, timestamp: new Date().toLocaleString() }]);
    setNewMessage('');
    // TODO: Save message to Firestore
  };

  // Handler for creating invoice
  const handleCreateInvoice = async (requestId: string) => {
    if (!user) return;
    const q = query(collection(db, 'invoices'), where('fromId', '==', user.id), where('maintenanceRequestId', '==', requestId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      // Invoice exists, allow editing
      const existingInvoice = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
      setInvoiceForm({ description: existingInvoice.description || '', amount: existingInvoice.totalAmount || '' });
      setInvoiceModal({ open: true, requestId, editId: existingInvoice.id });
    } else {
      setInvoiceForm({ description: '', amount: '' });
      setInvoiceModal({ open: true, requestId });
    }
  };

  // Handler for exporting invoice as PDF
  const handleExportPDF = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Invoice from: ' + (invoice.from || 'Service Provider'), 30, 40);
    doc.setFontSize(16);
    const dateStr = invoice.issuedDate || invoice.createdAt || invoice.invoiceDate;
    const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
    doc.text('Date: ' + dateDisplay, 30, 55);

    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Amount']],
      body: [
        [invoice.description || '', `RM${isNaN(Number(invoice.totalAmount)) ? '0.00' : Number(invoice.totalAmount).toFixed(2)}`]
      ],
      foot: [['Total', `RM${isNaN(Number(invoice.totalAmount)) ? '0.00' : Number(invoice.totalAmount).toFixed(2)}`]],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 13 },
      footStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 13 },
      bodyStyles: { fontSize: 12 },
      styles: { halign: 'left', cellPadding: 6 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });
    doc.save(`invoice-${invoice.id}.pdf`);
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim() === '' || invoiceId.length < 10) {
      alert('Invalid invoice ID.');
      return;
    }
    if (!user) return;
    try {
      console.log('Soft deleting invoice for user:', invoiceId, user.id);
      await updateDoc(doc(db, 'invoices', invoiceId), { hiddenFor: arrayUnion(user.id) });
      await fetchMyInvoices();
    } catch (error) {
      console.error('Failed to delete invoice:', error); // Improved error logging
      alert('Failed to delete invoice.');
    }
  };

  const handleSubmitInvoice = async () => {
    if (!invoiceForm.description || !invoiceForm.amount || !invoiceModal.requestId || !user) return;
    setCreatingInvoice(true);
    try {
      const now = new Date();
      if (invoiceModal.editId) {
        // Edit existing invoice
        await updateDoc(doc(db, 'invoices', invoiceModal.editId), {
          description: invoiceForm.description,
          totalAmount: Number(invoiceForm.amount),
          updatedAt: now.toISOString(),
        });
      } else {
        // Create new invoice
        const newInvoice = {
          fromId: user.id,
          from: user.fullName,
          toId: 'admin',
          to: 'Admin',
          maintenanceRequestId: invoiceModal.requestId,
          description: invoiceForm.description,
          totalAmount: Number(invoiceForm.amount),
          status: 'pending_payment',
          createdAt: now.toISOString(),
          issuedDate: now.toISOString(),
        };
        await addDoc(collection(db, 'invoices'), newInvoice);
      }
      await fetchMyInvoices();
      setInvoiceModal({ open: false });
      setInvoiceForm({ description: '', amount: '' });
    } catch (e) {
      alert('Failed to create or update invoice.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, Service Provider 2</h1>
          <p className="text-gray-500 mt-1">Service Type: General Services</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalRequests}</p>
          </div>
          <FaTools className="h-8 w-8 text-blue-600" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pendingRequests}</p>
          </div>
          <FaClock className="h-8 w-8 text-yellow-600" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{stats.inProgressRequests}</p>
          </div>
          <FaExclamationTriangle className="h-8 w-8 text-blue-600" />
        </div>
        <div className="bg-white p-6 rounded-lg shadow flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{stats.completedRequests}</p>
          </div>
          <FaCheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>

      {/* My Assigned Requests Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Assigned Requests</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={e => setHideCompleted(e.target.checked)}
              className="rounded"
            />
            Hide Completed Requests
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(hideCompleted ? assignedRequests.filter(req => req.status !== 'completed') : assignedRequests).map((req) => {
                const canCreateInvoice = req.status === 'completed' && req.assignedTo === user?.id;
                return (
                  <tr key={req.id}>
                    <td className="px-4 py-2 font-medium text-gray-900">{req.issueDescription}</td>
                    <td className="px-4 py-2">{req.unitProperty}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${req.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{req.priority || '-'}</span>
                    </td>
                    <td className="px-4 py-2">
                      <select className="border rounded px-2 py-1 text-xs" value={req.status} onChange={e => handleStatusChange(req.id, e.target.value)} disabled={req.assignedTo !== user?.id}>
                        <option value="pending">Pending</option>
                        <option value="in progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="delayed">Delayed</option>
                        <option value="faced an issue">Faced an issue</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">{req.createdAt && (typeof req.createdAt === 'object' && 'toDate' in req.createdAt ? req.createdAt.toDate().toLocaleDateString() : new Date(req.createdAt).toLocaleDateString())}</td>
                    <td className="px-4 py-2 space-x-2">
                      <button className="text-indigo-600 hover:underline text-xs" onClick={() => handleViewDetails(req)}>View Details</button>
                      {canCreateInvoice && (
                        <>
                          <button className="text-green-600 hover:underline text-xs" onClick={() => handleCreateInvoice(req.id)}>Create Invoice</button>
                          <button className="text-red-600 hover:underline text-xs" onClick={() => setConfirmDeleteId(req.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(hideCompleted ? assignedRequests.filter(req => req.status !== 'completed') : assignedRequests).length === 0 && (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">No assigned requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{showDetails.issueDescription}</h2>
              <button
                onClick={() => setShowDetails(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="mb-4 flex gap-4">
              <div><span className="font-semibold">Unit:</span> {showDetails.unitProperty}</div>
              <div><span className="font-semibold">Status:</span> <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{showDetails.status}</span></div>
              <div><span className="font-semibold">Priority:</span> {showDetails.priority || '-'}</div>
            </div>
            <div className="border-t pt-4">
              <div className="h-64 overflow-y-auto bg-gray-50 rounded p-4 mb-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`mb-2 flex ${msg.sender === 'S' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender === 'A' ? 'bg-gray-200 text-gray-900' : 'bg-blue-100 text-blue-900'}`}>
                      {msg.text}
                      <div className="text-xs text-gray-400 mt-1">{msg.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                />
                <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSendMessage}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Submitted Invoices Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Submitted Invoices</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2">{inv.description}</td>
                  <td className="px-4 py-2 font-semibold text-green-700">RM{inv.totalAmount}</td>
                  <td className="px-4 py-2">{inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : inv.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{inv.status === 'pending_payment' ? 'Pending' : inv.status}</span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <button className="text-blue-600 hover:underline text-xs" onClick={() => handleExportPDF(inv)}>Export</button>
                    {inv.status === 'pending_payment' && typeof inv.id === 'string' && inv.id.length === 20 && (
                      <button className="text-red-600 hover:underline text-xs" onClick={() => handleCancelInvoice(inv.id)}>Cancel</button>
                    )}
                    {inv.status === 'paid' && typeof inv.id === 'string' && inv.id.length === 20 && (
                      <button className="text-red-600 hover:underline text-xs" onClick={() => handleCancelInvoice(inv.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {myInvoices.length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">No invoices submitted</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {invoiceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Invoice</h2>
              <button
                onClick={() => setInvoiceModal({ open: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                className="border rounded px-3 py-2 w-full"
                value={invoiceForm.description}
                onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                placeholder="Invoice description"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Amount (RM)</label>
              <input
                type="number"
                min="0"
                className="border rounded px-3 py-2 w-full"
                value={invoiceForm.amount}
                onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                placeholder="Amount"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                onClick={() => setInvoiceModal({ open: false })}
                disabled={creatingInvoice}
              >Cancel</button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                onClick={handleSubmitInvoice}
                disabled={creatingInvoice || !invoiceForm.description || !invoiceForm.amount}
              >{creatingInvoice ? 'Creating...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-2">
            <h2 className="text-lg font-bold mb-4">Delete Request?</h2>
            <p className="mb-6">Are you sure you want to delete this completed request? This will hide it from your view but not from admin or tenant.</p>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => setConfirmDeleteId(null)}
              >Cancel</button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                onClick={async () => {
                  if (!user) return;
                  await updateDoc(doc(db, 'maintenance_requests', confirmDeleteId), { hiddenFor: arrayUnion(user.id) });
                  setAssignedRequests(prev => prev.filter(r => r.id !== confirmDeleteId));
                  setConfirmDeleteId(null);
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 