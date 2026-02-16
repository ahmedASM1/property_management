'use client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col min-w-0">
        <Sidebar />
        <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
          <main className="p-3 sm:p-4 md:p-6 flex-1 min-w-0 overflow-x-hidden">
            <div className="max-w-7xl mx-auto w-full min-w-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
} 