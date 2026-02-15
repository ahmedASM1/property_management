'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTenantContractUnits } from '@/hooks/useTenantContractUnits';
import MaintenanceRequestList from '../../../components/MaintenanceRequestList';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

const REQUEST_TYPES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'service', label: 'Service' },
];
const SERVICE_TYPES = [
  'Cleaning',
  'AC Repair',
  'Plumbing',
  'Furniture Assembly',
  'Electrical Work',
  'Pest Control',
  'Other',
];

export default function MaintenancePage() {
  const auth = useAuth();
  const user = auth?.user;
  const { units: contractUnits, loading: contractUnitsLoading } = useTenantContractUnits(user?.id);
  const [requestType, setRequestType] = useState<'maintenance' | 'service'>('maintenance');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(user?.unitNumber || '');
  const [priority, setPriority] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [customService, setCustomService] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill unit from contract when available; fallback to user.unitNumber
  useEffect(() => {
    if (contractUnits.length > 0) {
      setUnit(contractUnits[0].value);
    } else if (user?.unitNumber) {
      setUnit(user.unitNumber);
    }
  }, [contractUnits, user?.unitNumber]);

  if (!user) return null;
  if (user.role !== 'tenant') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-gray-700">This page is only accessible to tenants.</h2>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);
    try {
      if (!description.trim()) {
        setError('Description is required.');
        setSubmitting(false);
        return;
      }
      if (!unit.trim()) {
        setError('Unit/Property is required.');
        setSubmitting(false);
        return;
      }
      if (requestType === 'maintenance' && !priority) {
        setError('Priority is required.');
        setSubmitting(false);
        return;
      }
      if (requestType === 'service') {
        if (!serviceType) {
          setError('Service type is required.');
          setSubmitting(false);
          return;
        }
        if (serviceType === 'Other' && !customService.trim()) {
          setError('Please specify your service.');
          setSubmitting(false);
          return;
        }
    }
      const requestData: Record<string, unknown> = {
        userId: user.id,
        tenantName: user.fullName || 'N/A',
        tenantPhone: user.phoneNumber || 'N/A',
        buildingName: user.buildingName || 'N/A',
        unitProperty: unit,
        issueDescription: description,
        type: requestType,
      status: 'pending',
      createdAt: serverTimestamp(),
        messages: [],
      };

      if (requestType === 'maintenance') {
        requestData.priority = priority;
      } else if (requestType === 'service') {
        requestData.serviceType = serviceType === 'Other' ? customService : serviceType;
      }

      await addDoc(collection(db, 'maintenance_requests'), requestData);

    await addDoc(collection(db, 'notifications'), {
      role: 'admin',
        message: `New ${requestType} request submitted by ${user.fullName || user.email || user.id} (Unit ${unit})`,
      read: false,
      createdAt: serverTimestamp(),
    });
      setDescription('');
      setUnit(contractUnits.length > 0 ? contractUnits[0].value : (user?.unitNumber || ''));
      setPriority('');
      setServiceType('');
      setCustomService('');
      setSuccess(true);
    } catch (err: unknown) {
      console.error('Failed to submit request:', err);
      setError('Failed to submit request.');
    } finally {
      setSubmitting(false);
  }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-2">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold text-center">Maintenance Requests</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8 font-[Inter] w-full max-w-2xl mx-auto mb-10">
        <div className="flex flex-col gap-6">
          <div>
            <label className="block font-semibold mb-1">Request Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={requestType}
              onChange={e => setRequestType(e.target.value as 'maintenance' | 'service')}
            >
              {REQUEST_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
          required
              placeholder={requestType === 'maintenance' ? 'Describe the issue in your unit, room, or property...' : 'Describe the service you need...'}
        />
          </div>
          <div>
            <label className="block font-semibold mb-1">Unit / Property</label>
            {contractUnitsLoading ? (
              <div className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-500 text-sm">Loading unit from contract...</div>
            ) : contractUnits.length > 0 ? (
              <select
                className="w-full border rounded px-3 py-2"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                required
              >
                {contractUnits.map((opt) => (
                  <option key={opt.contractId} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                className="w-full border rounded px-3 py-2"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="Unit / Property (from your contract when available)"
                required
              />
            )}
            {contractUnits.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">Unit is taken from your active contract.</p>
            )}
          </div>
          {requestType === 'maintenance' && (
            <div>
              <label className="block font-semibold mb-1">Priority</label>
        <select
                className="w-full border rounded px-3 py-2"
                value={priority}
                onChange={e => setPriority(e.target.value)}
                required
              >
                <option value="">Select priority</option>
                <option value="Low">Low</option>
          <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          )}
          {requestType === 'service' && (
            <div>
              <label className="block font-semibold mb-1">Service Type</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                required
              >
                <option value="">Select service type</option>
                {SERVICE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
        </select>
              {serviceType === 'Other' && (
        <input
                  type="text"
                  className="mt-2 w-full border rounded px-3 py-2"
                  placeholder="Please specify your service"
                  value={customService}
                  onChange={e => setCustomService(e.target.value)}
                  required
                />
              )}
            </div>
          )}
        <button
          type="submit"
            className="w-full py-3 rounded-xl font-bold text-lg shadow-lg transition bg-[#1C7ED6] hover:bg-blue-800 text-white flex items-center justify-center"
            disabled={submitting}
        >
            {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
          {success && <div className="text-green-600 text-center mt-2">Request submitted successfully!</div>}
          {error && <div className="text-red-600 text-center mt-2">{error}</div>}
        </div>
      </form>
      <MaintenanceRequestList />
    </div>
  );
} 