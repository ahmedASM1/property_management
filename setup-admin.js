const admin = require('firebase-admin');

// Initialize Firebase Admin with your service account
// You'll need to download your service account key from Firebase Console
// Go to Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node setup-admin.js <ADMIN_USER_UID>');
  console.log('\nTo get the UID:');
  console.log('1. Register a user through your app');
  console.log('2. Go to Firebase Console > Authentication > Users');
  console.log('3. Find the user and copy their UID');
  process.exit(1);
}

async function setupAdmin() {
  try {
    // Set custom claims for admin access
    await admin.auth().setCustomUserClaims(uid, { 
      admin: true,
      role: 'admin',
      approved: true
    });

    // Update the user document in Firestore
    await admin.firestore().collection('users').doc(uid).update({
      role: 'admin',
      isApproved: true,
      adminClaimSet: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Admin privileges granted to user: ${uid}`);
    console.log('The user can now access admin features in the dashboard.');
    
    // Get user details to confirm
    const userRecord = await admin.auth().getUser(uid);
    console.log(`User email: ${userRecord.email}`);
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin().then(() => {
  process.exit(0);
}); 