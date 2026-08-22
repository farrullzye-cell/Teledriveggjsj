import fs from 'fs';
import path from 'path';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, sanitizeForFirestore } from './firebase';
import {
  GoogleDriveConfig,
  DEFAULT_DRIVE_CONFIG,
  GoogleDriveSession,
  DriveFileItem,
  DriveAboutInfo,
  getDriveAccessToken,
} from './google-drive';

// ==========================================
// CONFIGURATION PERSISTENCE (In Code & DB)
// ==========================================

function getPermanentConfig(): any {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read config.json:', e);
  }
  return {};
}

function writePermanentConfig(updatedData: any) {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(updatedData, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to write permanent config.json:', e);
    return false;
  }
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
    await setDoc(docRef, sanitizeForFirestore(updated), { merge: true });
  } catch (err) {
    console.warn('Could not persist Google Drive settings to Firestore:', err);
  }

  return updated;
}

// ==========================================
// PERMANENT FIRESTORE SESSION MANAGEMENT WITH IN-MEMORY CACHE
// ==========================================

const FIRESTORE_SESSION_DOC = 'google_drive_session';
const DEFAULT_AUTH_DOMAIN = 'https://teledriveggjsjjj.onrender.com';

// Server-side in-memory session and token cache for lightning-fast 0ms Range chunk responses
let cachedServerSession: { session: GoogleDriveSession | null; expiresAt: number } | null = null;
let cachedServerToken: { token: string; expiresAt: number } | null = null;

/**
 * Retrieve the active Google Drive session permanently stored in Firestore (with memory cache)
 */
export async function getStoredDriveSession(forceFresh = false): Promise<GoogleDriveSession | null> {
  if (!forceFresh && cachedServerSession && Date.now() < cachedServerSession.expiresAt) {
    return cachedServerSession.session;
  }

  let session: GoogleDriveSession | null = null;
  try {
    const docRef = doc(db, 'settings', FIRESTORE_SESSION_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      session = snap.data() as GoogleDriveSession;
    }
  } catch (err) {
    console.warn('Error reading Google Drive session from Firestore:', err);
  }

  // Fallback: check config.json
  if (!session) {
    try {
      const perm = getPermanentConfig();
      if (perm.google_drive_session && perm.google_drive_session.access_token) {
        session = perm.google_drive_session as GoogleDriveSession;
      }
    } catch (err) {
      console.warn('Error reading session from config.json:', err);
    }
  }

  // Cache for 60 seconds
  cachedServerSession = {
    session,
    expiresAt: Date.now() + 60000,
  };

  return session;
}

/**
 * Permanently save Google Drive login session to Firestore and config.json
 */
