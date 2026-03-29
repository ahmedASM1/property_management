'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    const verify = async () => {
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
          return;
        }
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again or use a fresh link from your email.');
      }
    };

    verify();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge" width={64} height={64} className="mx-auto" />
          </div>
          <div className="inline-block w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Verifying your email...</h1>
          <p className="text-gray-600 mt-2">Please wait.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge" width={64} height={64} className="mx-auto" />
          </div>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Verification failed</h1>
          <p className="text-gray-600 mt-2">{message}</p>
          <Link
            href="/register"
            className="mt-6 inline-block w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
          >
            Back to registration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <Image src="/Green Bridge.svg" alt="Green Bridge" width={64} height={64} className="mx-auto" />
        </div>
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Email verified</h1>
        <p className="text-gray-600 mt-2">{message}</p>
        <p className="text-gray-500 text-sm mt-4">
          You will be able to sign in once an administrator approves your registration.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="inline-block w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
