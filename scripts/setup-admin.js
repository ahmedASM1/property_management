#!/usr/bin/env node

/**
 * Secure Admin Setup Script
 * This script creates the initial admin user for Green Bridge Property Management
 * 
 * Usage: node scripts/setup-admin.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} = require('firebase/firestore');
const readline = require('readline');
const crypto = require('crypto');

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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility functions
const question = (query) => new Promise((resolve) => rl.question(query, resolve));
const hideInput = (query) => new Promise((resolve) => {
  process.stdout.write(query);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  let input = '';
  process.stdin.on('data', (char) => {
    char = char + '';
    switch (char) {
      case '\n':
      case '\r':
      case '\u0004':
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners('data');
        console.log('');
        resolve(input);
        break;
      case '\u0003':
        process.exit();
        break;
      case '\u007f': // backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        break;
      default:
        input += char;
        process.stdout.write('*');
        break;
    }
  });
});

// Password validation
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Check if admin already exists
async function checkExistingAdmin() {
  try {
    // Try to find any user with admin role
    const adminQuery = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    return !adminQuery.empty;
  } catch (error) {
    console.log('No existing admin found or error checking:', error.message);
    return false;
  }
}

// Create admin user
async function createAdminUser(adminData) {
  try {
    console.log('\n🔄 Creating admin user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      adminData.email, 
      adminData.password
    );
    
    const user = userCredential.user;
    console.log('✅ Firebase Auth user created successfully');
    
    // Create Firestore user document
    const userDocData = {
      id: user.uid,
      email: adminData.email,
      fullName: adminData.fullName,
      phoneNumber: adminData.phoneNumber,
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
      setupDate: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', user.uid), userDocData);
    console.log('✅ Firestore user document created successfully');
    
    // Sign out the admin user
    await signOut(auth);
    console.log('✅ Admin user setup completed successfully');
    
    return {
      success: true,
      userId: user.uid,
      email: adminData.email
    };
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main setup function
async function setupAdmin() {
  console.log('🏢 Green Bridge Property Management - Admin Setup');
  console.log('================================================\n');
  
  // Check if admin already exists
  const adminExists = await checkExistingAdmin();
  if (adminExists) {
    console.log('⚠️  An admin user already exists in the system.');
    const overwrite = await question('Do you want to create another admin user? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }
  
  console.log('Please provide the following information for the admin user:\n');
  
  // Collect admin information
  const adminData = {};
  
  // Full Name
  adminData.fullName = await question('Full Name: ');
  if (!adminData.fullName.trim()) {
    console.log('❌ Full name is required');
    rl.close();
    return;
  }
  
  // Email
  adminData.email = await question('Email Address: ');
  if (!adminData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
    console.log('❌ Valid email address is required');
    rl.close();
    return;
  }
  
  // Phone Number
  adminData.phoneNumber = await question('Phone Number (optional): ');
  
  // Password
  let password;
  let confirmPassword;
  
  do {
    password = await hideInput('Password: ');
    if (!password) {
      console.log('❌ Password is required');
      continue;
    }
    
    const validation = validatePassword(password);
    if (!validation.isValid) {
      console.log('❌ Password requirements not met:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
      continue;
    }
    
    confirmPassword = await hideInput('Confirm Password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match');
      continue;
    }
    
    break;
  } while (true);
  
  adminData.password = password;
  
  // Security confirmation
  console.log('\n🔒 Security Confirmation');
  console.log('This will create a super admin user with full system access.');
  const confirm = await question('Are you sure you want to proceed? (y/N): ');
  
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('Setup cancelled.');
    rl.close();
    return;
  }
  
  // Create admin user
  const result = await createAdminUser(adminData);
  
  if (result.success) {
    console.log('\n🎉 Admin user created successfully!');
    console.log('=====================================');
    console.log(`Email: ${result.email}`);
    console.log(`User ID: ${result.userId}`);
    console.log('\n📋 Next Steps:');
    console.log('1. Go to your application login page');
    console.log('2. Use the email and password you just created');
    console.log('3. You will have full admin access to the system');
    console.log('4. You can now create other users through the admin panel');
    console.log('\n⚠️  Important Security Notes:');
    console.log('- Store these credentials securely');
    console.log('- Consider enabling two-factor authentication');
    console.log('- Regularly review admin access logs');
    console.log('- Create additional admin users for backup access');
  } else {
    console.log('\n❌ Failed to create admin user');
    console.log(`Error: ${result.error}`);
  }
  
  rl.close();
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  rl.close();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user.');
  rl.close();
  process.exit(0);
});

// Check environment variables
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.log('❌ Firebase configuration not found.');
  console.log('Please ensure your .env.local file contains the required Firebase configuration.');
  process.exit(1);
}

// Run the setup
setupAdmin().catch(console.error);

