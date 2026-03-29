'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import Image from 'next/image';

function MagicLinkContent() {
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired'>('loading');
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (!token || !userId) {
      setStatus('invalid');
      return;
    }

    validateMagicLink(token, userId);
  }, [searchParams.get('token'), searchParams.get('userId')]);

  const validateMagicLink = async (token: string, userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        setStatus('invalid');
        return;
      }

      const userData = userDoc.data();
      const now = new Date();
      const expiresAt = new Date(userData.magicLinkExpires);

      // Check if token matches and hasn't expired
      if (userData.magicLinkToken !== token || now > expiresAt) {
        setStatus('expired');
        return;
      }

      // Check if user has already set password
      if (userData.hasSetPassword) {
        toast.error('This link has already been used');
        router.push('/login');
        return;
      }

      setUser(userData);
      setStatus('valid');
    } catch (error) {
      console.error('Error validating magic link:', error);
      setStatus('invalid');
    }
  };

  const handleContinue = () => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');
    router.push(`/auth/set-password?token=${token}&userId=${userId}`);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaSpinner className="animate-spin text-green-600 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Validating your link...</h1>
          </div>
          <p className="text-gray-600">Please wait while we verify your login link.</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaExclamationTriangle className="text-red-500 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Invalid Link</h1>
          </div>
          <p className="text-gray-600 mb-6">
            This login link is invalid or has been tampered with. Please contact your administrator for a new link.
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

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaExclamationTriangle className="text-yellow-500 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Link Expired</h1>
          </div>
          <p className="text-gray-600 mb-6">
            This login link has expired. Login links are valid for 24 hours. Please contact your administrator for a new link.
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

  if (status === 'valid' && user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
          </div>
          <div className="flex items-center justify-center mb-4">
            <FaCheck className="text-green-500 text-2xl mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Welcome, {String(user?.fullName ?? '')}!</h1>
          </div>
          <p className="text-gray-600 mb-6">
            Your account has been created successfully. Click the button below to set your password and complete your account setup.
          </p>
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              <p><strong>Email:</strong> {String(user?.email ?? '')}</p>
              <p><strong>Role:</strong> {String(user?.role ?? '')}</p>
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Set Password & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function MagicLinkFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={64} height={64} className="mx-auto" />
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

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<MagicLinkFallback />}>
      <MagicLinkContent />
    </Suspense>
  );
}


