'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, Tenant, Invoice } from '@/types';
import { 
  FaHome, 
  FaUsers, 
  FaMoneyBillWave, 
  FaTools, 
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaBuilding,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope
} from 'react-icons/fa';

interface PropertyWithDetails extends Property {
  currentTenant?: Tenant;
  recentInvoices?: Invoice[];
  maintenanceCount?: number;
  totalIncome?: number;
  overdueAmount?: number;
  monthlyRent: number;
  rentalType: string;
  contractStartDate?: string;
  contractEndDate?: string;
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PropertyWithDetails | null>(null);

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
        const propertiesData = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch additional details for each property
        const propertiesWithDetails = await Promise.all(
          propertiesData.map(async (property) => {
            let currentTenant: Tenant | undefined;
            let recentInvoices: Invoice[] = [];
            let maintenanceCount = 0;
            let totalIncome = 0;
            let overdueAmount = 0;

            // Fetch current tenant if property is occupied
            if (property.currentTenantId) {
              try {
                const tenantDocRef = doc(db, 'users', property.currentTenantId);
                const tenantDoc = await getDoc(tenantDocRef);

                if (tenantDoc.exists()) {
                  currentTenant = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
                }
              } catch (error) {
                console.error('Error fetching tenant:', error);
              }
            }

            // Fetch recent invoices for this property
            try {
              const invoicesQuery = query(
                collection(db, 'invoices'),
                where('unitNumber', '==', property.unitNumber)
              );
              const invoicesSnapshot = await getDocs(invoicesQuery);
              recentInvoices = invoicesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Invoice[];
              
              // Calculate total income from paid invoices
              totalIncome = recentInvoices
                .filter(inv => inv.isPaid)
                .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

              // Calculate overdue amount
              overdueAmount = recentInvoices
                .filter(inv => inv.status === 'overdue')
                .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
            } catch (error) {
              console.error('Error fetching invoices:', error);
            }

            // Fetch maintenance requests count
            try {
              const maintenanceQuery = query(
                collection(db, 'maintenance_requests'),
                where('unitProperty', '==', property.unitNumber)
              );
              const maintenanceSnapshot = await getDocs(maintenanceQuery);
              maintenanceCount = maintenanceSnapshot.size;
            } catch (error) {
              console.error('Error fetching maintenance requests:', error);
            }

            return {
              ...property,
              currentTenant,
              recentInvoices,
              maintenanceCount,
              totalIncome,
              overdueAmount,
            };
          })
        );

        setProperties(propertiesWithDetails);

      } catch (error) {
        console.error('Error fetching property data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

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
        <h1 className="text-3xl font-bold text-gray-900">My Properties</h1>
        <p className="text-gray-600 mt-2">Detailed overview of your property portfolio</p>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-12">
          <FaHome className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No properties found</h3>
          <p className="mt-1 text-sm text-gray-500">Contact Green Bridge to add your properties to the platform.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Property Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{property.unitNumber}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <FaBuilding className="h-3 w-3" />
                      {property.buildingName}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <FaMapMarkerAlt className="h-3 w-3" />
                      {property.address}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    property.status === 'occupied' ? 'bg-green-100 text-green-800' :
                    property.status === 'vacant' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Property Details */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FaMoneyBillWave className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">Monthly Rent</span>
                    </div>
                    <p className="text-lg font-bold text-green-600">RM {property.monthlyRent.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FaTools className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Maintenance</span>
                    </div>
                    <p className="text-lg font-bold text-blue-600">{property.maintenanceCount || 0}</p>
                  </div>
                </div>

                {/* Current Tenant */}
                {property.currentTenant && (
                  <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <FaUsers className="h-4 w-4" />
                      Current Tenant
                    </h4>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Name:</span> {property.currentTenant.fullName}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Phone:</span> 
                        <a href={`tel:${property.currentTenant.phoneNumber}`} className="text-blue-600 hover:underline ml-1">
                          {property.currentTenant.phoneNumber}
                        </a>
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">Email:</span> 
                        <a href={`mailto:${property.currentTenant.email}`} className="text-blue-600 hover:underline ml-1">
                          {property.currentTenant.email}
                        </a>
                      </p>
                      {property.contractStartDate && (
                        <p className="text-sm">
                          <span className="font-medium text-gray-700">Contract:</span> 
                          <span className="ml-1">
                            {new Date(property.contractStartDate).toLocaleDateString()} - {new Date(property.contractEndDate || '').toLocaleDateString()}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <FaMoneyBillWave className="h-4 w-4" />
                    Financial Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Total Income</p>
                      <p className="text-lg font-bold text-green-600">RM {property.totalIncome?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Overdue Amount</p>
                      <p className="text-lg font-bold text-red-600">RM {property.overdueAmount?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>

                {/* Recent Invoices */}
                {property.recentInvoices && property.recentInvoices.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Invoices</h4>
                    <div className="space-y-2">
                      {property.recentInvoices.slice(0, 3).map((invoice) => (
                        <div key={invoice.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{invoice.month} {invoice.year}</p>
                            <p className="text-xs text-gray-500">Invoice #{invoice.id.slice(-6)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">RM {invoice.totalAmount?.toLocaleString()}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              invoice.isPaid ? 'bg-green-100 text-green-800' :
                              invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invoice.isPaid ? 'Paid' : invoice.status || 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedProperty(property)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    View Details
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    <FaTools className="h-4 w-4" />
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                    <FaCalendarAlt className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Details Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Property Details</h2>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Property Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Unit Number</p>
                    <p className="font-medium">{selectedProperty.unitNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Building</p>
                    <p className="font-medium">{selectedProperty.buildingName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{selectedProperty.rentalType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly Rent</p>
                    <p className="font-medium">RM {selectedProperty.monthlyRent.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Tenant Info */}
              {selectedProperty.currentTenant && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Current Tenant</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium">{selectedProperty.currentTenant.fullName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium">{selectedProperty.currentTenant.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{selectedProperty.currentTenant.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Contract Period</p>
                        <p className="font-medium">
                          {selectedProperty.contractStartDate && selectedProperty.contractEndDate ? 
                            `${new Date(selectedProperty.contractStartDate).toLocaleDateString()} - ${new Date(selectedProperty.contractEndDate).toLocaleDateString()}` :
                            'Not specified'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Financial Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">Total Income</p>
                    <p className="text-xl font-bold text-green-600">RM {selectedProperty.totalIncome?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-xl font-bold text-red-600">RM {selectedProperty.overdueAmount?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600">Maintenance</p>
                    <p className="text-xl font-bold text-blue-600">{selectedProperty.maintenanceCount || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
 
 
 