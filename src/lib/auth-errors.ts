/** User-friendly auth error messages. Never expose "Firebase" or raw provider messages in production. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
  'auth/operation-not-allowed': 'Registration is not allowed at this time. Please try again later.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'permission-denied': 'You do not have permission to perform this action.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Returns a user-friendly error message for auth errors. Never returns text containing "Firebase".
 */
export function getAuthErrorMessage(error: unknown): string {
  // Check for Firestore permission errors
  if (error && typeof error === 'object') {
    const err = error as { code?: string; message?: string };
    
    // Check for Firestore permission denied
    if (err.code === 'permission-denied' || 
        (typeof err.message === 'string' && err.message.toLowerCase().includes('permission'))) {
      return 'You do not have permission to perform this action. Please contact support if this persists.';
    }
    
    // Check for Firebase Auth errors
    if ('code' in err && typeof err.code === 'string' && AUTH_ERROR_MESSAGES[err.code]) {
      return AUTH_ERROR_MESSAGES[err.code];
    }
    // Use custom app message if present and safe (no Firebase wording)
    if (typeof err.message === 'string' && err.message && !err.message.toLowerCase().includes('firebase')) {
      return err.message;
    }
  }
  
  return FALLBACK_MESSAGE;
}
