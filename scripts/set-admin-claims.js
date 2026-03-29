/**
 * Set Firebase Auth custom claims and Firestore admin fields for an existing user.
 * Requires a service account key at the repo root (not committed): serviceAccountKey.json
 *
 * Usage: node scripts/set-admin-claims.js <ADMIN_USER_UID>
 */

const path = require('path');
const admin = require('firebase-admin');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/set-admin-claims.js <ADMIN_USER_UID>');
  console.log('\nTo get the UID:');
  console.log('1. Register a user through your app');
  console.log('2. Go to Firebase Console > Authentication > Users');
  console.log('3. Find the user and copy their UID');
  process.exit(1);
}

async function setupAdmin() {
  try {
    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
      role: 'admin',
      approved: true,
    });

    await admin.firestore().collection('users').doc(uid).update({
      role: 'admin',
      isApproved: true,
      adminClaimSet: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Admin privileges granted to user: ${uid}`);
    console.log('The user can now access admin features in the dashboard.');

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
