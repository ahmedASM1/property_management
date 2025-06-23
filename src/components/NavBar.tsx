"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FaUserCircle, FaSignOutAlt, FaUsers, FaFileInvoice, FaFileContract, FaHome, FaUser, FaSun, FaMoon, FaTimes } from 'react-icons/fa';
import { Bell } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';

interface Notification {
  id: string;
  read: boolean;
  createdAt: any; // Using 'any' for simplicity with Firestore Timestamps
  [key: string]: any;
}

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

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

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notifications'),
      user.role === 'admin' 
        ? where('role', '==', 'admin')
        : where('userId', '==', user.id)
    );

    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(items.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (notifOpen && unreadCount > 0) {
      notifications.filter(n => !n.read).forEach(async n => {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      });
    }
    // eslint-disable-next-line
  }, [notifOpen]);

  const openDrawer = () => {
    setDrawerVisible(true);
    setTimeout(() => setDrawerOpen(true), 10);
  };

  const closeDrawerInstant = () => {
    setDrawerOpen(false);
    setDrawerVisible(false);
  };

  // Helper to format Firestore Timestamp or date
  function formatNotificationDate(date: any) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    if (date.toDate) return date.toDate().toLocaleString();
    if (date.seconds) return new Date(date.seconds * 1000).toLocaleString();
    return String(date);
  }

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark notification as read
      await updateDoc(doc(db, 'notifications', notification.id), {
        read: true
      });

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      // Route based on notification content
      if (notification.message.toLowerCase().includes('maintenance') ||
          notification.message.toLowerCase().includes('service')) {
        // Route based on user role
        if (user?.role === 'admin' || user?.role === 'propertyOwner') {
          router.push('/dashboard/maintenance/admin');
        } else if (user?.role === 'tenant') {
          router.push('/dashboard/maintenance');
        } else if (user?.role === 'service') {
          router.push('/dashboard');
        }
      } else if (notification.message.toLowerCase().includes('invoice')) {
        router.push('/dashboard/invoices');
      } else if (notification.message.toLowerCase().includes('contract')) {
        router.push('/dashboard/contracts');
      }
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
    }
  };

  const hasNotifications = notifications.some(n => !n.read);

  return (
    <header className="w-full bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          <img src="/Green Bridge.png" alt="Green Bridge Logo" className="h-8 w-8 inline-block align-middle" />
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
              <Link href="/dashboard/invoices/received" className={navClassName('/dashboard/invoices/received')}><FaFileInvoice className="inline mr-1 mb-1" />Received Invoices</Link>
              <Link href="/dashboard/contracts" className={navClassName('/dashboard/contracts')}><FaFileContract className="inline mr-1 mb-1" />Contracts</Link>
              <Link href="/dashboard/users" className={navClassName('/dashboard/users')}><FaUsers className="inline mr-1 mb-1" />Users</Link>
            </>
          ) : user?.role === 'propertyOwner' ? (
            <>
              <Link href="/dashboard" className={navClassName('/dashboard', true)}><FaHome className="inline mr-1 mb-1" />Dashboard</Link>
            </>
          ) : user?.role === 'service' ? (
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
            <div className="relative">
              <button onClick={() => setNotifOpen(v => !v)} className="relative focus:outline-none">
                <Bell className="h-6 w-6 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            // Mark all as read
                            const batch = writeBatch(db);
                            notifications.forEach(notification => {
                              batch.update(doc(db, 'notifications', notification.id), { read: true });
                            });
                            await batch.commit();
                            setNotifications([]);
                          } catch (error) {
                            console.error("Error clearing notifications:", error);
                            toast.error("Failed to clear notifications.");
                          }
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.map(notification => (
                      <li key={notification.id}
                          className={`border-b border-gray-100 ${notification.read ? '' : 'bg-indigo-50'}`}
                      >
                        <a 
                           href="#"
                           onClick={(e) => { e.preventDefault(); handleNotificationClick(notification); }}
                           className="block px-4 py-3 hover:bg-gray-100"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-800 truncate">{notification.message}</p>
                          <button
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            className="ml-2 text-gray-400 hover:text-red-500"
                          >
                                <FaTimes />
                          </button>
                        </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                        </a>
                      </li>
                    ))}
                    {notifications.length === 0 && (
                      <li className="px-4 py-3 text-sm text-center text-gray-500">No new notifications.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
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
                      href="/dashboard/invoices/received"
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        pathname.startsWith('/dashboard/invoices/received')
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaFileInvoice className="w-5 h-5" />
                      <span>Received Invoices</span>
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

                {/* Owner Links */}
                {user.role === 'propertyOwner' && <></>}

                {/* Service Provider Links */}
                {user.role === 'service' && (
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
