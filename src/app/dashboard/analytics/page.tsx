'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, Invoice } from '@/types';
import { 
  FaChartLine, 
  FaMoneyBillWave, 
  FaBuilding,
  FaUsers,
  FaTools,
  FaCalendarAlt,
  FaArrowUp as FaTrendingUp,
  FaArrowDown as FaTrendingDown
} from 'react-icons/fa';

interface AnalyticsData {
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
  totalMonthlyIncome: number;
  averageRent: number;
  occupancyRate: number;
  totalMaintenanceRequests: number;
  averageMaintenancePerProperty: number;
  monthlyIncomeTrend: { month: string; income: number }[];
  propertyPerformance: { unitNumber: string; income: number; occupancy: boolean }[];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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

        // Calculate basic statistics
        const totalProperties = properties.length;
        const occupiedProperties = properties.filter(p => p.status === 'occupied').length;
        const vacantProperties = properties.filter(p => p.status === 'vacant').length;
        const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;
        const averageRent = totalProperties > 0 ? 
          properties.reduce((sum, p) => sum + p.monthlyRent, 0) / totalProperties : 0;

        // Fetch invoices for income calculations
        let totalMonthlyIncome = 0;
        const monthlyIncomeMap = new Map<string, number>();
        const propertyPerformance: { unitNumber: string; income: number; occupancy: boolean }[] = [];

        for (const property of properties) {
          try {
            const invoicesQuery = query(
              collection(db, 'invoices'),
              where('unitNumber', '==', property.unitNumber)
            );
            const invoicesSnapshot = await getDocs(invoicesQuery);
            
            let propertyIncome = 0;
            invoicesSnapshot.docs.forEach(doc => {
              const invoice = doc.data() as Invoice;
              if (invoice.isPaid) {
                propertyIncome += invoice.totalAmount || 0;
                totalMonthlyIncome += invoice.totalAmount || 0;
                
                // Track monthly income
                const monthKey = `${invoice.month} ${invoice.year}`;
                monthlyIncomeMap.set(monthKey, (monthlyIncomeMap.get(monthKey) || 0) + (invoice.totalAmount || 0));
              }
            });

            propertyPerformance.push({
              unitNumber: property.unitNumber,
              income: propertyIncome,
              occupancy: property.status === 'occupied'
            });
          } catch (error) {
            console.error('Error fetching invoices for property:', property.unitNumber, error);
          }
        }

        // Fetch maintenance requests
        let totalMaintenanceRequests = 0;
        for (const property of properties) {
          try {
            const maintenanceQuery = query(
              collection(db, 'maintenance_requests'),
              where('unitProperty', '==', property.unitNumber)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            totalMaintenanceRequests += maintenanceSnapshot.size;
          } catch (error) {
            console.error('Error fetching maintenance for property:', property.unitNumber, error);
          }
        }

        const averageMaintenancePerProperty = totalProperties > 0 ? totalMaintenanceRequests / totalProperties : 0;

        // Convert monthly income map to array and sort
        const monthlyIncomeTrend = Array.from(monthlyIncomeMap.entries())
          .map(([month, income]) => ({ month, income }))
          .sort((a, b) => {
            const [aMonth, aYear] = a.month.split(' ');
            const [bMonth, bYear] = b.month.split(' ');
            return new Date(`${aMonth} 1, ${aYear}`).getTime() - new Date(`${bMonth} 1, ${bYear}`).getTime();
          });

        setAnalyticsData({
          totalProperties,
          occupiedProperties,
          vacantProperties,
          totalMonthlyIncome,
          averageRent,
          occupancyRate,
          totalMaintenanceRequests,
          averageMaintenancePerProperty,
          monthlyIncomeTrend,
          propertyPerformance
        });

      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <FaChartLine className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data available</h3>
        <p className="mt-1 text-sm text-gray-500">Add properties to start seeing analytics.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Property Analytics</h1>
        <p className="text-gray-600 mt-2">Insights and performance metrics for your property portfolio</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{analyticsData.totalProperties}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaBuilding className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{analyticsData.occupancyRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaUsers className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Income</p>
              <p className="text-2xl font-bold text-green-600 mt-2">RM {analyticsData.totalMonthlyIncome.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaMoneyBillWave className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Rent</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">RM {analyticsData.averageRent.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaTrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Property Status Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Occupied</span>
              </div>
              <span className="text-sm font-bold">{analyticsData.occupiedProperties}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">Vacant</span>
              </div>
              <span className="text-sm font-bold">{analyticsData.vacantProperties}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-sm font-bold">{analyticsData.totalProperties}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Requests</span>
              <span className="text-sm font-bold">{analyticsData.totalMaintenanceRequests}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg. per Property</span>
              <span className="text-sm font-bold">{analyticsData.averageMaintenancePerProperty.toFixed(1)}</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <FaTools className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Maintenance tracking active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Income Trend */}
      {analyticsData.monthlyIncomeTrend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Income Trend</h3>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyticsData.monthlyIncomeTrend.slice(-6).map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.month}</span>
                      <FaTrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-lg font-bold text-green-600">RM {item.income.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Property Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Property Performance</h3>
          <p className="text-sm text-gray-500">Income and occupancy by property</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Income</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analyticsData.propertyPerformance.map((property, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{property.unitNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">RM {property.income.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      property.occupancy ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {property.occupancy ? 'Occupied' : 'Vacant'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {property.income > analyticsData.averageRent ? (
                        <FaTrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <FaTrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${
                        property.income > analyticsData.averageRent ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {property.income > analyticsData.averageRent ? 'Above Average' : 'Below Average'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FaTrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">Portfolio Health</span>
            </div>
            <p className="text-sm text-gray-600">
              Your portfolio has an occupancy rate of {analyticsData.occupancyRate.toFixed(1)}%, 
              which is {analyticsData.occupancyRate > 80 ? 'excellent' : analyticsData.occupancyRate > 60 ? 'good' : 'needs attention'}.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FaMoneyBillWave className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Revenue Performance</span>
            </div>
            <p className="text-sm text-gray-600">
              Average monthly income per property is RM {analyticsData.averageRent.toLocaleString()}, 
              with total portfolio income of RM {analyticsData.totalMonthlyIncome.toLocaleString()}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 