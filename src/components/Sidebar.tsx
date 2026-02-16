'use client';
import {
  FaHome, FaFileContract, FaFileInvoiceDollar, FaTools, FaChartLine, FaUsers,
  FaBuilding, FaBars, FaTimes, FaClipboardList, FaChartBar, FaCreditCard
} from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { UserRole } from '@/types';
import NotificationSystem from './NotificationSystem';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}


const linksByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/users', label: 'User Management', icon: FaUsers },
    { href: '/dashboard/buildings', label: 'Buildings', icon: FaBuilding },
    { href: '/dashboard/units', label: 'Units', icon: FaHome },
    { href: '/dashboard/assignments', label: 'Assignments', icon: FaClipboardList },
    { href: '/dashboard/contracts', label: 'Contracts', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/financial', label: 'Financial Management', icon: FaCreditCard },
    { href: '/dashboard/maintenance/admin', label: 'Maintenance', icon: FaTools },
    { href: '/dashboard/reports', label: 'Reports', icon: FaChartBar },
    { href: '/dashboard/analytics', label: 'Analytics', icon: FaChartLine },
  ],
  agent: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/tenants', label: 'Tenants', icon: FaUsers },
    { href: '/dashboard/buildings', label: 'Buildings', icon: FaBuilding },
    { href: '/dashboard/units', label: 'Units', icon: FaHome },
    { href: '/dashboard/assignments', label: 'Assignments', icon: FaClipboardList },
    { href: '/dashboard/contracts', label: 'Contracts', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/maintenance/admin', label: 'Maintenance', icon: FaTools },
  ],
  property_owner: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/properties', label: 'My Properties', icon: FaBuilding },
    { href: '/dashboard/units', label: 'My Units', icon: FaHome },
    { href: '/dashboard/contracts', label: 'Contracts', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/financial', label: 'Financial Management', icon: FaCreditCard },
    { href: '/dashboard/maintenance', label: 'Maintenance', icon: FaTools },
    { href: '/dashboard/reports', label: 'Reports', icon: FaChartBar },
    { href: '/dashboard/analytics', label: 'Analytics', icon: FaChartLine },
  ],
  tenant: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/tenant/residency', label: 'My residency', icon: FaBuilding },
    { href: '/dashboard/tenant/contracts', label: 'My Contract', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'My Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/maintenance', label: 'Maintenance', icon: FaTools },
    { href: '/dashboard/payments', label: 'Payments', icon: FaFileInvoiceDollar },
  ],
  service_provider: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/maintenance', label: 'My Jobs', icon: FaTools },
    { href: '/dashboard/invoices', label: 'My Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FaFileInvoiceDollar },
  ],
  mixedProvider: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/maintenance', label: 'My Jobs', icon: FaTools },
    { href: '/dashboard/invoices', label: 'My Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FaFileInvoiceDollar },
    { href: '/dashboard/properties', label: 'Assigned Properties', icon: FaBuilding },
  ],
};

