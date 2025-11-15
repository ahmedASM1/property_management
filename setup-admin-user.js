// Admin User Setup Script
// Run this script to create an admin user for the system

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase configuration - replace with your actual config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

async function createAdminUser() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Admin user details
    const adminEmail = 'admin@greenbridge.com';
    const adminPassword = 'Admin123!';
    const adminData = {
      fullName: 'System Administrator',
      email: adminEmail,
      role: 'admin',
      isApproved: true,
      hasSetPassword: true, // Admin user has completed password setup
      phoneNumber: '+60 12-345 6789',
      idNumber: 'ADMIN001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Creating admin user...');
    
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;

    console.log('Admin user created successfully:', user.uid);

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), adminData);

    console.log('Admin user document created in Firestore');
    console.log('\nAdmin Login Credentials:');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('\nYou can now log in to the system as an administrator.');

  } catch (error) {
    console.error('Error creating admin user:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists. You can use the existing credentials to log in.');
    }
  }
}

// Run the script
createAdminUser();
