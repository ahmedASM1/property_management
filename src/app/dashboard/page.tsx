'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Tenant } from '@/types';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import TenantDashboard from '@/components/dashboard/TenantDashboard';
import AdminNotifications from '@/components/AdminNotifications';
import dynamic from 'next/dynamic';

const ServiceProviderDashboard = dynamic(() => import('@/components/dashboard/ServiceProviderDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

const PropertyOwnerDashboard = dynamic(() => import('@/components/dashboard/PropertyOwnerDashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  ),
});

export default function DashboardPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    tenants?: Tenant[];
    invoices?: Invoice[];
  }>({});

  // Debug log for user role
  console.log('DashboardPage user:', user);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        console.log('Fetching dashboard data for role:', user.role);
        
        if (user.role === 'admin') {
          // Fetch all tenants
          const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
          const tenantsSnapshot = await getDocs(tenantsQuery);
          const tenants = tenantsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
            };
          }) as Tenant[];
          console.log('Admin dashboard - tenants loaded:', tenants.length);

          // Fetch all invoices
          const invoicesQuery = query(collection(db, 'invoices'));
          const invoicesSnapshot = await getDocs(invoicesQuery);
          const invoices = invoicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
            };
          }) as unknown as Invoice[];
          console.log('Admin dashboard - invoices loaded:', invoices.length);

          setData({ tenants, invoices });
        } else if (user.role === 'tenant') {
          // Fetch tenant's invoices
          const invoicesQuery = query(
            collection(db, 'invoices'),
            where('tenantId', '==', user.id)
          );
          const invoicesSnapshot = await getDocs(invoicesQuery);
          const invoices = invoicesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
            };
          }) as unknown as Invoice[];
          console.log('Tenant dashboard - invoices loaded:', invoices.length);

          setData({ invoices });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const renderDashboard = () => {
    switch (user.role) {
      case 'admin':
        return (
          <div className="space-y-8">
            <AdminNotifications />
            <AdminDashboard data={data} />
          </div>
        );
      case 'service':
        return <ServiceProviderDashboard />;
      case 'propertyOwner':
        return <PropertyOwnerDashboard />;
      case 'tenant':
      default:
        return (
          <>
            <TenantDashboard data={data} />
          </>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.fullName}
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your {user.role === 'admin' ? 'property management' : user.role === 'tenant' ? 'rental' : 'business'} today.
        </p>
      </div>
      {renderDashboard()}
    </div>
  );
}