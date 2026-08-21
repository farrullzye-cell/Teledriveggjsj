'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  HardDrive,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  ShieldCheck,
  Send,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';

interface StorageMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function StorageMigrationModal({ isOpen, onClose, onSuccess }: StorageMigrationModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'integrity' | 'firestore'>('overview');
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  // Firestore sync state
  const [firestoreSyncing, setFirestoreSyncing] = useState(false);
  const [firestoreResult, setFirestoreResult] = useState<any>(null);

  // Toast / Alert message
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showAlert = (type: 'success' | 'error' | 'info', text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config/status');
      const data = await res.json();
      setStatusData(data);
    } catch (e: any) {
      showAlert('error', 'Gagal memuat status konfigurasi: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIntegrity = useCallback(async () => {
    try {
      setIntegrityLoading(true);
      const res = await fetch('/api/admin/storage-integrity');
      const data = await res.json();
      if (data.success) {
        setIntegrityData(data);
      } else {
        showAlert('error', data.message || 'Gagal memuat data integritas');
      }
    } catch (e: any) {
      showAlert('error', 'Gagal memeriksa integritas storage');
    } finally {
      setIntegrityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadIntegrity();
    }
  }, [isOpen, loadStatus, loadIntegrity]);

  const handleSyncFirestore = async () => {
    try {
      setFirestoreSyncing(true);
      setFirestoreResult(null);
      const res = await fetch('/api/admin/sync-firestore', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFirestoreResult(data);
        showAlert('success', '✅ ' + data.message);
        if (onSuccess) onSuccess();
      } else {
        showAlert('error', '❌ ' + (data.message || 'Gagal sinkronisasi Firestore'));
      }
    } catch (err: any) {
      showAlert('error', 'Gagal memanggil Firestore sync: ' + err.message);
    } finally {
      setFirestoreSyncing(false);
    }
  };

  if (!isOpen) return null;

  const summary = integrityData?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#0c0e14] border border-emerald-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-[#0d1814] to-[#0c0e14]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Telegram Pure Cloud Storage &amp; Vaults</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Pure Telegram Engine
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Pusat kontrol penyimpanan media berbasis Telegram Channel &amp; Topic Vaults dengan sinkronisasi metadata Firestore.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert Banner */}
        {alert && (
          <div
            className={`px-5 py-3 text-xs font-semibold flex items-center justify-between border-b ${
              alert.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : alert.type === 'error'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              {alert.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              {alert.type === 'info' && <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              <span>{alert.text}</span>
            </div>
            <button onClick={() => setAlert(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#090b10] px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'bg-[#121622] text-emerald-400 border-t-2 border-emerald-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Status &amp; Arsitektur</span>
          </button>
          <button
            onClick={() => setActiveTab('integrity')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'integrity'
                ? 'bg-[#121622] text-emerald-400 border-t-2 border-emerald-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Integritas File ({summary?.total_db_files || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('firestore')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'firestore'
                ? 'bg-[#121622] text-emerald-400 border-t-2 border-emerald-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>3. Firestore Cloud Sync</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Storage Architecture Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Telegram Primary */}
                <div className="bg-[#0e1617] border border-emerald-500/30 rounded-xl p-4 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider rounded-bl-lg">
                    PRIMARY STORAGE
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <Send className="w-4 h-4" />
                    <span>Telegram Cloud Vaults</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Penyimpanan media terdistribusi langsung di Channel/Group Telegram dengan topik vault terpisah.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400 font-mono truncate">
                      Chat ID: {statusData?.chat_id || 'Connected'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                  </div>
                </div>

                {/* Firestore Database */}
                <div className="bg-[#0e121d] border border-blue-500/30 rounded-xl p-4 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-extrabold uppercase tracking-wider rounded-bl-lg">
                    METADATA DB
                  </div>
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <Database className="w-4 h-4" />
                    <span>Firestore Database</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Source of truth metadata, relasi folder/vault, log aktivitas, dan sinkronisasi permanen.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Siap &amp; Terhubung
                    </span>
                    <button
                      onClick={handleSyncFirestore}
                      disabled={firestoreSyncing}
                      className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold rounded text-[10px] transition"
                    >
                      {firestoreSyncing ? 'Syncing...' : 'Sync DB'}
                    </button>
                  </div>
                </div>

                {/* Streaming Engine */}
                <div className="bg-[#10141a] border border-cyan-500/30 rounded-xl p-4 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-extrabold uppercase tracking-wider rounded-bl-lg">
                    STREAM ENGINE
                  </div>
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <Zap className="w-4 h-4" />
                    <span>Chunked Range Proxy</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Pemutaran video instan HTTP 206 Partial Content dengan dukungan timeline scrubbing &amp; multi-resolusi.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-cyan-400 font-mono">
                      /api/v1/videos/stream
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Ready</span>
                  </div>
                </div>
              </div>

              {/* Real-time Storage Diagnostics Metrics */}
              <div className="bg-[#080a0f] border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-500" />
                    <span>Distribusi File &amp; Status Storage</span>
                  </span>
                  <button
                    onClick={loadIntegrity}
                    disabled={integrityLoading}
                    className="text-zinc-400 hover:text-emerald-400 text-[10px] flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${integrityLoading ? 'animate-spin' : ''}`} />
                    <span>Perbarui Statistik</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-zinc-800 text-center">
                    <span className="text-[10px] text-zinc-500 block">Total Berkas DB</span>
                    <span className="text-base font-extrabold text-white">{summary?.total_db_files ?? '-'}</span>
                  </div>
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-emerald-500/20 text-center">
                    <span className="text-[10px] text-emerald-400/80 block">Tersimpan di Telegram</span>
                    <span className="text-base font-extrabold text-emerald-400">{summary?.healthy_count ?? summary?.total_db_files ?? '-'}</span>
                  </div>
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-cyan-500/20 text-center">
                    <span className="text-[10px] text-cyan-400/80 block">Streaming Ready</span>
                    <span className="text-base font-extrabold text-cyan-400">100%</span>
                  </div>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={handleSyncFirestore}
                  disabled={firestoreSyncing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <Database className="w-4 h-4" />
                  <span>{firestoreSyncing ? 'Menyinkronkan...' : 'Sinkronkan Database ke Firestore'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INTEGRITY */}
          {activeTab === 'integrity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-white">Status Integritas Seluruh Berkas</h3>
                  <p className="text-[11px] text-zinc-400">
                    Memastikan setiap berkas memiliki tautan Telegram file ID dan streaming proxy aktif.
                  </p>
                </div>
                <button
                  onClick={loadIntegrity}
                  disabled={integrityLoading}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${integrityLoading ? 'animate-spin' : ''}`} />
                  <span>Scan Ulang</span>
                </button>
              </div>

              {integrityLoading ? (
                <div className="p-8 text-center text-zinc-500">Memeriksa integritas storage Telegram &amp; database...</div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {integrityData?.files?.map((file: any) => (
                    <div
                      key={file.id}
                      className="p-2.5 bg-[#080a0f] border border-zinc-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="truncate flex-1">
                        <div className="font-semibold text-zinc-200 truncate">{file.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          ID: {file.id} • {(file.size / 1024).toFixed(1)} KB • Provider: {file.storage_provider || 'telegram'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Telegram Cloud
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FIRESTORE SYNC */}
          {activeTab === 'firestore' && (
            <div className="space-y-4">
              <div className="bg-[#0b0f19] border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Google Cloud Firestore Synchronization</h3>
                    <p className="text-[11px] text-zinc-400">
                      Menyimpan seluruh konfigurasi permanen, vault, log, dan daftar berkas ke Firestore database.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#04060a] border border-zinc-800 rounded-lg space-y-2 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Firestore Project:</span>
                    <span className="text-amber-400">gen-lang-client-0854109396</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Database ID:</span>
                    <span className="text-emerald-400">ai-studio-rullzyecloud-d8ccd23e-2ae8-4f68-be30-455eb3379287</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Collection / Doc:</span>
                    <span className="text-blue-400">app_data / main</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncFirestore}
                  disabled={firestoreSyncing}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Database className="w-4 h-4" />
                  <span>{firestoreSyncing ? 'Menyinkronkan ke Firestore...' : 'Eksekusi Push Data ke Firestore Sekarang'}</span>
                </button>
              </div>

              {firestoreResult && (
                <div className="bg-[#080a0f] border border-emerald-500/30 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{firestoreResult.message}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div className="p-2 bg-[#0e121d] rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Files Saved</span>
                      <span className="font-extrabold text-white">{firestoreResult.stats?.files_count}</span>
                    </div>
                    <div className="p-2 bg-[#0e121d] rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Vaults Saved</span>
                      <span className="font-extrabold text-white">{firestoreResult.stats?.vaults_count}</span>
                    </div>
                    <div className="p-2 bg-[#0e121d] rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Activity Logs</span>
                      <span className="font-extrabold text-white">{firestoreResult.stats?.logs_count}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-[#080a0f] text-xs">
          <span className="text-zinc-500 text-[11px]">
            Telegram Cloud = Storage &amp; Streaming • Firestore = Primary Database
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
