'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { MaintenanceRequest } from '@/types';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function CreateInvoicePage() {
  const auth = useAuth();
  const user = auth?.user;
  const searchParams = useSearchParams();
  const requestIdFromUrl = searchParams.get('requestId');

  const [completedRequests, setCompletedRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function fetchRequests() {
      if (!user) return;
      try {
        if (requestIdFromUrl) {
          const requestDoc = await getDoc(doc(db, 'maintenance_requests', requestIdFromUrl));
          if (requestDoc.exists()) {
            const requestData = { id: requestDoc.id, ...requestDoc.data() } as MaintenanceRequest;
            if (requestData.assignedTo === user.id && requestData.status === 'completed') {
              setCompletedRequests([requestData]);
              setSelectedRequest(requestData.id);
              setDescription(`Invoice for service on unit ${requestData.unitProperty}: ${requestData.issueDescription}`);
            } else {
              setError('This request cannot be invoiced or does not belong to you.');
            }
          } else {
            setError('Request not found.');
          }
        } else {
          const q = query(
            collection(db, 'maintenance_requests'),
            where('assignedTo', '==', user.id),
            where('status', '==', 'completed')
          );
          const snapshot = await getDocs(q);
          const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MaintenanceRequest[];
          setCompletedRequests(requests);
        }
      } catch (err) {
        console.error('Error fetching completed requests:', err);
        setError('Failed to load completed jobs.');
      }
    }
    if (user) {
      fetchRequests();
    }
  }, [user, requestIdFromUrl]);

  const handleRequestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const requestId = e.target.value;
    setSelectedRequest(requestId);
    const request = completedRequests.find(r => r.id === requestId);
    if (request) {
      setDescription(`Invoice for service on unit ${request.unitProperty}: ${request.issueDescription}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedRequest || !amount || !description) {
      setError('Please fill out all fields.');
      return;
    }
    
    setSubmitting(true);
    try {
      const request = completedRequests.find(r => r.id === selectedRequest);
      if (!request || !user) {
        setError('Selected request not found or user not logged in.');
        setSubmitting(false);
        return;
      }
      
      await addDoc(collection(db, 'invoices'), {
        from: user.fullName,
        fromId: user.id,
        to: 'Admin',
        toId: 'admin', // Generic admin ID or specific one if available
        maintenanceRequestId: selectedRequest,
        description,
        totalAmount: parseFloat(amount),
        status: 'pending_payment',
        isPaid: false,
        createdAt: serverTimestamp(),
        invoiceDate: new Date().toISOString(),
      });
      
      setSuccess('Invoice submitted successfully!');
      setSelectedRequest('');
      setAmount('');
      setDescription('');

    } catch (err) {
      console.error('Error submitting invoice:', err);
      setError('Failed to submit invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold text-center">Create Invoice for Admin</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {requestIdFromUrl ? 'Selected Job' : 'Select Completed Job'}
          </label>
          {requestIdFromUrl && completedRequests.length > 0 ? (
            <div className="w-full border rounded-md shadow-sm px-3 py-2 bg-gray-100">
              {completedRequests[0].issueDescription} (Unit: {completedRequests[0].unitProperty})
            </div>
          ) : (
            <select
              value={selectedRequest}
              onChange={handleRequestChange}
              className="w-full border rounded-md shadow-sm px-3 py-2"
              required
              disabled={!!requestIdFromUrl}
            >
              <option value="">-- Select a Job --</option>
              {completedRequests.map(req => (
                <option key={req.id} value={req.id}>
                  {req.issueDescription} (Unit: {req.unitProperty})
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (RM)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-md shadow-sm px-3 py-2"
            placeholder="e.g., 150.00"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border rounded-md shadow-sm px-3 py-2"
            placeholder="Invoice details..."
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Invoice'}
        </button>
        {success && <p className="text-green-600 text-center">{success}</p>}
        {error && <p className="text-red-600 text-center">{error}</p>}
      </form>
    </div>
  );
} 