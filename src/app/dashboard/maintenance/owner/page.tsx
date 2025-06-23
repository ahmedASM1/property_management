'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { 
  FaTools, 
  FaBuilding,
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFilter
} from 'react-icons/fa';

interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  buildingName: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  createdAt: any;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  completedAt?: any;
  messages: { sender: string; text: string; timestamp: any; senderName?: string }[];
}

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in progress' | 'completed'>('all');
  const [filterProperty, setFilterProperty] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.id)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch maintenance requests for all properties
        const allRequests: MaintenanceRequest[] = [];
        
        for (const property of properties) {
          try {
            const maintenanceQuery = query(
              collection(db, 'maintenance_requests'),
              where('unitProperty', '==', property.unitNumber)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            
            maintenanceSnapshot.docs.forEach(doc => {
              const request = doc.data() as MaintenanceRequest;
              allRequests.push({
                ...request,
                id: doc.id,
                buildingName: property.buildingName
              });
            });
          } catch (error) {
            console.error('Error fetching maintenance for property:', property.unitNumber, error);
          }
        }

        // Sort by creation date (newest first)
        allRequests.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setMaintenanceRequests(allRequests);

      } catch (error) {
        console.error('Error fetching maintenance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Filter requests based on selected filters
  const filteredRequests = maintenanceRequests.filter(request => {
    const statusMatch = filterStatus === 'all' || request.status === filterStatus;
    const propertyMatch = !filterProperty || request.unitProperty === filterProperty;
    return statusMatch && propertyMatch;
  });

  // Calculate summary statistics
  const totalRequests = filteredRequests.length;
  const pendingRequests = filteredRequests.filter(req => req.status === 'pending').length;
  const inProgressRequests = filteredRequests.filter(req => req.status === 'in progress').length;
  const completedRequests = filteredRequests.filter(req => req.status === 'completed').length;

  // Get unique properties for filter
  const properties = [...new Set(maintenanceRequests.map(req => req.unitProperty))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance History</h1>
        <p className="text-gray-600 mt-2">Track maintenance requests for your properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalRequests}</p>
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
              <p className="text-2xl font-bold text-yellow-600 mt-2">{pendingRequests}</p>
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
              <p className="text-2xl font-bold text-blue-600 mt-2">{inProgressRequests}</p>
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
              <p className="text-2xl font-bold text-green-600 mt-2">{completedRequests}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="h-4 w-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property} value={property}>{property}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterProperty('');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Maintenance Requests</h3>
              <p className="text-sm text-gray-500">Showing {filteredRequests.length} requests</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FaTools className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No maintenance requests found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or contact support.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{request.issueDescription}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.priority === 'high' ? 'bg-red-100 text-red-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FaBuilding className="h-4 w-4" />
                          <span>{request.unitProperty} - {request.buildingName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaUser className="h-4 w-4" />
                          <span>{request.tenantName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaPhone className="h-4 w-4" />
                          <span>{request.tenantPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="h-4 w-4" />
                          <span>{new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {request.assignedProviderName && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Assigned to:</span> {request.assignedProviderName}
                          </p>
                        </div>
                      )}

                      {request.scheduledDate && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Scheduled for:</span> {new Date(request.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Request Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Request Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Issue Description</p>
                    <p className="font-medium">{selectedRequest.issueDescription}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{selectedRequest.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority</p>
                    <p className="font-medium">{selectedRequest.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{selectedRequest.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="font-medium">{selectedRequest.unitProperty} - {selectedRequest.buildingName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.createdAt?.toDate ? selectedRequest.createdAt.toDate() : selectedRequest.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Tenant Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{selectedRequest.tenantName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedRequest.tenantPhone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Provider Info */}
              {selectedRequest.assignedProviderName && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Service Provider</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900">{selectedRequest.assignedProviderName}</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              {selectedRequest.messages && selectedRequest.messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Communication History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedRequest.messages.map((message, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {message.senderName || message.sender}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
 

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { 
  FaTools, 
  FaBuilding,
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFilter
} from 'react-icons/fa';

interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  buildingName: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  createdAt: any;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  completedAt?: any;
  messages: { sender: string; text: string; timestamp: any; senderName?: string }[];
}

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in progress' | 'completed'>('all');
  const [filterProperty, setFilterProperty] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.id)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch maintenance requests for all properties
        const allRequests: MaintenanceRequest[] = [];
        
        for (const property of properties) {
          try {
            const maintenanceQuery = query(
              collection(db, 'maintenance_requests'),
              where('unitProperty', '==', property.unitNumber)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            
            maintenanceSnapshot.docs.forEach(doc => {
              const request = doc.data() as MaintenanceRequest;
              allRequests.push({
                ...request,
                id: doc.id,
                buildingName: property.buildingName
              });
            });
          } catch (error) {
            console.error('Error fetching maintenance for property:', property.unitNumber, error);
          }
        }

        // Sort by creation date (newest first)
        allRequests.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setMaintenanceRequests(allRequests);

      } catch (error) {
        console.error('Error fetching maintenance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Filter requests based on selected filters
  const filteredRequests = maintenanceRequests.filter(request => {
    const statusMatch = filterStatus === 'all' || request.status === filterStatus;
    const propertyMatch = !filterProperty || request.unitProperty === filterProperty;
    return statusMatch && propertyMatch;
  });

  // Calculate summary statistics
  const totalRequests = filteredRequests.length;
  const pendingRequests = filteredRequests.filter(req => req.status === 'pending').length;
  const inProgressRequests = filteredRequests.filter(req => req.status === 'in progress').length;
  const completedRequests = filteredRequests.filter(req => req.status === 'completed').length;

  // Get unique properties for filter
  const properties = [...new Set(maintenanceRequests.map(req => req.unitProperty))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance History</h1>
        <p className="text-gray-600 mt-2">Track maintenance requests for your properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalRequests}</p>
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
              <p className="text-2xl font-bold text-yellow-600 mt-2">{pendingRequests}</p>
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
              <p className="text-2xl font-bold text-blue-600 mt-2">{inProgressRequests}</p>
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
              <p className="text-2xl font-bold text-green-600 mt-2">{completedRequests}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="h-4 w-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property} value={property}>{property}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterProperty('');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Maintenance Requests</h3>
              <p className="text-sm text-gray-500">Showing {filteredRequests.length} requests</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FaTools className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No maintenance requests found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or contact support.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{request.issueDescription}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.priority === 'high' ? 'bg-red-100 text-red-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FaBuilding className="h-4 w-4" />
                          <span>{request.unitProperty} - {request.buildingName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaUser className="h-4 w-4" />
                          <span>{request.tenantName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaPhone className="h-4 w-4" />
                          <span>{request.tenantPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="h-4 w-4" />
                          <span>{new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {request.assignedProviderName && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Assigned to:</span> {request.assignedProviderName}
                          </p>
                        </div>
                      )}

                      {request.scheduledDate && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Scheduled for:</span> {new Date(request.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Request Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Request Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Issue Description</p>
                    <p className="font-medium">{selectedRequest.issueDescription}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{selectedRequest.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority</p>
                    <p className="font-medium">{selectedRequest.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{selectedRequest.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="font-medium">{selectedRequest.unitProperty} - {selectedRequest.buildingName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.createdAt?.toDate ? selectedRequest.createdAt.toDate() : selectedRequest.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Tenant Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{selectedRequest.tenantName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedRequest.tenantPhone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Provider Info */}
              {selectedRequest.assignedProviderName && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Service Provider</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900">{selectedRequest.assignedProviderName}</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              {selectedRequest.messages && selectedRequest.messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Communication History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedRequest.messages.map((message, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {message.senderName || message.sender}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
 

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { 
  FaTools, 
  FaBuilding,
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFilter
} from 'react-icons/fa';

interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  buildingName: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  createdAt: any;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  completedAt?: any;
  messages: { sender: string; text: string; timestamp: any; senderName?: string }[];
}

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in progress' | 'completed'>('all');
  const [filterProperty, setFilterProperty] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.id)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch maintenance requests for all properties
        const allRequests: MaintenanceRequest[] = [];
        
        for (const property of properties) {
          try {
            const maintenanceQuery = query(
              collection(db, 'maintenance_requests'),
              where('unitProperty', '==', property.unitNumber)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            
            maintenanceSnapshot.docs.forEach(doc => {
              const request = doc.data() as MaintenanceRequest;
              allRequests.push({
                ...request,
                id: doc.id,
                buildingName: property.buildingName
              });
            });
          } catch (error) {
            console.error('Error fetching maintenance for property:', property.unitNumber, error);
          }
        }

        // Sort by creation date (newest first)
        allRequests.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setMaintenanceRequests(allRequests);

      } catch (error) {
        console.error('Error fetching maintenance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Filter requests based on selected filters
  const filteredRequests = maintenanceRequests.filter(request => {
    const statusMatch = filterStatus === 'all' || request.status === filterStatus;
    const propertyMatch = !filterProperty || request.unitProperty === filterProperty;
    return statusMatch && propertyMatch;
  });

  // Calculate summary statistics
  const totalRequests = filteredRequests.length;
  const pendingRequests = filteredRequests.filter(req => req.status === 'pending').length;
  const inProgressRequests = filteredRequests.filter(req => req.status === 'in progress').length;
  const completedRequests = filteredRequests.filter(req => req.status === 'completed').length;

  // Get unique properties for filter
  const properties = [...new Set(maintenanceRequests.map(req => req.unitProperty))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance History</h1>
        <p className="text-gray-600 mt-2">Track maintenance requests for your properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalRequests}</p>
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
              <p className="text-2xl font-bold text-yellow-600 mt-2">{pendingRequests}</p>
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
              <p className="text-2xl font-bold text-blue-600 mt-2">{inProgressRequests}</p>
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
              <p className="text-2xl font-bold text-green-600 mt-2">{completedRequests}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="h-4 w-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property} value={property}>{property}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterProperty('');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Maintenance Requests</h3>
              <p className="text-sm text-gray-500">Showing {filteredRequests.length} requests</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FaTools className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No maintenance requests found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or contact support.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{request.issueDescription}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.priority === 'high' ? 'bg-red-100 text-red-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FaBuilding className="h-4 w-4" />
                          <span>{request.unitProperty} - {request.buildingName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaUser className="h-4 w-4" />
                          <span>{request.tenantName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaPhone className="h-4 w-4" />
                          <span>{request.tenantPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="h-4 w-4" />
                          <span>{new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {request.assignedProviderName && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Assigned to:</span> {request.assignedProviderName}
                          </p>
                        </div>
                      )}

                      {request.scheduledDate && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Scheduled for:</span> {new Date(request.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Request Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Request Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Issue Description</p>
                    <p className="font-medium">{selectedRequest.issueDescription}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{selectedRequest.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority</p>
                    <p className="font-medium">{selectedRequest.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{selectedRequest.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="font-medium">{selectedRequest.unitProperty} - {selectedRequest.buildingName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.createdAt?.toDate ? selectedRequest.createdAt.toDate() : selectedRequest.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Tenant Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{selectedRequest.tenantName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedRequest.tenantPhone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Provider Info */}
              {selectedRequest.assignedProviderName && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Service Provider</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900">{selectedRequest.assignedProviderName}</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              {selectedRequest.messages && selectedRequest.messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Communication History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedRequest.messages.map((message, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {message.senderName || message.sender}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
 

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/types';
import { 
  FaTools, 
  FaBuilding,
  FaCalendarAlt,
  FaUser,
  FaPhone,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFilter
} from 'react-icons/fa';

interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  buildingName: string;
  priority: string;
  status: 'pending' | 'in progress' | 'completed';
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  createdAt: any;
  scheduledDate?: string;
  assignedTo?: string;
  assignedProviderName?: string;
  completedAt?: any;
  messages: { sender: string; text: string; timestamp: any; senderName?: string }[];
}

export default function OwnerMaintenancePage() {
  const { user } = useAuth();
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in progress' | 'completed'>('all');
  const [filterProperty, setFilterProperty] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.id)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch maintenance requests for all properties
        const allRequests: MaintenanceRequest[] = [];
        
        for (const property of properties) {
          try {
            const maintenanceQuery = query(
              collection(db, 'maintenance_requests'),
              where('unitProperty', '==', property.unitNumber)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            
            maintenanceSnapshot.docs.forEach(doc => {
              const request = doc.data() as MaintenanceRequest;
              allRequests.push({
                ...request,
                id: doc.id,
                buildingName: property.buildingName
              });
            });
          } catch (error) {
            console.error('Error fetching maintenance for property:', property.unitNumber, error);
          }
        }

        // Sort by creation date (newest first)
        allRequests.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setMaintenanceRequests(allRequests);

      } catch (error) {
        console.error('Error fetching maintenance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Filter requests based on selected filters
  const filteredRequests = maintenanceRequests.filter(request => {
    const statusMatch = filterStatus === 'all' || request.status === filterStatus;
    const propertyMatch = !filterProperty || request.unitProperty === filterProperty;
    return statusMatch && propertyMatch;
  });

  // Calculate summary statistics
  const totalRequests = filteredRequests.length;
  const pendingRequests = filteredRequests.filter(req => req.status === 'pending').length;
  const inProgressRequests = filteredRequests.filter(req => req.status === 'in progress').length;
  const completedRequests = filteredRequests.filter(req => req.status === 'completed').length;

  // Get unique properties for filter
  const properties = [...new Set(maintenanceRequests.map(req => req.unitProperty))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Maintenance History</h1>
        <p className="text-gray-600 mt-2">Track maintenance requests for your properties</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalRequests}</p>
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
              <p className="text-2xl font-bold text-yellow-600 mt-2">{pendingRequests}</p>
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
              <p className="text-2xl font-bold text-blue-600 mt-2">{inProgressRequests}</p>
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
              <p className="text-2xl font-bold text-green-600 mt-2">{completedRequests}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaCheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="h-4 w-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Properties</option>
              {properties.map(property => (
                <option key={property} value={property}>{property}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterProperty('');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Maintenance Requests</h3>
              <p className="text-sm text-gray-500">Showing {filteredRequests.length} requests</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FaTools className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No maintenance requests found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or contact support.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{request.issueDescription}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.status === 'completed' ? 'bg-green-100 text-green-800' :
                          request.status === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          request.priority === 'high' ? 'bg-red-100 text-red-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FaBuilding className="h-4 w-4" />
                          <span>{request.unitProperty} - {request.buildingName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaUser className="h-4 w-4" />
                          <span>{request.tenantName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaPhone className="h-4 w-4" />
                          <span>{request.tenantPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="h-4 w-4" />
                          <span>{new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {request.assignedProviderName && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Assigned to:</span> {request.assignedProviderName}
                          </p>
                        </div>
                      )}

                      {request.scheduledDate && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Scheduled for:</span> {new Date(request.scheduledDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Request Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Request Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Issue Description</p>
                    <p className="font-medium">{selectedRequest.issueDescription}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{selectedRequest.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Priority</p>
                    <p className="font-medium">{selectedRequest.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{selectedRequest.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Property</p>
                    <p className="font-medium">{selectedRequest.unitProperty} - {selectedRequest.buildingName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.createdAt?.toDate ? selectedRequest.createdAt.toDate() : selectedRequest.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Tenant Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{selectedRequest.tenantName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedRequest.tenantPhone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Provider Info */}
              {selectedRequest.assignedProviderName && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Service Provider</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900">{selectedRequest.assignedProviderName}</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              {selectedRequest.messages && selectedRequest.messages.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Communication History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedRequest.messages.map((message, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {message.senderName || message.sender}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{message.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
 