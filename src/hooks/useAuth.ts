import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import {
  auth,
  formatPlayerName,
  signInAsGuest,
  signInWithGoogle,
  signOutUser,
} from '../firebase';

export interface AuthState {
  user: User | null;
  displayName: string;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function mapAuthError(error: unknown): string {
  if (!(error instanceof Error)) return 'Authentication failed. Please try again.';
  const msg = error.message;
  if (msg.includes('popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completion.';
  }
  if (msg.includes('operation-not-allowed') || msg.includes('admin-restricted-operation')) {
    return 'Anonymous sign-in is disabled on this Firebase project. Please sign in with Google, or enable Anonymous auth in Firebase Console.';
  }
  if (msg.includes('unauthorized-domain')) {
    return 'This hosting domain is not yet allowlisted in Firebase Auth Authorized Domains.';
  }
  return msg;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInAsGuest();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOutUser();
    } catch (err) {
      setError(mapAuthError(err));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    displayName: formatPlayerName(user),
    loading,
    signingIn,
    error,
    loginWithGoogle,
    loginAsGuest,
    logout,
    clearError,
  };
}
