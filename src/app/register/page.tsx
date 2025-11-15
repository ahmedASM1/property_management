'use client';
// =======================================
// UNIVERSAL REGISTRATION PAGE - /pages/register/page.tsx
// =======================================

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const { registerUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    // State for the success modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');

    // Password visibility
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const resetForm = () => {
        setFullName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Validation
        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }
        
        setLoading(true);
        try {
            // Mark registration in progress to avoid auth-state race
            if (typeof window !== 'undefined') {
                localStorage.setItem('gb_pending_registration', '1');
            }
            
            await registerUser({ email, password, fullName });
            setShowSuccessModal(true);
            resetForm();
        } catch (error: unknown) {
            const errorMessage = (error as { code?: string; message?: string }).code === 'auth/email-already-in-use'
                ? 'An account with this email already exists.'
                : ((error as { message?: string }).message || "Something went wrong. Please try again later.");
            toast.error(errorMessage);
        } finally {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('gb_pending_registration');
            }
            setLoading(false);
        }
    };
    
    if (showSuccessModal) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
                <div className="max-w-lg w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-green-700">✅ Thank you for registering!</h2>
                    <p className="text-gray-600 mb-6">
                        Your registration is under review. We'll notify you once it's approved.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        An administrator will review your application and assign you the appropriate role. 
                        You'll receive an email notification once your account is approved.
                    </p>
                    <button
                        onClick={() => {
                            setShowSuccessModal(false);
                            router.push('/login');
                        }} 
                        className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-300"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-lg w-full bg-white p-8 sm:p-10 rounded-2xl shadow-lg">
                <header className="text-center mb-8">
                    <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={60} height={60} className="mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
                    <p className="text-gray-600 text-sm mt-1">Sign up to Green Bridge Realty</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <input 
                            type="text" 
                            placeholder="Your Full Name" 
                            required 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                            autoComplete="off" 
                        />
                    </div>
                    
                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <input 
                            type="email" 
                            placeholder="you@example.com" 
                            required 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" 
                            autoComplete="off" 
                        />
                    </div>

                    {/* Password */}
                    <div className="relative space-y-2">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <input
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            required 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            autoComplete="new-password"
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)} 
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500" 
                            style={{top: '1.75rem'}}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    
                    {/* Confirm Password */}
                    <div className="relative space-y-2">
                        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                        <input
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            required 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            autoComplete="new-password"
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500" 
                            style={{top: '1.75rem'}}
                        >
                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>

                    {/* Login Link */}
                    <p className="text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="font-medium text-green-600 hover:underline">
                            Sign in here
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}