const Sidebar = () => {
  const auth = useAuth();
  const user = auth?.user;
  const signOut = auth?.signOut;
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [darkMode] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Dark mode effect (must run before any early return - rules of hooks)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Click outside to close profile dropdown (must run before any early return - rules of hooks)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  if (!user || !signOut) {
    return null;
  }

  const role = user.role || 'tenant';
  const links = linksByRole[role] || [];

  // Get user initials
  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U';
  };

  

  // Smooth unified styling for all sidebar items
  const getNavItemClasses = (isActive: boolean) => {
    return `group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out ${
      isActive 
        ? 'bg-green-100 text-green-600 font-semibold border-l-4 border-green-500' 
        : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
    }`;
  };

  const getIconClasses = (isActive: boolean) => {
    return `w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
      isActive 
        ? 'text-green-600' 
        : 'text-gray-500 group-hover:text-green-600'
    }`;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-green-50 to-white">
      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {links.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={getNavItemClasses(isActive)}
              onClick={() => drawerOpen && setDrawerOpen(false)}
            >
              <item.icon className={getIconClasses(isActive)} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User Profile Section - Clickable with Dropdown */}
      <div className="px-3 py-4">
        {/* User Profile - Clickable */}
        <div className="relative" ref={profileRef}>
          <div className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-green-50 transition-all duration-300 ease-in-out">
            <button 
              onClick={() => setProfileOpen(!profileOpen)} 
              className="flex items-center gap-3 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Open profile menu"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-green-600 text-white font-semibold text-sm shadow-sm flex-shrink-0">
                {user.profileImage ? (
                  <Image src={user.profileImage} alt={user.fullName || 'Profile'} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  getInitials(user.fullName || '')
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            </button>
            {/* Unified Notification System - separate clickable control */}
            <div className="flex-shrink-0">
              <NotificationSystem />
            </div>
          </div>
          
          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-[9999] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                <h3 className="text-sm font-semibold text-gray-900">Account Menu</h3>
              </div>
              <div className="py-2">
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Account clicked'); // Debug log
                    setProfileOpen(false);
                    if (drawerOpen) setDrawerOpen(false);
                    // Navigate to account page
                    router.push('/dashboard/account');
                  }}
                  className="profile-dropdown-item flex items-center gap-3 px-4 py-3 hover:bg-green-50 active:bg-green-100 transition-all duration-300 ease-in-out cursor-pointer w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-green-600 text-white font-semibold text-xs shadow-sm flex-shrink-0">
                    {user.profileImage ? (
                      <Image src={user.profileImage} alt="" width={32} height={32} className="object-cover w-full h-full" />
                    ) : (
                      'AC'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">Account</p>
                    <p className="text-xs text-gray-500">Profile & Settings</p>
                  </div>
                </button>

                <button
                  onMouseDown={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Logout clicked'); // Debug log
                    try {
                      setProfileOpen(false);
                      if (drawerOpen) setDrawerOpen(false);
                      await signOut();
                    } catch (error) {
                      console.error('Logout error:', error);
                      // Still close the dropdown even if logout fails
                    }
                  }}
                  className="profile-dropdown-item flex items-center gap-3 px-4 py-3 hover:bg-red-50 active:bg-red-100 transition-all duration-300 ease-in-out w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <div className="flex items-center justify-center h-8 w-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full text-white font-semibold text-xs shadow-sm">
                    LO
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 hover:text-red-600 transition-colors duration-300 ease-in-out truncate">
                      Logout
                    </p>
                    <p className="text-xs text-gray-500">Sign Out</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header - compact */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <Image src="/Green Bridge.svg" alt="Green Bridge" width={28} height={28} className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shadow-sm flex-shrink-0" />
          <Link href="/dashboard" className="text-base sm:text-lg font-bold text-gray-900 truncate">Green Bridge</Link>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg hover:bg-green-50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 flex-shrink-0"
          aria-label="Open menu"
        >
          <FaBars className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:h-screen lg:fixed lg:top-0 lg:left-0 bg-gradient-to-b from-green-50 to-white">
        <div className="flex items-center gap-3 p-4">
          <Image src="/Green Bridge.svg" alt="Green Bridge" width={32} height={32} className="h-8 w-8 rounded-lg shadow-sm" />
          <Link href="/dashboard" className="text-lg font-bold text-gray-900">Green Bridge</Link>
        </div>
        <nav className="flex-1 flex flex-col overflow-hidden">
          {sidebarContent}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-[min(280px,85vw)] max-w-[280px] bg-white shadow-2xl transform transition-transform ease-in-out duration-300 lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex flex-col h-full bg-gradient-to-b from-green-50 to-white overflow-hidden">
          <div className="flex items-center justify-between p-3 sm:p-4 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Image src="/Green Bridge.svg" alt="Green Bridge" width={28} height={28} className="h-7 w-7 rounded-lg shadow-sm flex-shrink-0" />
              <Link href="/dashboard" className="text-base font-bold text-gray-900 truncate">Green Bridge</Link>
            </div>
            <button
              className="p-2 rounded-lg hover:bg-green-50 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 flex-shrink-0"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <FaTimes className="h-5 w-5 text-gray-700" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">{sidebarContent}</div>
        </nav>
      </div>
    </>
  );
} 

export default Sidebar; 