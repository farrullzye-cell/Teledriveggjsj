'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  HardDrive,
  Upload,
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
  Palette,
  Monitor,
  Zap,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal states
  const [fileToDelete, setFileToDelete] = useState<FileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fullscreen Preview modal states
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'VIEW' | 'METADATA'>('VIEW');

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
        if (fileToDelete) setFileToDelete(null);
        if (isPinModalOpen) setIsPinModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile, isUploadOpen, fileToDelete, isPinModalOpen]);

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
        if (isMounted && data.website_name) {
          setWebsiteName(data.website_name);
        }
      } catch (e) {
        console.error(e);
      }
      fetchVaults();
    };
    loadConfigAndVaults();
    return () => {
      isMounted = false;
    };
  }, []);

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
      Array.from(selectedFiles).forEach((file) => {
        formData.append('files', file);
      });
      formData.append('vault_id', selectedUploadVault);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        showToast('success', data.message || 'File berhasil diunggah!');
        setIsUploadOpen(false);
        setSelectedFiles(null);
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
          header: 'bg-[#051308]/90 border-emerald-900/60 text-emerald-400',
          card: 'bg-[#051308] border-emerald-900/50 hover:border-emerald-400/80',
          cardIconBg: 'bg-[#030a05] border-emerald-900/60 text-emerald-400',
          accent: 'text-emerald-400',
          accentBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          btnPrimary: 'bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20',
          badge: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 font-mono',
          glowBorder: 'border-emerald-500/50',
          themeName: 'Matrix Command Terminal',
        };
      case 'datacenter':
        return {
          wrapper: 'bg-[#0b1329] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white',
          header: 'bg-[#131f3a]/90 border-indigo-900/50 text-slate-100',
          card: 'bg-[#131f3a] border-slate-800 hover:border-indigo-500/60',
          cardIconBg: 'bg-[#0b1329] border-slate-800 text-indigo-400',
          accent: 'text-indigo-400',
          accentBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/20',
          badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60',
          glowBorder: 'border-indigo-500/50',
          themeName: 'Enterprise Cloud Console',
        };
      case 'cyberpunk':
        return {
          wrapper: 'bg-[#09070f] text-zinc-100 font-sans selection:bg-pink-500 selection:text-white',
          header: 'bg-[#130f22]/90 border-pink-900/50 text-zinc-100',
          card: 'bg-[#130f22] border-zinc-800 hover:border-pink-500/60',
          cardIconBg: 'bg-[#09070f] border-zinc-800 text-pink-400',
          accent: 'text-pink-400',
          accentBg: 'bg-pink-500/10 border-pink-500/30 text-pink-300',
          btnPrimary: 'bg-gradient-to-r from-pink-500 to-cyan-500 hover:opacity-90 text-white font-semibold shadow-lg shadow-pink-500/20',
          badge: 'bg-pink-950/80 text-pink-400 border-pink-800/60',
          glowBorder: 'border-pink-500/50',
          themeName: 'Neon Cyberpunk Cloud',
        };
      case 'pterodactyl':
      default:
        return {
          wrapper: 'bg-[#0B0F19] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black',
          header: 'bg-[#111827]/90 border-cyan-900/40 text-slate-100',
          card: 'bg-[#111827] border-slate-800 hover:border-cyan-500/60',
          cardIconBg: 'bg-[#0B0F19] border-slate-800 text-cyan-400',
          accent: 'text-cyan-400',
          accentBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
          btnPrimary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20',
          badge: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
          glowBorder: 'border-cyan-500/50',
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
            onClick={() => setIsPinModalOpen(true)}
            className={`p-2 sm:px-4 sm:py-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 hover:${theme.glowBorder} text-zinc-300 hover:text-white transition flex items-center gap-2 text-xs font-semibold uppercase tracking-wider`}
            title="Setup & Settings"
          >
            <Settings className={`w-4 h-4 ${theme.accent}`} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
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
                className={`p-2 sm:p-2.5 rounded-lg bg-black/30 hover:bg-black/50 border border-white/10 hover:${theme.glowBorder} flex items-center gap-2 transition text-left group min-w-0`}
              >
                <Terminal className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${theme.accent} shrink-0 group-hover:animate-bounce`} />
                <div className="min-w-0">
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-zinc-500 block">Console Logs</span>
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
              <button
                key={vault.id}
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
                        src={`/api/files/${file.id}/download`}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className={file.type === 'image' ? 'hidden' : 'flex flex-col items-center gap-1.5'}>
                      {renderFileIcon(file.type)}
                    </div>

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
      </main>

      {/* UPLOAD MODAL / OVERLAY */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5">
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
                  <div className="w-full max-w-4xl flex flex-col items-center gap-3">
                    <video
                      controls
                      autoPlay
                      src={`/api/files/${previewFile.id}/download`}
                      className="max-h-[75vh] w-full rounded-lg border border-[#2a2a2a] shadow-2xl bg-black"
                    >
                      Browser Anda tidak mendukung video tag.
                    </video>
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

      {/* TERMINAL LOGS MODAL */}
      {isTerminalLogsOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#030a05] border border-emerald-500/50 rounded-xl p-5 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-900/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                  Node System Console Logs
                </h3>
              </div>
              <button
                onClick={() => setIsTerminalLogsOpen(false)}
                className="text-zinc-500 hover:text-emerald-400 transition"
              >
                <X className="w-4 h-4" />
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

      {/* FOOTER */}
      <footer className="h-12 border-t border-[#1a1a1a] bg-[#080808] flex items-center px-6 sm:px-10 justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        <div>Terminal System / {websiteName}</div>
        <div className="hidden sm:block">&copy; {new Date().getFullYear()} Telegram Cloud Core. All Rights Reserved.</div>
        <div>v4.2.1-Sophisticated</div>
      </footer>
    </div>
  );
}

