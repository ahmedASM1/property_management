'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { doc, updateDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  FaUser, 
  FaCog, 
  FaSave, 
  FaBell, 
  FaArrowLeft,
  FaExclamationTriangle,
  FaSun,
  FaMoon
} from 'react-icons/fa';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface SystemSettings {
  id?: string;
  platformName: string;
  platformDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailNotifications: boolean;
  emailFromName: string;
  emailFromAddress: string;
  adminNotifications: boolean;
  userNotifications: boolean;
  passwordMinLength: number;
  sessionTimeout: number;
  twoFactorAuth: boolean;
  loginAttempts: number;
  autoBackup: boolean;
  backupFrequency: string;
  dataRetention: number;
  logLevel: string;
  apiRateLimit: number;
  webhookUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function AccountPage() {
  const auth = useAuth();
  const user = auth?.user;
  const signOut = auth?.signOut;
  
  // Profile state
  const [editing, setEditing] = useState(false);
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

  // Settings state
  const [settings, setSettings] = useState<SystemSettings>({
    platformName: 'Green Bridge',
    platformDescription: 'Property Management Platform',
    maintenanceMode: false,
    registrationEnabled: true,
    emailNotifications: true,
    emailFromName: 'Green Bridge Admin',
    emailFromAddress: 'info@greenbridge-my.com',
    adminNotifications: true,
    userNotifications: true,
    passwordMinLength: 8,
    sessionTimeout: 24,
    twoFactorAuth: false,
    loginAttempts: 5,
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 365,
    logLevel: 'info',
    apiRateLimit: 1000,
    webhookUrl: ''
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [hasChanges, setHasChanges] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setForm({
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      unitNumber: user?.unitNumber || '',
      buildingName: user?.buildingName || '',
      rentalType: user?.rentalType || '',
      profileImage: user?.profileImage || '',
    });
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSettings is stable
  }, [user]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchSettings = async () => {
    try {
      const settingsSnapshot = await getDocs(collection(db, 'systemSettings'));
      if (!settingsSnapshot.empty) {
        const settingsData = settingsSnapshot.docs[0].data() as SystemSettings;
        setSettings({ ...settings, ...settingsData });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSettingsChange = (field: string, value: string | number | boolean) => {
    setSettings(prev => {
      const newSettings = { ...prev, [field]: value };
      setHasChanges(true);
      return newSettings;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm(f => ({ ...f, profileImage: ev.target?.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    let profileImageUrl = form.profileImage;
    
    if (imageFile && user) {
      setUploading(true);
      try {
        // Try client-side upload first
        const storageRef = ref(storage, `profileImages/${user.id}_${Date.now()}`);
        await uploadBytes(storageRef, imageFile);
        profileImageUrl = await getDownloadURL(storageRef);
      } catch (uploadError) {
        console.warn('Client-side upload failed, trying server-side API:', uploadError);
        
        // Fallback: Use server-side API route (bypasses CORS)
        try {
          const formData = new FormData();
          formData.append('file', imageFile);
          formData.append('folder', 'profileImages');
          
          const response = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload API failed: ${response.statusText}`);
          }

          const result = await response.json();
          profileImageUrl = result.url;
          
          if (result.fallback) {
            console.warn('Using fallback storage method:', result.message);
          }
        } catch (apiError) {
          console.error('Server-side upload also failed:', apiError);
          setError('Failed to upload image. Please check your connection and try again.');
          setUploading(false);
          setSaving(false);
          return;
        }
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
      toast.success('Profile updated successfully!');
      window.location.reload();
    } catch {
      setError('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user || user.role !== 'admin') return;
    
    setSavingSettings(true);
    try {
      const settingsData = {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: user.id
      };

      const settingsSnapshot = await getDocs(collection(db, 'systemSettings'));
      if (settingsSnapshot.empty) {
        await addDoc(collection(db, 'systemSettings'), settingsData);
      } else {
        await updateDoc(doc(db, 'systemSettings', settingsSnapshot.docs[0].id), settingsData);
      }
      
      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!user) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FaUser },
    ...(user.role === 'admin' ? [{ id: 'settings', label: 'Settings', icon: FaCog }] : []),
    { id: 'preferences', label: 'Preferences', icon: FaBell }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <FaArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
          <p className="text-gray-600">Manage your profile and preferences</p>
        </div>
        {hasChanges && user.role === 'admin' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <FaExclamationTriangle className="h-4 w-4" />
              Unsaved changes
            </span>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaSave className="h-4 w-4" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-green-100 text-green-700 border-l-4 border-green-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full border-2 border-green-300 flex items-center justify-center text-2xl font-bold text-green-700 overflow-hidden bg-gray-100">
                      {user.profileImage ? (
                        <Image src={user.profileImage} alt="Profile" width={80} height={80} className="object-cover w-full h-full rounded-full" />
                      ) : getInitials(user.fullName)}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{user.fullName}</h2>
                    <p className="text-gray-600 capitalize">{user.role}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          name="fullName"
                          value={form.fullName}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          name="phoneNumber"
                          value={form.phoneNumber}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      {user.role === 'tenant' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label>
                            <input
                              name="unitNumber"
                              value={form.unitNumber}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                            <input
                              name="buildingName"
                              value={form.buildingName}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rental Type</label>
                            <select
                              name="rentalType"
                              value={form.rentalType}
                              onChange={handleChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                              <option value="">Select rental type</option>
                              <option value="Room1">Room 1</option>
                              <option value="Room2">Room 2</option>
                              <option value="Room3">Room 3</option>
                              <option value="Studio">Studio</option>
                              <option value="Whole Unit">Whole Unit</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving || uploading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving...' : uploading ? 'Uploading...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <p className="text-gray-900">{user.fullName}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <p className="text-gray-900">{user.phoneNumber || 'Not provided'}</p>
                      </div>
                      {user.role === 'tenant' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label>
                            <p className="text-gray-900">{user.unitNumber || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                            <p className="text-gray-900">{user.buildingName || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rental Type</label>
                            <p className="text-gray-900">{user.rentalType || 'Not provided'}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Edit Profile
                      </button>
                      <button
                        onClick={signOut}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab (Admin Only) */}
            {activeTab === 'settings' && user.role === 'admin' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h2>
                
                <div className="space-y-6">
                  {/* General Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
                        <input
                          value={settings.platformName}
                          onChange={(e) => handleSettingsChange('platformName', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Platform Description</label>
                        <input
                          value={settings.platformDescription}
                          onChange={(e) => handleSettingsChange('platformDescription', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Security</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Minimum Length</label>
                        <input
                          type="number"
                          value={settings.passwordMinLength}
                          onChange={(e) => handleSettingsChange('passwordMinLength', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (hours)</label>
                        <input
                          type="number"
                          value={settings.sessionTimeout}
                          onChange={(e) => handleSettingsChange('sessionTimeout', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Features</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Maintenance Mode</span>
                        <button
                          onClick={() => handleSettingsChange('maintenanceMode', !settings.maintenanceMode)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.maintenanceMode ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Registration Enabled</span>
                        <button
                          onClick={() => handleSettingsChange('registrationEnabled', !settings.registrationEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.registrationEnabled ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Preferences</h2>
                
                <div className="space-y-6">
                  {/* Theme Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Appearance</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {darkMode ? (
                          <FaSun className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <FaMoon className="w-5 h-5 text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                          {darkMode ? 'Light Mode' : 'Dark Mode'}
                        </span>
                      </div>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          darkMode ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            darkMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Notification Preferences */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Notifications</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Email Notifications</span>
                        <button
                          onClick={() => handleSettingsChange('emailNotifications', !settings.emailNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.emailNotifications ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                        <button
                          onClick={() => handleSettingsChange('userNotifications', !settings.userNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.userNotifications ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.userNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

