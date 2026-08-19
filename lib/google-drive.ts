import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { firebaseConfig } from './firebase';

// Scopes required for Google Drive integration
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleDriveConfig {
  enabled: boolean;
  folder_id: string;
  folder_name: string;
  auto_backup: boolean;
  sync_videos: boolean;
  client_id: string;
  client_secret?: string;
  domain?: string;
  redirect_uri?: string;
  authorized_domains?: string[];
  auto_detect_vaults?: boolean;
  sync_interval_seconds?: number;
  updatedAt?: string;
}

export interface GoogleDriveSession {
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: number;
  user?: {
    displayName?: string;
    email?: string;
    photoURL?: string;
    uid?: string;
  };
  domain: string;
  authorized_domains?: string[];
  connected_at: string;
  last_refreshed_at?: string;
  last_synced_at?: string;
  client_id?: string;
  client_secret?: string;
}

export const DEFAULT_DRIVE_CONFIG: GoogleDriveConfig = {
  enabled: true,
  folder_id: 'root',
  folder_name: 'RULLZYE CLOUD',
  auto_backup: false,
  sync_videos: false,
  client_id: '845198712806-2a1fij4pubtbacq17vjh1e98b3nq0uic.apps.googleusercontent.com',
  domain: 'https://teledriveggjsjjj.onrender.com',
  redirect_uri: 'https://teledriveggjsjjj.onrender.com/api/v1/drive/auth/callback',
  authorized_domains: [
    'https://teledriveggjsjjj.onrender.com',
    'http://localhost:3000',
  ],
  auto_detect_vaults: true,
  sync_interval_seconds: 15,
  updatedAt: new Date().toISOString(),
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder?: boolean;
}

export interface DriveAboutInfo {
  user: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
  storageQuota: {
    limit: string;
    usage: string;
    usageInDrive: string;
    usageInDriveTrash: string;
  };
}

// In-memory token management
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Get the Google Auth instance reusing Firebase app
 */
export function getFirebaseAuth() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

/**
 * Initialize Google Auth Provider with Google Drive Scopes
 */
export function getGoogleDriveProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  GOOGLE_DRIVE_SCOPES.forEach((scope) => {
    provider.addScope(scope);
  });
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline',
  });
  return provider;
}

/**
 * Initialize Auth State Listener
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (typeof window === 'undefined') return () => {};
  try {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (err) {
    console.warn('initGoogleAuth error:', err);
    return () => {};
  }
};

/**
 * Client-Side Google Sign-in with Drive Scopes
 */
export const googleSignInDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (typeof window === 'undefined') return null;
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    const provider = getGoogleDriveProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Google Drive dari autentikasi.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get Cached Access Token
 */
export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Set Access Token manually (e.g. from client session)
 */
export const setDriveAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Disconnect / Logout from Google
 */
export const googleLogoutDrive = async () => {
  if (typeof window === 'undefined') return;
  const auth = getFirebaseAuth();
  await signOut(auth);
  cachedAccessToken = null;
};
