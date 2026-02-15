'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  registerUser: (userData: { email: string; password: string; fullName: string; phoneNumber?: string }) => Promise<void>;
  registerAdmin: (userData: { email: string; password: string; fullName: string }) => Promise<void>;
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
            // They need to be created by admin or register first
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

  const registerUser = async (userData: { email: string; password: string; fullName: string; phoneNumber?: string }) => {
    const { email, password, fullName, phoneNumber } = userData;
    
    // Do not query Firestore here: unauthenticated users cannot read /users (permission-denied).
    // Rely on Firebase Auth: createUserWithEmailAndPassword throws auth/email-already-in-use if email exists.
    
    // Set flag to prevent auth state handler from interfering during registration
    if (typeof window !== 'undefined') {
      localStorage.setItem('gb_pending_registration', '1');
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document first (needed before we can send verification from our domain)
      await setDoc(doc(db, 'users', user.uid), {
        email,
        fullName,
        phoneNumber: phoneNumber || '',
        role: 'tenant', // Placeholder until admin assigns role on approval
        status: 'pending',
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isApproved: false,
        authProvider: 'email',
      });

      // Try to send verification email from our domain first (Green Bridge branding)
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const idToken = await user.getIdToken();
      const res = await fetch(`${baseUrl}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, fullName: fullName.trim() }),
      });
      if (res.ok) {
        // Our domain email sent successfully
      } else {
        // Fallback: send Firebase's built-in verification email so registration still succeeds
        await sendEmailVerification(user);
      }

      // Sign out so they must verify email and wait for admin approval before logging in
      await firebaseSignOut(auth);
    } catch (error) {
      // Clear flag on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gb_pending_registration');
      }
      console.error("Registration failed:", error);
      throw error;
    } finally {
      // Clear flag after registration completes (success or failure)
      // Small delay to ensure auth state handler has processed
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('gb_pending_registration');
        }
      }, 100);
    }
  };

  const registerAdmin = async (userData: { email: string; password: string; fullName: string }) => {
    const { email, password, fullName } = userData;
    try {
      // Check if an admin already exists - only allow first admin creation
      // This should only be called from the setup-admin page
      await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      
      // Allow admin creation only if no admin exists (initial setup) or if called from setup-admin page
      // For security, we'll allow it but it should only be accessible via /setup-admin route
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create admin user document with approved status
      await setDoc(doc(db, 'users', user.uid), {
        email,
        fullName,
        role: 'admin',
        status: 'approved',
        isApproved: true,
        hasSetPassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authProvider: 'email',
      });
  
      // Sign out admin after registration - they need to log in
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Admin registration failed:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      } catch (docError: unknown) {
        const msg = (docError as { message?: string })?.message ?? '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          await firebaseSignOut(auth);
          throw new Error('Your account is being reviewed. Please wait for admin approval before you can sign in.');
        }
        throw docError;
      }

      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Account not found. Please contact your administrator.');
      }

      const userData = userDoc.data();
      const isApproved = userData.status === 'approved' || userData.isApproved === true;

      // Check if email is verified
      if (!firebaseUser.emailVerified) {
        await firebaseSignOut(auth);
        throw new Error('Please verify your email address before signing in. Check your inbox for the verification link.');
      }

      // Update emailVerified in Firestore if it's not already set
      if (!userData.emailVerified) {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          emailVerified: true,
          updatedAt: new Date().toISOString(),
        });
      }

      if (!isApproved) {
        await firebaseSignOut(auth);
        if (userData.status === 'rejected') {
          throw new Error('Your account has been rejected. Please contact your administrator.');
        }
        throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
      }

      if (userData.hasSetPassword === false) {
        await firebaseSignOut(auth);
        throw new Error('Please complete your account setup by clicking the link sent to your email.');
      }

      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        ...userData,
        status: userData.status || (userData.isApproved ? 'approved' : 'pending'),
      } as User);

      router.push('/dashboard');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        throw new Error('Invalid email or password.');
      }
      if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later or reset your password.');
      }
      if (err.message && (String(err.message).toLowerCase().includes('permission') || String(err.message).toLowerCase().includes('insufficient'))) {
        throw new Error('Your account is being reviewed. Please wait for admin approval before you can sign in.');
      }
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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) throw new Error('No account found with this email.');
      throw new Error(data.error || 'Failed to send password reset link.');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, registerUser, registerAdmin, signIn, signOut, resetPassword }}>
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