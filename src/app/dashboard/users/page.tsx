"use client";
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tenant, Invoice, User } from '@/types';
import toast from 'react-hot-toast';
import { sendPaymentReminderEmail } from '@/lib/email';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersData = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as User[];
        // For tenants, fetch unpaid invoices
        const tenantUsers = usersData.filter(u => u.role === 'tenant');
        if (tenantUsers.length > 0) {
          const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
          const invoices = invoicesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Invoice[];
          usersData.forEach(user => {
            if (user.role === 'tenant') {
              (user as Tenant).outstandingAmount = invoices
                .filter(inv => inv.tenantId === user.id && !inv.isPaid)
                .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
            }
          });
        }
        setUsers(usersData);
      } catch (error) {
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved: true });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isApproved: true } : u));
      toast.success('User approved');
    } catch {
      toast.error('Failed to approve user');
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved: false });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isApproved: false } : u));
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
      const updateData: any = {
        fullName: editUser.fullName,
        phoneNumber: editUser.phoneNumber,
        role: editUser.role,
      };
      // Add role-specific fields
      if (editUser.role === 'tenant') {
        updateData.unitNumber = editUser.unitNumber;
        updateData.rentalType = editUser.rentalType;
        updateData.contractEnd = editUser.contractEnd || '';
      } else if (editUser.role === 'service') {
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
      </div>
      <div className="overflow-x-auto rounded-lg shadow bg-white">
        <table className="min-w-[800px] divide-y divide-gray-200 text-sm md:text-base">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Phone</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Role</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Details</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.profileImage ? (
                      <img className="h-8 w-8 rounded-full mr-3" src={user.profileImage} alt="" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 mr-3 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">{user.fullName[0]}</span>
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{user.phoneNumber}</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'tenant' ? 'bg-blue-100 text-blue-800' : 
                      user.role === 'owner' ? 'bg-green-100 text-green-800' :
                      'bg-orange-100 text-orange-800'}`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                  {user.role === 'tenant' ? (
                    <>Unit: {user.unitNumber}<br/>Type: {user.rentalType}</>
                  ) : user.role === 'service' ? (
                    <>Service: {user.serviceType}</>
                  ) : user.role === 'owner' ? (
                    <>Property Owner</>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-4 whitespace-nowrap">
                  {user.isApproved ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Approved
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-3 py-4 whitespace-nowrap space-x-2 flex flex-col sm:flex-row items-start sm:items-center">
                  {!user.isApproved && (
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
                  )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                    <option value="service">Service Provider</option>
                    <option value="owner">Property Owner</option>
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
                {editUser.role === 'service' && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
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