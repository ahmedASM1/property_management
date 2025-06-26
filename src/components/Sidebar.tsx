'use client';
import {
  FaHome, FaFileContract, FaFileInvoiceDollar, FaTools, FaChartLine, FaUsers,
  FaBuilding, FaUserCog, FaSignOutAlt, FaBars, FaTimes
} from 'react-icons/fa';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const linksByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/contracts', label: 'Contracts', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/maintenance/admin', label: 'Maintenance', icon: FaTools },
    { href: '/dashboard/reports', label: 'Reports', icon: FaChartLine },
    { href: '/dashboard/users', label: 'Users', icon: FaUsers },
  ],
  propertyOwner: [
  { href: '/dashboard', label: 'Dashboard', icon: FaHome },
  { href: '/dashboard/properties', label: 'My Properties', icon: FaBuilding },
    { href: '/dashboard/reports', label: 'Reports', icon: FaChartLine },
  ],
  tenant: [
  { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/tenant/contracts', label: 'My Contract', icon: FaFileContract },
    { href: '/dashboard/invoices', label: 'My Invoices', icon: FaFileInvoiceDollar },
    { href: '/dashboard/maintenance', label: 'Maintenance', icon: FaTools },
  ],
  service: [
  { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FaFileInvoiceDollar },
  ],
  mixedProvider: [
  { href: '/dashboard', label: 'Dashboard', icon: FaHome },
    { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FaFileInvoiceDollar },
  ],
};

const Sidebar = () => {
  const auth = useAuth();
  const user = auth?.user;
  const signOut = auth?.signOut;
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user || !signOut) {
    return null;
  }

  const role = user.role || 'tenant';
  const links = linksByRole[role] || [];
  
  const commonLinks = [
    { href: '/dashboard/profile', label: 'Profile', icon: FaUserCog },
  ];

  const sidebarContent = (
    <>
      <div className="flex flex-col gap-2 p-4">
          {links.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition ${
              pathname === item.href
                ? 'bg-primary/10 text-primary font-semibold shadow'
                : 'text-gray-700 hover:bg-gray-100 hover:text-primary'
            }`}
            onClick={() => drawerOpen && setDrawerOpen(false)}
          >
              {item.icon && <item.icon className="w-5 h-5" />}
              {item.label}
            </Link>
          ))}
        </div>
      <div className="mt-auto p-4">
        <div className="border-t border-gray-200 pt-4 flex flex-col gap-2">
            {commonLinks.map(item => (
                 <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition ${
                    pathname === item.href
                        ? 'bg-primary/10 text-primary font-semibold shadow'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-primary'
                    }`}
                    onClick={() => drawerOpen && setDrawerOpen(false)}
                >
                  {item.icon && <item.icon className="w-5 h-5" />}
                  {item.label}
                </Link>
              ))}
            <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50"
            >
                <FaSignOutAlt /> Logout
              </button>
            </div>
        </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white shadow-md">
        <Link href="/dashboard" className="text-xl font-bold text-primary">Green Bridge</Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Open menu"
            >
          <FaBars className="h-6 w-6 text-gray-700" />
            </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:h-screen lg:fixed lg:top-0 lg:left-0 bg-white shadow-lg">
        <div className="flex items-center justify-center p-6 border-b">
          <Link href="/dashboard" className="text-2xl font-bold text-primary">Green Bridge</Link>
        </div>
        <nav className="flex-1 flex flex-col">
          {sidebarContent}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-2xl transform transition-transform ease-in-out duration-300 lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b">
                <Link href="/dashboard" className="text-2xl font-bold text-primary">Green Bridge</Link>
                <button
                    className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <FaTimes className="h-6 w-6 text-gray-700" />
              </button>
            </div>
            {sidebarContent}
          </nav>
        </div>
    </>
  );
} 

export default Sidebar; 