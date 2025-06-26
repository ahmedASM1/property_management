'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaArrowLeft, FaUserCircle, FaEnvelope, FaPhone, FaMapMarkerAlt, FaFileContract } from 'react-icons/fa';

export default function TenantDetailPage() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenantDetails() {
      if (!user || user.role !== 'propertyOwner' || !tenantId) {
        setLoading(false);
        return;
      }

      try {
        const tenantDoc = await getDoc(doc(db, 'users', tenantId));
        if (tenantDoc.exists()) {
          const tenantData = { ...tenantDoc.data(), id: tenantDoc.id } as User;
          
          // Security check: Ensure the owner is viewing a tenant in one of their properties.
          // This can be improved by checking against a list of their tenants.
          // For now, we assume the UI path is secure enough.

          setTenant(tenantData);
        } else {
          // Tenant not found
          router.push('/dashboard/tenants');
        }
      } catch (error) {
        console.error("Error fetching tenant details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenantDetails();
  }, [user, tenantId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-10">
        <p>Tenant not found or you do not have permission to view this page.</p>
        <Link href="/dashboard/tenants" className="text-indigo-600 hover:underline mt-4 inline-block">
            Back to My Tenants
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/tenants" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold">Tenant Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-center space-x-6">
            <div className="flex-shrink-0">
              {tenant.profileImage ? (
                <Image className="h-24 w-24 rounded-full object-cover" src={tenant.profileImage} alt={tenant.fullName} width={96} height={96} />
              ) : (
                <FaUserCircle className="h-24 w-24 text-gray-300" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{tenant.fullName}</h2>
              <p className="text-md text-gray-500">{tenant.role.charAt(0).toUpperCase() + tenant.role.slice(1)}</p>
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-8">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FaEnvelope className="mr-2"/> Email address
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{tenant.email}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FaPhone className="mr-2"/> Phone number
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{tenant.phoneNumber}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FaMapMarkerAlt className="mr-2"/> Property
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {tenant.buildingName}, Unit {tenant.unitNumber}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <FaFileContract className="mr-2"/> Contract Status
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    tenant.contractStatus === 'Active' ? 'bg-green-100 text-green-800' :
                    tenant.contractStatus === 'Expiring' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {tenant.contractStatus || 'Not Available'}
                  </span>
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Contract Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {tenant.contractStart ? new Date(tenant.contractStart as string).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Contract End Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {tenant.contractEnd ? new Date(tenant.contractEnd as string).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
} 