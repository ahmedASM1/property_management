'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaPaperPlane } from 'react-icons/fa';

interface Message {
  sender: string;
  senderName: string;
  text: string;
  timestamp: any;
}
interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  buildingName: string;
  createdAt: any;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  providerInstructions?: string;
  messages: Message[];
  fileUrls?: string[];
}
export default function RequestItemPage() {
  const auth = useAuth();
  const user = auth?.user;
  const searchParams = useSearchParams();
  const requestId = searchParams.get('id');

  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError('No request ID provided.');
      setLoading(false);
      return;
    }
    if (!user) return;

    const fetchRequest = async () => {
      try {
        const docRef = doc(db, 'maintenance_requests', requestId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const requestData = { id: docSnap.id, ...docSnap.data() } as MaintenanceRequest;
          // Security check: ensure the user is authorized to view this
          if (requestData.userId !== user.id && user.role !== 'admin' && user.role !== 'service') {
            setError('You are not authorized to view this request.');
          } else {
            setRequest(requestData);
          }
        } else {
          setError('Request not found.');
        }
      } catch (err) {
        setError('Failed to fetch request details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [requestId, user]);

  const handleStatusChange = async (newStatus: 'in progress' | 'completed') => {
    if (!request || !user) return;

    try {
      const requestRef = doc(db, 'maintenance_requests', request.id);
      
      // Add a system message about the status change
      const systemMessage: Message = {
        sender: 'system',
        senderName: 'System',
        text: `Status updated to "${newStatus}" by ${user.fullName}.`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(requestRef, {
        status: newStatus,
        messages: arrayUnion(systemMessage)
      });
      
      // Update local state
      setRequest(prev => prev ? { ...prev, status: newStatus, messages: [...prev.messages, systemMessage] } : null);

      // Create notifications for admin and tenant
      const tenantNotification = addDoc(collection(db, 'notifications'), {
        userId: request.userId,
        message: `Status of your request for unit ${request.unitProperty} is now: ${newStatus}`,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      const adminNotification = addDoc(collection(db, 'notifications'), {
        role: 'admin',
        message: `Service provider ${user.fullName} updated request for unit ${request.unitProperty} to: ${newStatus}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      await Promise.all([tenantNotification, adminNotification]);

    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status.');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !request) return;

    setIsSending(true);
    const message: Message = {
      sender: user.id,
      senderName: user.fullName || 'User',
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    
    try {
      const requestRef = doc(db, 'maintenance_requests', request.id);
      await updateDoc(requestRef, {
        messages: arrayUnion(message)
      });
      // Add message to local state for immediate UI update
      setRequest(prev => prev ? { ...prev, messages: [...prev.messages, message] } : null);
      setNewMessage('');

      // Create notifications
      const recipientRole = user.role === 'admin' ? 'tenant' : 'admin';
      const recipientId = user.role === 'admin' ? request.userId : 'some-admin-id-placeholder'; // Requires a method to target admins
      
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        message: `New message on request for unit ${request.unitProperty} from ${user.fullName}`,
        read: false,
        createdAt: serverTimestamp(),
      });


    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
  return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
} 
  if (error) {
    return <div className="text-center py-10 text-red-500">{error}</div>;
  }
  if (!request) {
    return <div className="text-center py-10">No request details available.</div>;
  }
  // Helper to convert various timestamp formats to a Date object
  const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate(); // Firestore Timestamp
    if (typeof timestamp === 'string') return new Date(timestamp); // ISO String or other date string
    if (typeof timestamp === 'number') return new Date(timestamp); // Unix timestamp
    return null;
  };
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-800">{request.issueDescription}</h1>
          <div className="text-sm text-gray-500 mt-2 flex items-center gap-4">
            <span>Unit: {request.unitProperty}</span>
            <div className="flex items-center gap-1">
              <span>Status:</span>
              {(user?.role === 'service' && user?.id === request.assignedTo) ? (
          <select
                  value={request.status}
                  onChange={(e) => handleStatusChange(e.target.value as 'in progress' | 'completed')}
                  className={`ml-1 px-2 py-1 text-xs font-semibold rounded-full border-none focus:ring-0 appearance-none ${
                    request.status === 'completed' ? 'bg-green-100 text-green-800' :
                    request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}
          >
                  <option value="in progress">In Progress</option>
                  <option value="completed">Completed</option>
          </select>
              ) : (
                <span className={`ml-1 px-2 py-1 text-xs font-semibold rounded-full ${
                  request.status === 'completed' ? 'bg-green-100 text-green-800' :
                  request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>{request.status}</span>
              )}
            </div>
            <span>Priority: {request.priority}</span>
          </div>
        </div>
        {/* Body */}
        <div className="p-6">
          {/* Messages */}
          <div className="h-96 overflow-y-auto mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            {request.messages.map((msg, index) => {
              const messageDate = toDate(msg.timestamp);
              const isSender = msg.sender === user?.id;
              return(
              <div key={index} className={`flex items-end gap-3 ${isSender ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center font-bold text-sm text-white
                  ${isSender ? 'bg-blue-500' : 'bg-green-500'}`}>
                  {msg.senderName?.charAt(0) || '?'}
                </div>
                <div className={`p-3 rounded-lg max-w-lg ${isSender ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  <p className="text-sm text-gray-800">{msg.text}</p>
                  {messageDate && (
                    <p className="text-xs text-gray-500 mt-1 text-right">{messageDate.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )})}
          </div>

          {/* Message Input */}
          <div className="flex items-center gap-3">
              <input
                type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Type your message..."
            />
            <button
              onClick={handleSendMessage}
              disabled={isSending || !newMessage.trim()}
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-blue-300 transition"
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 
 
 
 