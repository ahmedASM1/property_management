'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  registerUser: (userData: any) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Check if user is approved
            if (!userData.isApproved) {
              // Don't throw an error here, just sign out and clear user
              await firebaseSignOut(auth);
              setUser(null);
              // Optionally, you can redirect or show a toast from a component
              // that listens to this state change.
              // For now, we'll just log it client-side.
              console.log('User is not approved. Signed out.');
              return; // Stop further execution for this user
            }
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              ...userData,
            } as User);
          } else {
            // This case might happen if a user is in auth but not firestore. Sign out.
            await firebaseSignOut(auth);
            setUser(null);
            console.error('User profile not found in Firestore. Signed out.');
          }
        } catch (error: any) {
          console.error('Error during auth state change processing:', error);
          // Ensure user is signed out on any error during the check
          await firebaseSignOut(auth).catch(e => console.error("Sign out failed", e));
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerUser = async (userData: any) => {
    const { email, password, ...rest } = userData;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
          ...rest,
          email,
          isApproved: false, // Default to not approved
          createdAt: new Date().toISOString(),
      });
  
      // It's critical to sign out the user immediately after registration
      // because their account is not yet approved.
      await firebaseSignOut(auth);
    } catch (error) {
      // It's important to catch and re-throw the error so the calling component can handle it.
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('profile-not-found');
      }

      const userData = userDoc.data();
      if (!userData.isApproved) {
        await firebaseSignOut(auth);
        throw new Error('not-approved');
      }

      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        ...userData,
      } as User);

      router.push('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message === 'not-approved') {
        throw new Error('Your account is pending approval');
      }
      if (error.message === 'profile-not-found') {
        throw new Error('User profile not found');
      }
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    router.push('/');
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, registerUser, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 