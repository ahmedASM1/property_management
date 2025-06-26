'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';

interface FormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);
  const auth = useAuth();
  const signIn = auth?.signIn;
  const resetPassword = auth?.resetPassword;
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      if (signIn) {
        await signIn(formData.email, formData.password);
        toast.success('Successfully signed in!');
        router.push('/dashboard');
      } else {
        throw new Error('Sign in function is not available');
      }
    } catch (error: unknown) {
      const errorMessage = (error as { code?: string; message?: string }).code === 'auth/user-not-found'
        ? 'No account found with this email address.'
        : (error as { message?: string }).message || 'An error occurred during login.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiMail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your password"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>
          <div className="text-sm">
            <button
              type="button"
              className="font-medium text-green-700 hover:text-green-600 transition-colors"
              onClick={() => setShowReset(true)}
            >
              Forgot password?
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="absolute left-0 inset-y-0 flex items-center pl-3">
            <FiLogIn className="h-5 w-5 text-green-100 group-hover:text-white" />
          </span>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      {/* Forgot Password Modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-2">
            <h2 className="text-lg font-bold mb-4">Reset Password</h2>
            <p className="mb-4 text-sm text-gray-600">Enter your email address and we&apos;ll send you a link to reset your password.</p>
            <input
              type="email"
              className="border rounded px-3 py-2 w-full mb-4"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => setShowReset(false)}
                disabled={resetting}
              >Cancel</button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                disabled={resetting || !resetEmail}
                onClick={async () => {
                  if (!resetPassword) return;
                  setResetting(true);
                  try {
                    await resetPassword(resetEmail);
                    toast.success('Password reset email sent! Check your inbox.');
                    setShowReset(false);
                    setResetEmail('');
                  } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email.';
                    toast.error(errorMessage);
                  } finally {
                    setResetting(false);
                  }
                }}
              >{resetting ? 'Sending...' : 'Send Reset Link'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
