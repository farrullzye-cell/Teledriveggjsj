import crypto from 'crypto';
import { getConfigMap } from './excel-db';

export interface ImageKitCredentials {
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
  enabled: boolean;
  defaultFolder: string;
}

export interface ImageKitUploadResult {
  ok: boolean;
  fileId?: string;
  name?: string;
  url?: string;
  thumbnailUrl?: string;
  size?: number;
  filePath?: string;
  fileType?: string;
  mime?: string;
  error?: string;
  raw?: any;
}

export interface ImageKitAuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

/**
 * Retrieve current active ImageKit credentials from config / environment
 */
export async function getImageKitCredentials(): Promise<ImageKitCredentials> {
  const config = await getConfigMap();
  const publicKey = config.imagekit_public_key || process.env.IMAGEKIT_PUBLIC_KEY || '';
  const privateKey = config.imagekit_private_key || process.env.IMAGEKIT_PRIVATE_KEY || '';
  let urlEndpoint = config.imagekit_url_endpoint || process.env.IMAGEKIT_URL_ENDPOINT || '';
  
  if (urlEndpoint && urlEndpoint.endsWith('/')) {
    urlEndpoint = urlEndpoint.slice(0, -1);
  }

  const enabled = config.imagekit_enabled !== undefined 
    ? Boolean(config.imagekit_enabled) 
    : Boolean(publicKey && privateKey && urlEndpoint);

  const defaultFolder = config.imagekit_default_folder || '/rullzye_cloud';

  return {
    publicKey,
    privateKey,
    urlEndpoint,
    enabled,
    defaultFolder,
  };
}

/**
 * Test connectivity & credentials with ImageKit.io API
 */
export async function testImageKitConnection(
  publicKey?: string,
  privateKey?: string,
  urlEndpoint?: string
): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    const creds = await getImageKitCredentials();
    const finalPub = publicKey || creds.publicKey;
    const finalPriv = privateKey || creds.privateKey;
    const finalEndpoint = urlEndpoint || creds.urlEndpoint;

    if (!finalPriv) {
      return { ok: false, message: 'Private Key ImageKit belum diisi.' };
    }
    if (!finalPub) {
      return { ok: false, message: 'Public Key ImageKit belum diisi.' };
    }
    if (!finalEndpoint) {
      return { ok: false, message: 'URL Endpoint ImageKit belum diisi (contoh: https://ik.imagekit.io/username).' };
    }

    const authHeader = 'Basic ' + Buffer.from(finalPriv + ':').toString('base64');

    // Query ImageKit files endpoint with limit=1 to verify auth
    const res = await fetch('https://api.imagekit.io/v1/files?limit=1', {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.message || data.help || `HTTP Error ${res.status}`;
      return {
        ok: false,
        message: `Koneksi ImageKit gagal: ${errMsg}`,
        details: data,
      };
    }

    return {
      ok: true,
      message: '✅ Koneksi ImageKit.io Berhasil Terverifikasi! Kunci API aktif dan siap digunakan.',
      details: {
        urlEndpoint: finalEndpoint,
        publicKey: finalPub,
        sampleFilesCount: Array.isArray(data) ? data.length : 0,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      message: 'Gagal menghubungi server ImageKit.io: ' + (err.message || 'Network error'),
    };
  }
}

/**
 * Upload Buffer, Base64, or Remote URL to ImageKit.io
 */
export async function uploadToImageKit(options: {
  file: Buffer | string; // Buffer, Base64 string, or remote HTTP URL
  fileName: string;
  folder?: string;
  tags?: string[];
  useUniqueFileName?: boolean;
  customCoordinates?: string;
}): Promise<ImageKitUploadResult> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'ImageKit Private Key tidak dikonfigurasi.' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const folder = options.folder || creds.defaultFolder || '/rullzye_cloud';

    const formData = new FormData();

    if (Buffer.isBuffer(options.file)) {
      const blob = new Blob([new Uint8Array(options.file)]);
      formData.append('file', blob, options.fileName);
    } else {
      formData.append('file', options.file);
    }

    formData.append('fileName', options.fileName);
    formData.append('folder', folder);
    formData.append('useUniqueFileName', options.useUniqueFileName !== false ? 'true' : 'false');

    if (options.tags && options.tags.length > 0) {
      formData.append('tags', options.tags.join(','));
    }

    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || !data.fileId) {
      const errMsg = data.message || data.help || `Upload failed with status ${res.status}`;
      return { ok: false, error: errMsg, raw: data };
    }

    // Determine smart thumbnail
    let thumbnailUrl = data.thumbnailUrl || '';
    const isVideo = options.fileName.match(/\.(mp4|mkv|webm|mov|avi|m4v)$/i) || data.fileType === 'non-image';
    if (isVideo && data.url) {
      // ImageKit video snapshot transformation
      thumbnailUrl = `${data.url}/ik-thumbnail.jpg?tr=so-1,w-480`;
    } else if (data.fileType === 'image' && data.url) {
      thumbnailUrl = `${data.url}?tr=w-480,fo-auto`;
    }

    return {
      ok: true,
      fileId: data.fileId,
      name: data.name,
      url: data.url,
      thumbnailUrl: thumbnailUrl || data.url,
      size: data.size,
      filePath: data.filePath,
      fileType: data.fileType,
      raw: data,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: 'ImageKit upload exception: ' + (err.message || 'Unknown error'),
    };
  }
}