export async function saveDriveSession(sessionData: Partial<GoogleDriveSession>): Promise<GoogleDriveSession> {
  const existing = (await getStoredDriveSession(true)) || {
    status: 'CONNECTED',
    access_token: '',
    domain: DEFAULT_AUTH_DOMAIN,
    authorized_domains: [DEFAULT_AUTH_DOMAIN, 'http://localhost:3000'],
    connected_at: new Date().toISOString(),
  };

  const finalSession: GoogleDriveSession = {
    ...existing,
    ...sessionData,
    domain: sessionData.domain || existing.domain || DEFAULT_AUTH_DOMAIN,
    status: sessionData.access_token ? 'CONNECTED' : (sessionData.status || 'DISCONNECTED'),
    connected_at: existing.connected_at || new Date().toISOString(),
    last_refreshed_at: new Date().toISOString(),
  };

  // Update in-memory cache immediately
  cachedServerSession = {
    session: finalSession,
    expiresAt: Date.now() + 60000,
  };

  if (finalSession.access_token) {
    cachedServerToken = {
      token: finalSession.access_token,
      expiresAt: finalSession.expires_at || (Date.now() + 3500000),
    };
  }

  // 1. Save permanently to Firestore in settings/google_drive_session (sanitized from any undefined fields)
  try {
    const docRef = doc(db, 'settings', FIRESTORE_SESSION_DOC);
    await setDoc(docRef, sanitizeForFirestore(finalSession), { merge: true });

    // Also update settings/googledrive with user status
    const gdriveRef = doc(db, 'settings', 'googledrive');
    await setDoc(
      gdriveRef,
      sanitizeForFirestore({
        enabled: true,
        session_active: true,
        user_email: finalSession.user?.email || '',
        user_name: finalSession.user?.displayName || '',
        domain: finalSession.domain,
        last_auth_at: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving Google Drive session to Firestore:', err);
  }

  // 2. Mirror into config.json for code persistence
  try {
    const perm = getPermanentConfig();
    perm.google_drive_session = finalSession;
    perm.app_domain = finalSession.domain;
    if (perm.google_drive) {
      perm.google_drive.domain = finalSession.domain;
      perm.google_drive.enabled = true;
    }
    writePermanentConfig(perm);
  } catch (e) {
    console.warn('Could not mirror session into config.json:', e);
  }

  return finalSession;
}

/**
 * Remove or disconnect Google Drive session from Firestore
 */
export async function clearDriveSession(): Promise<void> {
  cachedServerSession = null;
  cachedServerToken = null;
  try {
    const docRef = doc(db, 'settings', FIRESTORE_SESSION_DOC);
    await setDoc(
      docRef,
      {
        status: 'DISCONNECTED',
        access_token: '',
        refresh_token: '',
        expires_at: 0,
        disconnected_at: new Date().toISOString(),
      },
      { merge: true }
    );

    const gdriveRef = doc(db, 'settings', 'googledrive');
    await setDoc(
      gdriveRef,
      {
        session_active: false,
        last_disconnected_at: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error clearing Google Drive session from Firestore:', err);
  }

  try {
    const perm = getPermanentConfig();
    if (perm.google_drive_session) {
      delete perm.google_drive_session;
      writePermanentConfig(perm);
    }
  } catch (e) {}
}
/**
 * Refresh expired access token using refresh_token against Google OAuth endpoint
 */
export async function refreshGoogleDriveAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const config = await getGoogleDriveConfig();
    const clientId = config.client_id || DEFAULT_DRIVE_CONFIG.client_id;
    const clientSecret = config.client_secret || process.env.GOOGLE_CLIENT_SECRET || '';

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    if (clientSecret) {
      params.set('client_secret', clientSecret);
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[GDRIVE-TOKEN-REFRESH] Failed to refresh token:', err);
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      const expiresInMs = (data.expires_in || 3600) * 1000;
      const expiresAt = Date.now() + expiresInMs;
      
      cachedServerToken = {
        token: data.access_token,
        expiresAt,
      };

      await saveDriveSession({
        access_token: data.access_token,
        expires_at: expiresAt,
        status: 'CONNECTED',
      });
      return data.access_token;
    }
  } catch (err) {
    console.error('[GDRIVE-TOKEN-REFRESH] Exception during token refresh:', err);
  }
  return null;
}

/**
 * Get a valid Google Drive access token:
 * 1. Checks memory cache (0ms instant response)
 * 2. Checks client memory token
 * 3. Checks permanent Firestore session with cached TTL
 * 4. Auto-refreshes token if expired and refresh_token is present
 */
export async function getValidDriveToken(explicitToken?: string | null): Promise<string | null> {
  if (explicitToken && explicitToken.trim() && explicitToken !== 'null' && explicitToken !== 'undefined') {
    return explicitToken.trim();
  }

  // 1. Fast in-memory token cache (0ms overhead during video range streaming)
  if (cachedServerToken && Date.now() < cachedServerToken.expiresAt - 60000) {
    return cachedServerToken.token;
  }

  // 2. Check in-memory token from google-drive.ts
  const mem = getDriveAccessToken();
  if (mem && mem.trim()) {
    cachedServerToken = { token: mem.trim(), expiresAt: Date.now() + 300000 };
    return mem.trim();
  }

  // 3. Read stored session from Firestore (cached)
  const session = await getStoredDriveSession();
  if (!session || !session.access_token) {
    return null;
  }

  // 4. Check expiration (refresh if expires within 5 minutes)
  const isExpired = session.expires_at ? Date.now() >= session.expires_at - 300000 : false;
  if (isExpired && session.refresh_token) {
    const refreshed = await refreshGoogleDriveAccessToken(session.refresh_token);
    if (refreshed) return refreshed;
  }

  if (session.access_token) {
    cachedServerToken = {
      token: session.access_token,
      expiresAt: session.expires_at || (Date.now() + 3500000),
    };
  }

  return session.access_token;
}

export class GoogleDriveAuthError extends Error {
  statusCode: number;
  code: string;
  constructor(message = 'Token otentikasi Google Drive telah kadaluarsa atau tidak valid.', code = 'UNAUTHORIZED', statusCode = 401) {
    super(message);
    this.name = 'GoogleDriveAuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Robust fetch helper for Google Drive API v3 with automatic 401 token refresh & single retry
 */
export async function fetchGoogleDriveApi(
  endpoint: string,
  init?: RequestInit,
  explicitToken?: string | null
): Promise<Response> {
  const authToken = await getValidDriveToken(explicitToken);
  if (!authToken) {
    throw new GoogleDriveAuthError('Sesi Google Drive belum terhubung atau token kadaluarsa. Silakan hubungkan Google Drive di panel.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com/drive/v3/${endpoint.replace(/^\//, '')}`;
  
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${authToken}`);

  let res = await fetch(url, {
    ...init,
    headers,
  });

  // Handle 401 Auth Error: Token may have expired, attempt auto-refresh
  if (res.status === 401) {
    cachedServerToken = null;
    cachedServerSession = null;

    const session = await getStoredDriveSession(true);
    if (session?.refresh_token) {
      console.log('[GDRIVE-API] 401 authError received, attempting token auto-refresh with refresh_token...');
      const refreshedToken = await refreshGoogleDriveAccessToken(session.refresh_token);
      if (refreshedToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        res = await fetch(url, {
          ...init,
          headers,
        });
      }
    }

    if (res.status === 401) {
      if (session) {
        saveDriveSession({ status: 'EXPIRED' }).catch(() => {});
      }
      throw new GoogleDriveAuthError('Token otentikasi Google Drive telah kadaluarsa. Silakan hubungkan ulang akun Google di panel.');
    }
  }

  return res;
}

// ==========================================
// REST API OPERATIONS (Direct Google Drive v3)
// ==========================================

/**
 * Fetch Account and Quota info from Google Drive
 */
export async function getDriveAboutInfo(token?: string): Promise<DriveAboutInfo> {
  const res = await fetchGoogleDriveApi(
    'about?fields=user(displayName,emailAddress,photoLink),storageQuota',
    { method: 'GET' },
    token
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Drive about info: ${err}`);
  }

  return await res.json();
}

/**
 * List files and folders from Google Drive
 */
export async function fetchDriveFiles(
  token?: string,
  options: {
    folderId?: string;
    pageSize?: number;
    pageToken?: string;
    searchQuery?: string;
    mimeTypeFilter?: 'video' | 'image' | 'folder' | 'all';
  } = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const { folderId = 'root', pageSize = 50, pageToken, searchQuery, mimeTypeFilter = 'all' } = options;

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
  const params = new URLSearchParams({
    q,
    pageSize: pageSize.toString(),
    fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, webViewLink, webContentLink, thumbnailLink, iconLink, createdTime, modifiedTime, parents)',
    orderBy: 'folder, modifiedTime desc',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const res = await fetchGoogleDriveApi(`files?${params.toString()}`, { method: 'GET' }, token);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const files: DriveFileItem[] = (data.files || []).map((f: any) => ({
    ...f,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    size: f.size ? parseInt(f.size, 10) : undefined,
    md5Checksum: f.md5Checksum || undefined,
  }));

  return { files, nextPageToken: data.nextPageToken };
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(
  token?: string,
  folderName?: string,
  parentFolderId: string = 'root'
): Promise<DriveFileItem> {
  const finalName = folderName || 'New Folder';
  const metadata = {
    name: finalName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentFolderId && parentFolderId !== 'root' ? [parentFolderId] : undefined,
  };

  const res = await fetchGoogleDriveApi(
    'files',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    },
    token
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create folder in Google Drive: ${errText}`);
  }

  const created = await res.json();
  return {
    ...created,
    isFolder: true,
  };
}

/**
 * Make file publicly accessible with reader role (anyone with link)
 */
export async function makeDriveFilePublic(token?: string, fileId?: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const res = await fetchGoogleDriveApi(
      `files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      },
      token
    );
    return res.ok;
  } catch (err) {
    console.warn(`[GDRIVE] Could not set public permission for ${fileId}:`, err);
    return false;
  }
}

/**
 * Publicize multiple Google Drive files concurrently and update their metadata & thumbnails in Firestore
 */
export async function batchMakeDriveFilesPublic(
  fileIds: string[],
  token?: string
): Promise<{
  total: number;
  successCount: number;
  failedCount: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}> {
  const authToken = await getValidDriveToken(token);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];
  let successCount = 0;
  let failedCount = 0;

  const { getFiles, updateFileRecord } = await import('./excel-db');
  const allDbFiles = await getFiles();

  // Process in chunks of 5
  const chunkSize = 5;
  for (let i = 0; i < fileIds.length; i += chunkSize) {
    const chunk = fileIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (gdriveId) => {
        try {
          const isOk = await makeDriveFilePublic(authToken || undefined, gdriveId);
          if (isOk) {
            successCount++;
            results.push({ id: gdriveId, success: true });

            // Find matching DB file
            const matching = allDbFiles.find(
              (f) => f.gdrive_file_id === gdriveId || f.id === gdriveId || f.telegram_file_id === `gdrive_${gdriveId}`
            );
            if (matching) {
              const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${gdriveId}`;
              const defaultThumb = matching.gdrive_thumbnail_url || `https://lh3.googleusercontent.com/d/${gdriveId}=w800`;
              await updateFileRecord(matching.id, {
                gdrive_url: directStreamingUrl,
                source_url: directStreamingUrl,
                gdrive_thumbnail_url: defaultThumb,
                is_public: true,
              });
            }
          } else {
            failedCount++;
            results.push({ id: gdriveId, success: false, error: 'Gagal mengatur izin publik Google Drive' });
          }
        } catch (e: any) {
          failedCount++;
          results.push({ id: gdriveId, success: false, error: e?.message || 'Error' });
        }
      })
    );
  }

  return {
    total: fileIds.length,
    successCount,
    failedCount,
    results,
  };
}

/**
 * Make ALL Google Drive files currently stored in database publicly viewable
 */
export async function makeAllDriveFilesPublic(token?: string): Promise<{
  totalDriveFiles: number;
  successCount: number;
  failedCount: number;
  message: string;
}> {
  const { getFiles } = await import('./excel-db');
  const files = await getFiles();
  const driveFiles = files.filter(
    (f) => f.gdrive_file_id || (f.telegram_file_id && f.telegram_file_id.startsWith('gdrive_'))
  );

  const driveIds = driveFiles
    .map((f) => f.gdrive_file_id || f.telegram_file_id?.replace('gdrive_', ''))
    .filter(Boolean) as string[];

  if (driveIds.length === 0) {
    return {
      totalDriveFiles: 0,
      successCount: 0,
      failedCount: 0,
      message: 'Tidak ada berkas Google Drive yang tersimpan di database.',
    };
  }

  const batchRes = await batchMakeDriveFilesPublic(driveIds, token);
  return {
    totalDriveFiles: driveIds.length,
    successCount: batchRes.successCount,
    failedCount: batchRes.failedCount,
    message: `Berhasil mengubah ${batchRes.successCount} dari ${driveIds.length} video Google Drive menjadi Publik (Dapat dilihat semua orang).`,
  };
}

/**
 * Upload binary file buffer to Google Drive
 */
export async function uploadFileBufferToDrive(
  token?: string,
  params?: {
    fileName?: string;
    name?: string;
    mimeType: string;
    buffer: Buffer;
    folderId?: string;
    parentFolderId?: string;
  }
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}> {
  if (!params) throw new Error('Parameter upload buffer diperlukan.');

  const authToken = await getValidDriveToken(token);
  if (!authToken) {
    throw new Error('Sesi Google Drive belum terhubung atau token kadaluarsa.');
  }

  const finalName = params.fileName || params.name || 'unnamed_file';
  const finalFolderId = params.folderId || params.parentFolderId;

  const metadata = {
    name: finalName,
    mimeType: params.mimeType,
    parents: finalFolderId && finalFolderId !== 'root' ? [finalFolderId] : undefined,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaHeader = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: ${params.mimeType}\r\n\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(metaHeader, 'utf-8'),
    Buffer.from(fileHeader, 'utf-8'),
    params.buffer,
    Buffer.from(closeDelimiter, 'utf-8'),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length.toString(),
      },
      body: bodyBuffer,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Make file publicly readable for web player & iframe embedding
  makeDriveFilePublic(authToken, data.id).catch(() => {});

  return {
    ...data,
    size: data.size ? parseInt(data.size, 10) : params.buffer.byteLength,
  };
}

/**
 * Ensure all Vault folders exist in Google Drive and link them
 */
export async function ensureDriveVaultFolders(
  token?: string,
  rootFolderId: string = 'root'
): Promise<{ rootFolderId: string; vaults: any[] }> {
  const authToken = await getValidDriveToken(token);
  if (!authToken) {
    throw new Error('Sesi Google Drive belum terhubung atau token kadaluarsa.');
  }

  let activeRootId = rootFolderId;

  // If rootFolderId is 'root' or empty, look for or create "RULLZYE CLOUD" folder
  if (!activeRootId || activeRootId === 'root') {
    const existing = await fetchDriveFiles(authToken, {
      folderId: 'root',
      mimeTypeFilter: 'folder',
      searchQuery: 'RULLZYE CLOUD',
    });
    const foundRoot = existing.files.find((f) => f.isFolder && f.name === 'RULLZYE CLOUD');
    if (foundRoot) {
      activeRootId = foundRoot.id;
    } else {
      const createdRoot = await createDriveFolder(authToken, 'RULLZYE CLOUD', 'root');
      activeRootId = createdRoot.id;
      await makeDriveFilePublic(authToken, activeRootId);
    }
  }

  await saveGoogleDriveConfig({ folder_id: activeRootId, folder_name: 'RULLZYE CLOUD' });

  // Get existing folders under root
  const subfolders = await fetchDriveFiles(authToken, {
    folderId: activeRootId,
    mimeTypeFilter: 'folder',
    pageSize: 100,
  });

  const { getVaults, updateVault } = await import('./excel-db');
  const currentVaults = await getVaults();
  const updatedVaults = [];

  for (const vault of currentVaults) {
    const folderTargetName = vault.gdrive_folder_name || vault.name;
    let matchingFolder = subfolders.files.find(
      (f: any) =>
        f.isFolder &&
        (f.name.toLowerCase() === folderTargetName.toLowerCase() ||
          (vault.gdrive_folder_id && f.id === vault.gdrive_folder_id))
    );

    if (!matchingFolder) {
      matchingFolder = await createDriveFolder(authToken, folderTargetName, activeRootId);
      await makeDriveFilePublic(authToken, matchingFolder.id);
    }

    const updated = await updateVault(vault.id, {
      gdrive_folder_id: matchingFolder.id,
      gdrive_folder_name: matchingFolder.name,
    });
    updatedVaults.push(updated || vault);
  }

  return { rootFolderId: activeRootId, vaults: updatedVaults };
}

/**
 * Scan all Google Drive Vault folders, auto-detect new uploads, and index them into Firestore
 */
export async function scanAndSyncDriveVaults(token?: string): Promise<{
  success: boolean;
  newCount: number;
  totalScanned: number;
  vaultsScanned: number;
  newFiles: any[];
  message: string;
}> {
  const authToken = await getValidDriveToken(token);
  if (!authToken) {
    return {
      success: false,
      newCount: 0,
      totalScanned: 0,
      vaultsScanned: 0,
      newFiles: [],
      message: 'Token otentikasi Google Drive belum tersedia di Firestore / session.',
    };
  }

  const { getVaults, updateVault, getFiles, addFileRecord, addLog, determineFileType } = await import('./excel-db');
  const vaults = await getVaults();
  const existingFiles = await getFiles();

  const existingDriveIds = new Set<string>();
  const existingFileKeys = new Set<string>();

  for (const f of existingFiles) {
    if (f.gdrive_file_id) existingDriveIds.add(f.gdrive_file_id);
    if (f.telegram_file_id?.startsWith('gdrive_')) existingDriveIds.add(f.telegram_file_id.replace('gdrive_', ''));
    existingFileKeys.add(`${f.name.toLowerCase()}_${f.size}`);
  }

  let newCount = 0;
  let totalScanned = 0;
  let vaultsScanned = 0;
  const newFiles: any[] = [];

  for (const vault of vaults) {
    const folderId = vault.gdrive_folder_id;
    if (!folderId || folderId === 'root') continue;

    try {
      vaultsScanned++;
      const driveList = await fetchDriveFiles(authToken, {
        folderId,
        pageSize: 100,
      });

      const vaultDriveFiles = driveList.files.filter((f: any) => !f.isFolder);
      totalScanned += vaultDriveFiles.length;

      for (const df of vaultDriveFiles) {
        const fileKey = `${df.name.toLowerCase()}_${df.size || 0}`;
        if (existingDriveIds.has(df.id) || existingFileKeys.has(fileKey)) {
          continue; // already indexed
        }

        const type = determineFileType(df.name, df.mimeType);
        const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${df.id}`;

        const createdRecord = await addFileRecord({
          name: df.name,
          size: df.size || 0,
          type,
          mime: df.mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
          gdrive_file_id: df.id,
          gdrive_url: directStreamingUrl,
          gdrive_web_link: df.webViewLink || `https://drive.google.com/file/d/${df.id}/view`,
          gdrive_thumbnail_url: df.thumbnailLink || '',
          gdrive_folder_id: folderId,
          telegram_file_id: `gdrive_${df.id}`,
          source_url: directStreamingUrl,
          vault_id: vault.id,
          storage_provider: 'gdrive',
        });

        if (createdRecord && !createdRecord.isDuplicate) {
          existingDriveIds.add(df.id);
          existingFileKeys.add(fileKey);
          newFiles.push(createdRecord);
          newCount++;
        }
      }

      await updateVault(vault.id, {
        gdrive_file_count: vaultDriveFiles.length,
        gdrive_last_synced: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn(`[GDRIVE-SYNC] Error scanning vault ${vault.name} (${vault.id}):`, err?.message || err);
    }
  }

  if (newCount > 0) {
    await addLog('GDRIVE_AUTO_DETECT', `${newCount} file(s) synced from Google Drive`, 'SUCCESS');
  }

  return {
    success: true,
    newCount,
    totalScanned,
    vaultsScanned,
    newFiles,
    message:
      newCount > 0
        ? `Berhasil mendeteksi & menyinkronkan ${newCount} file baru dari Google Drive Vault!`
        : `Penyelarasan selesai. ${totalScanned} file di Google Drive Vault sudah tersinkron.`,
  };
}

/**
 * Delete a file or folder from Google Drive
 */
export async function deleteDriveFile(token?: string, fileId?: string): Promise<boolean> {
  if (!fileId) return false;
  const res = await fetchGoogleDriveApi(`files/${fileId}`, { method: 'DELETE' }, token);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete Google Drive file: ${errText}`);
  }
  return true;
}

// ==========================================
// AUTO BURST UPLOAD & BATCH SYNC ENGINE
// ==========================================

/**
 * High-Speed Auto Burst Scan & Ingestion
 * Concurrently scans Google Drive folders, applies duplicate detection,
 * auto-classifies media, and ingests in high-performance batches.
 */
export async function burstScanAndSyncDriveVaults(options?: {
  token?: string;
  concurrency?: number;
  duplicatePolicy?: 'skip' | 'overwrite' | 'rename';
  folderId?: string;
}): Promise<{
  success: boolean;
  totalScanned: number;
  newCount: number;
  duplicatesCount: number;
  vaultsScanned: number;
  importedFiles: any[];
  message: string;
}> {
  const authToken = await getValidDriveToken(options?.token);
  if (!authToken) {
    return {
      success: false,
      totalScanned: 0,
      newCount: 0,
      duplicatesCount: 0,
      vaultsScanned: 0,
      importedFiles: [],
      message: 'Token otentikasi Google Drive belum aktif di Firestore.',
    };
  }

  const { getVaults, updateVault, getFiles, addBatchFileRecords, addLog, determineFileType } = await import('./excel-db');
  const vaults = await getVaults();
  const existingFiles = await getFiles();

  const candidateRecords: any[] = [];
  let totalScanned = 0;
  let vaultsScanned = 0;

  // 1. If specific folderId passed, scan that folder
  if (options?.folderId) {
    vaultsScanned = 1;
    const driveList = await fetchDriveFiles(authToken, {
      folderId: options.folderId,
      pageSize: 1000,
    });
    const nonFolders = driveList.files.filter((f: any) => !f.isFolder);
    totalScanned += nonFolders.length;

    for (const df of nonFolders) {
      const type = determineFileType(df.name, df.mimeType || '');
      const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${df.id}`;
      candidateRecords.push({
        name: df.name,
        size: df.size || 0,
        type,
        mime: df.mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
        gdrive_file_id: df.id,
        gdrive_url: directStreamingUrl,
        gdrive_web_link: df.webViewLink || `https://drive.google.com/file/d/${df.id}/view`,
        gdrive_thumbnail_url: df.thumbnailLink || '',
        gdrive_folder_id: options.folderId,
        telegram_file_id: `gdrive_${df.id}`,
        source_url: directStreamingUrl,
        vault_id: type === 'video' ? 'vault_media' : type === 'image' ? 'vault_media' : 'vault_docs',
        storage_provider: 'gdrive',
      });
    }
  } else {
    // Check if any vaults are explicitly linked to subfolders
    const linkedVaults = vaults.filter((v: any) => v.gdrive_folder_id && v.gdrive_folder_id !== 'root');

    if (linkedVaults.length > 0) {
      // Scan all linked vaults in parallel
      for (const vault of linkedVaults) {
        const folderId = vault.gdrive_folder_id;
        try {
          vaultsScanned++;
          const driveList = await fetchDriveFiles(authToken, {
            folderId,
            pageSize: 1000,
          });

          const nonFolders = driveList.files.filter((f: any) => !f.isFolder);
          totalScanned += nonFolders.length;

          for (const df of nonFolders) {
            const type = determineFileType(df.name, df.mimeType || '');
            const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${df.id}`;
            candidateRecords.push({
              name: df.name,
              size: df.size || 0,
              type,
              mime: df.mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
              gdrive_file_id: df.id,
              gdrive_url: directStreamingUrl,
              gdrive_web_link: df.webViewLink || `https://drive.google.com/file/d/${df.id}/view`,
              gdrive_thumbnail_url: df.thumbnailLink || '',
              gdrive_folder_id: folderId,
              telegram_file_id: `gdrive_${df.id}`,
              source_url: directStreamingUrl,
              vault_id: vault.id,
              storage_provider: 'gdrive',
            });
          }

          await updateVault(vault.id, {
            gdrive_file_count: nonFolders.length,
            gdrive_last_synced: new Date().toISOString(),
          });
        } catch (err: any) {
          console.warn(`[BURST-SYNC] Error scanning vault ${vault.name}:`, err?.message || err);
        }
      }
    } else {
      // Fallback: Scan root / configured Google Drive folder
      vaultsScanned = 1;
      const config = await getGoogleDriveConfig();
      const targetFolderId = config.folder_id || 'root';
      try {
        const driveList = await fetchDriveFiles(authToken, {
          folderId: targetFolderId,
          pageSize: 1000,
        });

        const nonFolders = driveList.files.filter((f: any) => !f.isFolder);
        totalScanned += nonFolders.length;

        for (const df of nonFolders) {
          const type = determineFileType(df.name, df.mimeType || '');
          const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${df.id}`;
          candidateRecords.push({
            name: df.name,
            size: df.size || 0,
            type,
            mime: df.mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
            gdrive_file_id: df.id,
            gdrive_url: directStreamingUrl,
            gdrive_web_link: df.webViewLink || `https://drive.google.com/file/d/${df.id}/view`,
            gdrive_thumbnail_url: df.thumbnailLink || '',
            gdrive_folder_id: targetFolderId,
            telegram_file_id: `gdrive_${df.id}`,
            source_url: directStreamingUrl,
            vault_id: type === 'video' ? 'vault_media' : type === 'image' ? 'vault_media' : 'vault_docs',
            storage_provider: 'gdrive',
          });
        }
      } catch (err: any) {
        console.warn(`[BURST-SYNC] Error scanning root folder ${targetFolderId}:`, err?.message || err);
      }
    }
  }

  // 2. Ingest with Duplicate Policy
  const policy = options?.duplicatePolicy || 'skip';
  const batchResult = await addBatchFileRecords(candidateRecords, policy);

  if (batchResult.inserted.length > 0 || batchResult.overwritten.length > 0) {
    await addLog(
      'GDRIVE_BURST_SYNC',
      `${batchResult.inserted.length} file baru diimpor, ${batchResult.skippedDuplicates.length} duplikat dilewati.`,
      'SUCCESS'
    );
  }

  return {
    success: true,
    totalScanned,
    newCount: batchResult.inserted.length + batchResult.overwritten.length,
    duplicatesCount: batchResult.skippedDuplicates.length,
    vaultsScanned,
    importedFiles: batchResult.inserted,
    message: `⚡ Auto Burst Sync Selesai: ${batchResult.inserted.length} file baru berhasil diimpor, ${batchResult.skippedDuplicates.length} file duplikat terdeteksi & dilewati.`,
  };
}

