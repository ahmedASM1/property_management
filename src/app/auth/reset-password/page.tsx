'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaEye, FaEyeSlash, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import Image from 'next/image';

function ResetPasswordContent() {
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

    validateResetToken(token, userId);
  }, [searchParams, router]);

  const validateResetToken = async (token: string, userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        toast.error('User not found');
        router.push('/login');
        return;
      }

      const userData = userDoc.data();
      const now = new Date();
      const expiresAt = new Date(userData.passwordResetExpires);

      // Check if token matches and hasn't expired
      if (userData.passwordResetToken !== token || now > expiresAt) {
        toast.error('Invalid or expired reset link');
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error validating reset token:', error);
      toast.error('Error validating reset token');
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

      // Get the current user from Firebase Auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Update password in Firebase Auth
      await updatePassword(currentUser, password);
      
      // Update user document to clear reset token
      await updateDoc(doc(db, 'users', userId), {
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date().toISOString()
      });

      toast.success('Password updated successfully!');
      
      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (error: unknown) {
      console.error('Error updating password:', error);
      
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/requires-recent-login') {
        toast.error('Please log in again before changing your password.');
        router.push('/login');
      } else {
        toast.error('Failed to update password. Please try again.');
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
            <h1 className="text-xl font-semibold text-gray-900">Validating reset link...</h1>
          </div>
          <p className="text-gray-600">Please wait while we verify your password reset link.</p>
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
            <h1 className="text-xl font-semibold text-gray-900">Invalid Link</h1>
          </div>
          <p className="text-gray-600 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
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
          <h1 className="text-2xl font-bold text-gray-900">Reset Your Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password below</p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Account</h3>
          <div className="text-sm text-gray-600">
            <p><strong>Email:</strong> {String(user?.email ?? '')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-10"
                placeholder="Enter your new password"
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
            <label className="form-label">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input pr-10"
                placeholder="Confirm your new password"
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
                Updating Password...
              </>
            ) : (
              <>
                <FaCheck />
                Update Password
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Security Note:</h4>
          <p className="text-sm text-blue-700">
            Your new password must be 8–15 characters and different from your previous password.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

