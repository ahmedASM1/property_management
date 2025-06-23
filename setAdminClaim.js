// setAdminClaim.js
// Usage: node setAdminClaim.js <ADMIN_USER_UID>
// This script sets the 'admin' custom claim for a Firebase user.

const admin = require('firebase-admin');

// Path to your Firebase service account key JSON file
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node setAdminClaim.js <ADMIN_USER_UID>');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Custom claim 'admin: true' set for user: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  }); 