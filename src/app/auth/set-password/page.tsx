'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaEye, FaEyeSlash, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import Image from 'next/image';

function SetPasswordContent() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{password?: string; confirmPassword?: string}>({});
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (!token || !userId) {
      router.push('/login');
      return;
    }

    validateAndGetUser(token, userId);
  }, [searchParams, router]);

  const validateAndGetUser = async (token: string, userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        toast.error('User not found');
        router.push('/login');
        return;
      }

      const userData = userDoc.data();
      const now = new Date();
      const expiresAt = new Date(userData.magicLinkExpires);

      // Check if token matches and hasn't expired
      if (userData.magicLinkToken !== token || now > expiresAt) {
        toast.error('Invalid or expired link');
        router.push('/login');
        return;
      }

      // Check if user has already set password
      if (userData.hasSetPassword) {
        toast.error('Password has already been set for this account');
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error validating user:', error);
      toast.error('Error validating user');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: {password?: string; confirmPassword?: string} = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be 8–15 characters';
    } else if (password.length > 15) {
      newErrors.password = 'Password must be 8–15 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
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
      const userId = searchParams.get('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Create Firebase Auth user
      await createUserWithEmailAndPassword(auth, (user as { email: string }).email, password);
      
      // Update user document
      await updateDoc(doc(db, 'users', userId), {
        hasSetPassword: true,
        magicLinkToken: null, // Clear the magic link token
        magicLinkExpires: null,
        updatedAt: new Date().toISOString()
      });

      toast.success('Password set successfully! You are now logged in.');
      
      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (error: unknown) {
      console.error('Error setting password:', error);
      
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/email-already-in-use') {
        // User already exists in Firebase Auth, try to sign them in
        try {
          await signInWithEmailAndPassword(auth, (user as { email: string }).email, password);
          
          // Update user document
          const userId = searchParams.get('userId');
          if (userId) {
            await updateDoc(doc(db, 'users', userId), {
              hasSetPassword: true,
              magicLinkToken: null,
              magicLinkExpires: null,
              updatedAt: new Date().toISOString()
            });
          }
          
          toast.success('Password updated successfully! You are now logged in.');
          router.push('/dashboard');
        } catch {
          toast.error('Failed to set password. Please try again.');
        }
      } else {
        toast.error('Failed to set password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaSpinner className="animate-spin text-green-600 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Loading...</h1>
          </div>
          <p className="text-gray-600">Please wait while we prepare your account setup.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaExclamationTriangle className="text-red-500 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Error</h1>
          </div>
          <p className="text-gray-600 mb-6">
            Unable to load user information. Please contact your administrator.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
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
          <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Set Your Password</h1>
          <p className="text-gray-600 mt-2">Complete your account setup</p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Account Details</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Name:</strong> {String(user?.fullName ?? '')}</p>
            <p><strong>Email:</strong> {String(user?.email ?? '')}</p>
            <p><strong>Role:</strong> {String(user?.role ?? '')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-10"
                placeholder="Enter your password"
                required
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
          </div>

          <div>
            <label className="form-label">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input pr-10"
                placeholder="Confirm your password"
                required
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
                Setting Password...
              </>
            ) : (
              <>
                <FaCheck />
                Set Password & Login
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Security Note:</h4>
          <p className="text-sm text-blue-700">
            Your password must be 8–15 characters. After setting your password, 
            you&apos;ll be able to log in normally using your email and password.
          </p>
        </div>
      </div>
    </div>
  );
}

function SetPasswordFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
        </div>
        <div className="flex items-center justify-center mb-4">
          <FaSpinner className="animate-spin text-green-600 text-2xl mr-3" />
          <h1 className="text-xl font-semibold text-gray-900">Loading...</h1>
        </div>
        <p className="text-gray-600">Please wait...</p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordFallback />}>
      <SetPasswordContent />
    </Suspense>
  );
}

