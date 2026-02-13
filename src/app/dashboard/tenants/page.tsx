'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Property, Building } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { FaArrowLeft, FaUserCircle } from 'react-icons/fa';

export default function OwnerTenantsPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [tenants, setTenants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        // Admin: fetch all tenants
        if (user.role === 'admin') {
          const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
          const tenantsSnapshot = await getDocs(tenantsQuery);
          const tenantsData = tenantsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
          setTenants(tenantsData);
          setLoading(false);
          return;
        }

        // Agent: only tenants in units of buildings assigned to this agent
        if (user.role === 'agent') {
          const buildingsSnap = await getDocs(query(collection(db, 'buildings'), orderBy('name')));
          const allBuildings = buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Building));
          const assignedBuildingIds = new Set(
            allBuildings.filter(b => (b.assignedAgentIds || []).includes(user.id)).map(b => b.id)
          );
          if (assignedBuildingIds.size === 0) {
            setTenants([]);
            setLoading(false);
            return;
          }
          const unitsSnap = await getDocs(collection(db, 'units'));
          const tenantIds = new Set<string>();
          unitsSnap.docs.forEach(d => {
            const u = d.data();
            if (u.currentTenantId && assignedBuildingIds.has(u.buildingId)) tenantIds.add(u.currentTenantId);
          });
          if (tenantIds.size === 0) {
            setTenants([]);
            setLoading(false);
            return;
          }
          const tenantsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'tenant')));
          const allTenants = tenantsSnap.docs.map(d => ({ ...d.data(), id: d.id } as User));
          setTenants(allTenants.filter(t => tenantIds.has(t.id)));
          setLoading(false);
          return;
        }

        // Property owner: fetch only their tenants
        if (user.role !== 'property_owner') {
          setLoading(false);
          return;
        }
        const unitsQuery = query(collection(db, 'units'), where('ownerId', '==', user.id));
        const unitsSnapshot = await getDocs(unitsQuery);
        const ownedUnits = unitsSnapshot.docs.map(doc => doc.data() as Property);

        const tenantIds = ownedUnits
          .map(unit => unit.currentTenantId)
          .filter((id): id is string => !!id);

        if (tenantIds.length === 0) {
          setLoading(false);
          return;
        }

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
        <h1 className="text-3xl font-bold">
          {user?.role === 'admin' || user?.role === 'agent' ? 'Tenants' : 'My Tenants'}
        </h1>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-600">
            {user?.role === 'admin'
              ? 'No tenants in the system yet.'
              : user?.role === 'agent'
                ? 'No tenants in your assigned buildings yet.'
                : 'You do not have any tenants at the moment.'}
          </p>
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
                        <Image className="h-10 w-10 rounded-full" src={tenant.profileImage} alt={tenant.fullName} width={40} height={40} />
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