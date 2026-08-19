import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

export const ALLOWED_ADMIN_EMAIL = 'farrullzye@gmail.com';

function getFirebaseCredentials() {
  if (typeof window === 'undefined') {
    // 1. Try reading from config.json on server-side
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed.firebase && parsed.firebase.projectId) {
            return parsed.firebase;
          }
          if (parsed.projectId && parsed.apiKey) {
            return {
              projectId: parsed.projectId,
              appId: parsed.appId || '',
              apiKey: parsed.apiKey,
              authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
              firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
              storageBucket: parsed.storageBucket || `${parsed.projectId}.firebasestorage.app`,
              messagingSenderId: parsed.messagingSenderId || '',
              measurementId: parsed.measurementId || '',
              oAuthClientId: parsed.oAuthClientId || '',
              recaptchaSiteKey: parsed.recaptchaSiteKey || '',
            };
          }
        }
      }
    } catch (e) {
      // Ignore error and try fallback
    }

    // 2. Try reading from firebase-applet-config.json
    try {
      const fs = require('fs');
      const path = require('path');
      const appletConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(appletConfigPath)) {
        const raw = fs.readFileSync(appletConfigPath, 'utf-8');
        if (raw.trim()) {
          return JSON.parse(raw);
        }
      }
    } catch (e) {
      // Ignore error
    }
  }

  // 3. Fallback to process.env or direct default
  return {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0504349540',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '1:845198712806:web:4a3be9b2c6c4b4be9e0027',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyCNwpDe7GKW_LzE4aXUhdDAT_VumIuiIog',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0504349540.firebaseapp.com',
    firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || 'ai-studio-teledriveggjsj-40f29d10-78f2-4d25-aba1-02258e7c932d',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0504349540.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '845198712806',
    oAuthClientId: '845198712806-2a1fij4pubtbacq17vjh1e98b3nq0uic.apps.googleusercontent.com',
  };
}

const firebaseConfig = getFirebaseCredentials();

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Request Drive & Profile Scopes
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Check if the email belongs to the authorized super admin
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ALLOWED_ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * Sign in with Google Popup and verify allowed admin email
 */
export async function signInWithGoogleAdmin(): Promise<{ user: User; token: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';

    const userEmail = user.email?.toLowerCase().trim();
    if (!isAuthorizedAdminEmail(userEmail)) {
      // Sign out unauthorized user immediately
      await signOut(auth);
      throw new Error(
        `Akses Ditolak: Akun (${user.email}) tidak memiliki izin. Hanya ${ALLOWED_ADMIN_EMAIL} yang diizinkan masuk ke panel ini.`
      );
    }

    return { user, token };
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Sign out admin from Firebase
 */
export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribe to Firebase Auth state with authorization check
 */
export function subscribeToAdminAuth(
  callback: (user: User | null, isAuthorized: boolean, token?: string) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAuthorized = isAuthorizedAdminEmail(user.email);
      if (!isAuthorized) {
        await signOut(auth);
        callback(null, false);
      } else {
        const idToken = await user.getIdToken();
        callback(user, true, idToken);
      }
    } else {
      callback(null, false);
    }
  });
}

export { firebaseConfig };

/**
 * Recursively strips `undefined` fields from objects/arrays so Firestore `setDoc`/`updateDoc` never crashes.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}
