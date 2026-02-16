'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { Bell, Check, X, Eye, CheckCircle, Trash2 } from 'lucide-react';

interface AdminNotification {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  userRole: string;
  status: string;
  createdAt: unknown;
  read: boolean;
}

interface PendingUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  unitNumber?: string;
  buildingName?: string;
  createdAt: unknown;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPendingUsers, setShowPendingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchPendingUsers();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Try to fetch notifications from Firestore
      // If the collection doesn't exist or there are permission issues, just set empty array
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('role', '==', 'admin'),
        orderBy('createdAt', 'desc')
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsData = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      })) as AdminNotification[];
      setNotifications(notificationsData);
    } catch (error) {
      console.log('No notifications found or collection not accessible:', error);
      // Set empty array if there's an error or no notifications exist
      setNotifications([]);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      // Try to fetch users with isApproved: false from Firestore
      // If the collection doesn't exist or there are permission issues, just set empty array
      const usersQuery = query(
        collection(db, 'users'),
        where('isApproved', '==', false),
        orderBy('createdAt', 'desc')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      })) as PendingUser[];
      setPendingUsers(usersData);
    } catch (error) {
      console.log('No pending users found or collection not accessible:', error);
      // Set empty array if there's an error or no pending users exist
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    if (!confirm('Clear all notifications? This cannot be undone and will remove test/old data so you only see new production notifications.')) return;
    setClearing(true);
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('role', '==', 'admin')
      );
      const snapshot = await getDocs(notificationsQuery);
      const BATCH_SIZE = 500;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setNotifications([]);
      toast.success('All notifications cleared. You will only see new notifications from now on.');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        updatedAt: new Date().toISOString()
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification marked as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleUserAction = async (approved: boolean) => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      // Update user approval status
      await updateDoc(doc(db, 'users', selectedUser.id), {
        isApproved: approved,
        adminNotes: adminNotes || null,
        updatedAt: new Date().toISOString()
      });

      toast.success(`User ${approved ? 'approved' : 'rejected'} successfully`);
      
      // Refresh data
      await fetchPendingUsers();
      await fetchNotifications();
      
      // Reset form
      setSelectedUser(null);
      setAdminNotes('');
    } catch (error: unknown) {
      console.error('Error processing user action:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process user action');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function'
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'tenant': return 'bg-blue-100 text-blue-800';
      case 'service-provider': return 'bg-green-100 text-green-800';
      case 'property-owner': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Admin Notifications</h2>
              {notifications.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center font-semibold shadow-sm border-2 border-white flex-shrink-0">
                  {notifications.length}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600">Manage user approvals and system alerts</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-shrink-0">
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              disabled={clearing}
              className="w-full sm:w-auto px-3 py-2 sm:px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
              title="Remove all current notifications (test/old data) so only new production notifications appear"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {clearing ? 'Clearing...' : 'Clear all notifications'}
            </button>
          )}
          <button
            onClick={() => setShowPendingUsers(!showPendingUsers)}
            className="w-full sm:w-auto px-3 py-2 sm:px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {showPendingUsers ? 'Hide' : 'Show'} Pending Users ({pendingUsers.length})
          </button>
        </div>
      </div>

      {/* Pending Users Section */}
      {showPendingUsers && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Pending User Approvals</h3>
            <span className="bg-orange-100 text-orange-800 text-xs rounded-full px-2 py-0.5 font-semibold">
              {pendingUsers.length} pending
            </span>
          </div>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <p className="text-gray-600 font-medium text-sm sm:text-base">No pending user approvals</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">All users have been processed</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {pendingUsers.map((user) => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-all duration-200 hover:shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{user.fullName}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{user.email}</p>
                        {user.phoneNumber && (
                          <p className="text-xs sm:text-sm text-gray-600">Phone: {user.phoneNumber}</p>
                        )}
                        {user.unitNumber && (
                          <p className="text-xs sm:text-sm text-gray-600">Unit: {user.unitNumber}</p>
                        )}
                        {user.buildingName && (
                          <p className="text-xs sm:text-sm text-gray-600">Building: {user.buildingName}</p>
                        )}
                        <p className="text-xs text-gray-500 font-medium mt-1 sm:mt-2">
                          Registered: {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="w-full sm:w-auto flex-shrink-0 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm font-medium transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Review Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Review User Registration</h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900">{selectedUser.fullName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                  {selectedUser.role}
                </span>
              </div>
              {selectedUser.phoneNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{selectedUser.phoneNumber}</p>
                </div>
              )}
              {selectedUser.unitNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit Number</label>
                  <p className="text-gray-900">{selectedUser.unitNumber}</p>
                </div>
              )}
              {selectedUser.buildingName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Building</label>
                  <p className="text-gray-900">{selectedUser.buildingName}</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="Add any notes about this user..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleUserAction(true)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => handleUserAction(false)}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setAdminNotes('');
                }}
                disabled={processing}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Notifications</h3>
            {notifications.length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-0.5 font-semibold">
                {notifications.length} total
              </span>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {notifications.length === 0 ? (
            <div className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium text-sm sm:text-base">No new notifications</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div key={notification.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-all duration-200 group">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 sm:mb-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                        New {notification.userRole} Registration
                      </h4>
                      {!notification.read && (
                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        {notification.userFullName} ({notification.userEmail})
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => markNotificationRead(notification.id)}
                    className="w-full sm:w-auto flex-shrink-0 px-3 py-2 sm:py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm font-medium transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Mark Read
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 