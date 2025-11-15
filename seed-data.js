// Simple data seeding script for testing
// Run this in the browser console after logging in as admin

const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
const { db } = require('./src/lib/firebase');

async function seedTestData() {
  try {
    console.log('Seeding test data...');
    
    // Add a test tenant
    const tenantData = {
      fullName: 'Test Tenant',
      email: 'tenant@test.com',
      phoneNumber: '+60123456789',
      role: 'tenant',
      isApproved: true,
      unitNumber: 'A-101',
      rentalType: 'Room1',
      contractEnd: '2024-12-31',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const tenantRef = await addDoc(collection(db, 'users'), tenantData);
    console.log('Test tenant added:', tenantRef.id);
    
    // Add a test invoice
    const invoiceData = {
      tenantId: tenantRef.id,
      month: 'December',
      year: 2024,
      lineItems: [
        { description: 'Rent', amount: 1500 },
        { description: 'Water Bill', amount: 50 },
        { description: 'Electricity Bill', amount: 100 }
      ],
      tax: 0,
      subtotal: 1650,
      totalAmount: 1650,
      status: 'unpaid',
      isPaid: false,
      dueDate: '2024-12-31',
      utilities: {
        water: 50,
        electricity: 100,
        internet: 0
      },
      rentAmount: 1500,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData);
    console.log('Test invoice added:', invoiceRef.id);
    
    // Add a test contract
    const contractData = {
      tenantId: tenantRef.id,
      tenantName: 'Test Tenant',
      propertyAddress: '123 Test Street, Kuala Lumpur',
      term: '1 year',
      moveInDate: '2024-01-01',
      expiryDate: '2024-12-31',
      rentalPerMonth: 1500,
      securityDeposit: 1500,
      utilityDeposit: 200,
      accessCardDeposit: 50,
      agreementFee: 100,
      dateOfAgreement: '2024-01-01',
      companySignName: 'ALWAELI MOHAMMED',
      companySignNRIC: '09308729',
      companySignDesignation: 'Managing Director',
      acknowledged: false,
      archived: false,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const contractRef = await addDoc(collection(db, 'contracts'), contractData);
    console.log('Test contract added:', contractRef.id);
    
    console.log('Test data seeding completed!');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.seedTestData = seedTestData;
}





