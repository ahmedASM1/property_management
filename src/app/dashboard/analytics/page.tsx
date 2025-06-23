'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MaintenanceRequest, Invoice, User } from '@/types';
import { 
  FaUsers, 
  FaFileInvoice, 
  FaTools, 
  FaExclamationCircle,
  FaChartLine,
  FaMoneyBillWave,
  FaBuilding,
  FaArrowUp as FaTrendingUp,
  FaArrowDown as FaTrendingDown
} from 'react-icons/fa';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsData {
  totalTenants: number;
  openInvoices: number;
  maintenanceRequests: number;
  criticalMaintenance: number;
  rentRevenue: number;
  propertyOccupancy: { occupied: number; vacant: number };
  financialOverview: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
    }[];
  };
  propertyPerformance: { unitNumber: string; income: number; occupancy: boolean }[];
}

const AnalyticsPage = () => {
  const { user } = useAuth() || {};
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!user || user.role !== 'propertyOwner') {
        setLoading(false);
        return;
      }

      try {
        // Fetch tenants
        const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'), where('propertyId', '==', user.uid));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        const totalTenants = tenantsSnapshot.size;

        // Fetch invoices
        const invoicesQuery = query(collection(db, 'invoices'), where('propertyOwnerId', '==', user.uid));
        const invoicesSnapshot = await getDocs(invoicesQuery);
        const openInvoices = invoicesSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
        let rentRevenue = 0;
        invoicesSnapshot.docs.forEach(doc => {
          if (doc.data().status === 'paid') {
            rentRevenue += doc.data().totalAmount;
          }
        });

        // Fetch maintenance requests
        const maintenanceQuery = query(collection(db, 'maintenanceRequests'), where('propertyOwnerId', '==', user.uid));
        const maintenanceSnapshot = await getDocs(maintenanceQuery);
        const maintenanceRequests = maintenanceSnapshot.size;
        const criticalMaintenance = maintenanceSnapshot.docs.filter(doc => doc.data().priority === 'high').length;
        
        // Fetch properties for occupancy
        const propertiesQuery = query(collection(db, 'properties'), where('ownerId', '==', user.uid));
        const propertiesSnapshot = await getDocs(propertiesQuery);
        let occupiedUnits = 0;
        propertiesSnapshot.docs.forEach(doc => {
            const property = doc.data();
            if (property.units) {
                property.units.forEach((unit: { status: string; }) => {
                    if (unit.status === 'occupied') {
                        occupiedUnits++;
                    }
                });
            }
        });
        const totalUnits = propertiesSnapshot.docs.reduce((acc, doc) => acc + (doc.data().units?.length || 0), 0);
        const vacantUnits = totalUnits - occupiedUnits;


        setAnalyticsData({
          totalTenants,
          openInvoices,
          maintenanceRequests,
          criticalMaintenance,
          rentRevenue,
          propertyOccupancy: { occupied: occupiedUnits, vacant: vacantUnits },
          financialOverview: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
              {
                label: 'Income',
                data: [5000, 6000, 7500, 7000, 8000, 9500],
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
              },
              {
                label: 'Expenses',
                data: [2000, 2200, 1800, 2500, 3000, 2800],
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
              },
            ],
          },
          propertyPerformance: [
            { unitNumber: '101', income: 1200, occupancy: true },
            { unitNumber: '102', income: 1250, occupancy: true },
            { unitNumber: '201', income: 1100, occupancy: false },
          ],
        });
      } catch (error) {
        console.error("Error fetching analytics data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="text-xl">Loading analytics...</div></div>;
  }

  if (!user || user.role !== 'propertyOwner' || !analyticsData) {
    return <div className="text-center py-10">You do not have permission to view this page or data is unavailable.</div>;
  }

  const {
    totalTenants,
    openInvoices,
    maintenanceRequests,
    criticalMaintenance,
    rentRevenue,
    propertyOccupancy,
    financialOverview,
    propertyPerformance,
  } = analyticsData;

  const occupancyData = {
    labels: ['Occupied', 'Vacant'],
    datasets: [
      {
        data: [propertyOccupancy.occupied, propertyOccupancy.vacant],
        backgroundColor: ['#4CAF50', '#FFC107'],
        hoverBackgroundColor: ['#45a049', '#FFB300'],
      },
    ],
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 flex items-center">
        <FaChartLine className="mr-3 text-indigo-600" />
        Property Owner Analytics
      </h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
          <FaUsers className="text-4xl text-blue-500 mr-4" />
          <div>
            <div className="text-gray-500">Total Tenants</div>
            <div className="text-2xl font-bold">{totalTenants}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
          <FaFileInvoice className="text-4xl text-green-500 mr-4" />
          <div>
            <div className="text-gray-500">Open Invoices</div>
            <div className="text-2xl font-bold">{openInvoices}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
          <FaTools className="text-4xl text-yellow-500 mr-4" />
          <div>
            <div className="text-gray-500">Maintenance Requests</div>
            <div className="text-2xl font-bold">{maintenanceRequests}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md flex items-center">
          <FaExclamationCircle className="text-4xl text-red-500 mr-4" />
          <div>
            <div className="text-gray-500">Critical Alerts</div>
            <div className="text-2xl font-bold">{criticalMaintenance}</div>
          </div>
        </div>
      </div>

      {/* Financial Overview & Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-700 flex items-center">
            <FaMoneyBillWave className="mr-2 text-green-600" />
            Financial Overview
          </h2>
          <div className="h-80">
            <Bar data={financialOverview} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-700 flex items-center">
            <FaBuilding className="mr-2 text-purple-600" />
            Property Occupancy
          </h2>
          <div className="h-80 flex items-center justify-center">
            <Pie data={occupancyData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Detailed Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rent Revenue Stream */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-700">Rent Revenue Stream</h2>
          <div className="flex items-center text-3xl font-bold text-green-600">
            <FaMoneyBillWave className="mr-3" />
            ${rentRevenue.toLocaleString()}
            <span className="text-sm text-green-500 ml-2 flex items-center">
              <FaTrendingUp /> +5.2%
            </span>
          </div>
          <p className="text-gray-500 mt-2">from last month</p>
        </div>

        {/* Property Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-700">Property Performance</h2>
          <ul className="space-y-3">
            {propertyPerformance.map((prop, index) => (
              <li key={index} className="flex justify-between items-center">
                <span>Unit {prop.unitNumber}</span>
                <span className={`font-semibold ${prop.occupancy ? 'text-green-600' : 'text-red-600'}`}>
                  {prop.occupancy ? 'Occupied' : 'Vacant'}
                </span>
                <span className="text-gray-600">${prop.income.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage; 