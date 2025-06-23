'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, Tenant, MaintenanceRequest } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaBuilding, FaUser, FaTools, FaExclamationCircle } from 'react-icons/fa';

export default function PropertyDetailPage() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPropertyDetails() {
      if (!user || user.role !== 'owner' || !propertyId) {
        setLoading(false);
        return;
      }

      try {
        const propertyDoc = await getDoc(doc(db, 'units', propertyId));

        if (propertyDoc.exists()) {
          const propertyData = { ...propertyDoc.data(), id: propertyDoc.id } as Property;

          // Security Check: Ensure the logged-in user owns this property
          if (propertyData.ownerId !== user.id) {
            router.push('/dashboard');
            return;
          }
          
          setProperty(propertyData);

          // Fetch current tenant if one is assigned
          if (propertyData.currentTenantId) {
            const tenantDoc = await getDoc(doc(db, 'users', propertyData.currentTenantId));
            if (tenantDoc.exists()) {
              setTenant({ ...tenantDoc.data(), id: tenantDoc.id } as Tenant);
            }
          }

          // Fetch maintenance requests for this unit
          const requestsQuery = query(
            collection(db, 'maintenance_requests'),
            where('unitProperty', '==', propertyData.unitNumber)
          );
          const requestsSnapshot = await getDocs(requestsQuery);
          const requestsData = requestsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceRequest));
          setMaintenanceRequests(requestsData);

        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching property details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPropertyDetails();
  }, [user, propertyId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-10">
        <p>Property not found or you do not have permission to view it.</p>
        <Link href="/dashboard" className="text-indigo-600 hover:underline mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold">{property.buildingName} - Unit {property.unitNumber}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Property & Tenant Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold flex items-center mb-4"><FaBuilding className="mr-3 text-indigo-500"/>Property Info</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Address:</strong> {property.buildingName}</p>
              <p><strong>Status:</strong> <span className={`font-semibold ${property.status === 'occupied' ? 'text-green-600' : 'text-yellow-600'}`}>{property.status}</span></p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold flex items-center mb-4"><FaUser className="mr-3 text-indigo-500"/>Current Tenant</h2>
            {tenant ? (
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {tenant.fullName}</p>
                <p><strong>Email:</strong> {tenant.email}</p>
                <p><strong>Phone:</strong> {tenant.phoneNumber}</p>
                <Link href={`/dashboard/tenants/${tenant.id}`} className="text-indigo-600 hover:underline font-semibold mt-2 inline-block">
                  View Full Tenant Details &rarr;
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-500">This unit is currently vacant.</p>
            )}
          </div>
        </div>

        {/* Right Column: Maintenance History */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold flex items-center mb-4"><FaTools className="mr-3 text-indigo-500"/>Maintenance History</h2>
          {maintenanceRequests.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {maintenanceRequests.map(request => (
                <li key={request.id} className="py-4">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{request.issueDescription}</p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      request.status === 'completed' ? 'bg-green-100 text-green-700' :
                      request.status === 'in progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Created on: {request.createdAt ? new Date(request.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <FaExclamationCircle className="mx-auto h-10 w-10 text-gray-400"/>
                <p className="mt-4 text-sm text-gray-600">No maintenance requests found for this unit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 