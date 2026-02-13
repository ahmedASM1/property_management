import React, { useEffect, useState } from 'react';
import { createNotification, NotificationMessages } from '@/utils/notificationUtils';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture',
  'Electrical',
  'TV Repair',
  'Other',
];

interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  phone: string;
  serviceTypes: string[];
  active: boolean;
}

interface Request {
  id: string;
  issueDescription: string;
  unitProperty: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  fileUrls?: string[];
  createdAt?: Date | string;
  status?: string;
  adminReply?: string;
  scheduledDate?: Date | string;
  messages?: { sender: 'admin' | 'tenant' | 'service'; text: string; timestamp: Date | string }[];
  serviceType?: string;
  customServiceType?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  userId?: string;
  hiddenFor?: string[];
  type?: string;
}

function formatDate(date: Date | string | undefined) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

export default function MaintenanceRequestList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Request | null>(null);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('in progress');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'admin' | 'tenant' | 'service'; text: string; timestamp: Date | string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [serviceType, setServiceType] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    
    async function fetchRequests() {
      setLoading(true);
      let q;
      if (user?.role === 'admin') {
        q = query(collection(db, 'maintenance_requests'));
      } else {
        q = query(collection(db, 'maintenance_requests'), where('userId', '==', user?.id));
      }
      const snap = await getDocs(q);
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request)));
      setLoading(false);
    }
    async function fetchProviders() {
      const snap = await getDocs(collection(db, 'serviceProviders'));
      setServiceProviders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceProvider)));
    }
    fetchRequests();
    fetchProviders();
  }, [user]);

  const openModal = (req: Request) => {
    setSelected(req);
    setReply(req.adminReply || '');
    setStatus(req.status || 'in progress');
    setScheduledDate(req.scheduledDate ? new Date(req.scheduledDate) : null);
    setMessages(req.messages || []);
    setServiceType(req.serviceType || '');
    setAssignedTo(req.assignedTo || '');
  };
  const closeModal = () => {
    setSelected(null);
    setReply('');
    setStatus('in progress');
    setScheduledDate(null);
  };
  const handleSave = async () => {
    if (!selected || !user) return;
    setSaving(true);
    const docData: Partial<Request> = {
      userId: selected.userId,
      unitProperty: selected.unitProperty,
      issueDescription: selected.issueDescription,
      type: 'maintenance',
      status: status,
      createdAt: new Date(),
      messages: messages,
    };
    if (selected.priority) docData.priority = selected.priority;
    if (selected.serviceType) {
      if (selected.serviceType === 'Other') {
        docData.customServiceType = serviceType;
      } else {
        docData.serviceType = selected.serviceType;
      }
    }
    if (selected.scheduledDate) {
      const date = typeof selected.scheduledDate === 'string' ? new Date(selected.scheduledDate) : selected.scheduledDate;
      docData.scheduledDate = date.toISOString();
    }
    if (selected.assignedTo) docData.assignedTo = selected.assignedTo;
    await updateDoc(doc(db, 'maintenance_requests', selected.id), docData);
    setRequests(reqs => reqs.map(r => r.id === selected.id ? { ...r, ...docData } : r));
    // Notify tenant
    if (selected.userId) {
      await createNotification({
        message: `Your request has been updated. Status: ${status}${selected.assignedTo ? ', Assigned to provider.' : ''}`,
        type: 'info',
        userId: selected.userId,
        priority: 'medium'
      });
    }
    // Notify provider if assigned
    if (selected.assignedTo) {
      await createNotification({
        message: NotificationMessages.MAINTENANCE_ASSIGNED(selected.assignedProviderName || 'Service Provider', selected.unitProperty),
        type: 'info',
        userId: selected.assignedTo,
        priority: 'medium'
      });
    }
    setSaving(false);
    closeModal();
  };
  const handleSendMessage = async () => {
    if (!selected || !newMessage.trim() || !user) return;
    const msg = {
      sender: user.role as 'admin' | 'tenant' | 'service',
      text: newMessage,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...messages, msg];
    await updateDoc(doc(db, 'maintenance_requests', selected.id), {
      messages: updatedMessages,
    });
    setMessages(updatedMessages);
    setNewMessage('');
    setRequests(reqs => reqs.map(r => r.id === selected.id ? { ...r, messages: updatedMessages } : r));
  };

  if (!user) return null;

  const visibleRequests = requests.filter(req => !Array.isArray(req.hiddenFor) || !req.hiddenFor.includes(user?.id));

  if (loading) return <div className="text-center text-gray-500">Loading requests...</div>;

  return (
    <div className="space-y-4 font-[Inter]" aria-label={user.role === 'admin' ? 'All maintenance requests' : 'Your maintenance requests'}>
      {visibleRequests.length === 0 ? (
        <div className="text-gray-500 text-center">No maintenance requests submitted yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
          {visibleRequests.map(req => (
            <div key={req.id} className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col gap-4 min-w-0 w-full max-w-full border-l-4 border-[#1C7ED6] transition hover:shadow-xl">
              {/* Request Description */}
              <div className="font-bold text-base sm:text-lg text-gray-900 mb-2 break-words leading-snug">{req.issueDescription}</div>
              {/* Status Badge */}
              <span className={`self-start px-4 py-1 rounded-full text-xs sm:text-sm font-semibold mb-1
                ${req.status === 'completed' ? 'bg-green-100 text-green-700' :
                  req.status === 'in progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'}`}>
                {req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}
              </span>
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-500 text-xs sm:text-sm border-b border-gray-100 pb-2">
                <span><b>Unit:</b> {req.unitProperty}</span>
                <span><b>Priority:</b> {req.priority}</span>
                <span><b>Submitted:</b> {formatDate(req.createdAt)}</span>
              </div>
              {req.serviceType && (
                <div className="text-xs sm:text-sm text-gray-700 mt-1"><b>Service Type:</b> {req.serviceType}</div>
              )}
              {req.assignedTo && (
                <div className="text-xs sm:text-sm text-gray-700 mt-1">
                  <b>Assigned To:</b> {serviceProviders.find(p => p.id === req.assignedTo)?.name || 'Unassigned'}
                </div>
              )}
              {/* File Attachments */}
              {req.fileUrls && Array.isArray(req.fileUrls) && req.fileUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {req.fileUrls.map((url, idx) =>
                    typeof url === 'string' && url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Attachment" className="w-20 h-16 object-cover rounded border" />
                      </a>
                    ) : typeof url === 'string' && url.match(/\.pdf$/i) ? (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-700 hover:underline">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> PDF
                      </a>
                    ) : null
                  )}
                </div>
              )}
              {/* Admin Reply */}
              {req.adminReply && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 sm:p-4 rounded-xl mt-4">
                  <div className="font-semibold text-blue-800 mb-1 flex items-center gap-2 text-xs sm:text-sm">
                    Admin Reply
                  </div>
                  <div className="text-gray-800 text-xs sm:text-sm">{req.adminReply}</div>
                </div>
              )}
              {/* Scheduled Date */}
              {req.scheduledDate && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 sm:p-4 rounded-xl mt-2 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="font-semibold text-green-800 text-xs sm:text-sm">Scheduled:</span>
                  <span className="text-gray-800 text-xs sm:text-sm">{formatDate(req.scheduledDate)}</span>
                </div>
              )}
              {/* Admin view: reply modal button */}
              <button
                className="mt-2 px-4 py-2 bg-[#1C7ED6] text-white rounded-xl shadow hover:bg-blue-800 transition text-sm font-semibold w-full"
                onClick={() => openModal(req)}
              >
                View & Reply
              </button>
              {req.status === 'completed' && (
                <button
                  onClick={async () => {
                    await updateDoc(doc(db, 'maintenance_requests', req.id), { hiddenFor: arrayUnion(user.id) });
                  }}
                  className="ml-2 px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition"
                >
                  Hide
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Modal for admin actions */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md relative font-[Inter]">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={closeModal}>&times;</button>
            <h2 className="text-xl font-bold mb-2 text-[#1C7ED6]">Maintenance Request</h2>
            <div className="mb-2"><span className="font-semibold">Issue:</span> {selected.issueDescription}</div>
            <div className="mb-2"><span className="font-semibold">Unit:</span> {selected.unitProperty}</div>
            <div className="mb-2"><span className="font-semibold">Priority:</span> {selected.priority}</div>
            <div className="mb-2"><span className="font-semibold">Submitted:</span> {formatDate(selected.createdAt)}</div>
            {selected.serviceType && (
              <div className="mb-2"><span className="font-semibold">Service Type:</span> {selected.serviceType}</div>
            )}
            {selected.assignedTo && (
              <div className="mb-2"><span className="font-semibold">Assigned To:</span> {serviceProviders.find(p => p.id === selected.assignedTo)?.name || 'Unassigned'}</div>
            )}
            {/* Chat Thread */}
            <div className="mb-4 max-h-48 overflow-y-auto bg-gray-50 rounded p-2 border">
              {messages.length === 0 && <div className="text-gray-400 text-sm">No messages yet.</div>}
              {messages.map((msg, idx) => (
                <div key={idx} className={`mb-2 flex ${msg.sender === user.role ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender === 'admin' ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900'}`}>{msg.text}
                    <div className="text-xs text-gray-400 mt-1">{formatDate(msg.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Message Input */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="flex-1 border rounded px-3 py-2"
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
              />
              <button
                className="px-4 py-2 bg-[#1C7ED6] text-white rounded hover:bg-blue-800 transition"
                onClick={handleSendMessage}
              >Send</button>
            </div>
            {/* Admin controls: reply, status, schedule */}
            {user.role === 'admin' && (
              <>
                <div className="mb-2">
                  <label className="block font-semibold mb-1">Service Type</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={serviceType}
                    onChange={e => {
                      setServiceType(e.target.value);
                      setAssignedTo('');
                    }}
                  >
                    <option value="">Select service type</option>
                    {SERVICE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block font-semibold mb-1">Assign to Provider</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    disabled={!serviceType}
                  >
                    <option value="">Select provider</option>
                    {serviceProviders.filter(p => p.active && p.serviceTypes.includes(serviceType)).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.serviceTypes.join(', ')})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block font-semibold mb-1">Admin Reply</label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={3}
                    placeholder="Type your reply to the tenant..."
                  />
                </div>
                <div className="mb-2">
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="in progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Schedule Maintenance Date</label>
                  <DatePicker
                    selected={scheduledDate}
                    onChange={date => setScheduledDate(date)}
                    className="w-full border rounded px-3 py-2"
                    placeholderText="Select date"
                    dateFormat="yyyy-MM-dd"
                    minDate={new Date()}
                    isClearable
                  />
                </div>
                <button
                  className="w-full py-2 bg-[#1C7ED6] text-white rounded font-semibold hover:bg-blue-800 transition"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save & Reply'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 