/**
 * Ingest multiple files from Google Drive in parallel bursts with duplicate checking
 */
export async function burstUploadDriveFiles(
  items: Array<{
    driveFileId: string;
    name: string;
    mimeType?: string;
    size?: number;
    thumbnailLink?: string;
    webViewLink?: string;
    vaultId?: string;
  }>,
  options?: {
    token?: string;
    duplicatePolicy?: 'skip' | 'overwrite' | 'rename';
  }
): Promise<{
  success: boolean;
  inserted: any[];
  skippedDuplicates: any[];
  message: string;
}> {
  const { addBatchFileRecords, addLog, determineFileType } = await import('./excel-db');

  const recordsToInsert = items.map((item) => {
    const type = determineFileType(item.name, item.mimeType || '');
    const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${item.driveFileId}`;

    return {
      name: item.name,
      size: Number(item.size) || 0,
      type,
      mime: item.mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
      telegram_file_id: `gdrive_${item.driveFileId}`,
      gdrive_file_id: item.driveFileId,
      gdrive_url: directStreamingUrl,
      gdrive_web_link: item.webViewLink || `https://drive.google.com/file/d/${item.driveFileId}/view`,
      gdrive_thumbnail_url: item.thumbnailLink || '',
      source_url: directStreamingUrl,
      vault_id: item.vaultId || (type === 'video' ? 'vault_media' : type === 'image' ? 'vault_media' : 'vault_general'),
      storage_provider: 'gdrive' as const,
    };
  });

  const policy = options?.duplicatePolicy || 'skip';
  const batchResult = await addBatchFileRecords(recordsToInsert, policy);

  await addLog(
    'GDRIVE_BURST_UPLOAD',
    `Burst upload ${items.length} item(s): ${batchResult.inserted.length} berhasil, ${batchResult.skippedDuplicates.length} duplikat`,
    'SUCCESS'
  );

  return {
    success: true,
    inserted: batchResult.inserted,
    skippedDuplicates: batchResult.skippedDuplicates,
    message: `Burst upload selesai: ${batchResult.inserted.length} file ditambahkan, ${batchResult.skippedDuplicates.length} duplikat dilewati.`,
  };
}

