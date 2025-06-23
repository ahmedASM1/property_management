'use client';

import NavBar from '@/components/NavBar';
import { usePathname } from 'next/navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
} 
 
 
 