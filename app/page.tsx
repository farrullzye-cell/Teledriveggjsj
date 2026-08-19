'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BulkVideoToolsModal from '@/components/BulkVideoToolsModal';
import BotLogsModal from '@/components/BotLogsModal';
import StorageMigrationModal from '@/components/StorageMigrationModal';
import MonetizationModal from '@/components/MonetizationModal';
import GoogleDriveModal from '@/components/GoogleDriveModal';
import {
  subscribeToAdminAuth,
  signInWithGoogleAdmin,
  signOutAdmin,
  ALLOWED_ADMIN_EMAIL,
} from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  HardDrive,
  Upload,
  Cloud,
  Search,
  Image as ImageIcon,
  Video,
  FileText,
  Archive,
  File,
  Download,
  Trash2,
  Settings,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  FolderOpen,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  LogOut,
  Eye,
  Copy,
  Check,
  Info,
  Maximize2,
  Film,
  Folder,
  Layers,
  MoveRight,
  Terminal,
  Cpu,
  Activity,
  Globe,
  Server,
  Code,
  Palette,
  Monitor,
  Zap,
  BarChart3,
  Play,
  Edit2,
  Key,
} from 'lucide-react';

interface VaultTopic {
  id: string;
  name: string;
  topic_id?: string;
  icon?: string;
  color?: string;
  description?: string;
  is_private?: boolean;
  fileCount?: number;
  totalSize?: number;
}

interface FileRecord {
  id: string;
  name: string;
  type: string; // image | video | document | archive | other
  mime: string;
  size: number;
  telegram_file_id: string;
  telegram_message_id: string;
  telegram_chat_id: string;
  uploaded_at: string;
  vault_id?: string;
  vault_name?: string;
  views?: number;
  likes?: number;
  thumbnail_file_id?: string;
  thumbnail_base64?: string;
  imagekit_file_id?: string;
  imagekit_url?: string;
  imagekit_thumbnail_url?: string;
  storage_provider?: 'telegram' | 'imagekit' | 'both';
}

// Client-side video thumbnail snapshot helper for ultra-fast previews
function extractVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      video.onloadeddata = () => {
        video.currentTime = Math.min(1.0, (video.duration && video.duration > 1) ? 1.0 : 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 480;
          let w = video.videoWidth || 640;
          let h = video.videoHeight || 360;
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            URL.revokeObjectURL(url);
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Canvas capture error:', e);
        }
        URL.revokeObjectURL(url);
        resolve('');
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve('');
      }, 3500);
    } catch (e) {
      resolve('');
    }
  });
}