// ==========================================
// ANTI-ERROR VIDEO STREAMING PROXY (HTTP 206)
// ==========================================

/**
 * Resilient Anti-Error Streaming Proxy for Google Drive Media
 * Handles HTTP 206 Partial Content Range headers, bypasses download quota limits & cookie barriers.
 */
export async function fetchDriveMediaStream(
  gdriveFileId: string,
  rangeHeader?: string | null,
  token?: string
): Promise<{
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
  directFallbackUrl?: string;
  embedPreviewUrl?: string;
  error?: string;
}> {
  const authToken = await getValidDriveToken(token);
  const directFallbackUrl = `https://drive.google.com/uc?export=download&id=${gdriveFileId}`;
  const embedPreviewUrl = `https://drive.google.com/file/d/${gdriveFileId}/preview`;

  const baseHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };
  if (rangeHeader) {
    baseHeaders['Range'] = rangeHeader;
  }

  // 1. Primary: Google Drive API v3 binary stream endpoint (High-speed, stable, direct byte range)
  if (authToken) {
    try {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${gdriveFileId}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;
      const apiHeaders = { ...baseHeaders, Authorization: `Bearer ${authToken}` };
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: apiHeaders,
        cache: 'no-store',
      });

      if (res.ok || res.status === 206) {
        const ct = res.headers.get('content-type') || 'video/mp4';
        if (!ct.includes('text/html') || ct.includes('video/')) {
          const responseHeaders: Record<string, string> = {
            'Content-Type': ct.startsWith('video/') ? ct : 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type, Accept',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          };

          if (res.headers.get('content-range')) {
            responseHeaders['Content-Range'] = res.headers.get('content-range')!;
          }
          if (res.headers.get('content-length')) {
            responseHeaders['Content-Length'] = res.headers.get('content-length')!;
          }

          return {
            ok: true,
            status: res.status,
            headers: responseHeaders,
            body: res.body,
            directFallbackUrl,
            embedPreviewUrl,
          };
        }
      }
    } catch (apiErr: any) {
      console.warn(`[STREAM-PROXY-WARN] Drive API stream failed for ${gdriveFileId}:`, apiErr?.message);
    }
  }

  // 2. Secondary: Direct Google Usercontent stream with virus-warning & token auto-bypass
  const directUrls = [
    `https://drive.usercontent.google.com/download?id=${gdriveFileId}&export=download&authuser=0&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${gdriveFileId}&confirm=t`,
  ];

  for (const url of directUrls) {
    try {
      const fbHeaders = { ...baseHeaders };
      if (authToken) fbHeaders['Authorization'] = `Bearer ${authToken}`;

      const fbRes = await fetch(url, {
        method: 'GET',
        headers: fbHeaders,
        redirect: 'follow',
        cache: 'no-store',
      });

      if (fbRes.ok || fbRes.status === 206) {
        const ct = fbRes.headers.get('content-type') || '';
        
        // If Google responded with direct video binary
        if (ct.startsWith('video/') || (!ct.includes('text/html') && !ct.includes('application/json'))) {
          const responseHeaders: Record<string, string> = {
            'Content-Type': ct.startsWith('video/') ? ct : 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
          };

          if (fbRes.headers.get('content-range')) {
            responseHeaders['Content-Range'] = fbRes.headers.get('content-range')!;
          }
          if (fbRes.headers.get('content-length')) {
            responseHeaders['Content-Length'] = fbRes.headers.get('content-length')!;
          }

          return {
            ok: true,
            status: fbRes.status,
            headers: responseHeaders,
            body: fbRes.body,
            directFallbackUrl,
            embedPreviewUrl,
          };
        }

        // If Google returned HTML virus scan confirmation page, parse confirm code and uuid
        if (ct.includes('text/html')) {
          const htmlText = await fbRes.text();
          const confirmMatch = htmlText.match(/name="confirm"\s+value="([^"]+)"/) || htmlText.match(/confirm=([a-zA-Z0-9_-]+)/);
          const uuidMatch = htmlText.match(/name="uuid"\s+value="([^"]+)"/) || htmlText.match(/uuid=([a-zA-Z0-9_-]+)/);
          
          if (confirmMatch && confirmMatch[1]) {
            const confirmCode = confirmMatch[1];
            const uuidCode = uuidMatch ? uuidMatch[1] : '';
            const bypassUrl = `https://drive.usercontent.google.com/download?id=${gdriveFileId}&export=download&confirm=${confirmCode}${uuidCode ? `&uuid=${uuidCode}` : ''}`;
            
            const bypassRes = await fetch(bypassUrl, {
              method: 'GET',
              headers: fbHeaders,
              redirect: 'follow',
              cache: 'no-store',
            });

            if (bypassRes.ok || bypassRes.status === 206) {
              const bct = bypassRes.headers.get('content-type') || '';
              if (!bct.includes('text/html')) {
                const responseHeaders: Record<string, string> = {
                  'Content-Type': bct.startsWith('video/') ? bct : 'video/mp4',
                  'Accept-Ranges': 'bytes',
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
                  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
                };
                if (bypassRes.headers.get('content-range')) responseHeaders['Content-Range'] = bypassRes.headers.get('content-range')!;
                if (bypassRes.headers.get('content-length')) responseHeaders['Content-Length'] = bypassRes.headers.get('content-length')!;

                return {
                  ok: true,
                  status: bypassRes.status,
                  headers: responseHeaders,
                  body: bypassRes.body,
                  directFallbackUrl,
                  embedPreviewUrl,
                };
              }
            }
          }
        }
      }
    } catch (fbErr: any) {
      console.warn(`[STREAM-PROXY-WARN] Fallback url ${url} failed for ${gdriveFileId}:`, fbErr?.message);
    }
  }

  return {
    ok: false,
    status: 502,
    headers: {},
    body: null,
    directFallbackUrl,
    embedPreviewUrl,
    error: 'Google Drive binary stream requires embed player fallback.',
  };
}

