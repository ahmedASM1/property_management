'use client';
import { ReactNode, useState, useEffect } from 'react';
import { useEnhancedAuth } from '@/contexts/EnhancedAuthContext';
import { UserRole } from '@/types';
import { 
  FaHome, FaUsers, FaBuilding, FaFileContract, FaReceipt, 
  FaWrench, FaCog, FaSignOutAlt, FaBars, FaTimes,
  FaUser, FaUserTie, FaUserCog, FaUserCheck, FaBell, FaQuestionCircle
} from 'react-icons/fa';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  permissions?: string[];
  badge?: number;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: FaHome,
    roles: ['admin', 'property_owner', 'tenant', 'service_provider', 'mixedProvider']
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: FaUsers,
    roles: ['admin'],
    permissions: ['users.read']
  },
  {
    label: 'Properties',
    href: '/dashboard/properties',
    icon: FaBuilding,
    roles: ['admin', 'property_owner'],
    permissions: ['properties.read']
  },
  {
    label: 'Units',
    href: '/dashboard/units',
    icon: FaBuilding,
    roles: ['admin', 'property_owner'],
    permissions: ['properties.read']
  },
  {
    label: 'Contracts',
    href: '/dashboard/contracts',
    icon: FaFileContract,
    roles: ['admin', 'property_owner', 'tenant'],
    permissions: ['contracts.read']
  },
  {
    label: 'Invoices',
    href: '/dashboard/invoices',
    icon: FaReceipt,
    roles: ['admin', 'property_owner', 'tenant', 'service_provider', 'mixedProvider'],
    permissions: ['invoices.read']
  },
  {
    label: 'Maintenance',
    href: '/dashboard/maintenance',
    icon: FaWrench,
    roles: ['admin', 'property_owner', 'tenant', 'service_provider', 'mixedProvider'],
    permissions: ['maintenance.read']
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: FaCog,
    roles: ['admin', 'property_owner', 'tenant', 'service_provider', 'mixedProvider']
  }
];

const getRoleIcon = (role: UserRole) => {
  const icons: Record<UserRole, typeof FaUser> = {
    admin: FaUserTie,
    property_owner: FaUserCheck,
    tenant: FaUser,
    service_provider: FaUserCog,
    mixedProvider: FaUserCog,
    agent: FaUser
  };
  return icons[role] || FaUser;
};

const getRoleColor = (role: UserRole) => {
  const colors: Record<UserRole, string> = {
    admin: 'text-red-600 bg-red-100',
    property_owner: 'text-green-600 bg-green-100',
    tenant: 'text-blue-600 bg-blue-100',
    service_provider: 'text-orange-600 bg-orange-100',
    mixedProvider: 'text-purple-600 bg-purple-100',
    agent: 'text-gray-600 bg-gray-100'
  };
  return colors[role] || 'text-gray-600 bg-gray-100';
};

const getRoleDisplayName = (role: UserRole) => {
  const names: Record<UserRole, string> = {
    admin: 'Administrator',
    property_owner: 'Property Owner',
    tenant: 'Tenant',
    service_provider: 'Service Provider',
    mixedProvider: 'Mixed Provider',
    agent: 'Agent'
  };
  return names[role] || role;
};

export default function ProfessionalDashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, hasPermission, isRole } = useEnhancedAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Fetch notifications count
    // This would typically come from an API
    setNotifications(3); // Mock data
  }, []);

  const filteredNavigationItems = navigationItems.filter(item => {
    // Check role access
    if (item.roles.length > 0 && !item.roles.some(role => isRole(role))) {
      return false;
    }

    // Check permission access
    if (item.permissions && !item.permissions.every(permission => hasPermission(permission))) {
      return false;
    }

    return true;
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return null;
  }

  const RoleIcon = getRoleIcon(user.role);
  const roleColorClass = getRoleColor(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center">
              <Image 
                src="/Green Bridge.svg" 
                alt="Green Bridge Logo" 
                width={32} 
                height={32}
                className="mr-3"
              />
              <span className="text-xl font-bold text-gray-900">Green Bridge</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className={`p-2 rounded-full ${roleColorClass}`}>
                <RoleIcon className="w-5 h-5" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                <p className="text-xs text-gray-500">{getRoleDisplayName(user.role)}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {filteredNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-100 text-green-700 border-r-2 border-green-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <FaSignOutAlt className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
              >
                <FaBars className="w-5 h-5" />
              </button>
              <h1 className="ml-2 text-2xl font-semibold text-gray-900">
                {navigationItems.find(item => item.href === pathname)?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <FaBell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>

              {/* Help */}
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <FaQuestionCircle className="w-5 h-5" />
              </button>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                  <p className="text-xs text-gray-500">{getRoleDisplayName(user.role)}</p>
                </div>
                <div className={`p-2 rounded-full ${roleColorClass}`}>
                  <RoleIcon className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

