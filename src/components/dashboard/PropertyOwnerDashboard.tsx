'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, Tenant, Invoice } from '@/types';
import { 
  FaHome, 
  FaUsers, 
  FaMoneyBillWave, 
  FaTools, 
  FaClock,
  FaExclamationTriangle,
  FaBuilding,
  FaMapMarkerAlt
} from 'react-icons/fa';
import Link from 'next/link';

interface PropertyWithDetails extends Property {
  buildingName: string;
  currentTenant?: Tenant;
  recentInvoices?: Invoice[];
  maintenanceCount?: number;
  totalIncome?: number;
}

const PropertyOwnerDashboard = () => {
  const auth = useAuth();
  const user = auth?.user;
  const [properties, setProperties] = useState<PropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProperties: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    totalMonthlyIncome: 0,
    pendingMaintenance: 0,
    overduePayments: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'units'),
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

            // Fetch current tenant if property is occupied
            if (property.currentTenantId) {
              try {
                const tenantDoc = await getDoc(doc(db, 'users', property.currentTenantId));
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
              recentInvoices = invoicesSnapshot.docs.slice(0, 3).map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Invoice[];
              
              // Calculate total income from paid invoices
              totalIncome = recentInvoices
                .filter(inv => inv.isPaid)
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
              buildingName: property.buildingName,
              currentTenant,
              recentInvoices,
              maintenanceCount,
              totalIncome
            };
          })
        );

        setProperties(propertiesWithDetails);

        // Calculate dashboard stats
        const totalProperties = propertiesData.length;
        const occupiedUnits = propertiesData.filter(p => p.status === 'occupied').length;
        const vacantUnits = propertiesData.filter(p => p.status === 'vacant').length;
        const totalMonthlyIncome = propertiesWithDetails.reduce((sum, p) => sum + (p.totalIncome || 0), 0);
        const pendingMaintenance = propertiesWithDetails.reduce((sum, p) => sum + (p.pendingMaintenanceRequests || 0), 0);
        const overduePayments = propertiesWithDetails.reduce((sum, p) => {
          const overdueInvoices = p.recentInvoices?.filter(inv => inv.status === 'overdue') || [];
          return sum + overdueInvoices.length;
        }, 0);

        setStats({
          totalProperties,
          occupiedUnits,
          vacantUnits,
          totalMonthlyIncome,
          pendingMaintenance,
          overduePayments
        });

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
    <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full">
            <FaHome className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.fullName || 'Property Owner'}
            </h2>
            <p className="text-gray-500">Your property portfolio overview</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProperties}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaBuilding className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Occupied Units</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.occupiedUnits}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaUsers className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vacant Units</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.vacantUnits}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FaClock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Income</p>
              <p className="text-2xl font-bold text-green-600 mt-2">RM {stats.totalMonthlyIncome.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaMoneyBillWave className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Maintenance</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{stats.pendingMaintenance}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <FaTools className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue Payments</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{stats.overduePayments}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaExclamationTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">My Properties</h3>
          {properties.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start">
                <h4 className="text-lg font-bold text-gray-900">{property.buildingName}</h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      property.status === 'occupied' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {property.status === 'occupied' ? 'Occupied' : 'Available'}
                </span>
              </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 flex items-center">
                      <FaMapMarkerAlt className="mr-2 text-gray-400" />
                Unit {property.unitNumber}
              </p>
                    </div>
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-medium text-gray-500">CURRENT TENANT</p>
                    <p className="text-sm text-gray-800 font-semibold">{property.currentTenant?.fullName || 'Vacant'}</p>
                  </div>
                  <div className="mt-4">
              <Link href={`/dashboard/properties/${property.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                      View Details →
              </Link>
            </div>
          </div>
        ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">You have not added any properties yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyOwnerDashboard; 