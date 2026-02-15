'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { Bell, X, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: unknown;
  userId?: string;
  role?: string;
  priority?: 'low' | 'medium' | 'high';
  link?: string;
}

interface NotificationSystemProps {
  className?: string;
}

export default function NotificationSystem({ className = '' }: NotificationSystemProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const DROPDOWN_WIDTH = 320; // px
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      user.role === 'admin' 
        ? where('role', '==', 'admin')
        : where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt
      })) as Notification[];

      // Remove duplicates based on message and timestamp
      const toTime = (c: unknown) => {
        if (typeof c === 'object' && c !== null && 'seconds' in c) return new Date((c as { seconds: number }).seconds * 1000).getTime();
        return new Date(c as string | number).getTime();
      };
      const uniqueItems = items.filter((item, index, self) => 
        index === self.findIndex(t => 
          t.message === item.message && 
          Math.abs(toTime(t.createdAt) - toTime(item.createdAt)) < 1000
        )
      );

      setNotifications(uniqueItems);
    });

    return () => unsubscribe();
  }, [user]);

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Decide dropdown direction based on viewport space
  useEffect(() => {
    if (!isOpen) return;
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 300 + 56; // list max + header approx
    setOpenUpwards(spaceBelow < dropdownHeight);
    const left = Math.max(8, Math.round(rect.right - DROPDOWN_WIDTH));
    const top = openUpwards ? Math.round(rect.top - (dropdownHeight + 8)) : Math.round(rect.bottom + 8);
    setCoords({ top, left });

    const handleRecalc = () => {
      const r = btn.getBoundingClientRect();
      const spaceB = window.innerHeight - r.bottom;
      const openUp = spaceB < dropdownHeight;
      setOpenUpwards(openUp);
      const l = Math.max(8, Math.round(r.right - DROPDOWN_WIDTH));
      const t = openUp ? Math.round(r.top - (dropdownHeight + 8)) : Math.round(r.bottom + 8);
      setCoords({ top: t, left: l });
    };
    window.addEventListener('resize', handleRecalc);
    window.addEventListener('scroll', handleRecalc, true);
    return () => {
      window.removeEventListener('resize', handleRecalc);
      window.removeEventListener('scroll', handleRecalc, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openUpwards is computed inside effect
  }, [isOpen]);

  useEffect(() => {
    setPortalReady(typeof window !== 'undefined');
  }, []);

  // Format timestamp like "Oct 30, 2025 – 7:12 PM"
  const formatTimestamp = (date: unknown): string => {
    if (!date) return '';
    
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date === 'object' && date !== null && 'seconds' in date) {
      dateObj = new Date((date as { seconds: number }).seconds * 1000);
    } else if (typeof date === 'object' && date !== null && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
      dateObj = (date as { toDate: () => Date }).toDate();
    } else {
      dateObj = new Date(date as string | number);
    }

    const dtf = new Intl.DateTimeFormat(undefined, {
      month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    const parts = dtf.formatToParts(dateObj);
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const hour = parts.find(p => p.type === 'hour')?.value ?? '';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value?.toUpperCase() ?? '';
    return `${month} ${day}, ${year} – ${hour}:${minute} ${dayPeriod}`.replace('  ', ' ');
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Get notification background color
  const getNotificationBgColor = (type: string, read: boolean) => {
    const baseClasses = 'p-3 rounded-lg border-l-4 transition-all duration-200';
    const readClasses = read ? 'bg-gray-50 opacity-75' : 'bg-white';
    
    switch (type) {
      case 'success':
        return `${baseClasses} ${readClasses} border-l-green-500`;
      case 'warning':
        return `${baseClasses} ${readClasses} border-l-yellow-500`;
      case 'error':
        return `${baseClasses} ${readClasses} border-l-red-500`;
      default:
        return `${baseClasses} ${readClasses} border-l-blue-500`;
    }
  };

  // Handle notification click (navigate) and mark as read
  const handleNotificationClick = async (notification: Notification) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Mark as read
      await updateDoc(doc(db, 'notifications', notification.id), {
        read: true,
        readAt: new Date()
      });

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );

      // Route: use notification link if present, else infer from message
      if (notification.link) {
        router.push(notification.link);
      } else {
        const message = notification.message.toLowerCase();
        if (message.includes('maintenance') || message.includes('service')) {
          if (user?.role === 'admin' || user?.role === 'property_owner') {
            router.push('/dashboard/maintenance/admin');
          } else if (user?.role === 'tenant') {
            router.push('/dashboard/maintenance');
          } else if (user?.role === 'service_provider') {
            router.push('/dashboard');
          }
        } else if (message.includes('invoice')) {
          router.push('/dashboard/invoices');
        } else if (message.includes('contract')) {
          router.push('/dashboard/contracts');
        } else if (message.includes('user') || message.includes('registration')) {
          router.push('/dashboard/users/approvals');
        }
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Error handling notification:', error);
      toast.error('Failed to process notification');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setIsProcessing(false);
    }
  };

  // Mark one as read (button)
  const handleMarkRead = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (notification.read) return;
    try {
      await updateDoc(doc(db, 'notifications', notification.id), { read: true, readAt: new Date() });
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark as read');
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(notification =>
        updateDoc(doc(db, 'notifications', notification.id), {
          read: true,
          readAt: new Date()
        })
      );

      await Promise.all(promises);
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    } finally {
      setIsProcessing(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasNotifications = notifications.length > 0;

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={notificationRef}>
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        disabled={isProcessing}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-700 transition-colors duration-200" />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] leading-none rounded-full h-4 min-w-[14px] px-1 flex items-center justify-center font-semibold shadow-sm border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && portalReady && createPortal(
        <div
          className="fixed z-[10000] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden backdrop-blur-sm transition-all duration-200"
          style={{ top: coords.top, left: coords.left, width: DROPDOWN_WIDTH, maxHeight: 356 }}
          ref={notificationRef}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-700" />
                Notifications {unreadCount > 0 && (<span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">{unreadCount}</span>)}
              </h3>
              {hasNotifications && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isProcessing}
                  className="text-xs text-green-700 hover:text-green-900 font-medium disabled:opacity-50 transition-colors duration-200 px-2 py-1 rounded hover:bg-green-50"
                >
                  Mark All as Read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {!hasNotifications ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No notifications</p>
                <p className="text-xs text-gray-400 mt-1">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`${getNotificationBgColor(notification.type, notification.read)} cursor-pointer hover:bg-gray-50 group transition-all duration-200 ${notification.read ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-start space-x-3 p-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-relaxed ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'} group-hover:text-gray-900 transition-colors duration-200`}>
                          {notification.message.length > 120 
                            ? `${notification.message.substring(0, 120)}...` 
                            : notification.message
                          }
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500 font-medium">{formatTimestamp(notification.createdAt)}</p>
                          <div className="flex items-center gap-2">
                            {!notification.read && (<div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>)}
                            <button
                              onClick={(e) => handleMarkRead(e, notification)}
                              className="text-[11px] px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors duration-200"
                              disabled={notification.read}
                              aria-label="Mark as Read"
                            >
                              Mark as Read
                            </button>
                            <button
                              onClick={(e) => handleDeleteNotification(e, notification.id)}
                              className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-200"
                              disabled={isProcessing}
                              aria-label="Delete notification"
                            >
                              <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
