'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { useRouter } from 'next/navigation';
import { 
  validatePasswordStrength, 
  validateEmail, 
  sanitizeInput,
  logSecurityEvent,
  SessionManager
} from '@/lib/auth-security';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  registerUser: (userData: Partial<User> & { email: string; password: string }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Permission definitions for each role
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'users.create', 'users.read', 'users.update', 'users.delete',
    'properties.create', 'properties.read', 'properties.update', 'properties.delete',
    'tenants.create', 'tenants.read', 'tenants.update', 'tenants.delete',
    'contracts.create', 'contracts.read', 'contracts.update', 'contracts.delete',
    'invoices.create', 'invoices.read', 'invoices.update', 'invoices.delete',
    'maintenance.create', 'maintenance.read', 'maintenance.update', 'maintenance.delete',
    'settings.update'
  ],
  property_owner: [
    'properties.read.own', 'properties.update.own',
    'tenants.read.own', 'tenants.update.own',
    'contracts.read.own', 'contracts.update.own',
    'invoices.read.own', 'invoices.create.own',
    'maintenance.create', 'maintenance.read.own', 'maintenance.update.own'
  ],
  tenant: [
    'profile.read.own', 'profile.update.own',
    'contracts.read.own',
    'invoices.read.own', 'invoices.pay.own',
    'maintenance.create.own', 'maintenance.read.own', 'maintenance.update.own'
  ],
  service_provider: [
    'profile.read.own', 'profile.update.own',
    'maintenance.read.assigned', 'maintenance.update.assigned',
    'invoices.create.own', 'invoices.read.own'
  ],
  mixedProvider: [
    'profile.read.own', 'profile.update.own',
    'maintenance.read.assigned', 'maintenance.update.assigned',
    'invoices.create.own', 'invoices.read.own',
    'properties.read.assigned'
  ],
  agent: [
    'users.read', 'users.create',
    'properties.read', 'properties.create',
    'tenants.read', 'tenants.create',
    'contracts.read', 'contracts.create',
    'invoices.read', 'invoices.create',
    'maintenance.read', 'maintenance.create'
  ]
};

