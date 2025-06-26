'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, where, onSnapshot, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

interface ServiceProvider {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  serviceType: string;
}

interface Message {
  sender: string;
  text: string;
  timestamp: string | Date;
  senderName?: string;
}

interface MaintenanceRequest {
  id:string;
  issueDescription: string;
  unitProperty: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed' | 'delayed' | 'faced an issue';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  buildingName: string;
  createdAt: string | Date;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  providerInstructions?: string;
  messages: Message[];
  hiddenFor?: string[];
}

interface RequestState {
  selectedProvider: string;
  providerInstructions: string;
  isAssigning: boolean;
}

const statusOptions = ['pending', 'in progress', 'completed', 'delayed', 'faced an issue'] as const;

// Helper to convert Firestore Timestamps or ISO strings to Date objects
const toDate = (timestamp: unknown): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    return (timestamp as { toDate(): Date }).toDate(); // Firestore Timestamp
  }
  if (typeof timestamp === 'string') return new Date(timestamp); // ISO String
  return null;
};

export default function AdminMaintenancePage() {
  const auth = useAuth();
  const adminUser = auth?.user;
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [requestStates, setRequestStates] = useState<Record<string, RequestState>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // Listener for real-time updates
    const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const updatedRequests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          messages: doc.data().messages || []
        })) as MaintenanceRequest[];
        
      const visibleRequests = adminUser?.id
        ? updatedRequests.filter(req => !Array.isArray(req.hiddenFor) || !req.hiddenFor.includes(adminUser.id))
        : [];
      setRequests(visibleRequests);
        
      // Initialize or update request states
        setRequestStates(prevStates => {
          const newStates = { ...prevStates };
          updatedRequests.forEach(request => {
            if (!newStates[request.id]) {
              newStates[request.id] = {
              selectedProvider: request.assignedTo || '',
              providerInstructions: request.providerInstructions || '',
              isAssigning: false,
              };
            }
          });
          return newStates;
        });
        
      if (loading) setLoading(false);
    }, (error) => {
        console.error('Error in real-time updates:', error);
      setLoading(false);
    });

    // Fetch service providers once
    async function fetchProviders() {
    try {
        const providersQuery = query(collection(db, 'users'), where('role', '==', 'service'));
        const providersSnap = await getDocs(providersQuery);
        const providersData = providersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ServiceProvider[];
        setServiceProviders(providersData);
    } catch (error) {
        console.error('Error fetching service providers:', error);
      }
    }
    fetchProviders();

    return () => unsubscribe();
  }, [loading, adminUser?.id]);

  async function handleDeleteRequest(requestId: string) {
    setDeletingId(requestId);
    try {
      await deleteDoc(doc(db, 'maintenance_requests', requestId));
    } catch (error) {
      console.error('Error deleting request:', error);
      } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  async function handleStatusChange(request: MaintenanceRequest, newStatus: string) {
    try {
      await updateDoc(doc(db, 'maintenance_requests', request.id), { status: newStatus });
      // Notify tenant
      await addDoc(collection(db, 'notifications'), {
        userId: request.userId,
        message: `Your ${request.type} request status has been updated to: ${newStatus}`,
        read: false,
        createdAt: serverTimestamp(),
      });
      // Also notify assigned service provider if there is one
      if (request.assignedTo) {
        await addDoc(collection(db, 'notifications'), {
            userId: request.assignedTo,
            message: `Status for request on unit ${request.unitProperty} updated to: ${newStatus}`,
            read: false,
            createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async function handleScheduleDate(request: MaintenanceRequest, date: Date | null) {
    if (!date) return;
    try {
      const scheduledDate = date.toISOString();
      await updateDoc(doc(db, 'maintenance_requests', request.id), { scheduledDate, status: 'in progress' });

      const notifications = [{
        userId: request.userId,
        message: `Your ${request.type} request has been scheduled for: ${date.toLocaleDateString()}`,
      }];

      if (request.assignedTo) {
        notifications.push({
          userId: request.assignedTo,
          message: `Request for unit ${request.unitProperty} is scheduled for: ${date.toLocaleDateString()}`,
        });
      }

      for (const { userId, message } of notifications) {
        await addDoc(collection(db, 'notifications'), { userId, message, read: false, createdAt: serverTimestamp() });
      }
    } catch (error) {
      console.error('Error scheduling date:', error);
    }
  }

  async function handleAssignProvider(request: MaintenanceRequest) {
    const requestState = requestStates[request.id];
    if (!requestState || !requestState.selectedProvider) return;
    
    setRequestStates(prev => ({ ...prev, [request.id]: { ...requestState, isAssigning: true } }));

    try {
      const provider = serviceProviders.find(p => p.id === requestState.selectedProvider);
      if (!provider) return;

      const systemMessage = {
        sender: 'system',
        text: `Request assigned to provider: ${provider.fullName}.`,
        timestamp: new Date().toISOString(),
        senderName: 'System'
      };

      await updateDoc(doc(db, 'maintenance_requests', request.id), {
          assignedTo: provider.id,
          assignedProviderName: provider.fullName,
          providerInstructions: requestState.providerInstructions.trim(),
          status: 'in progress',
        messages: arrayUnion(systemMessage),
        assignedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: provider.id,
        message: `New maintenance request assigned for unit ${request.unitProperty}`,
        read: false,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Error assigning provider:', error);
      } finally {
      setRequestStates(prev => ({ ...prev, [request.id]: { ...requestState, isAssigning: false } }));
    }
  }

  async function handleSendMessage() {
    if (!selectedRequest || !newMessage.trim() || !adminUser) return;
    
    const message: Message = {
      sender: adminUser.id,
      senderName: adminUser.fullName || 'Admin',
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'maintenance_requests', selectedRequest.id), {
        messages: arrayUnion(message)
      });
      setSelectedRequest(prev => {
        if (!prev) return null;
        return { ...prev, messages: [...prev.messages, message] };
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold text-center">Maintenance & Service Requests</h1>
      </div>
      <div className="grid gap-6">
        {requests.map(request => {
          const requestState = requestStates[request.id] || { selectedProvider: '', providerInstructions: '', isAssigning: false };
          const createdDate = toDate(request.createdAt);
          const scheduledDate = toDate(request.scheduledDate);
          
          return (
            <div key={request.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{request.issueDescription}</h3>
                    <p className="text-sm text-gray-500">Tenant: {request.tenantName} • Phone: {request.tenantPhone}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium
                    ${request.status === 'completed' ? 'bg-green-100 text-green-800' :
                      request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {request.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1 border-t border-b py-2 my-2">
                  <p><span className="font-medium">Unit/Property:</span> {request.unitProperty}</p>
                  <p><span className="font-medium">Building:</span> {request.buildingName}</p>
                  <p><span className="font-medium">Request Type:</span> {request.type}</p>
                  {request.serviceType && <p><span className="font-medium">Service:</span> {request.serviceType}</p>}
                  {createdDate && <p><span className="font-medium">Created:</span> {createdDate.toLocaleString()}</p>}
                  {scheduledDate && <p className="font-medium text-blue-600">Scheduled: {scheduledDate.toLocaleString()}</p>}
                  {request.assignedProviderName && <p className="font-medium text-green-600">Assigned to: {request.assignedProviderName}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      className="w-full border rounded-md shadow-sm px-3 py-2"
                      value={request.status}
                      onChange={(e) => handleStatusChange(request, e.target.value)}
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date</label>
                    <DatePicker
                      selected={scheduledDate}
                      onChange={(date) => handleScheduleDate(request, date)}
                      className="w-full border rounded-md shadow-sm px-3 py-2"
                      placeholderText="Select date"
                      minDate={new Date()}
                      showTimeSelect
                      dateFormat="Pp"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Provider</label>
                    <select
                      className="w-full border rounded-md shadow-sm px-3 py-2"
                      value={requestState.selectedProvider}
                      onChange={(e) => setRequestStates(prev => ({ ...prev, [request.id]: { ...requestState, selectedProvider: e.target.value } }))}
                      disabled={!!request.assignedTo}
                    >
                      <option value="">Select provider</option>
                      {serviceProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.fullName} - {provider.serviceType}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button onClick={() => setSelectedRequest(request)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                      View Messages ({request.messages.length})
                    </button>
                    {request.status === 'completed' && (
                    <>
                      <button
                        onClick={() => setConfirmDelete(request.id)}
                        disabled={deletingId === request.id}
                        className="ml-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deletingId === request.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!adminUser) return;
                          await updateDoc(doc(db, 'maintenance_requests', request.id), { hiddenFor: arrayUnion(adminUser.id) });
                        }}
                        className="ml-2 px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition"
                      >
                        Hide
                      </button>
                    </>
                    )}
                  </div>
                </div>

                {requestState.selectedProvider && !request.assignedTo && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions for Provider</label>
                    <textarea
                      value={requestState.providerInstructions}
                      onChange={(e) => setRequestStates(prev => ({ ...prev, [request.id]: { ...requestState, providerInstructions: e.target.value } }))}
                      className="w-full border rounded-md shadow-sm px-3 py-2"
                      rows={2}
                      placeholder="Add instructions..."
                    />
                    <button
                      onClick={() => handleAssignProvider(request)}
                      disabled={requestState.isAssigning || !requestState.providerInstructions.trim()}
                      className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {requestState.isAssigning ? 'Assigning...' : 'Assign & Notify Provider'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Messages Modal */}
      {selectedRequest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} 
                onClick={() => setSelectedRequest(null)}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Messages</h3>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            <div className="h-80 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
              {selectedRequest.messages.map((message, index) => {
                const messageDate = toDate(message.timestamp);
                const isAdmin = message.sender === adminUser?.id;
    return (
                  <div key={index} className={`mb-3 flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${isAdmin ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                      <div className="text-sm font-bold">
                        {message.senderName || message.sender}
                        {isAdmin && <span className="font-normal text-xs opacity-75 ml-1">(Admin)</span>}
                  </div>
                      <p className="text-sm">{message.text}</p>
                      {messageDate && <div className="text-xs mt-1 text-right opacity-70">{messageDate.toLocaleString()}</div>}
                </div>
            </div>
          );
        })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a message..."
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} 
          onClick={() => setConfirmDelete(null)}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure you want to delete this maintenance request? This cannot be undone.</p>
            <div className="flex justify-end space-x-3">
                    <button
                onClick={() => setConfirmDelete(null)}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                Cancel
                    </button>
                    <button
                onClick={() => handleDeleteRequest(confirmDelete)}
                disabled={!!deletingId}
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
