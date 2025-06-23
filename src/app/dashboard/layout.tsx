'use client';
import { Fragment } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Profile', href: '/dashboard/profile' },
  { name: 'Invoices', href: '/dashboard/invoices' },
  { name: 'Contract', href: '/dashboard/contract' },
];

const adminNavigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Users', href: '/dashboard/users' },
  { name: 'Invoices', href: '/dashboard/invoices' },
  { name: 'Contracts', href: '/dashboard/contracts' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <div className="py-10">
          <main>
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
} 