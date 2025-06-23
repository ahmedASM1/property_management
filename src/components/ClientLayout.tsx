"use client";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  return (
    <AuthProvider>
      <Toaster position="top-center" />
      {!isAuthPage && <NavBar />}
      <main className={!isAuthPage ? 'min-h-screen bg-gray-50 p-4 pt-24' : ''}>
        {children}
      </main>
    </AuthProvider>
  );
} 