/**
 * Delete a file from ImageKit.io
 */
export async function deleteFromImageKit(fileId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: authHeader,
      },
    });

    if (res.status === 204 || res.status === 200) {
      return { ok: true };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Update file details or rename in ImageKit.io
 */
export async function updateImageKitFileDetails(
  fileId: string,
  updates: { tags?: string[]; customCoordinates?: string }
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
      method: 'PATCH',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, data };
    }
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Move a file within ImageKit folder structure
 */
export async function moveImageKitFile(
  sourceFilePath: string,
  destinationPath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const res = await fetch('https://api.imagekit.io/v1/files/move', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceFilePath,
        destinationPath,
      }),
    });

    if (res.status === 204 || res.status === 200) {
      return { ok: true };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get metadata of a file from ImageKit.io
 */
export async function getImageKitFileMetadata(fileId: string): Promise<{ ok: boolean; metadata?: any; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/metadata`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, metadata: data };
    }
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get detailed file information from ImageKit.io
 */
export async function getImageKitFileDetails(fileId: string): Promise<{ ok: boolean; file?: any; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, file: data };
    }
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * List files from ImageKit.io folder
 */
export async function listImageKitFiles(folder?: string, limit = 50): Promise<{ ok: boolean; files?: any[]; error?: string }> {
  try {
    const creds = await getImageKitCredentials();
    if (!creds.privateKey) {
      return { ok: false, error: 'Private Key missing' };
    }

    const authHeader = 'Basic ' + Buffer.from(creds.privateKey + ':').toString('base64');
    const pathQuery = folder ? `&path=${encodeURIComponent(folder)}` : '';
    const res = await fetch(`https://api.imagekit.io/v1/files?limit=${limit}${pathQuery}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ([]));
    if (res.ok && Array.isArray(data)) {
      return { ok: true, files: data };
    }
    return { ok: false, error: data.message || `Status ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Generate client-side authentication parameters for direct frontend uploads
 */
export async function generateImageKitAuthParams(): Promise<ImageKitAuthParams | { error: string }> {
  const creds = await getImageKitCredentials();
  if (!creds.privateKey || !creds.publicKey) {
    return { error: 'ImageKit credentials not configured' };
  }

  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes valid

  const signature = crypto
    .createHmac('sha1', creds.privateKey)
    .update(token + expire)
    .digest('hex');

  return {
    token,
    expire,
    signature,
    publicKey: creds.publicKey,
    urlEndpoint: creds.urlEndpoint,
  };
}

/**
 * Generate an optimized video streaming URL with transformations
 */
export function formatImageKitVideoUrl(baseUrl: string, options?: { quality?: number; width?: number; height?: number }): string {
  if (!baseUrl || !baseUrl.includes('imagekit.io')) {
    return baseUrl;
  }

  const trs: string[] = [];
  if (options?.quality) trs.push(`q-${options.quality}`);
  if (options?.width) trs.push(`w-${options.width}`);
  if (options?.height) trs.push(`h-${options.height}`);

  if (trs.length === 0) return baseUrl;

  const trString = `tr=${trs.join(',')}`;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${trString}`;
}

/**
 * Generate transformed URL for images or thumbnails
 */
export function generateImageKitThumbnailUrl(url: string, type: string = 'image'): string {
  if (!url || !url.includes('imagekit.io')) {
    return url;
  }

  if (type === 'video' || url.match(/\.(mp4|mkv|webm|mov|avi|m4v)/i)) {
    return url.includes('ik-thumbnail.jpg') ? url : `${url}/ik-thumbnail.jpg?tr=so-1,w-480`;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}tr=w-480,fo-auto`;
}

