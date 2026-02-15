'use client';

import { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * Wraps AuthProvider so it only mounts on the client.
 * Avoids "Cannot read properties of null (reading 'useState')" during SSR
 * when AuthProvider is used in the root layout (Next 15 + React 19).
 */
export default function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return <AuthProvider>{children}</AuthProvider>;
}
