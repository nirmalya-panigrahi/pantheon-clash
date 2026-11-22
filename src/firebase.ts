import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';

export const FIREBASE_PROJECT_ID = 'trans-girder-w91ww';
export const FIRESTORE_DATABASE_ID =
  'ai-studio-android-tactical-bf2dc554-7747-49b7-86a8-8f7272fe236a';

const runtimeApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? '';

export const isFirebaseConfigured = runtimeApiKey.length > 0;

let app: FirebaseApp | null = null;
export let db: Firestore | null = null;
export let auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp({
    apiKey: runtimeApiKey,
    authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: '885340292054',
    appId: '1:885340292054:web:6a3f90c33b689c31ec9a77',
  });
  db = getFirestore(app, FIRESTORE_DATABASE_ID);
  auth = getAuth(app);
}

export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

if (isFirebaseConfigured) {
  void testConnection();
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) {
    throw new Error('Online multiplayer is disabled because no Firebase API key is configured.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInAsGuest(): Promise<User> {
  if (!auth) {
    throw new Error('Online multiplayer is disabled because no Firebase API key is configured.');
  }
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function formatPlayerName(user: User | null): string {
  if (!user) return 'Guest';
  if (user.displayName && user.displayName.trim().length > 0) {
    return user.displayName.trim().slice(0, 48);
  }
  if (user.isAnonymous) {
    return `Oracle-${user.uid.slice(0, 6)}`;
  }
  return user.email ? user.email.split('@')[0].slice(0, 48) : `Oracle-${user.uid.slice(0, 6)}`;
}
