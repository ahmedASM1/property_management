import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import ClientLayout from '@/components/ClientLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Green Bridge - Tenant Management System',
  description: 'A comprehensive tenant management system for property administrators',
  icons: {
    icon: '/Green Bridge.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Toaster position="top-center" />
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
