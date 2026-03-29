'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { validatePasswordStrength, validateEmail, sanitizeInput } from '@/lib/auth-security';
import { toast } from 'react-hot-toast';
import { 
  FaUser, FaEnvelope, FaPhone, FaLock, FaShieldAlt, 
  FaExclamationTriangle, FaSpinner, FaEye, FaEyeSlash
} from 'react-icons/fa';
import Image from 'next/image';

export default function SetupAdminPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordValidation, setPasswordValidation] = useState<{ isValid: boolean; score: number; feedback: string[] }>({ isValid: false, score: 0, feedback: [] });
  
  const router = useRouter();

  useEffect(() => {
    checkExistingAdmin();
  }, []);

  const checkExistingAdmin = async () => {
    try {
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      setAdminExists(!adminSnapshot.empty);
    } catch (error) {
      console.error('Error checking existing admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Validate password in real-time
    if (name === 'password') {
      const validation = validatePasswordStrength(value);
      setPasswordValidation(validation);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!passwordValidation.isValid) {
      newErrors.password = 'Password does not meet requirements';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const user = userCredential.user;
      
      // Create Firestore user document
      const userDocData = {
        id: user.uid,
        email: sanitizeInput(formData.email),
        fullName: sanitizeInput(formData.fullName),
        phoneNumber: sanitizeInput(formData.phoneNumber),
        role: 'admin',
        isApproved: true,
        hasSetPassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Admin-specific fields
        adminLevel: 'super',
        permissions: [
          'users.create', 'users.read', 'users.update', 'users.delete',
          'properties.create', 'properties.read', 'properties.update', 'properties.delete',
          'tenants.create', 'tenants.read', 'tenants.update', 'tenants.delete',
          'contracts.create', 'contracts.read', 'contracts.update', 'contracts.delete',
          'invoices.create', 'invoices.read', 'invoices.update', 'invoices.delete',
          'maintenance.create', 'maintenance.read', 'maintenance.update', 'maintenance.delete',
          'settings.update'
        ],
        setupCompleted: true,
        setupDate: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', user.uid), userDocData);
      
      // Sign out the admin user
      await signOut(auth);
      
      toast.success('Admin user created successfully!');
      
      // Redirect to login page
      router.push('/login?message=admin-created');
      
    } catch (error: unknown) {
      console.error('Error creating admin user:', error);
      
      let errorMessage = 'Failed to create admin user';
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-green-600 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">Checking system status...</p>
        </div>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <FaShieldAlt className="text-green-500 text-4xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Already Exists</h1>
          <p className="text-gray-600 mb-6">
            An admin user has already been set up for this system. If you need to create additional admin users, 
            please log in as an existing admin and use the user management panel.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Setup Admin Account</h1>
          <p className="text-gray-600 mt-2">Create the initial administrator account</p>
        </div>

        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <FaExclamationTriangle className="text-yellow-500 text-lg mr-3 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">Important Security Notice</h4>
              <p className="text-sm text-yellow-700">
                This will create a super admin account with full system access. 
                Make sure to use a strong password and store the credentials securely.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">
              <FaUser className="inline mr-2" />
              Full Name *
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className={`form-input ${errors.fullName ? 'border-red-300' : ''}`}
              placeholder="Enter your full name"
            />
            {errors.fullName && (
              <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
            )}
          </div>

          <div>
            <label className="form-label">
              <FaEnvelope className="inline mr-2" />
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`form-input ${errors.email ? 'border-red-300' : ''}`}
              placeholder="info@greenbridge-my.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="form-label">
              <FaPhone className="inline mr-2" />
              Phone Number
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="form-input"
              placeholder="+60 12-345 6789"
            />
          </div>

          <div>
            <label className="form-label">
              <FaLock className="inline mr-2" />
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input pr-10 ${errors.password ? 'border-red-300' : ''}`}
                placeholder="Enter a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
            {formData.password && (
              <div className="mt-2">
                <div className="flex items-center mb-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    passwordValidation.isValid ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-xs text-gray-600">Password Strength</span>
                </div>
                {passwordValidation.feedback.length > 0 && (
                  <ul className="text-xs text-gray-600 space-y-1">
                    {passwordValidation.feedback.map((feedback, index) => (
                      <li key={index} className="flex items-center">
                        <span className="mr-1">•</span>
                        {feedback}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">
              <FaLock className="inline mr-2" />
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`form-input pr-10 ${errors.confirmPassword ? 'border-red-300' : ''}`}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" />
                Creating Admin Account...
              </>
            ) : (
              <>
                <FaShieldAlt />
                Create Admin Account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">After Setup:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• You&apos;ll be redirected to the login page</li>
            <li>• Use your email and password to log in</li>
            <li>• You&apos;ll have full admin access to the system</li>
            <li>• You can create other users through the admin panel</li>
          </ul>
        </div>
      </div>
    </div>
  );
}