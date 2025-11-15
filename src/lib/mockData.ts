import { Invoice, Tenant } from '@/types';

// Mock data for development when Firebase is not configured
export const mockTenants: Tenant[] = [
  {
    id: 'tenant1',
    email: 'john.doe@example.com',
    fullName: 'John Doe',
    role: 'tenant',
    isApproved: true,
    phoneNumber: '+1234567890',
    address: '123 Main St, City, State',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tenant2',
    email: 'jane.smith@example.com',
    fullName: 'Jane Smith',
    role: 'tenant',
    isApproved: true,
    phoneNumber: '+1234567891',
    address: '456 Oak Ave, City, State',
    createdAt: new Date().toISOString(),
  }
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv1',
    tenantId: 'tenant1',
    month: 'January',
    year: 2024,
    lineItems: [
      { description: 'Rent', amount: 1200 },
      { description: 'Water Bill', amount: 50 },
      { description: 'Electricity Bill', amount: 80 }
    ],
    tax: 0,
    subtotal: 1330,
    totalAmount: 1330,
    status: 'unpaid',
    isPaid: false,
    dueDate: '2024-02-01',
    utilities: {
      water: 50,
      electricity: 80,
      internet: 0
    },
    rentAmount: 1200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'inv2',
    tenantId: 'tenant2',
    month: 'January',
    year: 2024,
    lineItems: [
      { description: 'Rent', amount: 1000 },
      { description: 'Water Bill', amount: 45 },
      { description: 'Electricity Bill', amount: 75 }
    ],
    tax: 0,
    subtotal: 1120,
    totalAmount: 1120,
    status: 'paid',
    isPaid: true,
    dueDate: '2024-02-01',
    utilities: {
      water: 45,
      electricity: 75,
      internet: 0
    },
    rentAmount: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const isFirebaseConfigured = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
};


