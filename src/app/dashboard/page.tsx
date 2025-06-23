'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Tenant } from '@/types';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import TenantDashboard from '@/components/dashboard/TenantDashboard';
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
        return <AdminDashboard data={data} />;
      case 'service':
        return <ServiceProviderDashboard />;
      case 'owner':
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
      {renderDashboard()}
    </div>
  );
}