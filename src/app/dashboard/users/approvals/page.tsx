'use client';
// =======================================
// USER APPROVALS PAGE - Admin Panel for User Approval/Rejection
// =======================================

import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { sendUserApprovalEmail } from '@/lib/userNotifications';
import { AdminOnlyRoute } from '@/components/auth/RoleBasedRoute';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { 
  FaArrowLeft, 
  FaCheck, 
  FaTimes, 
  FaUser, 
  FaEnvelope, 
  FaCalendar,
  FaSpinner,
  FaUserCheck
} from 'react-icons/fa';

export default function UserApprovalsPage() {
  return (
    <AdminOnlyRoute>
      <UserApprovalsContent />
    </AdminOnlyRoute>
  );
}

function UserApprovalsContent() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('tenant');

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'users'), 
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as User[];
      setPendingUsers(users);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast.error('Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, role: UserRole) => {
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      // Find the user before removing from state
      const userToApprove = pendingUsers.find(u => u.id === userId);
      
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved',
        role: role,
        updatedAt: new Date().toISOString(),
        // Legacy field for backward compatibility
        isApproved: true,
      });
      
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      toast.success('User approved successfully');
      
      // Send approval email notification
      if (userToApprove) {
        try {
          await sendUserApprovalEmail({
            userEmail: userToApprove.email,
            userName: userToApprove.fullName,
            status: 'approved',
            role: role,
            adminName: 'Administrator' // You can get this from auth context
          });
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
          // Don't fail the approval if email fails
        }
      }
      
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingUsers(prev => new Set(prev).add(userId));
    try {
      // Find the user before removing from state
      const userToReject = pendingUsers.find(u => u.id === userId);
      
      await updateDoc(doc(db, 'users', userId), {
        status: 'rejected',
        updatedAt: new Date().toISOString(),
        // Legacy field for backward compatibility
        isApproved: false,
      });
      
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      toast.success('User rejected');
      
      // Send rejection email notification
      if (userToReject) {
        try {
          await sendUserApprovalEmail({
            userEmail: userToReject.email,
            userName: userToReject.fullName,
            status: 'rejected',
            adminName: 'Administrator' // You can get this from auth context
          });
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
          // Don't fail the rejection if email fails
        }
      }
      
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Failed to reject user');
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const openApprovalModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRole('tenant'); // Default role
    setShowApprovalModal(true);
  };

  const confirmApproval = () => {
    if (selectedUser) {
      handleApprove(selectedUser.id, selectedRole);
      setShowApprovalModal(false);
      setSelectedUser(null);
    }
  };

  const roleOptions: { value: UserRole; label: string; description: string }[] = [
    { value: 'tenant', label: 'Tenant', description: 'Resident living in a unit' },
    { value: 'property_owner', label: 'Property Owner', description: 'Owner of properties/units' },
    { value: 'service_provider', label: 'Service Provider', description: 'Provides maintenance services' },
    { value: 'admin', label: 'Admin', description: 'System administrator' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/users" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Approvals</h2>
          <p className="text-gray-600">Review and approve pending user registrations</p>
        </div>
        <div className="ml-auto">
          <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
            {pendingUsers.length} pending
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <FaUser className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900">{pendingUsers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <FaCalendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today&apos;s Registrations</p>
              <p className="text-2xl font-bold text-gray-900">
                {pendingUsers.filter(user => {
                  const today = new Date();
                  const userDate = new Date(user.createdAt);
                  return userDate.toDateString() === today.toDateString();
                }).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <FaUserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ready to Review</p>
              <p className="text-2xl font-bold text-gray-900">{pendingUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Users List */}
      {pendingUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FaUserCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
          <p className="text-gray-600">All user registrations have been reviewed.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Pending User Registrations</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">
                        {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{user.fullName}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <FaEnvelope className="h-4 w-4" />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FaCalendar className="h-4 w-4" />
                          <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => openApprovalModal(user)}
                      disabled={processingUsers.has(user.id)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {processingUsers.has(user.id) ? (
                        <FaSpinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <FaCheck className="h-4 w-4" />
                      )}
                      <span>Approve</span>
                    </button>
                    
                    <button
                      onClick={() => handleReject(user.id)}
                      disabled={processingUsers.has(user.id)}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {processingUsers.has(user.id) ? (
                        <FaSpinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <FaTimes className="h-4 w-4" />
                      )}
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Approve User</h3>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-semibold">
                    {selectedUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{selectedUser.fullName}</h4>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Assign Role</label>
                <div className="space-y-2">
                  {roleOptions.map((option) => (
                    <label key={option.value} className="relative">
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={selectedRole === option.value}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="sr-only"
                      />
                      <div className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedRole === option.value 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{option.label}</div>
                            <div className="text-sm text-gray-600">{option.description}</div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedRole === option.value 
                              ? 'border-blue-500 bg-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {selectedRole === option.value && (
                              <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproval}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <FaUserCheck className="h-4 w-4" />
                <span>Approve User</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}