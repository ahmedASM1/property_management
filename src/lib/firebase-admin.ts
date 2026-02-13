import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

function formatPrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

export function getAdminFirestore() {
  if (getApps().length > 0) {
    return getFirestore();
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin requires FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (and NEXT_PUBLIC_FIREBASE_PROJECT_ID). ' +
      'Get these from Firebase Console > Project Settings > Service Accounts > Generate new key.'
    );
  }
  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: formatPrivateKey(privateKey),
    }),
    projectId,
  });
  return getFirestore(adminApp);
}
