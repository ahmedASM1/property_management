'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserStatus } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  registerUser: (userData: { email: string; password: string; fullName: string }) => Promise<void>;
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
      // Avoid race conditions during registration: if a registration is in progress,
      // skip auth-state handling until it completes.
      try {
        if (typeof window !== 'undefined' && localStorage.getItem('gb_pending_registration') === '1') {
          setLoading(false);
          return;
        }
      } catch {}
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Check if user is approved (using new status field or legacy isApproved)
            const isApproved = userData.status === 'approved' || userData.isApproved === true;
            
            if (isApproved) {
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                ...userData,
                status: userData.status || (userData.isApproved ? 'approved' : 'pending'),
              } as User);
            } else {
              // User exists but not approved - sign them out
              await firebaseSignOut(auth);
              setUser(null);
            }
          } else {
            // User doesn't exist in Firestore - sign them out
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error: unknown) {
          console.error('Error during auth state change processing:', error);
          // Don't sign out on error, just set user to null and continue
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerUser = async (userData: { email: string; password: string; fullName: string }) => {
    const { email, password, fullName } = userData;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document with pending status
      await setDoc(doc(db, 'users', user.uid), {
        email,
        fullName,
        role: 'tenant', // Default role - admin will assign proper role
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Legacy field for backward compatibility
        isApproved: false,
      });
  
      // Don't set user in context - they need admin approval
      // Sign them out immediately after registration
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // User doesn't exist in Firestore
        await firebaseSignOut(auth);
        throw new Error('Account not found. Please contact your administrator.');
      } else {
        const userData = userDoc.data();
        
        // Check if user is approved (using new status field or legacy isApproved)
        const isApproved = userData.status === 'approved' || userData.isApproved === true;
        
        if (!isApproved) {
          await firebaseSignOut(auth);
          if (userData.status === 'rejected') {
            throw new Error('Your account has been rejected. Please contact your administrator.');
          } else {
            throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
          }
        }
        
        // Check if user has set their password (for admin-created accounts)
        if (userData.hasSetPassword === false) {
          await firebaseSignOut(auth);
          throw new Error('Please complete your account setup by clicking the link sent to your email.');
        }
        
        setUser({
          id: userCredential.user.uid,
          email: userCredential.user.email || '',
          ...userData,
          status: userData.status || (userData.isApproved ? 'approved' : 'pending'),
        } as User);
      }

      router.push('/dashboard');
    } catch (error: unknown) {
      console.error('Login error:', error);
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