export default function GalleryPage() {
  const [websiteName, setWebsiteName] = useState('RULLZYE CLOUD');
  const [panelTheme, setPanelTheme] = useState<'pterodactyl' | 'terminal' | 'datacenter' | 'cyberpunk'>('pterodactyl');
  const [isMounted, setIsMounted] = useState(false);
  const [isTerminalLogsOpen, setIsTerminalLogsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PHOTOS' | 'VIDEOS' | 'FILES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync saved theme after initial mount to prevent Next.js hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('panelTheme');
    if (saved && ['pterodactyl', 'terminal', 'datacenter', 'cyberpunk'].includes(saved)) {
      setPanelTheme(saved as any);
    }
  }, []);

  const handleThemeSwitch = (theme: 'pterodactyl' | 'terminal' | 'datacenter' | 'cyberpunk') => {
    setPanelTheme(theme);
    localStorage.setItem('panelTheme', theme);
  };

  // Vault Topics States
  const [vaults, setVaults] = useState<VaultTopic[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string>('ALL');
  const [selectedUploadVault, setSelectedUploadVault] = useState<string>('vault_general');

  // Modal Create Vault state
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultIcon, setNewVaultIcon] = useState('Folder');
  const [newVaultColor, setNewVaultColor] = useState('amber');
  const [newVaultDescription, setNewVaultDescription] = useState('');
  const [createTelegramTopicCheck, setCreateTelegramTopicCheck] = useState(true);
  const [creatingVault, setCreatingVault] = useState(false);

  // Modal Move File to Vault state
  const [fileToMove, setFileToMove] = useState<FileRecord | null>(null);
  const [targetVaultId, setTargetVaultId] = useState<string>('vault_general');
  const [movingFile, setMovingFile] = useState(false);

  // Upload modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | File[] | null>(null);
  const [uploadCustomName, setUploadCustomName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rename File modal states
  const [fileToRename, setFileToRename] = useState<FileRecord | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renamingFile, setRenamingFile] = useState(false);

  // Delete modal states
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit Stats (Views & Likes) state
  const [fileToEditStats, setFileToEditStats] = useState<FileRecord | null>(null);
  const [editViewsInput, setEditViewsInput] = useState<string>('0');
  const [editLikesInput, setEditLikesInput] = useState<string>('0');
  const [savingStats, setSavingStats] = useState(false);

  // Telegram Bot Live Status & Auto-Poller state
  const [botUsername, setBotUsername] = useState('');
  const [botName, setBotName] = useState('');
  const [isBotPolling, setIsBotPolling] = useState(true);
  const [processedEvents, setProcessedEvents] = useState(0);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [webhookUrlSet, setWebhookUrlSet] = useState('');

  // Fullscreen Preview modal states
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'VIEW' | 'METADATA'>('VIEW');
  const [isVideoBuffering, setIsVideoBuffering] = useState(true);

  // Bulk Video Tools Modal state
  const [isBulkVideoOpen, setIsBulkVideoOpen] = useState(false);

  // Storage & ImageKit Migration Modal state
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  // Monetization & Adsterra Smartlinks Modal state
  const [isMonetizationOpen, setIsMonetizationOpen] = useState(false);

  // Google Drive Modal state
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);

  // Live Bot Request Logs Modal state
  const [isBotLogsOpen, setIsBotLogsOpen] = useState(false);

  // Firebase Google Auth State for Super Admin (farrullzye@gmail.com)
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);

  // Subscribe to Firebase Auth changes with single-email whitelist protection
  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((user, isAuthorized) => {
      setAdminUser(user);
      setIsAuthorizedAdmin(isAuthorized);
      setAuthLoading(false);
      if (user && !isAuthorized) {
        setAuthError(
          `Akses Ditolak: Akun Google (${user.email}) tidak memiliki izin. Hanya ${ALLOWED_ADMIN_EMAIL} yang diizinkan masuk ke panel ini.`
        );
      } else if (isAuthorized) {
        setAuthError('');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleAdminLogin = async () => {
    setIsSigningInGoogle(true);
    setAuthError('');
    try {
      const res = await signInWithGoogleAdmin();
      setAdminUser(res.user);
      setIsAuthorizedAdmin(true);
      showToast('success', `Selamat datang, Super Admin (${res.user.email})`);
    } catch (err: any) {
      console.error('Google Admin Sign-in Error:', err);
      setAuthError(err.message || 'Gagal login dengan Google.');
      showToast('error', err.message || 'Gagal login.');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOutAdmin();
      setAdminUser(null);
      setIsAuthorizedAdmin(false);
      showToast('info', 'Anda telah logout dari panel admin.');
    } catch (e: any) {
      console.error('Logout error:', e);
    }
  };

  // PIN verification modal for Settings
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Keyboard escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewFile) setPreviewFile(null);
        if (isUploadOpen) setIsUploadOpen(false);
        if (isBulkVideoOpen) setIsBulkVideoOpen(false);
        if (isStorageModalOpen) setIsStorageModalOpen(false);
        if (isMonetizationOpen) setIsMonetizationOpen(false);
        if (isGoogleDriveOpen) setIsGoogleDriveOpen(false);
        if (isBotLogsOpen) setIsBotLogsOpen(false);
        if (fileToDelete) setFileToDelete(null);
        if (isPinModalOpen) setIsPinModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile, isUploadOpen, isBulkVideoOpen, isStorageModalOpen, isMonetizationOpen, isGoogleDriveOpen, isBotLogsOpen, fileToDelete, isPinModalOpen]);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/status');
      const data = await res.json();
      if (data.website_name) {
        setWebsiteName(data.website_name);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVaults = async () => {
    try {
      const res = await fetch('/api/vaults');
      const data = await res.json();
      if (data.ok && Array.isArray(data.vaults)) {
        setVaults(data.vaults);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (activeTab !== 'ALL') params.set('type', activeTab);
      if (activeVaultId && activeVaultId !== 'ALL') params.set('vault_id', activeVaultId);

      const res = await fetch(`/api/files?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal memuat daftar file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadConfigAndVaults = async () => {
      try {
        const res = await fetch('/api/config/status');
        const data = await res.json();
        if (isMounted) {
          if (data.website_name) setWebsiteName(data.website_name);
          if (data.bot_username) setBotUsername(data.bot_username);
          if (data.bot_name) setBotName(data.bot_name);
        }
      } catch (e) {
        console.error(e);
      }
      fetchVaults();
    };
    loadConfigAndVaults();

    // Auto-poll telegram events & Google Drive Vault auto-detection periodically in background
    let driveSyncCounter = 0;
    const pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const pollRes = await fetch('/api/telegram/poll');
        const pollData = await pollRes.json();
        if (pollData.ok && isMounted) {
          setIsBotPolling(pollData.isPolling !== false);
          if (pollData.processedCount !== undefined) {
            setProcessedEvents(pollData.processedCount);
          }
        }
      } catch {}

      // Google Drive Vault Auto-Detection Sync every ~15 seconds (every 6 ticks)
      driveSyncCounter++;
      if (driveSyncCounter % 6 === 0) {
        try {
          const syncRes = await fetch('/api/v1/drive/sync');
          const syncData = await syncRes.json();
          if (syncData.success && syncData.data?.newCount > 0 && isMounted) {
            fetchFiles();
            fetchVaults();
            showToast('success', `Auto-Detect: ${syncData.data.newCount} file baru disinkronkan dari Google Drive Vault!`);
          }
        } catch {}
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const handleRegisterWebhook = async () => {
    setIsRegisteringWebhook(true);
    try {
      const currentOrigin = window.location.origin;
      const targetWebhookUrl = `${currentOrigin}/api/telegram/webhook`;

      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetWebhookUrl }),
      });

      const data = await res.json();
      if (data.ok) {
        setWebhookUrlSet(targetWebhookUrl);
        showToast('success', '⚡ Webhook Telegram 24/7 Berhasil Didaftarkan! Bot merespons instan.');
      } else {
        showToast('error', data.message || 'Gagal mendaftarkan Webhook.');
      }
    } catch (e: any) {
      showToast('error', 'Gagal mendaftarkan webhook: ' + e.message);
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadFiles = async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        if (activeTab !== 'ALL') params.set('type', activeTab);
        if (activeVaultId && activeVaultId !== 'ALL') params.set('vault_id', activeVaultId);

        const res = await fetch(`/api/files?${params.toString()}`);
        const data = await res.json();
        if (isMounted) {
          if (data.success) {
            setFiles(data.files || []);
          }
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (isMounted) {
          showToast('error', 'Gagal memuat daftar file');
          setLoading(false);
        }
      }
    };
    loadFiles();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery, activeVaultId]);

  // Upload handler
  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedFiles || selectedFiles.length === 0) {
      showToast('error', 'Pilih file yang akan diunggah!');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      const filesArray = Array.from(selectedFiles);
      
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        formData.append('files', file);

        // If file is a video, automatically extract a lightweight thumbnail snapshot
        if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|mkv|webm|avi)$/i)) {
          try {
            const thumbBase64 = await extractVideoThumbnail(file);
            if (thumbBase64) {
              formData.append(`thumbnail_base64_${i}`, thumbBase64);
            }
          } catch (e) {
            console.warn('Auto thumbnail extraction skipped:', e);
          }
        }
      }

      formData.append('vault_id', selectedUploadVault);
      if (uploadCustomName.trim()) {
        formData.append('custom_name', uploadCustomName.trim());
      }

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        showToast('success', data.message || 'File berhasil diunggah!');
        setIsUploadOpen(false);
        setSelectedFiles(null);
        setUploadCustomName('');
        fetchFiles();
        fetchVaults();
      } else {
        showToast('error', data.message || 'Gagal mengunggah file');
      }
    } catch (err: any) {
      showToast('error', 'Terjadi kesalahan saat mengunggah file');
    } finally {
      setUploading(false);
    }
  };

  // Rename file handler
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !renameInput.trim()) return;

    setRenamingFile(true);
    try {
      const res = await fetch(`/api/files/${fileToRename.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameInput.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Nama file berhasil diperbarui!');
        setFileToRename(null);
        if (previewFile && previewFile.id === fileToRename.id) {
          setPreviewFile({ ...previewFile, name: renameInput.trim() });
        }
        fetchFiles();
      } else {
        showToast('error', data.message || 'Gagal mengubah nama file');
      }
    } catch (err) {
      showToast('error', 'Terjadi kesalahan saat mengubah nama file');
    } finally {
      setRenamingFile(false);
    }
  };

  // Create Vault handler
  const handleCreateVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName.trim()) {
      showToast('error', 'Nama Vault Topic wajib diisi!');
      return;
    }

    setCreatingVault(true);
    try {
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVaultName,
          icon: newVaultIcon,
          color: newVaultColor,
          description: newVaultDescription,
          create_telegram_topic: createTelegramTopicCheck,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        showToast('success', data.message || 'Vault Topic berhasil dibuat!');
        setIsCreateVaultOpen(false);
        setNewVaultName('');
        setNewVaultDescription('');
        fetchVaults();
      } else {
        showToast('error', data.message || 'Gagal membuat Vault Topic');
      }
    } catch (err) {
      showToast('error', 'Terjadi kesalahan saat membuat Vault Topic');
    } finally {
      setCreatingVault(false);
    }
  };

  // Delete Vault Topic handler
  const handleDeleteVault = async (vaultId: string, vaultName: string) => {
    if (!confirm(`Yakin ingin menghapus kategori topic "${vaultName}"? File di dalamnya akan dipindahkan ke General Storage.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/vaults?id=${vaultId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        showToast('success', data.message || 'Kategori Topic berhasil dihapus!');
        if (activeVaultId === vaultId) setActiveVaultId('ALL');
        fetchVaults();
        fetchFiles();
      } else {
        showToast('error', data.message || 'Gagal menghapus kategori topic');
      }
    } catch (e) {
      showToast('error', 'Terjadi kesalahan saat menghapus topic');
    }
  };

  // Save Edit Views & Likes Stats handler
  const handleSaveStatsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToEditStats) return;

    setSavingStats(true);
    try {
      const res = await fetch('/api/files/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileToEditStats.id,
          views: parseInt(editViewsInput || '0', 10),
          likes: parseInt(editLikesInput || '0', 10),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('success', 'Jumlah Views & Likes berhasil diperbarui!');
        setFileToEditStats(null);
        fetchFiles();
      } else {
        showToast('error', data.message || 'Gagal memperbarui stats');
      }
    } catch (e) {
      showToast('error', 'Terjadi kesalahan saat memperbarui stats');
    } finally {
      setSavingStats(false);
    }
  };

  // Move File to Vault handler
  const handleMoveFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToMove || !targetVaultId) return;

    setMovingFile(true);
    try {
      const res = await fetch(`/api/files/${fileToMove.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault_id: targetVaultId }),
      });

      const data = await res.json();
      if (data.ok) {
        showToast('success', data.message);
        setFileToMove(null);
        fetchFiles();
        fetchVaults();
      } else {
        showToast('error', data.message || 'Gagal memindahkan file');
      }
    } catch (e) {
      showToast('error', 'Gagal memindahkan file');
    } finally {
      setMovingFile(false);
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/files/${fileToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        showToast('success', `File ${fileToDelete.name} berhasil dihapus`);
        setFileToDelete(null);
        fetchFiles();
      } else {
        showToast('error', data.message || 'Gagal menghapus file');
      }
    } catch (e) {
      showToast('error', 'Gagal menghapus file');
    } finally {
      setDeleting(false);
    }
  };

  // PIN modal verify
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setVerifyingPin(true);

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();

      if (data.success) {
        setIsPinModalOpen(false);
        setEnteredPin('');
        window.location.href = '/setup';
      } else {
        setPinError(data.message || 'PIN salah!');
      }
    } catch (e) {
      setPinError('Gagal memverifikasi PIN');
    } finally {
      setVerifyingPin(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-cyan-400" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-400" />;
      case 'document':
        return <FileText className="w-8 h-8 text-teal-400" />;
      case 'archive':
        return <Archive className="w-8 h-8 text-amber-400" />;
      default:
        return <File className="w-8 h-8 text-slate-400" />;
    }
  };

  const getThemeConfig = () => {
    const activeTheme = isMounted ? panelTheme : 'pterodactyl';
    switch (activeTheme) {
      case 'terminal':
        return {
          wrapper: 'bg-[#030a05] text-emerald-400 font-sans selection:bg-emerald-500 selection:text-black',
          header: 'bg-[#06190b] border-emerald-800/80 text-emerald-400',
          card: 'bg-[#06190b] border-emerald-700/60 shadow-lg',
          cardIconBg: 'bg-[#030a05] border-emerald-800/80 text-emerald-400',
          accent: 'text-emerald-400',
          accentBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          btnPrimary: 'bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20',
          badge: 'bg-emerald-950/90 text-emerald-400 border-emerald-700/80 font-mono',
          glowBorder: 'border-emerald-500',
          themeName: 'Matrix Command Terminal',
        };
      case 'datacenter':
        return {
          wrapper: 'bg-[#080e1e] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white',
          header: 'bg-[#0f172a] border-indigo-800/80 text-slate-100',
          card: 'bg-[#0f172a] border-indigo-700/60 shadow-lg',
          cardIconBg: 'bg-[#080e1e] border-slate-800 text-indigo-400',
          accent: 'text-indigo-400',
          accentBg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/20',
          badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-700/80',
          glowBorder: 'border-indigo-500',
          themeName: 'Enterprise Cloud Console',
        };
      case 'cyberpunk':
        return {
          wrapper: 'bg-[#0a0712] text-zinc-100 font-sans selection:bg-pink-500 selection:text-white',
          header: 'bg-[#150f28] border-pink-800/80 text-zinc-100',
          card: 'bg-[#150f28] border-pink-700/60 shadow-lg',
          cardIconBg: 'bg-[#0a0712] border-zinc-800 text-pink-400',
          accent: 'text-pink-400',
          accentBg: 'bg-pink-500/15 border-pink-500/40 text-pink-300',
          btnPrimary: 'bg-gradient-to-r from-pink-500 to-cyan-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-pink-500/20',
          badge: 'bg-pink-950/90 text-pink-400 border-pink-700/80',
          glowBorder: 'border-pink-500',
          themeName: 'Neon Cyberpunk Cloud',
        };
      case 'pterodactyl':
      default:
        return {
          wrapper: 'bg-[#080c16] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black',
          header: 'bg-[#0f172a] border-cyan-800/80 text-slate-100',
          card: 'bg-[#0f172a] border-cyan-700/60 shadow-lg',
          cardIconBg: 'bg-[#080c16] border-slate-800 text-cyan-400',
          accent: 'text-cyan-400',
          accentBg: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
          btnPrimary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20',
          badge: 'bg-cyan-950/90 text-cyan-400 border-cyan-700/80',
          glowBorder: 'border-cyan-500',
          themeName: 'Pterodactyl Cyber Console',
        };
    }
  };

  const theme = getThemeConfig();

  return (
    <div className={`min-h-screen ${theme.wrapper} flex flex-col transition-colors duration-300 relative`}>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 border text-xs font-semibold uppercase tracking-wider backdrop-blur-md transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-[#0c0c0c] border-emerald-500/60 text-emerald-400'
              : toast.type === 'error'
              ? 'bg-[#0c0c0c] border-rose-500/60 text-rose-400'
              : 'bg-[#0c0c0c] border-amber-500/60 text-amber-400'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <Sparkles className="w-4 h-4 text-amber-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER */}
      <header className={`min-h-[64px] sm:min-h-[80px] py-3 border-b ${theme.header} backdrop-blur-md sticky top-0 z-30 px-3.5 sm:px-8 flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-2.5 sm:gap-4 overflow-hidden">
          <div className={`w-8 h-8 ${theme.btnPrimary} rounded-lg rotate-45 flex items-center justify-center shrink-0`}>
            <div className="w-4 h-4 bg-black/60 rotate-45"></div>
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-snug">
              <span className="truncate max-w-[130px] sm:max-w-none">{websiteName}</span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider border shrink-0 ${theme.badge}`}>
                Server Panel
              </span>
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-zinc-400 truncate">
              Telegram Cloud Storage & Node Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-8 border-r border-white/10 pr-8">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-0.5">Total Repositories</p>
              <p className="text-sm font-bold text-white">{files.length} <span className={`text-[10px] ${theme.accent} font-normal`}>files</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-0.5">Node Status</p>
              <p className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>24/7 ONLINE</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsStorageModalOpen(true)}
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm shadow-amber-500/10"
            title="Buka Pusat Manajemen Storage & Migrasi ImageKit"
          >
            <Cloud className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Storage &amp; Migrasi</span>
          </button>

          <button
            onClick={() => setIsBulkVideoOpen(true)}
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-cyan-200 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm shadow-cyan-500/10"
            title="Buka Bulk Video Compressor & Uploader Engine"
          >
            <Video className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Bulk Video Studio</span>
          </button>

          <a
            href="/terabox"
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition flex items-center gap-2 text-xs font-semibold uppercase tracking-wider shadow-sm"
            title="TeraBox Remote Upload & Manager"
          >
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">TeraBox</span>
          </a>

          <button
            onClick={() => setIsGoogleDriveOpen(true)}
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-sky-200 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm shadow-sky-500/10"
            title="Buka Google Drive Storage & Sync Manager"
          >
            <HardDrive className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Google Drive</span>
          </button>

          <button
            onClick={() => setIsMonetizationOpen(true)}
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-sm shadow-amber-500/10"
            title="Buka Adsterra Smartlink & Monetization Manager"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Adsterra Smartlink</span>
          </button>

          <a
            href="/docs"
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-2 text-xs font-semibold uppercase tracking-wider shadow-sm"
            title="Buka Dokumentasi Lengkap REST API & Video Streaming"
          >
            <Code className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Docs API</span>
          </a>

          <a
            href="/public-portal"
            target="_blank"
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 transition flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            title="Buka Website Netlify & API Hub"
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Netlify & API Hub</span>
          </a>

          <button
            onClick={() => setIsPinModalOpen(true)}
            className="p-2 sm:px-4 sm:py-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-zinc-300 hover:text-white transition flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            title="Setup & Settings"
          >
            <Settings className={`w-4 h-4 ${theme.accent}`} />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* SUPER ADMIN GOOGLE PROFILE & LOGOUT */}
          {adminUser && isAuthorizedAdmin ? (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="flex items-center gap-2 bg-[#0c0c0c] border border-amber-500/40 rounded-xl px-2.5 py-1.5 shadow-sm">
                {adminUser.photoURL ? (
                  <img
                    src={adminUser.photoURL}
                    alt={adminUser.displayName || 'Admin'}
                    className="w-6 h-6 rounded-full border border-amber-400 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="hidden xl:block leading-none">
                  <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                    <span>{adminUser.displayName || 'Super Admin'}</span>
                    <span className="text-[8px] px-1 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                      AUTHORIZED
                    </span>
                  </div>
                  <div className="text-[9px] text-amber-400 font-mono mt-0.5">{adminUser.email}</div>
                </div>
                <button
                  onClick={handleAdminLogout}
                  title="Logout dari Akun Super Admin"
                  className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGoogleAdminLogin}
              disabled={isSigningInGoogle}
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              title="Login Super Admin dengan Google (farrullzye@gmail.com)"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isSigningInGoogle ? 'Login...' : 'Login Admin'}</span>
            </button>
          )}
        </div>
      </header>

      {/* FIREBASE SUPER ADMIN AUTHENTICATION GATE */}
      {authLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 text-zinc-400 gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-xs uppercase tracking-widest text-zinc-400">
            Memverifikasi Otoritas Super Admin (Firebase)...
          </p>
        </div>
      ) : !isAuthorizedAdmin ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-lg bg-[#0e0e0e] border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
                Panel Akses Super Admin
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Panel manajemen server &amp; storage ini dilindungi oleh{' '}
                <span className="text-amber-400 font-semibold">Firebase Google Authentication</span>. Hanya pemilik akun dengan email yang diizinkan yang dapat mengelola sistem ini.
              </p>
            </div>

            {/* EMAIL RESTRICTION BADGE */}
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" />
                <span>Strict Whitelist Policy</span>
              </div>
              <div className="text-xs text-zinc-300">
                Email Resmi Super Admin:{' '}
                <span className="font-mono text-amber-300 font-bold bg-black/60 px-2 py-0.5 rounded border border-amber-500/30">
                  {ALLOWED_ADMIN_EMAIL}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Login dengan akun Google selain di atas akan ditolak secara otomatis oleh sistem keamanan.
              </p>
            </div>

            {/* ERROR ALERT */}
            {authError && (
              <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 space-y-1.5 text-left">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Akses Ditolak</span>
                </div>
                <p className="text-xs text-rose-200 leading-relaxed font-sans">{authError}</p>
              </div>
            )}

            {/* GOOGLE SIGN IN BUTTON */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleGoogleAdminLogin}
                disabled={isSigningInGoogle}
                className="w-full py-3.5 px-6 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl disabled:opacity-50"
              >
                {isSigningInGoogle ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-800" />
                    <span>Memverifikasi Akun Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Login Google (Super Admin)</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-500 pt-2">
                <a href="/public-portal" target="_blank" className="hover:text-cyan-400 underline transition">
                  Website Publik Netlify &rarr;
                </a>
                <span>&bull;</span>
                <a href="/docs" target="_blank" className="hover:text-emerald-400 underline transition">
                  REST API Docs &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
      /* MAIN CONTAINER */
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-8 space-y-6 sm:space-y-8">
        {/* SERVER CONTROL PANEL DASHBOARD METRICS & THEME SWITCHER */}
        <div className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border ${theme.card} shadow-2xl space-y-4 overflow-hidden`}>
          {/* TOP METRICS ROW */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${theme.accentBg} flex items-center justify-center shrink-0 mt-0.5 sm:mt-0`}>
                <Server className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.accent}`} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                    Node Console Status
                  </h2>
                  <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-mono uppercase border shrink-0 ${theme.badge}`}>
                    {theme.themeName}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  Firestore 24/7 Cloud Persistence + Telegram Forum Storage Engine
                </p>
              </div>
            </div>

            {/* LIVE SYSTEM STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 sm:p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-2 min-w-0">
                <Activity className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.accent} shrink-0`} />
                <div className="min-w-0">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-500 block">Uptime</span>
                  <span className="font-mono text-emerald-400 font-bold text-[10px] sm:text-xs truncate block">99.99% ONLINE</span>
                </div>
              </div>

              <div className="p-2 sm:p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-2 min-w-0">
                <Cpu className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.accent} shrink-0`} />
                <div className="min-w-0">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-500 block">Node Health</span>
                  <span className="font-mono text-white font-semibold text-[10px] sm:text-xs truncate block">12ms Latency</span>
                </div>
              </div>

              <div className="p-2 sm:p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center gap-2 min-w-0">
                <HardDrive className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.accent} shrink-0`} />
                <div className="min-w-0">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-500 block">Database</span>
                  <span className="font-mono text-sky-400 font-semibold text-[10px] sm:text-xs truncate block">Firestore Active</span>
                </div>
              </div>

              <button
                onClick={() => setIsTerminalLogsOpen(true)}
                className="p-2 sm:p-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 flex items-center gap-2 transition text-left group min-w-0"
              >
                <Terminal className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.accent} shrink-0 group-hover:animate-bounce`} />
                <div className="min-w-0">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-400 block">Console Logs</span>
                  <span className={`font-mono text-[10px] sm:text-xs ${theme.accent} font-bold flex items-center gap-1 truncate`}>
                    Live Terminal &rarr;
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* THEME PRESET SWITCHER SELECTOR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Palette className={`w-3.5 h-3.5 ${theme.accent} shrink-0`} />
              <span>Pilih Style Tampilan Panel Server:</span>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => handleThemeSwitch('pterodactyl')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition flex items-center justify-center gap-1.5 border min-w-0 ${
                  panelTheme === 'pterodactyl'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-black/30 text-zinc-400 hover:text-white border-white/10'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Pterodactyl</span>
              </button>

              <button
                onClick={() => handleThemeSwitch('terminal')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition flex items-center justify-center gap-1.5 border min-w-0 ${
                  panelTheme === 'terminal'
                    ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-black/30 text-zinc-400 hover:text-white border-white/10'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Matrix</span>
              </button>

              <button
                onClick={() => handleThemeSwitch('datacenter')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition flex items-center justify-center gap-1.5 border min-w-0 ${
                  panelTheme === 'datacenter'
                    ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-md shadow-indigo-500/20'
                    : 'bg-black/30 text-zinc-400 hover:text-white border-white/10'
                }`}
              >
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Enterprise</span>
              </button>

              <button
                onClick={() => handleThemeSwitch('cyberpunk')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition flex items-center justify-center gap-1.5 border min-w-0 ${
                  panelTheme === 'cyberpunk'
                    ? 'bg-pink-600 text-white border-pink-400 font-bold shadow-md shadow-pink-500/20'
                    : 'bg-black/30 text-zinc-400 hover:text-white border-white/10'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Cyberpunk</span>
              </button>
            </div>
          </div>
          {/* TELEGRAM BOT REAL-TIME GATEWAY BAR */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-950/60 via-black/50 to-indigo-950/40 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Telegram Bot Engine: {botUsername ? `@${botUsername}` : 'ONLINE'}
                  </span>
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                    Auto-Poller Active ({processedEvents} events)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Merespons tombol interaktif, kompresi video otomatis, & upload berkas secara langsung.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsBotLogsOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                title="Buka live tracer untuk memantau request dan respons bot secara langsung"
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>📋 Live Request Logs</span>
              </button>

              <button
                onClick={handleRegisterWebhook}
                disabled={isRegisteringWebhook}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-semibold text-xs transition flex items-center gap-1.5"
                title="Daftarkan Webhook URL domain untuk respon instan tanpa polling delay"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>{isRegisteringWebhook ? 'Mendaftarkan...' : '⚡ Set Webhook (Instan)'}</span>
              </button>

              {botUsername && (
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <span>Buka Bot</span>
                  <span>&rarr;</span>
                </a>
              )}
            </div>
          </div>
        </div>
        {/* ACTION BAR: CATEGORY FILTER, SEARCH, & UPLOAD BUTTON */}
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between pb-6 border-b border-[#1a1a1a]">
          {/* CATEGORY TABS */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0c0c0c] border border-[#222222] rounded-md overflow-x-auto no-scrollbar">
            {(['ALL', 'PHOTOS', 'VIDEOS', 'FILES'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-sm text-[11px] uppercase tracking-widest font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab === 'ALL' && 'All Files'}
                {tab === 'PHOTOS' && 'Photos'}
                {tab === 'VIDEOS' && 'Videos'}
                {tab === 'FILES' && 'Documents'}
              </button>
            ))}
          </div>

          {/* SEARCH & UPLOAD */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* SEARCH INPUT */}
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search repository..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0c0c0c] border border-[#222222] focus:border-amber-500/70 rounded-md pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* BULK VIDEO TOOLS BUTTON */}
            <button
              onClick={() => setIsBulkVideoOpen(true)}
              className="py-2.5 px-4 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wider uppercase transition flex items-center gap-2 shrink-0 shadow-lg shadow-cyan-500/20"
              title="Kompresi video massal & upload dengan progress bar"
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Bulk Video Studio</span>
            </button>

            {/* UPLOAD BUTTON */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="py-2.5 px-5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs tracking-wider uppercase transition flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* MULTI-VAULT TELEGRAM TOPICS BAR */}
        <div className="bg-[#0c0c0c] border border-[#222222] rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-300">
                Multi-Vault Topic Storage Engine
              </h2>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                Telegram Forum Topics
              </span>
            </div>

            <button
              onClick={() => setIsCreateVaultOpen(true)}
              className="py-1.5 px-3 rounded-md bg-[#161616] hover:bg-[#222] border border-[#2e2e2e] text-amber-400 hover:text-amber-300 font-semibold text-[11px] uppercase tracking-wider transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Vault Topic Baru</span>
            </button>
          </div>

          {/* VAULT TOPIC PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveVaultId('ALL')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap border ${
                activeVaultId === 'ALL'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md font-semibold'
                  : 'bg-[#080808] text-zinc-400 hover:text-white border-[#222]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Semua Vault ({vaults.reduce((sum, v) => sum + (v.fileCount || 0), 0)})</span>
            </button>

            {vaults.map((vault) => (
              <div key={vault.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setActiveVaultId(vault.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap border ${
                    activeVaultId === vault.id
                      ? 'bg-amber-500 text-black border-amber-400 shadow-md font-semibold'
                      : 'bg-[#080808] text-zinc-300 hover:text-white border-[#222] hover:border-amber-500/30'
                  }`}
                >
                  {vault.is_private ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{vault.name}</span>
                  {vault.fileCount !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${activeVaultId === vault.id ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                      {vault.fileCount}
                    </span>
                  )}
                  {vault.topic_id && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${activeVaultId === vault.id ? 'bg-black/30 text-black' : 'bg-sky-950 text-sky-400 border border-sky-800/40'}`}>
                      Topic #{vault.topic_id}
                    </span>
                  )}
                </button>
                {vault.id !== 'vault_general' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVault(vault.id, vault.name);
                    }}
                    className="p-1.5 rounded-lg bg-[#080808] hover:bg-rose-950/80 text-zinc-500 hover:text-rose-400 border border-[#222] hover:border-rose-500/40 transition"
                    title={`Hapus kategori "${vault.name}"`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* FILE CARDS GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs uppercase tracking-widest">Connecting to Telegram Storage...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="bg-[#0c0c0c] border border-[#222222] rounded-xl p-16 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[#111111] border border-[#222222] flex items-center justify-center text-zinc-600">
              <FolderOpen className="w-8 h-8 text-amber-500/60" />
            </div>
            <div>
              <h3 className="text-base font-serif-italic text-white">No Files Archived</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                {searchQuery
                  ? `No items matched your search query "${searchQuery}"`
                  : 'Upload your first file to securely store it in Telegram Cloud Storage.'}
              </p>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="mt-2 py-2.5 px-5 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] hover:border-amber-500/50 text-amber-500 font-semibold text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload File</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Archived Repositories ({files.length})
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    setPreviewFile(file);
                    setActivePreviewTab('VIEW');
                  }}
                  className="bg-[#0c0c0c] border border-[#222222] hover:border-amber-500/50 rounded-xl p-3.5 flex flex-col justify-between group transition-all duration-200 relative cursor-pointer"
                >
                  {/* PREVIEW / ICON CONTAINER */}
                  <div className="w-full aspect-square rounded-lg bg-[#080808] border border-[#1a1a1a] flex items-center justify-center overflow-hidden mb-3 relative group-hover:border-zinc-700 transition-colors">
                    {file.type === 'image' ? (
                      <img
                        src={`/api/files/${file.id}/thumbnail`}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `/api/files/${file.id}/download`;
                        }}
                      />
                    ) : file.type === 'video' ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black overflow-hidden">
                        <img
                          src={`/api/files/${file.id}/thumbnail`}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                          <div className="p-2 rounded-full bg-rose-600/80 border border-rose-400/50 text-white backdrop-blur-sm shadow-lg shadow-rose-600/30 group-hover:scale-110 transition">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono font-bold text-slate-300 border border-slate-700">
                          HD
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        {renderFileIcon(file.type)}
                      </div>
                    )}

                    {/* OVERLAY PREVIEW BUTTON ON HOVER */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[2px]">
                      <span className="py-1.5 px-3 rounded bg-amber-500 text-black font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-lg">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </span>
                    </div>
                  </div>

                  {/* DETAILS */}
                  <div className="space-y-1 mb-3">
                    <h4
                      className="text-xs font-medium text-zinc-200 group-hover:text-amber-400 transition truncate"
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
                      <span>{formatSize(file.size)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#2a2a2a] text-amber-400/90 font-mono text-[9px] truncate max-w-[80px]" title={file.vault_name || 'General Storage'}>
                        {file.vault_name || 'General Storage'}
                      </span>
                    </div>

                    {/* VIEWS & LIKES STATS BADGE & EDIT BUTTON */}
                    <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-zinc-400 border-t border-[#161616] mt-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold" title="Total Dilihat">👁️ {file.views || 0}</span>
                        <span className="text-rose-400 font-bold" title="Total Disukai">❤️ {file.likes || 0}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileToEditStats(file);
                          setEditViewsInput(String(file.views || 0));
                          setEditLikesInput(String(file.likes || 0));
                        }}
                        className="px-1.5 py-0.5 rounded bg-[#161616] hover:bg-amber-500 hover:text-black text-zinc-400 font-semibold text-[9px] uppercase tracking-wider transition border border-[#222]"
                        title="Edit Jumlah Views & Likes"
                      >
                        Edit Stats
                      </button>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#1a1a1a]">
                    <a
                      href={`/api/files/${file.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="py-1.5 px-1.5 rounded-sm bg-[#111111] hover:bg-amber-500 hover:text-black text-amber-500 font-semibold text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1 text-center"
                      title="Download File"
                    >
                      <Download className="w-3 h-3" />
                      <span>Get</span>
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToMove(file);
                        setTargetVaultId(file.vault_id || 'vault_general');
                      }}
                      className="py-1.5 px-1.5 rounded-sm bg-[#111111] hover:bg-sky-950/60 hover:text-sky-400 border border-transparent hover:border-sky-500/40 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1"
                      title="Pindahkan ke Vault Topic lain"
                    >
                      <MoveRight className="w-3 h-3" />
                      <span>Move</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToDelete(file);
                      }}
                      className="py-1.5 px-1.5 rounded-sm bg-[#111111] hover:bg-rose-950/60 hover:text-rose-400 border border-transparent hover:border-rose-500/40 text-zinc-500 font-semibold text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1"
                      title="Hapus File"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Del</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* NETLIFY PUBLIC WEBSITE & REST API DOCS INTEGRATION PANEL */}
        <div className="mt-12 bg-gradient-to-br from-[#0b0f19] via-[#090c14] to-[#0d1220] border border-cyan-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Globe className="w-64 h-64 text-cyan-400" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-cyan-500/30">
                    Netlify + Render Bridge
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    API CORS Enabled
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  Website Publik Netlify & REST API Documentation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proyek ini terbagi menjadi <strong>Server Storage Privat (Render)</strong> dan <strong>Website Publik Client (Netlify)</strong> yang terhubung melalui REST API v1.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/docs"
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <Code className="w-4 h-4" />
                <span>REST API Docs Full</span>
              </a>

              <a
                href="/api/v1/public/project-export"
                target="_blank"
                download
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Website Netlify (.ZIP)</span>
              </a>

              <a
                href="/public-portal"
                target="_blank"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 border border-slate-700"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Preview Public Site</span>
              </a>
            </div>
          </div>

          {/* PUBLIC ENDPOINTS LIST GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <span className="text-[10px] font-mono text-slate-500">Status Endpoint</span>
              </div>
              <code className="text-xs font-mono text-cyan-300 block truncate">/api/v1/public/status</code>
              <p className="text-[11px] text-slate-400">Cek status kesehatan server privat, total media, dan versi API.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Fast Thumbnail</span>
              </div>
              <code className="text-xs font-mono text-cyan-300 block truncate">/api/v1/public/thumbnail/{`{id}`}</code>
              <p className="text-[11px] text-slate-400">Render thumbnail ringan video &amp; gambar tanpa buffer berat.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <span className="text-[10px] font-mono text-slate-500">Media Gallery</span>
              </div>
              <code className="text-xs font-mono text-cyan-300 block truncate">/api/v1/public/media?category=ALL</code>
              <p className="text-[11px] text-slate-400">Diakses oleh website publik Netlify untuk menampilkan foto &amp; video.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">GET</span>
                <span className="text-[10px] font-mono text-rose-400 font-bold">Range Video 206</span>
              </div>
              <code className="text-xs font-mono text-cyan-300 block truncate">/api/v1/public/download/{`{id}`}?inline=true</code>
              <p className="text-[11px] text-slate-400">Streaming video besar &gt;15MB via HTTP 206 seek buffer.</p>
            </div>
          </div>

          {/* NETLIFY DEPLOYMENT STEPS QUICK GUIDE */}
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <strong className="text-cyan-300 block">Siap Di-Deploy ke Netlify Drop:</strong>
                <span>Klik tombol <strong>Unduh Website Netlify (.ZIP)</strong>, lalu ekstrak dan seret folder tersebut ke <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="underline text-white font-bold">app.netlify.com/drop</a> untuk langsung mempublikasikan website client Anda!</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      )}

      {/* UPLOAD MODAL / OVERLAY */}
      {isUploadOpen && (
        <div 
          onClick={() => setIsUploadOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-serif-italic text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-500" />
                <span>Upload to Cloud Repository</span>
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QUICK LINK TO BULK VIDEO STUDIO */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Video className="w-4 h-4 text-cyan-400 shrink-0" />
                <p className="text-[11px] text-cyan-200 leading-snug">
                  Upload banyak video? Gunakan <b className="text-cyan-300">Bulk Video Studio</b> untuk kompresi hemat 80% &amp; progress bar live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setIsBulkVideoOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider shrink-0 transition"
              >
                Buka Studio
              </button>
            </div>

            {/* IMAGEKIT PRIMARY STORAGE BADGE */}
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-200">
                  Storage Utama: <b className="text-white">ImageKit.io CDN</b> + Telegram Backup
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setIsStorageModalOpen(true);
                }}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold shrink-0"
              >
                Kelola &rarr;
              </button>
            </div>

            {/* DRAG & DROP AREA */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  setSelectedFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-[#222222] hover:border-amber-500/50 bg-[#080808]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFiles(e.target.files);
                  }
                }}
              />
              <Upload className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-xs font-medium text-zinc-200">
                  Drag & drop files or <span className="text-amber-500 underline">Browse Files</span>
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                  Maximum 100 MB per payload
                </p>
              </div>
            </div>

            {/* DESTINATION VAULT TOPIC SELECTOR */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Target Vault Topic Storage:
              </label>
              <select
                value={selectedUploadVault}
                onChange={(e) => setSelectedUploadVault(e.target.value)}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3 py-2 text-xs text-white focus:outline-none"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.topic_id ? `(Telegram Topic #${v.topic_id})` : ''} {v.is_private ? '🔒 Private' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* CUSTOM FILE NAME INPUT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Ubah / Kustom Nama File (Opsional):
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {uploadCustomName.trim()
                    ? `Kustom: "${uploadCustomName.trim()}"`
                    : `Auto Vault: "${vaults.find((v) => v.id === selectedUploadVault)?.name || 'RULLZYE'} 1, 2..."`}
                </span>
              </div>
              <input
                type="text"
                value={uploadCustomName}
                onChange={(e) => setUploadCustomName(e.target.value)}
                placeholder={`Kosongkan untuk penamaan otomatis (${vaults.find((v) => v.id === selectedUploadVault)?.name || 'RULLZYE'} 1, ${vaults.find((v) => v.id === selectedUploadVault)?.name || 'RULLZYE'} 2, dst)`}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                💡 <span className="text-zinc-400">Aturan Penamaan:</span> Jika diisi, file akan diberi nama sesuai input Anda. Jika dikosongkan, nama otomatis mengikuti nama Vault (<span className="text-amber-400 font-medium">{vaults.find((v) => v.id === selectedUploadVault)?.name || 'RULLZYE'} 1</span>, <span className="text-amber-400 font-medium">{vaults.find((v) => v.id === selectedUploadVault)?.name || 'RULLZYE'} 2</span>, dst).
              </p>
            </div>

            {/* SELECTED FILES PREVIEW LIST */}
            {selectedFiles && selectedFiles.length > 0 && (
              <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3 max-h-36 overflow-y-auto space-y-2">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Selected Payload ({selectedFiles.length}):
                </p>
                {Array.from(selectedFiles).map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs text-zinc-300 bg-[#111111] px-3 py-1.5 rounded"
                  >
                    <span className="truncate max-w-[200px] text-xs">{file.name}</span>
                    <span className="text-zinc-500 text-[10px]">{formatSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* UPLOAD SUBMIT BUTTON */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="py-2 px-4 rounded-md bg-[#111111] hover:bg-[#1a1a1a] text-zinc-400 font-medium text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUploadSubmit()}
                disabled={uploading || !selectedFiles}
                className="py-2 px-5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs tracking-wider uppercase transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {uploading ? 'Transmitting...' : 'Start Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-serif-italic text-white">Delete File Record</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-medium text-amber-400">{fileToDelete.name}</span>? Metadata and stored payload will be purged.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="py-2 px-4 rounded-md bg-[#111111] hover:bg-[#1a1a1a] text-zinc-400 font-medium text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="py-2 px-4 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs uppercase tracking-wider transition"
              >
                {deleting ? 'Purging...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE VAULT TOPIC MODAL */}
      {isCreateVaultOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVaultSubmit}
            className="w-full max-w-md bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-serif-italic text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Buat Vault Topic Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateVaultOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Nama Vault Topic:
              </label>
              <input
                type="text"
                required
                placeholder="misal: Photos & Video, Dokumen Keuangan"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Deskripsi (Opsional):
              </label>
              <input
                type="text"
                placeholder="Keterangan singkat vault ini..."
                value={newVaultDescription}
                onChange={(e) => setNewVaultDescription(e.target.value)}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={createTelegramTopicCheck}
                  onChange={(e) => setCreateTelegramTopicCheck(e.target.checked)}
                  className="rounded border-[#333] bg-[#111] text-amber-500 focus:ring-0"
                />
                <span className="font-medium">Otomatis buat Forum Topic di Telegram Group Storage</span>
              </label>
              <p className="text-[10px] text-zinc-500 pl-5">
                Telegram Bot API akan membuat topic resmi di Forum Supergroup Anda sehingga semua file vault ini terpisah rapi di Telegram!
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a1a1a]">
              <button
                type="button"
                onClick={() => setIsCreateVaultOpen(false)}
                className="py-2 px-4 rounded-md bg-[#111111] hover:bg-[#1a1a1a] text-zinc-400 font-medium text-xs uppercase tracking-wider"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creatingVault}
                className="py-2 px-5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {creatingVault ? 'Memproses...' : 'Buat Vault Topic'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MOVE FILE TO VAULT MODAL */}
      {fileToMove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleMoveFileSubmit}
            className="w-full max-w-md bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-serif-italic text-white flex items-center gap-2">
                <MoveRight className="w-4 h-4 text-sky-400" />
                <span>Pindahkan File ke Vault Lain</span>
              </h3>
              <button
                type="button"
                onClick={() => setFileToMove(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Pindahkan file <span className="text-amber-400 font-medium">{fileToMove.name}</span> ke topik vault pilihan Anda:
            </p>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Pilih Vault Tujuan:
              </label>
              <select
                value={targetVaultId}
                onChange={(e) => setTargetVaultId(e.target.value)}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3 py-2 text-xs text-white focus:outline-none"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.topic_id ? `(Telegram Topic #${v.topic_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1a1a1a]">
              <button
                type="button"
                onClick={() => setFileToMove(null)}
                className="py-2 px-4 rounded-md bg-[#111111] hover:bg-[#1a1a1a] text-zinc-400 font-medium text-xs uppercase tracking-wider"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={movingFile}
                className="py-2 px-5 rounded-md bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs uppercase tracking-wider transition shadow-lg shadow-sky-500/10 disabled:opacity-50"
              >
                {movingFile ? 'Memindahkan...' : 'Pindahkan Sekarang'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN PIN VERIFICATION MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyPin}
            className="w-full max-w-sm bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <h3 className="text-sm font-serif-italic text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Admin Passcode Required</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Enter security PIN to access cloud configuration settings.
            </p>

            {pinError && (
              <div className="bg-rose-950/50 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Passcode PIN</label>
              <input
                type="password"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="159357"
                required
                autoFocus
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="py-2 px-4 rounded-md bg-[#111111] hover:bg-[#1a1a1a] text-zinc-400 font-medium text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifyingPin}
                className="py-2 px-5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider transition"
              >
                {verifyingPin ? 'Verifying...' : 'Authorize'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FULLSCREEN PREVIEW & METADATA INSPECTOR MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col overflow-hidden text-white animate-in fade-in duration-200">
          {/* MODAL HEADER */}
          <div className="h-16 px-6 bg-[#0c0c0c] border-b border-[#222222] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 overflow-hidden pr-4">
              <div className="p-2 rounded-md bg-[#161616] border border-[#262626] shrink-0">
                {renderFileIcon(previewFile.type)}
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white truncate" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    {previewFile.type}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {formatSize(previewFile.size)} • Uploaded on {formatDate(previewFile.uploaded_at)}
                </p>
              </div>
            </div>

            {/* VIEW / METADATA TAB TOGGLE & ACTIONS */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center p-1 bg-[#141414] border border-[#262626] rounded-md text-xs font-medium">
                <button
                  onClick={() => setActivePreviewTab('VIEW')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition ${
                    activePreviewTab === 'VIEW'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActivePreviewTab('METADATA')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition ${
                    activePreviewTab === 'METADATA'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Metadata Info
                </button>
              </div>

              {/* COPY DIRECT LINK */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/api/files/${previewFile.id}/download`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                  showToast('info', 'Link download berhasil disalin!');
                }}
                className="p-2 rounded-md bg-[#161616] hover:bg-[#222222] border border-[#262626] text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs"
                title="Copy Direct Download Link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                <span className="hidden sm:inline text-[11px] uppercase tracking-wider">{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>

              {/* DOWNLOAD BUTTON */}
              <a
                href={`/api/files/${previewFile.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>

              {/* CLOSE BUTTON */}
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 rounded-md bg-[#161616] hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-[#262626] transition ml-2"
                title="Close Preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MODAL BODY */}
          <div className="flex-1 p-6 overflow-auto flex items-center justify-center relative">
            {activePreviewTab === 'VIEW' ? (
              <div className="w-full h-full flex items-center justify-center">
                {previewFile.type === 'image' || previewFile.mime.startsWith('image/') ? (
                  <div className="relative max-h-full max-w-full flex items-center justify-center p-2">
                    <img
                      src={`/api/files/${previewFile.id}/download`}
                      alt={previewFile.name}
                      className="max-h-[78vh] max-w-full object-contain rounded-lg border border-[#2a2a2a] shadow-2xl bg-[#050505]"
                    />
                  </div>
                ) : previewFile.type === 'video' || previewFile.mime.startsWith('video/') ? (
                  <div className="w-full max-w-4xl flex flex-col items-center gap-3 relative rounded-xl overflow-hidden group">
                    <video
                      controls
                      autoPlay
                      preload="auto"
                      playsInline
                      src={`/api/files/${previewFile.id}/download`}
                      onWaiting={() => setIsVideoBuffering(true)}
                      onSeeking={() => setIsVideoBuffering(true)}
                      onPlaying={() => setIsVideoBuffering(false)}
                      onCanPlay={() => setIsVideoBuffering(false)}
                      onLoadStart={() => setIsVideoBuffering(true)}
                      className="max-h-[75vh] w-full rounded-lg border border-[#2a2a2a] shadow-2xl bg-black"
                    >
                      Browser Anda tidak mendukung video tag.
                    </video>

                    {/* Rendering & Buffering Overlay Animation */}
                    {isVideoBuffering && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none z-10 transition duration-300">
                        <div className="relative flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
                          <div className="absolute w-10 h-10 rounded-full border-4 border-rose-500/20 border-b-rose-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                          <Play className="w-5 h-5 text-amber-500 absolute animate-pulse fill-amber-500" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-100 font-mono tracking-wider flex items-center justify-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                            <span>PEMUTARAN STREAMING ULTRA FAST</span>
                          </p>
                          <p className="text-[11px] text-zinc-400 font-mono">Menyelaraskan buffer & render frame video...</p>
                        </div>
                        <div className="flex items-end justify-center space-x-1 h-4 pt-1">
                          <span className="w-1 bg-amber-500 rounded-full animate-bounce" style={{ height: '60%', animationDelay: '0.1s' }}></span>
                          <span className="w-1 bg-amber-400 rounded-full animate-bounce" style={{ height: '100%', animationDelay: '0.2s' }}></span>
                          <span className="w-1 bg-rose-500 rounded-full animate-bounce" style={{ height: '40%', animationDelay: '0.3s' }}></span>
                          <span className="w-1 bg-amber-500 rounded-full animate-bounce" style={{ height: '80%', animationDelay: '0.4s' }}></span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : previewFile.mime.startsWith('audio/') ? (
                  <div className="w-full max-w-md bg-[#0e0e0e] border border-[#262626] rounded-xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <FileText className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-white mb-1">{previewFile.name}</h4>
                      <p className="text-xs text-zinc-400">{formatSize(previewFile.size)} • {previewFile.mime}</p>
                    </div>
                    <audio controls src={`/api/files/${previewFile.id}/download`} className="w-full" />
                  </div>
                ) : previewFile.mime === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full max-w-5xl max-h-[80vh] bg-white rounded-lg border border-[#2a2a2a] overflow-hidden shadow-2xl">
                    <iframe
                      src={`/api/files/${previewFile.id}/download`}
                      className="w-full h-full border-none"
                      title={previewFile.name}
                    />
                  </div>
                ) : (
                  /* Document / Other Fallback Metadata Preview Card */
                  <div className="w-full max-w-xl bg-[#0e0e0e] border border-[#262626] rounded-xl p-8 text-center space-y-6 shadow-2xl">
                    <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                      {renderFileIcon(previewFile.type)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white truncate px-4">{previewFile.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        File ini tidak dapat ditampilkan secara langsung sebagai gambar/video. Silakan unduh atau periksa metadata lengkapnya.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-left bg-[#080808] border border-[#1a1a1a] rounded-lg p-4 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">Format / MIME</span>
                        <span className="font-mono text-zinc-200">{previewFile.mime}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">Ukuran Payload</span>
                        <span className="font-medium text-amber-400">{formatSize(previewFile.size)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <a
                        href={`/api/files/${previewFile.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-6 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/10 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Payload</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* METADATA INSPECTOR TAB */
              <div className="w-full max-w-3xl bg-[#0e0e0e] border border-[#262626] rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#222222]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Full File Metadata & Cloud Inspector</h3>
                      <p className="text-xs text-zinc-400">Spesifikasi teknis dan identifier Telegram Storage payload</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Payload Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Nama File (Original)</span>
                    <p className="font-mono text-zinc-200 break-all select-all">{previewFile.name}</p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Kategori & MIME Type</span>
                    <p className="font-mono text-amber-400 uppercase">{previewFile.type} <span className="text-zinc-500 font-normal">({previewFile.mime})</span></p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Ukuran File (Bytes)</span>
                    <p className="font-mono text-zinc-200">{formatSize(previewFile.size)} <span className="text-zinc-500">({previewFile.size.toLocaleString('id-ID')} bytes)</span></p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Waktu Diunggah</span>
                    <p className="font-mono text-zinc-200">{new Date(previewFile.uploaded_at).toLocaleString('id-ID')}</p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1 md:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Telegram File ID (Cloud Key)</span>
                    <p className="font-mono text-[11px] text-zinc-400 break-all select-all bg-[#050505] p-2 rounded border border-[#141414]">{previewFile.telegram_file_id}</p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Telegram Message ID</span>
                    <p className="font-mono text-zinc-300">{previewFile.telegram_message_id || '-'}</p>
                  </div>

                  <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Storage Chat ID</span>
                    <p className="font-mono text-zinc-300">{previewFile.telegram_chat_id || '-'}</p>
                  </div>
                </div>

                <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-4 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Direct Download API Endpoint</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/files/${previewFile.id}/download`}
                      className="w-full bg-[#050505] border border-[#222222] rounded px-3 py-1.5 text-xs font-mono text-amber-400 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/files/${previewFile.id}/download`;
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                        showToast('info', 'Link disalin!');
                      }}
                      className="px-3 py-1.5 bg-amber-500 text-black font-semibold text-xs rounded uppercase tracking-wider shrink-0 hover:bg-amber-400 transition"
                    >
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDIT VIEWS & LIKES STATS */}
      {fileToEditStats && (
        <div
          onClick={() => setFileToEditStats(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0c0c0c] border border-amber-500/40 rounded-xl p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Edit Stats Media
                </h3>
              </div>
              <button
                onClick={() => setFileToEditStats(null)}
                className="text-zinc-500 hover:text-white transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStatsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nama File
                </label>
                <p className="text-xs text-amber-400 font-semibold truncate bg-[#161616] p-2.5 rounded border border-[#262626]">
                  {fileToEditStats.name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Jumlah Views (Dilihat) 👁️
                </label>
                <input
                  type="number"
                  min="0"
                  value={editViewsInput}
                  onChange={(e) => setEditViewsInput(e.target.value)}
                  className="w-full bg-[#161616] border border-[#2e2e2e] focus:border-amber-500 rounded p-2.5 text-xs text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Jumlah Likes (Disukai) ❤️
                </label>
                <input
                  type="number"
                  min="0"
                  value={editLikesInput}
                  onChange={(e) => setEditLikesInput(e.target.value)}
                  className="w-full bg-[#161616] border border-[#2e2e2e] focus:border-amber-500 rounded p-2.5 text-xs text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setFileToEditStats(null)}
                  className="px-4 py-2 bg-[#161616] hover:bg-[#222] text-zinc-300 text-xs font-semibold rounded uppercase tracking-wider transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingStats}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded uppercase tracking-wider transition shadow-lg shadow-amber-500/20"
                >
                  {savingStats ? 'Menyimpan...' : 'Simpan Stats'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TERMINAL LOGS MODAL */}
      {isTerminalLogsOpen && (
        <div 
          onClick={() => setIsTerminalLogsOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#030a05] border border-emerald-500/50 rounded-xl p-5 shadow-2xl space-y-4 font-mono my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                  Node System Console Logs
                </h3>
              </div>
              <button
                onClick={() => setIsTerminalLogsOpen(false)}
                className="text-zinc-500 hover:text-emerald-400 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black border border-emerald-900/80 rounded-lg p-4 h-64 overflow-y-auto space-y-2 text-xs text-emerald-400/90 leading-relaxed font-mono">
              <p className="text-zinc-500">[00:00:01] System boot initialized: RULLZYE CLOUD Node Engine v2.4.0</p>
              <p className="text-emerald-400">[00:00:02] [DATABASE] Connecting to Google Cloud Firestore...</p>
              <p className="text-emerald-400 font-bold">[00:00:03] [FIRESTORE] &check; Cloud Database Connected (24/7 Persistence Active)</p>
              <p className="text-sky-400">[00:00:04] [TELEGRAM] Telegram Storage Bot authenticated successfully</p>
              <p className="text-sky-400">[00:00:05] [FORUMS] Topic Storage Vaults: {vaults.length} Forum Topics Active</p>
              <p className="text-amber-400">[00:00:06] [REPOS] Synced {files.length} payload file records in memory</p>
              <p className="text-emerald-400">[00:00:07] [HEALTH] Latency: 12ms | Memory: OK | Storage: Unlimited</p>
              <p className="text-emerald-400 font-bold animate-pulse">[SYSTEM] Node Status: ONLINE & READY FOR COMMANDS &gt;_</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Status: 24/7 Firestore Synced &bull; Telegram Storage Ready
              </span>
              <button
                onClick={() => setIsTerminalLogsOpen(false)}
                className="py-1.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded uppercase tracking-wider transition"
              >
                Close Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK VIDEO TOOLS & UPLOADER MODAL */}
      <BulkVideoToolsModal
        isOpen={isBulkVideoOpen}
        onClose={() => setIsBulkVideoOpen(false)}
        vaults={vaults.map((v) => ({
          id: v.id,
          name: v.name,
          topic_id: v.topic_id,
          is_private: v.is_private,
        }))}
        defaultVaultId={selectedUploadVault}
        onUploadSuccess={() => {
          showToast('success', 'Semua video dalam antrean berhasil diunggah!');
          fetchFiles();
          fetchVaults();
        }}
      />

      {/* LIVE TELEGRAM BOT REQUEST LOGS TRACER MODAL */}
      <BotLogsModal
        isOpen={isBotLogsOpen}
        onClose={() => setIsBotLogsOpen(false)}
      />

      {/* STORAGE & IMAGEKIT CDN MIGRATION MODAL */}
      <StorageMigrationModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onSuccess={() => {
          showToast('success', 'Status storage & database berhasil diperbarui!');
          fetchFiles();
          fetchConfig();
        }}
      />

      {/* MONETIZATION & ADSTERRA SMARTLINKS MODAL */}
      <MonetizationModal
        isOpen={isMonetizationOpen}
        onClose={() => setIsMonetizationOpen(false)}
      />

      {/* GOOGLE DRIVE STORAGE & SYNC MODAL */}
      <GoogleDriveModal
        isOpen={isGoogleDriveOpen}
        onClose={() => setIsGoogleDriveOpen(false)}
        onImportSuccess={() => {
          showToast('success', 'File dari Google Drive berhasil diimpor!');
          fetchFiles();
        }}
      />

      {/* FOOTER */}
      <footer className="h-12 border-t border-[#1a1a1a] bg-[#080808] flex items-center px-6 sm:px-10 justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        <div>Terminal System / {websiteName}</div>
        <div className="hidden sm:block">&copy; {new Date().getFullYear()} Telegram Cloud Core. All Rights Reserved.</div>
        <div>v4.2.1-Sophisticated</div>
      </footer>
    </div>
  );
}