// ==========================================
// GOOGLE DRIVE DUPLICATE DETECTION & BURST DELETE ENGINE
// ==========================================

export interface DriveDuplicateGroup {
  groupKey: string;
  matchType: 'checksum' | 'name_size' | 'normalized_name_size';
  keySummary: string;
  keepFile: DriveFileItem;
  duplicateFiles: DriveFileItem[];
  totalGroupSize: number;
  reclaimableBytes: number;
  reclaimableFormatted: string;
}

export interface DriveDuplicateScanOptions {
  scope?: 'all' | 'folder' | 'vaults';
  folderId?: string;
  keepStrategy?: 'keep_oldest' | 'keep_newest';
  matchStrategy?: 'md5_or_name_size' | 'exact_name_size' | 'checksum_only' | 'normalized_name_size';
  maxFilesToScan?: number;
}

export interface DriveDuplicateScanResult {
  success: boolean;
  scannedFilesCount: number;
  duplicateGroupsCount: number;
  totalDuplicatesCount: number;
  reclaimableBytes: number;
  reclaimableFormatted: string;
  groups: DriveDuplicateGroup[];
  allDuplicateFileIds: string[];
  message: string;
}

export interface BurstDeleteDriveDuplicatesOptions extends DriveDuplicateScanOptions {
  targetFileIds?: string[];
  concurrency?: number;
}