export function EnhancedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        // Avoid race conditions during registration
        if (typeof window !== 'undefined' && localStorage.getItem('gb_pending_registration') === '1') {
          setLoading(false);
          return;
        }

        if (firebaseUser) {
          await handleUserAuth(firebaseUser);
        } else {
          setUser(null);
          setSessionExpired(false);
        }
      } catch (error) {
        console.error('Error during auth state change:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        logSecurityEvent('auth_state_change_error', { error: errorMsg }, 'high');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUserAuth = async (firebaseUser: { uid: string; email: string | null }) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        // Create basic user document if it doesn't exist
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: firebaseUser.email || '',
          role: 'tenant',
          isApproved: true,
          hasSetPassword: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: 'tenant',
          isApproved: true,
          hasSetPassword: true,
        } as User);
        return;
      }

      const userData = userDoc.data();
      
      // Enhanced security checks
      if (!userData.isApproved) {
        await firebaseSignOut(auth);
        logSecurityEvent('unapproved_user_login_attempt', { 
          userId: firebaseUser.uid, 
          email: firebaseUser.email 
        }, 'medium');
        throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
      }

      if (userData.hasSetPassword === false) {
        await firebaseSignOut(auth);
        throw new Error('Please complete your account setup by clicking the link sent to your email.');
      }

      // Check for account lockout
      if (userData.lockedUntil && new Date(userData.lockedUntil) > new Date()) {
        await firebaseSignOut(auth);
        throw new Error('Account is temporarily locked. Please contact support.');
      }

      // Update last login
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        ...userData,
      } as User);

      // Create session
      const sessionId = SessionManager.createSession(firebaseUser.uid);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gb_session_id', sessionId);
      }

      logSecurityEvent('successful_login', { 
        userId: firebaseUser.uid, 
        email: firebaseUser.email,
        role: userData.role 
      }, 'low');

    } catch (error) {
      console.error('Error handling user auth:', error);
      throw error;
    }
  };

  const registerUser = async (userData: Partial<User> & { email: string; password: string }) => {
    const { email, password, ...rest } = userData;
    
    // Input validation
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    const sanitizedData = {
      ...rest,
      fullName: sanitizeInput(rest.fullName || ''),
      phoneNumber: sanitizeInput(rest.phoneNumber || ''),
    };

    // Password strength validation
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        ...sanitizedData,
        email,
        isApproved: false, // Require admin approval
        hasSetPassword: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      logSecurityEvent('user_registration', { 
        userId: user.uid, 
        email: user.email,
        role: sanitizedData.role 
      }, 'low');

      // Don't set user in context if not approved
      if (sanitizedData.isApproved) {
        setUser({
          id: user.uid,
          email: user.email || '',
          ...sanitizedData,
          isApproved: true,
        } as User);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logSecurityEvent('registration_failed', { 
        email, 
        error: errorMsg 
      }, 'medium');
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    // Input validation
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    const sanitizedEmail = sanitizeInput(email);
    let userCredential: { user: { uid: string; email: string | null } } | null = null;

    try {
      userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Account not found. Please contact your administrator.');
      }

      const userData = userDoc.data();
      
      // Reset failed login attempts on successful login
      if (userData.failedLoginAttempts > 0) {
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date().toISOString()
        });
      }

      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        ...userData,
      } as User);

      router.push('/dashboard');
    } catch (error: unknown) {
      // Handle failed login attempts
      const code = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        try {
          // Try to find user by email to track failed attempts
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', sanitizedEmail));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const failedAttempts = (userData.failedLoginAttempts || 0) + 1;
            
            const updateData: { failedLoginAttempts: number; updatedAt: string; lockedUntil?: string } = {
              failedLoginAttempts: failedAttempts,
              updatedAt: new Date().toISOString()
            };

            // Lock account after 5 failed attempts
            if (failedAttempts >= 5) {
              updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
            }

            await updateDoc(doc(db, 'users', userDoc.id), updateData);

            logSecurityEvent('failed_login_attempt', { 
              email: sanitizedEmail, 
              failedAttempts,
              locked: failedAttempts >= 5
            }, failedAttempts >= 5 ? 'high' : 'medium');
          }
        } catch (updateError) {
          console.error('Error updating failed login attempts:', updateError);
        }
      }

      logSecurityEvent('login_failed', {
        email: sanitizedEmail,
        error: error instanceof Error ? error.message : String(error)
      }, 'medium');
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Destroy session
      if (typeof window !== 'undefined') {
        const sessionId = localStorage.getItem('gb_session_id');
        if (sessionId) {
          SessionManager.destroySession(sessionId);
          localStorage.removeItem('gb_session_id');
        }
      }

      await firebaseSignOut(auth);
      setUser(null);
      setSessionExpired(false);
      
      logSecurityEvent('user_logout', { 
        userId: user?.id 
      }, 'low');
      
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    try {
      await sendPasswordResetEmail(auth, email);
      logSecurityEvent('password_reset_requested', { email }, 'low');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logSecurityEvent('password_reset_failed', { email, error: errorMsg }, 'medium');
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.feedback.join(', ')}`);
    }

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      
      // Update password
      await updatePassword(auth.currentUser!, newPassword);
      
      logSecurityEvent('password_changed', { userId: user.id }, 'low');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logSecurityEvent('password_change_failed', { 
        userId: user.id, 
        error: errorMsg 
      }, 'medium');
      throw error;
    }
  };

  const refreshSession = async () => {
    if (!user) return;

    try {
      const sessionId = typeof window !== 'undefined' ? localStorage.getItem('gb_session_id') : null;
      if (sessionId) {
        const validation = SessionManager.validateSession(sessionId);
        if (validation.valid) {
          setSessionExpired(false);
        } else {
          setSessionExpired(true);
        }
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      setSessionExpired(true);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
  };

  const isRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      sessionExpired,
      registerUser, 
      signIn, 
      signOut, 
      resetPassword,
      changePassword,
      refreshSession,
      hasPermission,
      isRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useEnhancedAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};

