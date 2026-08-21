'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder,
  Film,
  Image as ImageIcon,
  FileText,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  DownloadCloud,
  CheckCircle2,
  HardDrive,
  UserCheck,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Save,
  Check,
  Play,
  Layers,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import {
  googleSignInDrive,
  googleLogoutDrive,
  initGoogleAuth,
  getDriveAccessToken,
  DriveFileItem,
  DriveAboutInfo,
  GoogleDriveConfig,
  DEFAULT_DRIVE_CONFIG,
} from '@/lib/google-drive';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (fileRecord: any) => void;
}

export default function GoogleDriveModal({ isOpen, onClose, onImportSuccess }: GoogleDriveModalProps) {
  const [activeTab, setActiveTab] = useState<'browser' | 'config'>('browser');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ displayName?: string; email?: string; photoURL?: string } | null>(null);
  const [aboutInfo, setAboutInfo] = useState<DriveAboutInfo | null>(null);

  // File browser state
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [folderHistory, setFolderHistory] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const currentFolder = folderHistory[folderHistory.length - 1];
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'video' | 'image' | 'folder'>('all');

  // New folder modal
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Delete confirmation
  const [itemToDelete, setItemToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import state
  const [importingId, setImportingId] = useState<string | null>(null);

  // Config state
  const [config, setConfig] = useState<GoogleDriveConfig>(DEFAULT_DRIVE_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  // Notification toast inside modal
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Auto Burst Upload & Duplicate Detection State
  const [burstSyncing, setBurstSyncing] = useState(false);
  const [publicizingAll, setPublicizingAll] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'overwrite' | 'rename'>('skip');
  const [showBurstOptions, setShowBurstOptions] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleMakeAllPublic = async () => {
    setPublicizingAll(true);
    try {
      const res = await fetch('/api/v1/drive/publicize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          all: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          `🌐 Berhasil: ${data.message || 'Semua video Google Drive telah dijadikan publik dan thumbnail diselaraskan!'}`
        );
        if (token) loadDriveData(token, currentFolder.id);
      } else {
        showToast('error', data.error?.message || 'Gagal mengubah izin Google Drive.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengubah izin video menjadi publik.');
    } finally {
      setPublicizingAll(false);
    }
  };

  const handleBurstSync = async (folderOnly: boolean = false) => {
    setBurstSyncing(true);
    try {
      const res = await fetch('/api/v1/drive/burst-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          token: token || undefined,
          duplicatePolicy,
          folderId: folderOnly && currentFolder.id !== 'root' ? currentFolder.id : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          'success',
          `⚡ Auto Burst Sync Selesai: ${data.data.newCount} file baru diimpor, ${data.data.duplicatesCount} duplikat dilewati.`
        );
        if (token) loadDriveData(token, currentFolder.id);
        if (onImportSuccess) onImportSuccess(data.data.importedFiles);
      } else {
        showToast('error', data.error?.message || 'Gagal menjalankan Burst Sync.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Koneksi burst sync gagal.');
    } finally {
      setBurstSyncing(false);
    }
  };

  // Load files and about info
  const loadDriveData = React.useCallback(async (authToken: string, folderId: string = 'root') => {
    setLoading(true);
    try {
      // 1. Load About Info
      const aboutRes = await fetch('/api/v1/drive/about', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const aboutJson = await aboutRes.json();
      if (aboutJson.success && aboutJson.data) {
        setAboutInfo(aboutJson.data);
        if (aboutJson.data.user) {
          setUser({
            displayName: aboutJson.data.user.displayName,
            email: aboutJson.data.user.emailAddress,
            photoURL: aboutJson.data.user.photoLink,
          });
        }
      }

      // 2. Load Files
      const params = new URLSearchParams({
        folderId,
        q: searchQuery,
      });
      if (filterType !== 'all') {
        params.set('filter', filterType);
      }

      const filesRes = await fetch(`/api/v1/drive/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const filesJson = await filesRes.json();
      if (filesJson.success && Array.isArray(filesJson.data)) {
        setFiles(filesJson.data);
      } else {
        showToast('error', filesJson.error?.message || 'Gagal memuat daftar file Google Drive');
      }
    } catch (err: any) {
      console.error('Error loading Google Drive:', err);
      showToast('error', err.message || 'Koneksi ke Google Drive gagal.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType]);

  // 1. Initialize auth listener & fetch initial config & Firestore Session
  useEffect(() => {
    if (!isOpen) return;

    // Load persistent config
    fetch('/api/v1/drive/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setConfig(data.config);
        }
      })
      .catch((e) => console.warn('Failed to fetch Drive config:', e));

    // Load permanent session from Firestore
    fetch('/api/v1/drive/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.authenticated && data.user) {
          setUser(data.user);
          if (data.storageQuota) {
            setAboutInfo({
              user: {
                displayName: data.user.displayName || '',
                emailAddress: data.user.email || '',
                photoLink: data.user.photoURL || '',
              },
              storageQuota: data.storageQuota,
            });
          }
          // Request file listing with the valid session
          loadDriveData('', currentFolder.id);
        }
      })
      .catch((e) => console.warn('Failed to check Firestore Drive session:', e));

    // Check in-memory token
    const existingToken = getDriveAccessToken();
    if (existingToken) {
      setToken(existingToken);
      loadDriveData(existingToken, currentFolder.id);
    }

    // Subscribe to Firebase Auth state
    const unsubscribe = initGoogleAuth(
      async (u, t) => {
        const userObj = {
          displayName: u.displayName || undefined,
          email: u.email || undefined,
          photoURL: u.photoURL || undefined,
        };
        setUser(userObj);
        setToken(t);
        loadDriveData(t, currentFolder.id);

        // Auto-persist session to Firestore
        try {
          await fetch('/api/v1/drive/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: t,
              user: userObj,
              domain: 'https://teledriveggjsjjj.onrender.com',
            }),
          });
        } catch (err) {
          console.warn('Could not auto-persist popup session to Firestore:', err);
        }
      },
      () => {
        // Not logged in or needs sign in
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, currentFolder.id, loadDriveData]);

  // Sign in with Google Popup and save permanently to Firestore
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const res = await googleSignInDrive();
      if (res && res.accessToken) {
        setToken(res.accessToken);
        const userObj = {
          displayName: res.user.displayName || undefined,
          email: res.user.email || undefined,
          photoURL: res.user.photoURL || undefined,
        };
        setUser(userObj);

        // Save session permanently to Firestore
        try {
          await fetch('/api/v1/drive/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: res.accessToken,
              user: userObj,
              domain: 'https://teledriveggjsjjj.onrender.com',
            }),
          });
        } catch (e) {
          console.warn('Could not save session to Firestore:', e);
        }

        showToast('success', `Berhasil terhubung & tersimpan permanen di Firestore: ${res.user.email || 'Akun Google'}`);
        await loadDriveData(res.accessToken, currentFolder.id);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      showToast('error', 'Gagal login Google Drive: ' + (err.message || 'Pop-up ditutup.'));
    } finally {
      setLoading(false);
    }
  };

  // Direct OAuth Authorization flow for Render domain
  const handleDirectOAuthRedirect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/drive/auth/url');
      const data = await res.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        showToast('error', data.error?.message || 'Gagal memulai otorisasi OAuth.');
        setLoading(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal terhubung ke Google OAuth.');
      setLoading(false);
    }
  };

  // Logout from Google & clear Firestore session
  const handleLogout = async () => {
    await googleLogoutDrive();
    try {
      await fetch('/api/v1/drive/session', { method: 'DELETE' });
    } catch (e) {}
    setToken(null);
    setUser(null);
    setAboutInfo(null);
    setFiles([]);
    showToast('info', 'Sesi Google Drive diputus dan dibersihkan dari Firestore.');
  };

  // Folder navigation
  const navigateToFolder = (folderId: string, folderName: string) => {
    const newHist = [...folderHistory, { id: folderId, name: folderName }];
    setFolderHistory(newHist);
    if (token) loadDriveData(token, folderId);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newHist = folderHistory.slice(0, index + 1);
    setFolderHistory(newHist);
    const target = newHist[newHist.length - 1];
    if (token) loadDriveData(token, target.id);
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const res = await fetch('/api/v1/drive/folder', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderName: newFolderName.trim(),
          parentFolderId: currentFolder.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Folder berhasil dibuat.');
        setNewFolderName('');
        setIsNewFolderOpen(false);
        loadDriveData(token, currentFolder.id);
      } else {
        showToast('error', data.error?.message || 'Gagal membuat folder.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal membuat folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Import file to Rullzye Cloud Firestore
  const handleImportFile = async (file: DriveFileItem) => {
    setImportingId(file.id);
    try {
      const res = await fetch('/api/v1/drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size || 0,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          thumbnailLink: file.thumbnailLink,
          vaultId: 'vault_media',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `"${file.name}" berhasil diimpor ke RULLZYE CLOUD!`);
        if (onImportSuccess && data.file) {
          onImportSuccess(data.file);
        }
      } else {
        showToast('error', data.error?.message || 'Gagal mengimpor file.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengimpor file.');
    } finally {
      setImportingId(null);
    }
  };

  // Delete file from Google Drive (Mandatory Workspace confirmation)
  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !token) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/v1/drive/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: itemToDelete.id,
          fileName: itemToDelete.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Item dihapus dari Google Drive.');
        setItemToDelete(null);
        loadDriveData(token, currentFolder.id);
      } else {
        showToast('error', data.error?.message || 'Gagal menghapus item.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus item');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save config permanently
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/v1/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setConfigSavedToast(true);
        setTimeout(() => setConfigSavedToast(false), 4000);
        showToast('success', 'Konfigurasi Google Drive berhasil disimpan di config.json & Firestore!');
      } else {
        showToast('error', data.error?.message || 'Gagal menyimpan konfigurasi.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setSavingConfig(false);
    }
  };

  // Helper formatting
  const formatBytes = (bytes?: number | string) => {
    if (!bytes) return '0 B';
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Google Drive Storage & Sync</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Dual-Persistence
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tersimpan permanen di <code className="text-amber-400 font-mono">config.json</code> &amp; Firestore untuk migrasi hosting tanpa konfigurasi ulang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls & Auth Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('browser')}
              className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition ${
                activeTab === 'browser'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Drive File Explorer</span>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition ${
                activeTab === 'config'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Konfigurasi Codebase</span>
            </button>
          </div>

          {/* User Account Pill / Google Login */}
          <div>
            {token && user ? (
              <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl px-3 py-1.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Google'} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="text-left leading-none">
                  <div className="text-xs font-medium text-white">{user.displayName || 'Google User'}</div>
                  <div className="text-[10px] text-slate-400">{user.email || ''}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Putus Tautan Google Drive"
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="gsi-material-button bg-white hover:bg-slate-100 text-slate-800 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow transition active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{loading ? 'Menghubungkan...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Storage Quota Bar (If Connected) */}
        {aboutInfo && aboutInfo.storageQuota && (
          <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>Google Drive Quota:</span>
              <strong className="text-white">
                {formatBytes(aboutInfo.storageQuota.usage)} / {formatBytes(aboutInfo.storageQuota.limit)}
              </strong>
              <span className="text-slate-500">
                ({Math.round((parseInt(aboutInfo.storageQuota.usage || '0', 10) / Math.max(1, parseInt(aboutInfo.storageQuota.limit || '1', 10))) * 100)}% terpakai)
              </span>
            </div>
            <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (parseInt(aboutInfo.storageQuota.usage || '0', 10) /
                        Math.max(1, parseInt(aboutInfo.storageQuota.limit || '1', 10))) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Modal Toast Notice */}
        {toastMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
              toastMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : toastMsg.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}
          >
            <span>{toastMsg.text}</span>
            <button onClick={() => setToastMsg(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'browser' ? (
            <div>
              {!token && !user ? (
                /* Unauthenticated State */
                <div className="text-center py-12 px-4 max-w-xl mx-auto">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
                    <HardDrive className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Hubungkan Akun Google Drive Anda</h3>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Akses, jelajahi, dan impor video atau media langsung dari Google Drive ke RULLZYE CLOUD. Sesi login akan disimpan secara <strong>permanen di Firestore</strong> dan aman saat migrasi hosting/domain.
                  </p>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl mb-6 text-left text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Domain Otorisasi Resmi:</span>
                      <strong className="text-amber-400 font-mono">https://teledriveggjsjjj.onrender.com</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Penyimpanan Sesi:</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Firestore Database (Permanen)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-5 py-3 rounded-2xl shadow-xl transition active:scale-95 text-xs"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>{loading ? 'Menghubungkan...' : 'Login Popup Google Drive'}</span>
                    </button>

                    <button
                      onClick={handleDirectOAuthRedirect}
                      disabled={loading}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold px-5 py-3 rounded-2xl border border-slate-700 shadow-xl transition active:scale-95 text-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Otorisasi Langsung (Render Domain)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Authenticated Drive Browser */
                <div className="space-y-4">
                  {/* Explorer Top Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto py-1">
                      {folderHistory.map((item, idx) => (
                        <React.Fragment key={item.id}>
                          <button
                            onClick={() => navigateToBreadcrumb(idx)}
                            className={`px-2.5 py-1 rounded-lg hover:bg-slate-800 transition whitespace-nowrap ${
                              idx === folderHistory.length - 1 ? 'font-bold text-amber-400 bg-slate-800/80' : 'text-slate-300'
                            }`}
                          >
                            {item.name}
                          </button>
                          {idx < folderHistory.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                      {/* Auto Burst Sync Button */}
                      <div className="relative">
                        <button
                          onClick={() => handleBurstSync(false)}
                          disabled={burstSyncing || loading}
                          title="Auto Burst Upload & Sync dari Google Drive dengan Deteksi Duplikat"
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${burstSyncing ? 'animate-spin' : ''}`} />
                          <span>{burstSyncing ? 'Burst Syncing...' : '⚡ Auto Burst Sync'}</span>
                        </button>
                      </div>

                      {/* Publicize All Button */}
                      <button
                        onClick={handleMakeAllPublic}
                        disabled={publicizingAll || loading}
                        title="Ubah semua video Google Drive menjadi publik (Bisa ditonton semua orang tanpa login) dan render thumbnail"
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <ShieldCheck className={`w-3.5 h-3.5 ${publicizingAll ? 'animate-spin' : ''}`} />
                        <span>{publicizingAll ? 'Memproses Publik...' : '🌐 Jadikan Semua Publik'}</span>
                      </button>

                      {/* Duplicate Policy Selector */}
                      <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1 text-[11px]">
                        <span className="text-slate-400">Duplikat:</span>
                        <select
                          value={duplicatePolicy}
                          onChange={(e) => setDuplicatePolicy(e.target.value as any)}
                          className="bg-transparent text-amber-400 font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="skip" className="bg-slate-900 text-white">Lewati (Skip)</option>
                          <option value="overwrite" className="bg-slate-900 text-white">Timpa (Overwrite)</option>
                          <option value="rename" className="bg-slate-900 text-white">Ganti Nama (Rename)</option>
                        </select>
                      </div>

                      <button
                        onClick={() => setIsNewFolderOpen(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Folder Baru</span>
                      </button>
                      <button
                        onClick={() => token && loadDriveData(token, currentFolder.id)}
                        disabled={loading}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                        title="Segarkan"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && token && loadDriveData(token, currentFolder.id)}
                        placeholder="Cari file di Google Drive..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                      <button
                        onClick={() => {
                          setFilterType('all');
                          if (token) loadDriveData(token, currentFolder.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        onClick={() => {
                          setFilterType('video');
                          if (token) loadDriveData(token, currentFolder.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          filterType === 'video' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Video
                      </button>
                      <button
                        onClick={() => {
                          setFilterType('image');
                          if (token) loadDriveData(token, currentFolder.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          filterType === 'image' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Gambar
                      </button>
                      <button
                        onClick={() => {
                          setFilterType('folder');
                          if (token) loadDriveData(token, currentFolder.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          filterType === 'folder' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Folder
                      </button>
                    </div>
                  </div>

                  {/* File List Grid */}
                  {loading ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
                      <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                      <p className="text-xs">Memuat konten Google Drive...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 bg-slate-950/40 border border-slate-800 rounded-2xl">
                      <Folder className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                      <p className="text-sm font-medium text-slate-400">Tidak ada file atau folder ditemukan.</p>
                      <p className="text-xs text-slate-600 mt-1">Gunakan tombol Folder Baru atau cari nama file lain.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {files.map((item) => {
                        const isVid = item.mimeType?.startsWith('video/');
                        const isImg = item.mimeType?.startsWith('image/');
                        const isFol = item.isFolder;

                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-2xl border transition group flex flex-col justify-between ${
                              isFol
                                ? 'bg-slate-950 hover:bg-slate-850 border-slate-800 hover:border-amber-500/50 cursor-pointer'
                                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            }`}
                            onClick={() => {
                              if (isFol) navigateToFolder(item.id, item.name);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              {/* Thumbnail / Icon */}
                              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                {item.thumbnailLink ? (
                                  <img
                                    src={item.thumbnailLink}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : isFol ? (
                                  <Folder className="w-6 h-6 text-amber-400" />
                                ) : isVid ? (
                                  <Film className="w-6 h-6 text-sky-400" />
                                ) : isImg ? (
                                  <ImageIcon className="w-6 h-6 text-emerald-400" />
                                ) : (
                                  <FileText className="w-6 h-6 text-slate-400" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>{isFol ? 'Folder' : formatBytes(item.size)}</span>
                                  {item.modifiedTime && (
                                    <span>• {new Date(item.modifiedTime).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions on Item */}
                            {!isFol && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImportFile(item);
                                  }}
                                  disabled={importingId === item.id}
                                  className="flex-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                                >
                                  {importingId === item.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <DownloadCloud className="w-3 h-3" />
                                  )}
                                  <span>{importingId === item.id ? 'Mengimpor...' : 'Impor ke Cloud'}</span>
                                </button>

                                {item.webViewLink && (
                                  <a
                                    href={item.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
                                    title="Buka di Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete(item);
                                  }}
                                  className="p-1.5 bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 hover:border-rose-500/30 transition"
                                  title="Hapus dari Google Drive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Config & Dual Persistence Tab */
            <form onSubmit={handleSaveConfig} className="space-y-6 max-w-2xl mx-auto">
              {/* Migration-Safe Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">Konfigurasi Permanen Aman Migrasi Hosting</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Pengaturan Google Drive di bawah otomatis disinkronkan ke berkas <strong><code>config.json</code></strong> di root repositori dan <strong>Firestore database</strong>. Saat aplikasi dipindahkan ke VPS/Render/server baru, konfigurasi tidak akan hilang atau perlu diatur ulang.
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block">Aktifkan Integrasi Google Drive</label>
                    <span className="text-[11px] text-slate-400">Izinkan sinkronisasi dan impor dari Google Drive</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block">Auto-Sync Video Baru ke Google Drive</label>
                    <span className="text-[11px] text-slate-400">Simpan salinan cadangan video yang diunggah ke Google Drive</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.sync_videos}
                    onChange={(e) => setConfig({ ...config, sync_videos: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block">Auto-Backup Database ke Google Drive</label>
                    <span className="text-[11px] text-slate-400">Simpan salinan berkas database JSON ke folder Drive utama</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.auto_backup}
                    onChange={(e) => setConfig({ ...config, auto_backup: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>
              </div>

              {/* Folders & OAuth Settings */}
              <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Nama Folder Google Drive Default
                  </label>
                  <input
                    type="text"
                    value={config.folder_name}
                    onChange={(e) => setConfig({ ...config, folder_name: e.target.value })}
                    placeholder="RULLZYE CLOUD"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Folder ID Google Drive (Opsional)
                  </label>
                  <input
                    type="text"
                    value={config.folder_id}
                    onChange={(e) => setConfig({ ...config, folder_id: e.target.value })}
                    placeholder="root atau ID folder Drive spesifik"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Gunakan &quot;root&quot; untuk menyimpan di direktori utama Drive.</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    OAuth Client ID
                  </label>
                  <input
                    type="text"
                    value={config.client_id}
                    onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono focus:outline-none focus:border-amber-500"
                    readOnly
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Client ID tersambung ke konfigurasi Firebase OAuth applet.</p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {configSavedToast && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Tersimpan di config.json &amp; Firestore
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
                >
                  {savingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Simpan ke Codebase &amp; Database</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Create Folder Modal */}
        {isNewFolderOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-2">Buat Folder di Google Drive</h3>
              <p className="text-xs text-slate-400 mb-4">
                Folder baru akan dibuat di dalam folder <strong>&quot;{currentFolder.name}&quot;</strong>.
              </p>
              <form onSubmit={handleCreateFolder} className="space-y-4">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Nama folder baru..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewFolderOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creatingFolder || !newFolderName.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {creatingFolder && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>Buat Folder</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog (Mandatory Workspace Confirmation) */}
        {itemToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Konfirmasi Hapus dari Google Drive</h3>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Apakah Anda yakin ingin menghapus <strong>&quot;{itemToDelete.name}&quot;</strong> dari Google Drive Anda? Tindakan ini akan memindahkan item ke tempat sampah Google Drive.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isDeleting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Ya, Hapus Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
