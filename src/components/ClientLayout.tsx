"use client";
import NavBar from '@/components/NavBar';
import { usePathname } from "next/navigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMinimalPage = pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/setup-admin";
  const isDashboardPage = pathname.startsWith("/dashboard");

  return (
    <>
      {!isMinimalPage && !isDashboardPage && <NavBar />}
      <main className={!isMinimalPage && !isDashboardPage ? 'min-h-screen bg-gray-50 p-4 pt-24' : ''}>
        {children}
      </main>
    </>
  );
} 