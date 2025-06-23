'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Property } from '@/types';
import Link from 'next/link';
import { FaArrowLeft, FaUserCircle } from 'react-icons/fa';

export default function OwnerTenantsPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [tenants, setTenants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      if (!user || user.role !== 'owner') {
        setLoading(false);
        return;
      }
      try {
        // 1. Find all units owned by the current owner
        const unitsQuery = query(collection(db, 'units'), where('ownerId', '==', user.id));
        const unitsSnapshot = await getDocs(unitsQuery);
        const ownedUnits = unitsSnapshot.docs.map(doc => doc.data() as Property);

        // 2. Get all tenant IDs from these units
        const tenantIds = ownedUnits
          .map(unit => unit.currentTenantId)
          .filter((id): id is string => !!id);

        if (tenantIds.length === 0) {
          setLoading(false);
          return;
        }

        // 3. Fetch tenant details from the 'users' collection
        const tenantsQuery = query(collection(db, 'users'), where('id', 'in', tenantIds));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        const tenantsData = tenantsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        setTenants(tenantsData);

      } catch (error) {
        console.error("Error fetching tenants: ", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold">My Tenants</h1>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-600">You do not have any tenants at the moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {tenants.map((tenant) => (
              <li key={tenant.id} className="p-4 hover:bg-gray-50">
                <Link href={`/dashboard/tenants/${tenant.id}`}>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {tenant.profileImage ? (
                        <img className="h-10 w-10 rounded-full" src={tenant.profileImage} alt={tenant.fullName} />
                      ) : (
                        <FaUserCircle className="h-10 w-10 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-600 truncate">{tenant.fullName}</p>
                      <p className="text-sm text-gray-500 truncate">Unit: {tenant.unitNumber} - {tenant.buildingName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Contract End: {tenant.contractEnd ? new Date(tenant.contractEnd as string).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 