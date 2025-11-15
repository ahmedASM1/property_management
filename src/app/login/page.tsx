'use client';
// ===================================
// LOGIN PAGE - /pages/login/page.tsx
// ===================================

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

/**
 * Login Form Component
 */
interface LoginFormProps {
  showReset: boolean;
  setShowReset: (show: boolean) => void;
  resetEmail: string;
  setResetEmail: (email: string) => void;
  resetting: boolean;
  setResetting: (resetting: boolean) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({
  showReset,
  setShowReset,
  resetEmail,
  setResetEmail,
  resetting,
  setResetting
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const auth = useAuth();
  if (!auth) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  const { signIn } = auth;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear validation error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Clear auth error
    if(authError) {
      setAuthError(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await signIn(formData.email, formData.password);
      // Redirect is handled in AuthContext
    } catch (error: unknown) {
      let message = 'An unexpected error occurred. Please try again.';
      if (error instanceof Error && error.message.includes('auth/invalid-credential')) {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (error instanceof Error && error.message.includes('not-approved')) {
        message = 'Your account is pending admin approval.';
      } else if (error instanceof Error && error.message.includes('profile-not-found')) {
        message = 'No profile found for this user.';
      }
      setAuthError(message);
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Auth Error Display */}
      {authError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-sm text-red-700">{authError}</p>
        </div>
      )}

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
              errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
          />
        </div>
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleInputChange}
            className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
              errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            checked={formData.rememberMe}
            onChange={handleInputChange}
            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
            Remember me
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          className="text-sm text-green-600 hover:text-green-500 font-medium"
        >
          Forgot password?
        </button>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
};

/**
 * Login Page Component
 */
export default function LoginPage() {
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-lg">
          {/* Header */}
          <header className="flex flex-col items-center">
            <div className="mb-6">
              <Image 
                src="/Green Bridge.png" 
                alt="Green Bridge Logo" 
                width={64} 
                height={64}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 text-center">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-gray-600 text-center">
              Sign in to your Green Bridge account
            </p>
          </header>

          {/* Login Form */}
          <main>
            <LoginForm 
              showReset={showReset}
              setShowReset={setShowReset}
              resetEmail={resetEmail}
              setResetEmail={setResetEmail}
              resetting={resetting}
              setResetting={setResetting}
            />
          </main>

          {/* Footer - Registration Link */}
          <footer className="text-center">
            <p className="text-sm text-gray-600 mt-4">
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-green-600 hover:text-green-500">
                Create one here
              </Link>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Need help? Contact your administrator for assistance.
            </p>
          </footer>
        </div>

        {/* Password Reset Modal */}
        {showReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-2">
              <h2 className="text-lg font-bold mb-4">Reset Password</h2>
              <p className="mb-4 text-sm text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <input
                type="email"
                className="form-input mb-4"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setShowReset(false)}
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={resetting || !resetEmail}
                  onClick={async () => {
                    setResetting(true);
                    try {
                      const response = await fetch('/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: resetEmail })
                      });
                      
                      if (response.ok) {
                        toast.success('Password reset link sent! Check your email.');
                        setShowReset(false);
                        setResetEmail('');
                      } else {
                        const error = await response.json();
                        toast.error(error.error || 'Failed to send reset link');
                      }
                    } catch (err) {
                      toast.error('Failed to send reset link');
                    } finally {
                      setResetting(false);
                    }
                  }}
                >
                  {resetting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