export interface BurstDeleteDriveDuplicatesResult {
  success: boolean;
  scannedCount: number;
  deletedCount: number;
  failedCount: number;
  freedBytes: number;
  freedFormatted: string;
  deletedFiles: Array<{ id: string; name: string; size: number; md5Checksum?: string }>;
  failedFiles: Array<{ id: string; name: string; error: string }>;
  message: string;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Remove copy suffixes from filename e.g. "video (1).mp4", "image - Copy.png", "doc (salinan 2).pdf"
 */
export function normalizeFileNameForDuplicate(filename: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  const nameOnly = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';

  const cleaned = nameOnly
    .replace(/\s*[\(\[]\s*(?:copy|salinan|duplikat|duplicate|\d+)\s*[\)\]]\s*$/i, '')
    .replace(/\s*-\s*(?:copy|salinan|duplikat|duplicate)\s*$/i, '')
    .replace(/_\s*(?:copy|salinan|duplikat|duplicate)\s*$/i, '')
    .replace(/\s*[\(\[]\s*(?:copy|salinan|duplikat|duplicate)\s*\d*\s*[\)\]]\s*$/i, '')
    .trim();

  return (cleaned || nameOnly) + ext;
}

/**
 * Scan Google Drive to detect duplicate files
 */
export async function scanDriveDuplicates(
  token?: string,
  options: DriveDuplicateScanOptions = {}
): Promise<DriveDuplicateScanResult> {
  const {
    scope = 'all',
    folderId = 'root',
    keepStrategy = 'keep_oldest',
    matchStrategy = 'md5_or_name_size',
    maxFilesToScan = 5000,
  } = options;

  const authToken = await getValidDriveToken(token);
  if (!authToken) {
    throw new GoogleDriveAuthError('Sesi Google Drive belum terhubung atau token kadaluarsa.');
  }

  const allScannedFiles: DriveFileItem[] = [];

  if (scope === 'vaults') {
    const { getVaults } = await import('./excel-db');
    const vaults = await getVaults();
    const targetFolderIds = vaults
      .map((v) => v.gdrive_folder_id)
      .filter((id): id is string => Boolean(id && id !== 'root'));

    if (targetFolderIds.length === 0) {
      targetFolderIds.push('root');
    }

    for (const fId of targetFolderIds) {
      let pageToken: string | undefined = undefined;
      do {
        const res = await fetchDriveFiles(authToken, {
          folderId: fId,
          pageSize: 1000,
          pageToken,
        });
        const regularFiles = res.files.filter((f) => !f.isFolder);
        allScannedFiles.push(...regularFiles);
        pageToken = res.nextPageToken;
      } while (pageToken && allScannedFiles.length < maxFilesToScan);
    }
  } else {
    // Single folder or all
    const targetFolder = scope === 'folder' && folderId ? folderId : 'root';
    let pageToken: string | undefined = undefined;
    do {
      const res = await fetchDriveFiles(authToken, {
        folderId: targetFolder,
        pageSize: 1000,
        pageToken,
      });
      const regularFiles = res.files.filter((f) => !f.isFolder);
      allScannedFiles.push(...regularFiles);
      pageToken = res.nextPageToken;
    } while (pageToken && allScannedFiles.length < maxFilesToScan);
  }

  // Deduplicate entries by file ID in case multiple folders reference the same file
  const uniqueFileMap = new Map<string, DriveFileItem>();
  for (const f of allScannedFiles) {
    if (f.id && !uniqueFileMap.has(f.id)) {
      uniqueFileMap.set(f.id, f);
    }
  }
  const fileList = Array.from(uniqueFileMap.values());

  // Group files by duplicate matching criteria
  const groupMap = new Map<
    string,
    {
      matchType: 'checksum' | 'name_size' | 'normalized_name_size';
      keySummary: string;
      files: DriveFileItem[];
    }
  >();

  for (const file of fileList) {
    const size = file.size || 0;
    const nameLower = (file.name || '').trim().toLowerCase();
    const normNameLower = normalizeFileNameForDuplicate(file.name || '').toLowerCase();

    let key = '';
    let matchType: 'checksum' | 'name_size' | 'normalized_name_size' = 'name_size';
    let keySummary = '';

    if (matchStrategy === 'checksum_only') {
      if (file.md5Checksum) {
        key = `chk:${file.md5Checksum}`;
        matchType = 'checksum';
        keySummary = `MD5: ${file.md5Checksum.slice(0, 8)}... (${formatBytes(size)})`;
      }
    } else if (matchStrategy === 'exact_name_size') {
      key = `exact:${nameLower}:${size}`;
      matchType = 'name_size';
      keySummary = `${file.name} (${formatBytes(size)})`;
    } else if (matchStrategy === 'normalized_name_size') {
      key = `norm:${normNameLower}:${size}`;
      matchType = 'normalized_name_size';
      keySummary = `Mirip: ${normNameLower} (${formatBytes(size)})`;
    } else {
      // Default: md5_or_name_size
      if (file.md5Checksum) {
        key = `chk:${file.md5Checksum}:${size}`;
        matchType = 'checksum';
        keySummary = `MD5 Hash Identik (${formatBytes(size)})`;
      } else {
        key = `exact:${nameLower}:${size}`;
        matchType = 'name_size';
        keySummary = `Nama & Ukuran Identik (${formatBytes(size)})`;
      }
    }

    if (!key) continue;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        matchType,
        keySummary,
        files: [],
      });
    }
    groupMap.get(key)!.files.push(file);
  }

  // Filter only groups with >1 file (actual duplicates)
  const duplicateGroups: DriveDuplicateGroup[] = [];
  const allDuplicateFileIds: string[] = [];
  let totalReclaimableBytes = 0;
  let totalDuplicatesCount = 0;

  for (const [groupKey, data] of groupMap.entries()) {
    if (data.files.length <= 1) continue;

    // Sort files according to keepStrategy
    const sorted = [...data.files].sort((a, b) => {
      const timeA = new Date(a.createdTime || a.modifiedTime || 0).getTime();
      const timeB = new Date(b.createdTime || b.modifiedTime || 0).getTime();
      if (keepStrategy === 'keep_newest') {
        return timeB - timeA; // newest first
      }
      return timeA - timeB; // oldest first (default)
    });

    const keepFile = sorted[0];
    const duplicateFiles = sorted.slice(1);

    const groupTotalSize = sorted.reduce((acc, f) => acc + (f.size || 0), 0);
    const groupReclaimable = duplicateFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    totalReclaimableBytes += groupReclaimable;
    totalDuplicatesCount += duplicateFiles.length;

    for (const dup of duplicateFiles) {
      allDuplicateFileIds.push(dup.id);
    }

    duplicateGroups.push({
      groupKey,
      matchType: data.matchType,
      keySummary: data.keySummary,
      keepFile,
      duplicateFiles,
      totalGroupSize: groupTotalSize,
      reclaimableBytes: groupReclaimable,
      reclaimableFormatted: formatBytes(groupReclaimable),
    });
  }

  // Sort groups by reclaimable size descending
  duplicateGroups.sort((a, b) => b.reclaimableBytes - a.reclaimableBytes);

  return {
    success: true,
    scannedFilesCount: fileList.length,
    duplicateGroupsCount: duplicateGroups.length,
    totalDuplicatesCount,
    reclaimableBytes: totalReclaimableBytes,
    reclaimableFormatted: formatBytes(totalReclaimableBytes),
    groups: duplicateGroups,
    allDuplicateFileIds,
    message:
      duplicateGroups.length > 0
        ? `Ditemukan ${totalDuplicatesCount} file duplikat dalam ${duplicateGroups.length} grup (${formatBytes(totalReclaimableBytes)} dapat dihemat).`
        : `Tidak ditemukan file duplikat dari ${fileList.length} file yang dipindai. Google Drive Anda bersih!`,
  };
}

