#!/usr/bin/env node

/**
 * Create Admin from Environment Variables
 * This script creates an admin user using credentials from environment variables
 * 
 * Usage: ADMIN_EMAIL=admin@greenbridge.com ADMIN_PASSWORD=SecurePass123! node scripts/create-admin-from-env.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  createUserWithEmailAndPassword,
  signOut
} = require('firebase/auth');
const { 
  getFirestore, 
  doc, 
  setDoc, 
  getDocs,
  collection,
  query,
  where
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdminFromEnv() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminPhone = process.env.ADMIN_PHONE || '';

  if (!adminEmail || !adminPassword) {
    console.error('❌ Missing required environment variables:');
    console.error('   ADMIN_EMAIL - Admin email address');
    console.error('   ADMIN_PASSWORD - Admin password');
    console.error('');
    console.error('Example usage:');
    console.error('   ADMIN_EMAIL=admin@greenbridge.com ADMIN_PASSWORD=SecurePass123! node scripts/create-admin-from-env.js');
    process.exit(1);
  }

  try {
    console.log('🏢 Green Bridge Property Management - Admin Creation');
    console.log('==================================================\n');
    
    // Check if admin already exists
    const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const adminSnapshot = await getDocs(adminQuery);
    
    if (!adminSnapshot.empty) {
      console.log('⚠️  An admin user already exists in the system.');
      console.log('   Skipping admin creation.');
      process.exit(0);
    }

    console.log('🔄 Creating admin user...');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Name: ${adminName}`);
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      adminEmail, 
      adminPassword
    );
    
    const user = userCredential.user;
    console.log('✅ Firebase Auth user created successfully');
    
    // Create Firestore user document
    const userDocData = {
      id: user.uid,
      email: adminEmail,
      fullName: adminName,
      phoneNumber: adminPhone,
      role: 'admin',
      isApproved: true,
      hasSetPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Admin-specific fields
      adminLevel: 'super',
      permissions: [
        'users.create', 'users.read', 'users.update', 'users.delete',
        'properties.create', 'properties.read', 'properties.update', 'properties.delete',
        'tenants.create', 'tenants.read', 'tenants.update', 'tenants.delete',
        'contracts.create', 'contracts.read', 'contracts.update', 'contracts.delete',
        'invoices.create', 'invoices.read', 'invoices.update', 'invoices.delete',
        'maintenance.create', 'maintenance.read', 'maintenance.update', 'maintenance.delete',
        'settings.update'
      ],
      setupCompleted: true,
      setupDate: new Date().toISOString(),
      createdBy: 'system'
    };
    
    await setDoc(doc(db, 'users', user.uid), userDocData);
    console.log('✅ Firestore user document created successfully');
    
    // Sign out the admin user
    await signOut(auth);
    console.log('✅ Admin user setup completed successfully');
    
    console.log('\n🎉 Admin user created successfully!');
    console.log('=====================================');
    console.log(`Email: ${adminEmail}`);
    console.log(`User ID: ${user.uid}`);
    console.log('\n📋 Next Steps:');
    console.log('1. Go to your application login page');
    console.log('2. Use the email and password from environment variables');
    console.log('3. You will have full admin access to the system');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Check environment variables
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.error('❌ Firebase configuration not found.');
  console.error('Please ensure your .env.local file contains the required Firebase configuration.');
  process.exit(1);
}

// Run the setup
createAdminFromEnv().catch(console.error);

