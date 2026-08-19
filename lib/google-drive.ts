import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

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
  updatedAt?: string;
}

export const DEFAULT_DRIVE_CONFIG: GoogleDriveConfig = {
  enabled: true,
  folder_id: 'root',
  folder_name: 'RULLZYE CLOUD',
  auto_backup: false,
  sync_videos: false,
  client_id: '845198712806-2a1fij4pubtbacq17vjh1e98b3nq0uic.apps.googleusercontent.com',
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
          // Token may need user re-authentication
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

// ==========================================
// CONFIGURATION PERSISTENCE (In Code & DB)
// ==========================================

function getPermanentConfig(): any {
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to read config.json:', e);
    }
  }
  return {};
}

function writePermanentConfig(updatedData: any) {
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(updatedData, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write permanent config.json:', e);
      return false;
    }
  }
  return false;
}

/**
 * Get current Google Drive configuration from Firestore (or code fallback)
 */
export async function getGoogleDriveConfig(): Promise<GoogleDriveConfig> {
  try {
    const docRef = doc(db, 'settings', 'googledrive');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<GoogleDriveConfig>;
      return {
        ...DEFAULT_DRIVE_CONFIG,
        ...data,
      };
    }
  } catch (err) {
    console.warn('Error reading Google Drive settings from Firestore:', err);
  }

  // Fallback to config.json
  const perm = getPermanentConfig();
  if (perm.google_drive) {
    return {
      ...DEFAULT_DRIVE_CONFIG,
      ...perm.google_drive,
    };
  }

  return { ...DEFAULT_DRIVE_CONFIG };
}

/**
 * Save Google Drive configuration to config.json AND Firestore
 * so it stays saved in code across hosting migrations.
 */
export async function saveGoogleDriveConfig(updates: Partial<GoogleDriveConfig>): Promise<GoogleDriveConfig> {
  const current = await getGoogleDriveConfig();
  const updated: GoogleDriveConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to config.json (Codebase persistence)
  const perm = getPermanentConfig();
  perm.google_drive = updated;
  writePermanentConfig(perm);

  // 2. Save to Firestore
  try {
    const docRef = doc(db, 'settings', 'googledrive');
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.warn('Error persisting Google Drive config to Firestore:', err);
  }

  return updated;
}

// ==========================================
// GOOGLE DRIVE REST API OPERATIONS
// ==========================================

/**
 * Get Google Drive user profile and storage quota
 */
export async function fetchDriveAbout(token: string): Promise<DriveAboutInfo> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * List files and folders from Google Drive
 */
export async function fetchDriveFiles(
  token: string,
  options: {
    folderId?: string;
    searchQuery?: string;
    mimeTypeFilter?: string;
    pageSize?: number;
    pageToken?: string;
  } = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const { folderId = 'root', searchQuery, mimeTypeFilter, pageSize = 50, pageToken } = options;

  const queryParts: string[] = ['trashed = false'];

  if (folderId && folderId !== 'all') {
    queryParts.push(`'${folderId}' in parents`);
  }

  if (searchQuery && searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  if (mimeTypeFilter === 'video') {
    queryParts.push("mimeType contains 'video/'");
  } else if (mimeTypeFilter === 'image') {
    queryParts.push("mimeType contains 'image/'");
  } else if (mimeTypeFilter === 'folder') {
    queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
  }

  const q = queryParts.join(' and ');
  const fields = 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, iconLink, createdTime, modifiedTime, parents)';
  const params = new URLSearchParams({
    q,
    pageSize: pageSize.toString(),
    fields,
    orderBy: 'folder,modifiedTime desc',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list Google Drive files (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const files: DriveFileItem[] = (data.files || []).map((f: any) => ({
    ...f,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    size: f.size ? parseInt(f.size, 10) : undefined,
  }));

  return {
    files,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(
  token: string,
  folderName: string,
  parentFolderId: string = 'root'
): Promise<DriveFileItem> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId && parentFolderId !== 'root') {
    metadata.parents = [parentFolderId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Drive folder: ${errText}`);
  }

  const created = await res.json();
  return {
    ...created,
    isFolder: true,
  };
}

/**
 * Delete a file or folder from Google Drive
 */
export async function deleteDriveFile(token: string, fileId: string): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete Google Drive file: ${errText}`);
  }

  return true;
}
