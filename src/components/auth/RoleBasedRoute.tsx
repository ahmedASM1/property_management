'use client';
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { FaSpinner, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  fallbackPath?: string;
  showLoading?: boolean;
}

export default function RoleBasedRoute({
  children,
  allowedRoles = [],
  fallbackPath = '/dashboard',
  showLoading = true
}: RoleBasedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check role-based access
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.push('/unauthorized');
      return;
    }
  }, [user, loading, allowedRoles, router]);

  if (loading && showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FaSpinner className="animate-spin text-green-600 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Check role access
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <FaShieldAlt className="text-red-500 text-4xl mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Your role ({user.role}) is not authorized.
          </p>
          <button
            onClick={() => router.push(fallbackPath)}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience components for common role checks
export function AdminOnlyRoute({ children, ...props }: Omit<RoleBasedRouteProps, 'allowedRoles'>) {
  return (
    <RoleBasedRoute allowedRoles={['admin']} {...props}>
      {children}
    </RoleBasedRoute>
  );
}

export function PropertyOwnerOnlyRoute({ children, ...props }: Omit<RoleBasedRouteProps, 'allowedRoles'>) {
  return (
    <RoleBasedRoute allowedRoles={['admin', 'property_owner']} {...props}>
      {children}
    </RoleBasedRoute>
  );
}

export function TenantOnlyRoute({ children, ...props }: Omit<RoleBasedRouteProps, 'allowedRoles'>) {
  return (
    <RoleBasedRoute allowedRoles={['admin', 'tenant']} {...props}>
      {children}
    </RoleBasedRoute>
  );
}

export function ServiceProviderOnlyRoute({ children, ...props }: Omit<RoleBasedRouteProps, 'allowedRoles'>) {
  return (
    <RoleBasedRoute allowedRoles={['admin', 'service_provider', 'mixedProvider']} {...props}>
      {children}
    </RoleBasedRoute>
  );
}

