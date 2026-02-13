'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  FaUsers,
  FaFileInvoice,
  FaTools,
  FaFileContract,
  FaBuilding,
  FaClipboardList,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { Tenant, Invoice } from '@/types';

interface AgentDashboardProps {
  data: {
    tenants?: Tenant[];
    invoices?: Invoice[];
  };
}

export default function AgentDashboard({ data }: AgentDashboardProps) {
  const { tenants = [], invoices = [] } = data;

  const totalUnpaidInvoices = invoices.filter((i) => !i.isPaid).length;
  const paidInvoices = invoices.filter((i) => i.isPaid).length;
  const [activeMaintenanceCount, setActiveMaintenanceCount] = useState<number>(0);
  const [contractsCount, setContractsCount] = useState<number>(0);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const recentTenants = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const maintenanceSnap = await getDocs(
          query(
            collection(db, 'maintenance_requests'),
            where('status', 'in', ['pending', 'in progress'])
          )
        );
        setActiveMaintenanceCount(maintenanceSnap.size);

        const contractsSnap = await getDocs(collection(db, 'contracts'));
        setContractsCount(contractsSnap.size);
      } catch (err) {
        console.error('Error fetching counts:', err);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
              <p className="text-gray-600">
                Manage tenants, invoices, contracts, and maintenance within your scope.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs text-gray-500">Last updated</div>
              <div className="text-base font-semibold text-gray-900">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/tenants"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FaUsers className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Tenants</p>
                <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/invoices"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FaFileInvoice className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Paid / Unpaid</p>
                <p className="text-2xl font-bold text-gray-900">
                  <span className="text-green-600">{paidInvoices}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-amber-600">{totalUnpaidInvoices}</span>
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/contracts"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FaFileContract className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Contracts</p>
                <p className="text-2xl font-bold text-gray-900">{contractsCount}</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/maintenance/admin"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <FaTools className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Maintenance</p>
                <p className="text-2xl font-bold text-gray-900">{activeMaintenanceCount}</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent tenants */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Tenants</h3>
              <Link
                href="/dashboard/tenants"
                className="text-sm font-medium text-green-600 hover:text-green-700"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {recentTenants.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No tenants yet.</div>
              ) : (
                recentTenants.map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/dashboard/tenants/${tenant.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold text-sm">
                        {(tenant.fullName || 'T').charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tenant.fullName}</p>
                        <p className="text-sm text-gray-500">{tenant.unitNumber || tenant.email}</p>
                      </div>
                    </div>
                    <FaClock className="h-4 w-4 text-gray-400" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent invoices (paid / unpaid) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
              <Link
                href="/dashboard/invoices"
                className="text-sm font-medium text-green-600 hover:text-green-700"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {recentInvoices.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">No invoices yet.</div>
              ) : (
                recentInvoices.map((inv) => {
                  const tenant = tenants.find((t) => t.id === inv.tenantId);
                  return (
                    <Link
                      key={inv.id}
                      href={`/dashboard/invoices/${inv.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {tenant?.fullName || 'Unknown'} · {inv.unitNumber || '-'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {inv.month} {inv.year} · RM{(inv.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      {inv.isPaid ? (
                        <FaCheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <FaExclamationTriangle className="h-5 w-5 text-amber-500" />
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/tenants"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaUsers className="h-4 w-4" /> Tenants
            </Link>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaFileInvoice className="h-4 w-4" /> Invoices
            </Link>
            <Link
              href="/dashboard/contracts"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <FaFileContract className="h-4 w-4" /> Contracts
            </Link>
            <Link
              href="/dashboard/maintenance/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <FaTools className="h-4 w-4" /> Maintenance
            </Link>
            <Link
              href="/dashboard/assignments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FaClipboardList className="h-4 w-4" /> Assignments
            </Link>
            <Link
              href="/dashboard/buildings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FaBuilding className="h-4 w-4" /> Buildings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
