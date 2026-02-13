'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function TenantProfilePage() {
  const auth = useAuth();
  const user = auth?.user;
  const signOut = auth?.signOut;
  const [editing, setEditing] = useState(false);
  const [isOwnerEditing, setIsOwnerEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phoneNumber: user?.phoneNumber || '',
    unitNumber: user?.unitNumber || '',
    buildingName: user?.buildingName || '',
    rentalType: user?.rentalType || '',
    profileImage: user?.profileImage || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    setForm({
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      unitNumber: user?.unitNumber || '',
      buildingName: user?.buildingName || '',
      rentalType: user?.rentalType || '',
      profileImage: user?.profileImage || '',
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      // Optionally show preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm(f => ({ ...f, profileImage: ev.target?.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    let profileImageUrl = form.profileImage;
    if (imageFile && user) {
      setUploading(true);
      try {
        const storageRef = ref(storage, `profileImages/${user.id}_${Date.now()}`);
        await uploadBytes(storageRef, imageFile);
        profileImageUrl = await getDownloadURL(storageRef);
      } catch {
        setError('Failed to upload image.');
        setUploading(false);
        setSaving(false);
        return;
      }
      setUploading(false);
    }
    try {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id), {
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        unitNumber: form.unitNumber,
        buildingName: form.buildingName,
        rentalType: form.rentalType,
        profileImage: profileImageUrl,
        updatedAt: new Date(),
      });
      setEditing(false);
      window.location.reload(); // To refresh context/user info
    } catch {
      setError('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  // New Profile for Owner and Service Provider
  if (user.role === 'property_owner' || user.role === 'service_provider') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="relative w-28 h-28 mx-auto mb-4">
            <div className="w-full h-full rounded-full bg-indigo-500 text-white flex items-center justify-center text-5xl font-bold">
              {getInitials(user.fullName)}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{user.fullName}</h2>
          {user.role === 'service_provider' && user.companyName && (
            <p className="text-md text-gray-500">{user.companyName}</p>
          )}
          <p className="text-md text-gray-500 mb-6">{user.email}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setIsOwnerEditing(true)}
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition"
            >
              Edit Profile
            </button>
            <button
              onClick={signOut}
              className="px-6 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {isOwnerEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Edit Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    name="phoneNumber"
                    value={form.phoneNumber}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setIsOwnerEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin profile card
  if (user.role === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-indigo-50 flex flex-col items-center py-8 px-2">
        <div className="w-full max-w-xl bg-white shadow-lg rounded-xl p-8 flex flex-col items-center">
          <div className="flex flex-col items-center mb-6">
            <div className="h-24 w-24 rounded-full border-2 border-indigo-300 flex items-center justify-center text-4xl font-bold text-indigo-700 mb-2 overflow-hidden bg-gray-100">
              {user.profileImage ? (
                <Image src={user.profileImage} alt="Profile" width={96} height={96} className="object-cover w-full h-full rounded-full" />
              ) : getInitials(user.fullName)}
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} className="mb-2" />
            {imageFile && <div className="text-xs text-gray-500 mb-2">Image ready to upload</div>}
            <div className="text-2xl font-bold text-gray-900 text-center">{user.fullName}</div>
            <div className="text-gray-500 text-center mb-1">Administrator at Green Bridge Realty Sdn. Bhd.</div>
            <div className="text-gray-500 text-center text-sm">{user.email}</div>
          </div>
          <button className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium shadow hover:bg-green-700 mb-2" onClick={handleSave} disabled={saving || uploading}>{saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Changes'}</button>
          <button className="px-5 py-2 bg-red-600 text-white rounded-lg font-medium shadow hover:bg-red-700" onClick={signOut}>Sign Out</button>
        </div>
      </div>
    );
  }

  // Tenant profile card
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-indigo-50 flex flex-col items-center py-8 px-2">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-xl p-4 sm:p-8 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <div className="h-24 w-24 rounded-full border-2 border-indigo-300 flex items-center justify-center text-4xl font-bold text-indigo-700 mb-2 overflow-hidden bg-gray-100">
            {user.profileImage ? (
              <Image src={user.profileImage} alt="Profile" width={96} height={96} className="object-cover w-full h-full rounded-full" />
            ) : getInitials(user.fullName)}
          </div>
          <input type="file" accept="image/*" onChange={handleImageChange} className="mb-2" />
          {imageFile && <div className="text-xs text-gray-500 mb-2">Image ready to upload</div>}
          <div className="text-2xl font-bold text-gray-900 text-center">{user.fullName}</div>
          <div className="text-gray-500 text-center mb-1">Tenant at Green Bridge Realty Sdn. Bhd.</div>
          <div className="text-gray-500 text-center text-sm">{user.email}</div>
          <div className="text-gray-500 text-center text-sm">{user.phoneNumber}</div>
        </div>
        {editing ? (
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit Number</label>
                <input name="unitNumber" value={form.unitNumber} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Building Name</label>
                <input name="buildingName" value={form.buildingName} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rental Type</label>
                <select name="rentalType" value={form.rentalType} onChange={handleChange} className="w-full border rounded px-3 py-2">
                  <option value="">Select rental type</option>
                  <option value="Room1">Room 1</option>
                  <option value="Room2">Room 2</option>
                  <option value="Room3">Room 3</option>
                  <option value="Studio">Studio</option>
                  <option value="Whole Unit">Whole Unit</option>
                </select>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <div className="text-sm text-gray-900">{user.fullName}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                <div className="text-sm text-gray-900">{user.phoneNumber}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit Number</label>
                <div className="text-sm text-gray-900">{user.unitNumber}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Building Name</label>
                <div className="text-sm text-gray-900">{user.buildingName}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rental Type</label>
                <div className="text-sm text-gray-900">{user.rentalType}</div>
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Edit Profile
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 