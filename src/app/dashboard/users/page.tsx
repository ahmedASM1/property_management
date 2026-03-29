"use client";
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Invoice, Tenant } from '@/types';
import toast from 'react-hot-toast';
import { sendPaymentReminderEmail } from '@/lib/email';
import Link from 'next/link';
import { AdminOnlyRoute } from '@/components/auth/RoleBasedRoute';
import { 
  FaArrowLeft, 
  FaSearch, 
  FaFilter, 
  FaDownload, 
  FaSortUp,
  FaSortDown,
  FaUserCheck
} from 'react-icons/fa';

function toJsDate(val: unknown): Date | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  const d = new Date(val as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function UsersPage() {
  return (
    <AdminOnlyRoute>
      <UsersPageContent />
    </AdminOnlyRoute>
  );
}

function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFormRef = useRef<HTMLFormElement>(null);

  // Advanced filtering and bulk operations
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        console.log('Fetching users from Firestore...');
        const snapshot = await getDocs(collection(db, 'users'));
        console.log('Users snapshot:', snapshot.docs.length, 'documents');
        
        const usersData = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as User[];
        console.log('Users data:', usersData);
        
        // For tenants, fetch unpaid invoices
        const tenantUsers = usersData.filter(u => u.role === 'tenant');
        if (tenantUsers.length > 0) {
          console.log('Fetching invoices for tenants...');
          const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
          const invoices = invoicesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Invoice[];
          console.log('Invoices data:', invoices);
          
          usersData.forEach(user => {
            if (user.role === 'tenant') {
              (user as Tenant).outstandingAmount = invoices
                .filter(inv => inv.tenantId === user.id && !inv.isPaid)
                .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
            }
          });
        }
        setUsers(usersData);
        setFilteredUsers(usersData);
        console.log('Users loaded successfully:', usersData.length);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users: ' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Filter and sort users
  useEffect(() => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.fullName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phoneNumber?.toLowerCase().includes(q) ||
        user.buildingName?.toLowerCase().includes(q) ||
        user.unitNumber?.toLowerCase().includes(q) ||
        user.idNumber?.toLowerCase().includes(q) ||
        user.serviceType?.toLowerCase().includes(q) ||
        user.companyName?.toLowerCase().includes(q) ||
        user.rentalType?.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        const userStatus = user.status || (user.isApproved ? 'approved' : 'pending');
        return userStatus === statusFilter;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (sortBy) {
        case 'fullName':
          aValue = a.fullName.toLowerCase();
          bValue = b.fullName.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'role':
          aValue = a.role;
          bValue = b.role;
          break;
        case 'createdAt':
          aValue = (toJsDate(a.createdAt) ?? new Date(0)).getTime();
          bValue = (toJsDate(b.createdAt) ?? new Date(0)).getTime();
          break;
        default:
          aValue = String(a[sortBy as keyof User] ?? '');
          bValue = String(b[sortBy as keyof User] ?? '');
      }

      // Handle undefined/null values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter, sortBy, sortOrder]);

  const handleApprove = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        status: 'approved',
        isApproved: true,
        updatedAt: new Date().toISOString()
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'approved', isApproved: true } : u));
      toast.success('User approved');
    } catch {
      toast.error('Failed to approve user');
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        status: 'rejected',
        isApproved: false,
        updatedAt: new Date().toISOString()
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected', isApproved: false } : u));
      toast.success('User rejected');
    } catch {
      toast.error('Failed to reject user');
    }
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const updateData: Partial<User> = {
        fullName: editUser.fullName,
        phoneNumber: editUser.phoneNumber,
        role: editUser.role,
        idNumber: editUser.idNumber || '',
      };
      if (editUser.role === 'tenant') {
        updateData.unitNumber = editUser.unitNumber;
        updateData.buildingName = editUser.buildingName || '';
        updateData.rentalType = editUser.rentalType;
        updateData.contractEnd = editUser.contractEnd || '';
      } else if (editUser.role === 'service_provider' || editUser.role === 'mixedProvider') {
        updateData.serviceType = editUser.serviceType;
        updateData.companyName = editUser.companyName;
      }
      await updateDoc(doc(db, 'users', editUser.id), updateData);
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...editUser } : u));
      setEditUser(null);
      toast.success('User updated');
    } catch {
      toast.error('Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editUser) return;
    setEditUser({ ...editUser, [e.target.name]: e.target.value });
  };

  const handleSendReminder = async (user: Tenant) => {
    try {
      await sendPaymentReminderEmail(user.email, user.fullName, user.outstandingAmount ?? 0);
      toast.success('Reminder sent');
    } catch {
      toast.error('Failed to send reminder');
    }
  };

  // Bulk operations
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.length === 0) return;

    setBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      
      for (const userId of selectedUsers) {
        const userRef = doc(db, 'users', userId);
        
        switch (bulkAction) {
          case 'approve':
            batch.update(userRef, { isApproved: true, status: 'approved' });
            break;
          case 'reject':
            batch.update(userRef, { isApproved: false, status: 'rejected' });
            break;
          case 'delete':
            batch.delete(userRef);
            break;
        }
      }
      
      await batch.commit();
      
      // Update local state
      if (bulkAction === 'delete') {
        setUsers(prev => prev.filter(user => !selectedUsers.includes(user.id)));
      } else {
        setUsers(prev => prev.map(user => 
          selectedUsers.includes(user.id) 
            ? { ...user, isApproved: bulkAction === 'approve', status: bulkAction === 'approve' ? 'approved' : 'rejected' }
            : user
        ));
      }
      
      toast.success(`${bulkAction} action completed for ${selectedUsers.length} users`);
      setSelectedUsers([]);
      setBulkAction('');
    } catch {
      toast.error(`Failed to ${bulkAction} users`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const exportUsers = () => {
    const csvContent = [
      'Name,Email,Phone,Role,Status,ID Number,Building,Unit,Rental Type,Service Type,Company,Contract End,Outstanding,Created At',
      ...filteredUsers.map(user => {
        const st = user.status || (user.isApproved ? 'approved' : 'pending');
        const out = user.role === 'tenant' ? String((user as Tenant).outstandingAmount ?? '') : '';
        return `"${user.fullName}","${user.email}","${user.phoneNumber || ''}","${user.role}","${st}","${user.idNumber || ''}","${user.buildingName || ''}","${user.unitNumber || ''}","${user.rentalType || ''}","${user.serviceType || ''}","${user.companyName || ''}","${user.contractEnd ? String(user.contractEnd) : ''}","${out}","${new Date(user.createdAt).toLocaleDateString()}"`;
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const pendingCount = users.filter(u => (u.status || (u.isApproved ? 'approved' : 'pending')) === 'pending').length;
  const getRoleBadgeClass = (role: string) =>
    role === 'admin' ? 'bg-purple-100 text-purple-800' :
    role === 'agent' ? 'bg-teal-100 text-teal-800' :
    role === 'tenant' ? 'bg-blue-100 text-blue-800' :
    role === 'property_owner' ? 'bg-green-100 text-green-800' :
    role === 'mixedProvider' ? 'bg-violet-100 text-violet-800' :
    'bg-orange-100 text-orange-800';
  const getStatusBadge = (user: User) => {
    const userStatus = user.status || (user.isApproved ? 'approved' : 'pending');
    if (userStatus === 'approved') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
    if (userStatus === 'rejected') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
  };

  const formatRentalType = (t?: string) => {
    if (!t) return '—';
    const labels: Record<string, string> = {
      Room1: 'Room 1',
      Room2: 'Room 2',
      Room3: 'Room 3',
      Studio: 'Studio',
      'Whole Unit': 'Whole Unit',
    };
    return labels[t] || t;
  };

  const formatDateShort = (d: unknown) => {
    const date = toJsDate(d);
    return date ? date.toLocaleDateString() : '—';
  };

  return (
    <div className="px-0 sm:px-0 w-full min-w-0">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1" aria-label="Back">
            <FaArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Users Management</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/users/approvals"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
          >
            <FaUserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            Approvals ({pendingCount})
          </Link>
          <button
            onClick={exportUsers}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <FaDownload className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search & Filters - full width and wrap on mobile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="w-full min-w-0">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search users by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 sm:pl-10 sm:pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="flex-1 min-w-[120px] sm:min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Roles</option>
              <option value="tenant">Tenant</option>
              <option value="service_provider">Service Provider</option>
              <option value="property_owner">Property Owner</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 min-w-[100px] sm:min-w-0 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <FaFilter className="h-3.5 w-3.5" />
              More Filters
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm font-medium text-blue-800">
                {selectedUsers.length} user(s) selected
              </span>
              <div className="flex flex-wrap gap-2">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="flex-1 min-w-[140px] sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select Action</option>
                  <option value="approve">Approve Selected</option>
                  <option value="reject">Reject Selected</option>
                  <option value="delete">Delete Selected</option>
                </select>
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction || bulkProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? 'Processing...' : 'Apply'}
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: card list (no horizontal scroll) */}
      <div className="md:hidden space-y-3">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => handleSelectUser(user.id)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
              />
              {user.profileImage ? (
                <img className="h-10 w-10 rounded-full flex-shrink-0" src={user.profileImage} alt="" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-500 text-sm font-medium">{user.fullName?.[0] || '?'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{user.fullName}</p>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{user.email}</p>
                {user.phoneNumber && <p className="text-xs text-gray-500">{user.phoneNumber}</p>}
                {user.idNumber && <p className="text-xs text-gray-500">ID: {user.idNumber}</p>}
                {user.role === 'tenant' && (
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    <p><span className="text-gray-400">Building:</span> {user.buildingName || '—'}</p>
                    <p><span className="text-gray-400">Unit:</span> {user.unitNumber || '—'}</p>
                    <p><span className="text-gray-400">Type:</span> {formatRentalType(user.rentalType)}</p>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Joined {formatDateShort(user.createdAt)}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleBadgeClass(user.role)}`}>
                    {user.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                  {getStatusBadge(user)}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              {(() => {
                const userStatus = user.status || (user.isApproved ? 'approved' : 'pending');
                if (userStatus === 'pending') {
                  return (
                    <>
                      <button onClick={() => handleApprove(user.id)} className="flex-1 min-w-[70px] py-2 px-3 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                        Approve
                      </button>
                      <button onClick={() => handleReject(user.id)} className="flex-1 min-w-[70px] py-2 px-3 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                        Reject
                      </button>
                    </>
                  );
                }
                return null;
              })()}
              <button onClick={() => setEditUser(user)} className="py-2 px-3 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                Edit
              </button>
              {user.role !== 'admin' && (
                <button
                  disabled={deletingId === user.id}
                  onClick={() => setConfirmDelete(user.id)}
                  className="py-2 px-3 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === user.id ? 'Deleting...' : 'Delete'}
                </button>
              )}
              {user.role === 'tenant' && ((user as Tenant).outstandingAmount ?? 0) > 0 && (
                <button onClick={() => handleSendReminder(user as Tenant)} className="py-2 px-3 bg-yellow-600 text-white rounded-lg text-xs font-medium hover:bg-yellow-700">
                  Remind
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
            No users match your filters.
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow bg-white">
        <table className="min-w-[960px] w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('fullName')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {sortBy === 'fullName' && (
                    sortOrder === 'asc' ? <FaSortUp className="h-3 w-3" /> : <FaSortDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center gap-1">
                  Email
                  {sortBy === 'email' && (
                    sortOrder === 'asc' ? <FaSortUp className="h-3 w-3" /> : <FaSortDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Phone</th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center gap-1">
                  Role
                  {sortBy === 'role' && (
                    sortOrder === 'asc' ? <FaSortUp className="h-3 w-3" /> : <FaSortDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">Building / unit / type</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">ID number</th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Joined
                  {sortBy === 'createdAt' && (
                    sortOrder === 'asc' ? <FaSortUp className="h-3 w-3" /> : <FaSortDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('isApproved')}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortBy === 'isApproved' && (
                    sortOrder === 'asc' ? <FaSortUp className="h-3 w-3" /> : <FaSortDown className="h-3 w-3" />
                  )}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatar URL
                      <img className="h-8 w-8 rounded-full mr-3" src={user.profileImage} alt="" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 mr-3 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">{user.fullName[0]}</span>
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{user.phoneNumber || '—'}</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(user.role)}`}>
                    {user.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm text-gray-700 align-top">
                  {user.role === 'tenant' ? (
                    <div className="space-y-0.5">
                      <div><span className="text-gray-400 text-xs">Bldg</span> {user.buildingName || '—'}</div>
                      <div><span className="text-gray-400 text-xs">Unit</span> {user.unitNumber || '—'}</div>
                      <div><span className="text-gray-400 text-xs">Type</span> {formatRentalType(user.rentalType)}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-4 text-sm text-gray-700 max-w-[120px] break-words align-top">
                  {user.idNumber || '—'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDateShort(user.createdAt)}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  {(() => {
                    const userStatus = user.status || (user.isApproved ? 'approved' : 'pending');
                    if (userStatus === 'approved') {
                      return (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Approved
                        </span>
                      );
                    } else if (userStatus === 'rejected') {
                      return (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Rejected
                        </span>
                      );
                    } else {
                      return (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      );
                    }
                  })()}
                </td>
                <td className="px-3 py-4 whitespace-nowrap space-x-2 flex flex-col sm:flex-row items-start sm:items-center">
                  {(() => {
                    const userStatus = user.status || (user.isApproved ? 'approved' : 'pending');
                    if (userStatus === 'pending') {
                      return (
                        <>
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="mb-2 sm:mb-0 sm:mr-2 inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition"
                          >
                            Reject
                          </button>
                        </>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={() => setEditUser(user)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition mt-2"
                  >
                    Edit
                  </button>
                  {user.role !== 'admin' && (
                    <button
                      disabled={deletingId === user.id}
                      onClick={() => setConfirmDelete(user.id)}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition mt-2`}
                    >
                      {deletingId === user.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  {user.role === 'tenant' && ((user as Tenant).outstandingAmount ?? 0) > 0 && (
                    <button
                      onClick={() => handleSendReminder(user as Tenant)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 transition mt-2"
                    >
                      Send Reminder
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Edit User</h3>
            <form onSubmit={handleEditSave} ref={editFormRef}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={editUser.email}
                    readOnly
                    className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 text-gray-600 shadow-sm sm:text-sm cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={editUser.fullName}
                    onChange={handleEditChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={editUser.phoneNumber || ''}
                    onChange={handleEditChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ID number</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={editUser.idNumber || ''}
                    onChange={handleEditChange}
                    placeholder="NRIC / passport"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    name="role"
                    value={editUser.role}
                    onChange={handleEditChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="tenant">Tenant</option>
                    <option value="service_provider">Service Provider</option>
                    <option value="mixedProvider">Mixed Provider</option>
                    <option value="property_owner">Property Owner</option>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editUser.role === 'tenant' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Building name</label>
                      <input
                        type="text"
                        name="buildingName"
                        value={editUser.buildingName || ''}
                        onChange={handleEditChange}
                        placeholder="e.g. Tower B"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Unit number</label>
                      <input
                        type="text"
                        name="unitNumber"
                        value={editUser.unitNumber || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rental type</label>
                      <select
                        name="rentalType"
                        value={editUser.rentalType || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Select type</option>
                        <option value="Room1">Room 1</option>
                        <option value="Room2">Room 2</option>
                        <option value="Room3">Room 3</option>
                        <option value="Studio">Studio</option>
                        <option value="Whole Unit">Whole unit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contract end</label>
                      <input
                        type="date"
                        name="contractEnd"
                        value={(() => {
                          const d = toJsDate(editUser.contractEnd);
                          return d ? d.toISOString().slice(0, 10) : '';
                        })()}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </>
                )}
                {(editUser.role === 'service_provider' || editUser.role === 'mixedProvider') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Service type</label>
                      <input
                        type="text"
                        name="serviceType"
                        value={editUser.serviceType || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Company name</label>
                      <input
                        type="text"
                        name="companyName"
                        value={editUser.companyName || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 