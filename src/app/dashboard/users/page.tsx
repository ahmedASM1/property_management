"use client";
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, writeBatch, addDoc } from 'firebase/firestore';
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
  FaTimes, 
  FaDownload, 
  FaSortUp,
  FaSortDown,
  FaUserPlus,
  FaSpinner,
  FaUser,
  FaUserCog,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaBriefcase,
  FaUserCheck
} from 'react-icons/fa';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    fullName: '',
    email: '',
    role: 'tenant',
    phoneNumber: '',
    idNumber: '',
    unitId: '',
    serviceType: '',
    companyName: ''
  });
  const [creatingUser, setCreatingUser] = useState(false);

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
      filtered = filtered.filter(user => 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
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
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
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
      };
      // Add role-specific fields
      if (editUser.role === 'tenant') {
        updateData.unitNumber = editUser.unitNumber;
        updateData.rentalType = editUser.rentalType;
        updateData.contractEnd = editUser.contractEnd || '';
      } else if (editUser.role === 'service_provider') {
        updateData.serviceType = editUser.serviceType;
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
      'Name,Email,Phone,Role,Status,Unit,Service Type,Created At',
      ...filteredUsers.map(user => 
        `"${user.fullName}","${user.email}","${user.phoneNumber || ''}","${user.role}","${user.isApproved ? 'Approved' : 'Pending'}","${user.unitNumber || ''}","${user.serviceType || ''}","${new Date(user.createdAt).toLocaleDateString()}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const normalizeRoleForDb = (role: string): string => {
    const map: Record<string, string> = {
      propertyOwner: 'property_owner',
      service: 'service_provider',
    };
    return map[role] || role;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const userData = {
        ...createUserData,
        role: normalizeRoleForDb(createUserData.role),
        status: 'approved',
        isApproved: true,
        hasSetPassword: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'users'), userData);
      
      // Send magic link
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: createUserData.email, userId: docRef.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to send magic link');
      }

      toast.success('User created successfully! Magic link sent to their email.');
      setShowCreateModal(false);
      setCreateUserData({
        fullName: '',
        email: '',
        role: 'tenant',
        phoneNumber: '',
        idNumber: '',
        unitId: '',
        serviceType: '',
        companyName: ''
      });
      
      // Refresh users list
      window.location.reload();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCreateUserData({ ...createUserData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Users Management</h2>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/users/approvals"
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <FaUserCheck className="h-4 w-4" />
            Approvals ({users.filter(u => (u.status || (u.isApproved ? 'approved' : 'pending')) === 'pending').length})
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaUserPlus className="h-4 w-4" />
            Create User
          </button>
          <button
            onClick={exportUsers}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FaDownload className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Advanced Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search users by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FaFilter className="h-4 w-4" />
              More Filters
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800">
                  {selectedUsers.length} user(s) selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="">Select Action</option>
                  <option value="approve">Approve Selected</option>
                  <option value="reject">Reject Selected</option>
                  <option value="delete">Delete Selected</option>
                </select>
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction || bulkProcessing}
                  className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? 'Processing...' : 'Apply'}
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-4 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg shadow bg-white">
        <table className="min-w-[800px] divide-y divide-gray-200 text-sm md:text-base">
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
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Details</th>
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
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{user.phoneNumber}</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'agent' ? 'bg-teal-100 text-teal-800' :
                      user.role === 'tenant' ? 'bg-blue-100 text-blue-800' : 
                      user.role === 'property_owner' ? 'bg-green-100 text-green-800' :
                      'bg-orange-100 text-orange-800'}`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                  {user.role === 'tenant' ? (
                    <>Unit: {user.unitNumber}<br/>Type: {user.rentalType}</>
                  ) : user.role === 'service_provider' ? (
                    <>Service: {user.serviceType}</>
                  ) : user.role === 'property_owner' ? (
                    <>Property Owner</>
                  ) : (
                    '-'
                  )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-medium mb-4">Edit User</h3>
            <form onSubmit={handleEditSave} ref={editFormRef}>
              <div className="space-y-4">
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
                    value={editUser.phoneNumber}
                    onChange={handleEditChange}
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
                    <option value="property_owner">Property Owner</option>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {editUser.role === 'tenant' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Unit Number</label>
                      <input
                        type="text"
                        name="unitNumber"
                        value={editUser.unitNumber || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rental Type</label>
                      <select
                        name="rentalType"
                        value={editUser.rentalType || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Select Type</option>
                        <option value="Room1">Room 1</option>
                        <option value="Room2">Room 2</option>
                        <option value="Room3">Room 3</option>
                        <option value="Studio">Studio</option>
                        <option value="Whole Unit">Whole Unit</option>
                      </select>
                    </div>
                  </>
                )}
                {editUser.role === 'service_provider' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Service Type</label>
                    <input
                      type="text"
                      name="serviceType"
                      value={editUser.serviceType || ''}
                      onChange={handleEditChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Create New User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FaUser className="inline mr-2" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={createUserData.fullName}
                      onChange={handleCreateUserChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FaEnvelope className="inline mr-2" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={createUserData.email}
                      onChange={handleCreateUserChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <FaPhone className="inline mr-2" />
                      Phone Number
                    </label>
                    <input
                      type="text"
                      name="phoneNumber"
                      value={createUserData.phoneNumber}
                      onChange={handleCreateUserChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+60 12-345 6789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                    <input
                      type="text"
                      name="idNumber"
                      value={createUserData.idNumber}
                      onChange={handleCreateUserChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="NRIC/Passport Number"
                    />
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Role Assignment</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Role *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'tenant', label: 'Tenant', icon: FaUser, color: 'blue' },
                      { value: 'propertyOwner', label: 'Property Owner', icon: FaBuilding, color: 'green' },
                      { value: 'service', label: 'Service Provider', icon: FaBriefcase, color: 'orange' },
                      { value: 'mixedProvider', label: 'Mixed Provider', icon: FaBriefcase, color: 'purple' },
                      { value: 'agent', label: 'Agent', icon: FaUserCog, color: 'teal' }
                    ].map(({ value, label, icon: Icon, color }) => (
                      <label key={value} className="relative">
                        <input
                          type="radio"
                          name="role"
                          value={value}
                          checked={createUserData.role === value}
                          onChange={handleCreateUserChange}
                          className="sr-only"
                        />
                        <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          createUserData.role === value 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <Icon className={`w-6 h-6 mx-auto mb-2 text-${color}-600`} />
                          <div className="text-sm font-medium text-center">{label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Role-specific fields */}
              {createUserData.role === 'tenant' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">Tenant Information</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Assignment (Optional)</label>
                    <input
                      type="text"
                      name="unitId"
                      value={createUserData.unitId}
                      onChange={handleCreateUserChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Unit number or ID"
                    />
                  </div>
                </div>
              )}

              {(createUserData.role === 'service_provider' || createUserData.role === 'mixedProvider') && (
                <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
                  <h4 className="font-medium text-orange-900">Service Provider Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                      <select
                        name="serviceType"
                        value={createUserData.serviceType}
                        onChange={handleCreateUserChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select service type</option>
                        <option value="Cleaning">Cleaning</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Door Repair">Door Repair</option>
                        <option value="General Maintenance">General Maintenance</option>
                        <option value="Air Conditioning">Air Conditioning</option>
                        <option value="Security">Security</option>
                        <option value="Landscaping">Landscaping</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <input
                        type="text"
                        name="companyName"
                        value={createUserData.companyName}
                        onChange={handleCreateUserChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Company name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {creatingUser ? (
                    <>
                      <FaSpinner className="animate-spin h-4 w-4" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FaUserPlus className="h-4 w-4" />
                      Create User & Send Login Link
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 