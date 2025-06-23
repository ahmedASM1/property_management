'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, Invoice } from '@/types';
import { 
  FaMoneyBillWave, 
  FaChartLine, 
  FaCalendarAlt,
  FaBuilding,
  FaDownload,
  FaFilter
} from 'react-icons/fa';

interface IncomeData {
  propertyId: string;
  unitNumber: string;
  buildingName: string;
  month: string;
  year: number;
  rentAmount: number;
  utilitiesAmount: number;
  totalAmount: number;
  status: 'paid' | 'pending' | 'overdue';
  paidAt?: Date;
}

export default function IncomePage() {
  const { user } = useAuth();
  const [incomeData, setIncomeData] = useState<IncomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch properties owned by this owner
        const propertiesQuery = query(
          collection(db, 'properties'),
          where('ownerId', '==', user.id)
        );
        const propertiesSnapshot = await getDocs(propertiesQuery);
        const properties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];

        // Fetch invoices for all properties
        const allIncomeData: IncomeData[] = [];
        
        for (const property of properties) {
          try {
            const invoicesQuery = query(
              collection(db, 'invoices'),
              where('unitNumber', '==', property.unitNumber)
            );
            const invoicesSnapshot = await getDocs(invoicesQuery);
            
            invoicesSnapshot.docs.forEach(doc => {
              const invoice = doc.data() as Invoice;
              const utilitiesAmount = (invoice.utilities?.water || 0) + 
                                    (invoice.utilities?.electricity || 0) + 
                                    (invoice.utilities?.internet || 0) + 
                                    (invoice.utilities?.other || 0);
              
              allIncomeData.push({
                propertyId: property.id,
                unitNumber: property.unitNumber,
                buildingName: property.buildingName,
                month: invoice.month,
                year: invoice.year,
                rentAmount: invoice.rentAmount || 0,
                utilitiesAmount,
                totalAmount: invoice.totalAmount || 0,
                status: invoice.isPaid ? 'paid' : (invoice.status as 'pending' | 'overdue') || 'pending',
                paidAt: invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt)
              });
            });
          } catch (error) {
            console.error('Error fetching invoices for property:', property.unitNumber, error);
          }
        }

        setIncomeData(allIncomeData);

      } catch (error) {
        console.error('Error fetching income data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Filter data based on selected filters
  const filteredData = incomeData.filter(item => {
    const monthMatch = !selectedMonth || item.month === selectedMonth;
    const yearMatch = !selectedYear || item.year.toString() === selectedYear;
    const statusMatch = filterStatus === 'all' || item.status === filterStatus;
    return monthMatch && yearMatch && statusMatch;
  });

  // Calculate summary statistics
  const totalIncome = filteredData
    .filter(item => item.status === 'paid')
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const pendingAmount = filteredData
    .filter(item => item.status === 'pending')
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const overdueAmount = filteredData
    .filter(item => item.status === 'overdue')
    .reduce((sum, item) => sum + item.totalAmount, 0);

  const totalProperties = new Set(filteredData.map(item => item.propertyId)).size;

  // Get unique months and years for filters
  const months = [...new Set(incomeData.map(item => item.month))].sort();
  const years = [...new Set(incomeData.map(item => item.year))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Income Report</h1>
        <p className="text-gray-600 mt-2">Track your rental income and payment status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-green-600 mt-2">RM {totalIncome.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaMoneyBillWave className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">RM {pendingAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <FaCalendarAlt className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue Amount</p>
              <p className="text-2xl font-bold text-red-600 mt-2">RM {overdueAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaChartLine className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Properties</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{totalProperties}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaBuilding className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="h-4 w-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Months</option>
              {months.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Years</option>
              {years.map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedMonth('');
                setSelectedYear('');
                setFilterStatus('all');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Income Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Income Details</h3>
              <p className="text-sm text-gray-500">Showing {filteredData.length} records</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              <FaDownload className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredData.length === 0 ? (
            <div className="text-center py-12">
              <FaMoneyBillWave className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No income data found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or contact support.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.unitNumber}</div>
                        <div className="text-sm text-gray-500">{item.buildingName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.month} {item.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      RM {item.rentAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      RM {item.utilitiesAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      RM {item.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.status === 'paid' ? 'bg-green-100 text-green-800' :
                        item.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.paidAt ? item.paidAt.toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
} 
 