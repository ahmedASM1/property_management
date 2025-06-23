import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { FileText, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface Contract {
  id: string;
  status: 'pending' | 'signed' | 'rejected';
  moveInDate: string;
  expiryDate: string;
  rentalPerMonth: string;
  createdAt: string;
}

interface AnalyticsData {
  totalContracts: number;
  activeContracts: number;
  pendingContracts: number;
  expiredContracts: number;
  totalRevenue: number;
  statusDistribution: { name: string; value: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  expiringSoon: Contract[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function ContractAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const contractsRef = collection(db, 'contracts');
      const querySnapshot = await getDocs(contractsRef);
      const contracts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contract[];

      // Calculate analytics
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const analytics: AnalyticsData = {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === 'signed').length,
        pendingContracts: contracts.filter(c => c.status === 'pending').length,
        expiredContracts: contracts.filter(c => new Date(c.expiryDate) < now).length,
        totalRevenue: contracts.reduce((sum, c) => sum + Number(c.rentalPerMonth), 0),
        statusDistribution: [
          { name: 'Signed', value: contracts.filter(c => c.status === 'signed').length },
          { name: 'Pending', value: contracts.filter(c => c.status === 'pending').length },
          { name: 'Rejected', value: contracts.filter(c => c.status === 'rejected').length },
          { name: 'Expired', value: contracts.filter(c => new Date(c.expiryDate) < now).length }
        ],
        monthlyRevenue: calculateMonthlyRevenue(contracts),
        expiringSoon: contracts
          .filter(c => {
            const expiryDate = new Date(c.expiryDate);
            return expiryDate > now && expiryDate <= thirtyDaysFromNow;
          })
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
      };

      setAnalyticsData(analytics);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyRevenue = (contracts: Contract[]) => {
    const monthlyData: { [key: string]: number } = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    contracts.forEach(contract => {
      if (contract.status === 'signed') {
        const startDate = new Date(contract.moveInDate);
        const endDate = new Date(contract.expiryDate);
        const rent = Number(contract.rentalPerMonth);

        for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
          const monthKey = months[d.getMonth()];
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + rent;
        }
      }
    });

    return Object.entries(monthlyData).map(([month, revenue]) => ({
      month,
      revenue
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center p-6">
        <p className="text-gray-600">No analytics data available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Contract Analytics</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contracts</p>
                <p className="text-2xl font-semibold text-gray-900">{analyticsData.totalContracts}</p>
              </div>
              <FileText className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Contracts</p>
                <p className="text-2xl font-semibold text-gray-900">{analyticsData.activeContracts}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Contracts</p>
                <p className="text-2xl font-semibold text-gray-900">{analyticsData.pendingContracts}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">RM {analyticsData.totalRevenue.toLocaleString()}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Status Distribution</h2>
            <div className="h-80">
              <PieChart width={400} height={300}>
                <Pie
                  data={analyticsData.statusDistribution}
                  cx={200}
                  cy={150}
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
            <div className="h-80">
              <BarChart
                width={400}
                height={300}
                data={analyticsData.monthlyRevenue}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Revenue (RM)" fill="#8884d8" />
              </BarChart>
            </div>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contracts Expiring Soon</h2>
          {analyticsData.expiringSoon.length === 0 ? (
            <p className="text-gray-600">No contracts expiring in the next 30 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Rent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Until Expiry</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData.expiringSoon.map(contract => {
                    const daysUntilExpiry = Math.ceil(
                      (new Date(contract.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr key={contract.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{contract.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(contract.expiryDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          RM {Number(contract.rentalPerMonth).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {daysUntilExpiry} days
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 