/**
 * Execute Burst Deletion of duplicate files from Google Drive and clean DB references
 */
export async function burstDeleteDriveDuplicates(
  token?: string,
  options: BurstDeleteDriveDuplicatesOptions = {}
): Promise<BurstDeleteDriveDuplicatesResult> {
  const { targetFileIds, concurrency = 6, ...scanOptions } = options;

  const authToken = await getValidDriveToken(token);
  if (!authToken) {
    throw new GoogleDriveAuthError('Sesi Google Drive belum terhubung atau token kadaluarsa.');
  }

  let filesToDelete: Array<{ id: string; name: string; size: number; md5Checksum?: string }> = [];
  let scannedCount = 0;

  if (targetFileIds && targetFileIds.length > 0) {
    // Targeted file deletion
    const targetSet = new Set(targetFileIds);
    const scan = await scanDriveDuplicates(authToken, scanOptions);
    scannedCount = scan.scannedFilesCount;

    for (const group of scan.groups) {
      for (const dup of group.duplicateFiles) {
        if (targetSet.has(dup.id)) {
          filesToDelete.push({
            id: dup.id,
            name: dup.name,
            size: dup.size || 0,
            md5Checksum: dup.md5Checksum,
          });
        }
      }
    }

    // If target IDs weren't matched in scan (e.g. forced deletion), include them directly
    const foundIds = new Set(filesToDelete.map((f) => f.id));
    for (const id of targetFileIds) {
      if (!foundIds.has(id)) {
        filesToDelete.push({ id, name: id, size: 0 });
      }
    }
  } else {
    // Full scan and burst delete all duplicates
    const scan = await scanDriveDuplicates(authToken, scanOptions);
    scannedCount = scan.scannedFilesCount;

    for (const group of scan.groups) {
      for (const dup of group.duplicateFiles) {
        filesToDelete.push({
          id: dup.id,
          name: dup.name,
          size: dup.size || 0,
          md5Checksum: dup.md5Checksum,
        });
      }
    }
  }

  if (filesToDelete.length === 0) {
    return {
      success: true,
      scannedCount,
      deletedCount: 0,
      failedCount: 0,
      freedBytes: 0,
      freedFormatted: '0 B',
      deletedFiles: [],
      failedFiles: [],
      message: 'Tidak ada file duplikat yang perlu dihapus.',
    };
  }

  const deletedFiles: Array<{ id: string; name: string; size: number; md5Checksum?: string }> = [];
  const failedFiles: Array<{ id: string; name: string; error: string }> = [];
  let freedBytes = 0;

  // Process deletions in parallel chunks for maximum throughput
  const batchSize = Math.max(1, Math.min(concurrency, 10));
  for (let i = 0; i < filesToDelete.length; i += batchSize) {
    const chunk = filesToDelete.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (file) => {
        try {
          await deleteDriveFile(authToken, file.id);
          deletedFiles.push(file);
          freedBytes += file.size || 0;
        } catch (err: any) {
          console.warn(`[BURST-DELETE] Gagal menghapus file ${file.name} (${file.id}):`, err?.message || err);
          failedFiles.push({
            id: file.id,
            name: file.name,
            error: err?.message || 'Delete failed',
          });
        }
      })
    );
  }

  // Synchronously purge all deleted Google Drive file records from database
  if (deletedFiles.length > 0) {
    try {
      const { deleteBatchFilesByGdriveIds, addLog } = await import('./excel-db');
      const deletedIds = deletedFiles.map((f) => f.id);
      await deleteBatchFilesByGdriveIds(deletedIds);
      await addLog(
        'GDRIVE_BURST_DELETE_DUPLICATES',
        `Menghapus ${deletedFiles.length} file duplikat Google Drive (${formatBytes(freedBytes)} dihemat)`,
        failedFiles.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'
      );
    } catch (dbErr) {
      console.warn('[BURST-DELETE] DB sync warning:', dbErr);
    }
  }

  return {
    success: deletedFiles.length > 0 || failedFiles.length === 0,
    scannedCount,
    deletedCount: deletedFiles.length,
    failedCount: failedFiles.length,
    freedBytes,
    freedFormatted: formatBytes(freedBytes),
    deletedFiles,
    failedFiles,
    message: `⚡ Berhasil menghapus ${deletedFiles.length} file duplikat Google Drive! ${formatBytes(freedBytes)} penyimpanan telah dibebaskan.${
      failedFiles.length > 0 ? ` (${failedFiles.length} gagal)` : ''
    }`,
  };
}

