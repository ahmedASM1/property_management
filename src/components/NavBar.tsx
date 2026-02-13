"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FaUserCircle, FaSignOutAlt, FaUsers, FaFileInvoice, FaFileContract, FaHome, FaUser, FaSun, FaMoon, FaTimes } from 'react-icons/fa';
import NotificationSystem from './NotificationSystem';
import Image from 'next/image';


export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const user = auth?.user;
  const signOut = auth?.signOut;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  function navClassName(href: string, exact: boolean = false) {
    const base = 'px-3 py-2 rounded-md text-sm font-medium transition';
    const active = 'bg-indigo-100 text-indigo-700 font-semibold shadow';
    let isActive;
    if (href === '/dashboard/invoices') {
      isActive = pathname.startsWith('/dashboard/invoices') && !pathname.startsWith('/dashboard/invoices/received');
    } else {
      isActive = exact ? pathname === href : pathname.startsWith(href);
    }
    return isActive ? `${base} ${active}` : `${base} text-gray-600 hover:bg-gray-100 hover:text-indigo-700`;
  }

  function getInitials(name: string) {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U';
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerVisible(false), 300);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        const hamburgerButton = document.querySelector('[aria-label="Open menu"]');
        if (hamburgerButton && hamburgerButton.contains(event.target as Node)) {
          return;
        }
        closeDrawer();
      }
    }
    if (drawerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);


  const openDrawer = () => {
    setDrawerVisible(true);
    setTimeout(() => setDrawerOpen(true), 10);
  };

  const closeDrawerInstant = () => {
    setDrawerOpen(false);
    setDrawerVisible(false);
  };


  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="w-full bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={32} height={32} className="h-8 w-8 inline-block align-middle" />
          <span className="font-bold text-lg text-green-900 tracking-wide hidden sm:inline">Green Bridge</span>
        </div>
        {/* Hamburger for mobile */}
        <div className="md:hidden">
          <button onClick={openDrawer} className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" aria-label="Open menu">
            <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {/* Desktop nav */}
        <nav className="hidden md:flex space-x-2 items-center">
          {user?.role === 'admin' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
              <Link href="/dashboard/invoices" className={navClassName('/dashboard/invoices')}><FaFileInvoice className="inline mr-1 mb-1" />Invoices</Link>
              <Link href="/dashboard/contracts" className={navClassName('/dashboard/contracts')}><FaFileContract className="inline mr-1 mb-1" />Contracts</Link>
              <Link href="/dashboard/users" className={navClassName('/dashboard/users')}><FaUsers className="inline mr-1 mb-1" />Users</Link>
            </>
          ) : user?.role === 'agent' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
              <Link href="/dashboard/tenants" className={navClassName('/dashboard/tenants')}><FaUsers className="inline mr-1 mb-1" />Tenants</Link>
              <Link href="/dashboard/invoices" className={navClassName('/dashboard/invoices')}><FaFileInvoice className="inline mr-1 mb-1" />Invoices</Link>
              <Link href="/dashboard/contracts" className={navClassName('/dashboard/contracts')}><FaFileContract className="inline mr-1 mb-1" />Contracts</Link>
            </>
          ) : user?.role === 'property_owner' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
            </>
          ) : user?.role === 'service_provider' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
            </>
          ) : user?.role === 'tenant' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
              <Link href="/dashboard/invoices" className={navClassName('/dashboard/invoices')}><FaFileInvoice className="inline mr-1 mb-1" />Invoices</Link>
            </>
          ) : (
             <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
          )}
          <div className="flex items-center gap-4">
            <NotificationSystem />
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200">
              {darkMode ? <FaSun className="text-yellow-500"/> : <FaMoon className="text-gray-700"/>}
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center justify-center h-9 w-9 bg-indigo-600 rounded-full text-white font-bold text-sm focus:outline-none"
              >
                {getInitials(user?.fullName || '')}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-semibold">{user?.fullName}</p>
                    <p className="text-xs text-gray-500">{user?.role}</p>
                  </div>
                  <Link href="/dashboard/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><FaUserCircle className="inline mr-2" />Profile</Link>
                  <button onClick={handleSignOut} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><FaSignOutAlt className="inline mr-2" />Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>
      {/* Mobile Drawer */}
      {drawerVisible && (
        <div
          ref={drawerRef}
          className={`fixed top-0 left-0 h-full bg-white w-64 shadow-xl transition-transform duration-300 z-50 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-5 border-b flex justify-between items-center">
            <span className="font-bold text-lg text-green-700">Menu</span>
            <button onClick={closeDrawer} className="text-gray-500 hover:text-gray-700">
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 flex flex-col space-y-2">
            {user && (
                <>
                {/* Common Links */}
                <Link
                  onClick={closeDrawerInstant}
                  href="/dashboard"
                  className={`flex items-center space-x-3 p-3 rounded-lg ${
                    pathname === '/dashboard'
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaHome className="w-5 h-5" />
                  <span>Dashboard</span>
                </Link>

                {/* Admin Links */}
                {user.role === 'admin' && (
                  <>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/invoices"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/invoices') && !pathname.startsWith('/dashboard/invoices/received')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaFileInvoice className="w-5 h-5" />
                      <span>Invoices</span>
                    </Link>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/contracts"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/contracts')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaFileContract className="w-5 h-5" />
                      <span>Contracts</span>
                    </Link>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/users"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/users')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaUsers className="w-5 h-5" />
                      <span>Users</span>
                    </Link>
                </>
              )}

                {/* Agent Links - no Users */}
                {user.role === 'agent' && (
                  <>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/tenants"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/tenants')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaUsers className="w-5 h-5" />
                      <span>Tenants</span>
                    </Link>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/invoices"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/invoices') && !pathname.startsWith('/dashboard/invoices/received')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaFileInvoice className="w-5 h-5" />
                      <span>Invoices</span>
                    </Link>
                    <Link
                      onClick={closeDrawerInstant}
                      href="/dashboard/contracts"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/contracts')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaFileContract className="w-5 h-5" />
                      <span>Contracts</span>
                    </Link>
                  </>
                )}

                {/* Owner Links */}
                {user.role === 'property_owner' && <></>}

                {/* Service Provider Links */}
                {user.role === 'service_provider' && (
                  <></>
                )}

                {/* Tenant Links */}
                {user.role === 'tenant' && (
                  <Link
                    onClick={closeDrawerInstant}
                    href="/dashboard/invoices"
                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                      pathname.startsWith('/dashboard/invoices')
                        ? 'bg-indigo-50 text-indigo-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FaFileInvoice className="w-5 h-5" />
                    <span>Invoices</span>
                  </Link>
                )}

                <hr className="my-2 border-t border-gray-200" />

                <Link
                  onClick={closeDrawerInstant}
                  href="/dashboard/profile"
                  className={`flex items-center space-x-3 p-3 rounded-lg ${
                    pathname === '/dashboard/profile'
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaUser className="w-5 h-5" />
                  <span>My Profile</span>
                </Link>

                  <button
                  onClick={() => {
                    closeDrawerInstant();
                    handleSignOut();
                  }}
                  className="flex items-center space-x-3 p-3 rounded-lg text-red-600 hover:bg-red-50 w-full"
                  >
                  <FaSignOutAlt className="inline mr-2" />
                  Sign Out
                  </button>
              </>
              )}
            </div>
        </div>
      )}
    </header>
  );
} 
