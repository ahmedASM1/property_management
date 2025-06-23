import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyADlEhij7ISV6VE60MZoh7EgkAatTXFi_8",
  authDomain: "waeliweb.firebaseapp.com",
  projectId: "waeliweb",
  storageBucket: "waeliweb.appspot.com",
  messagingSenderId: "26711475097",
  appId: "1:26711475097:web:583e119a150e7d76acc908"
};

// Initialize Firebase only if it hasn't been initialized yet
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
// Set persistent auth state
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage }; 