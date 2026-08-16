'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  HardDrive,
  Database,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Play,
  FileText,
  ShieldCheck,
  Send,
  X,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

interface StorageMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function StorageMigrationModal({ isOpen, onClose, onSuccess }: StorageMigrationModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'migrate' | 'integrity' | 'firestore'>('overview');
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<any>(null);
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);

  // Migration states
  const [batchLimit, setBatchLimit] = useState(10);
  const [isMigrating, setIsMigrating] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationStats, setMigrationStats] = useState<{ total: number; success: number; failed: number } | null>(null);

  // Firestore sync state
  const [firestoreSyncing, setFirestoreSyncing] = useState(false);
  const [firestoreResult, setFirestoreResult] = useState<any>(null);

  // Test ImageKit state
  const [testingIK, setTestingIK] = useState(false);
  const [ikTestResult, setIkTestResult] = useState<any>(null);

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

  const handleTestImageKit = async () => {
    try {
      setTestingIK(true);
      setIkTestResult(null);
      const res = await fetch('/api/test-imagekit', { method: 'POST' });
      const data = await res.json();
      setIkTestResult(data);
      if (data.ok) {
        showAlert('success', '✅ ' + data.message);
      } else {
        showAlert('error', '❌ ' + (data.error || 'Test ImageKit gagal'));
      }
    } catch (err: any) {
      showAlert('error', 'Gagal menguji ImageKit: ' + err.message);
    } finally {
      setTestingIK(false);
    }
  };

  const handleDryRun = async () => {
    try {
      setDryRunLoading(true);
      setDryRunResult(null);
      const res = await fetch('/api/admin/migrate-imagekit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true, limit: batchLimit }),
      });
      const data = await res.json();
      if (data.success) {
        setDryRunResult(data);
        showAlert('info', `Ditemukan ${data.total_legacy_files} berkas legacy Telegram (${data.batch_size} dalam batch).`);
      } else {
        showAlert('error', data.message || 'Gagal melakukan simulasi migrasi');
      }
    } catch (e: any) {
      showAlert('error', 'Gagal simulasi migrasi: ' + e.message);
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleExecuteMigration = async () => {
    try {
      setIsMigrating(true);
      setMigrationLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Memulai migrasi batch (${batchLimit} files)...`]);

      const res = await fetch('/api/admin/migrate-imagekit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false, limit: batchLimit }),
      });
      const data = await res.json();

      if (data.success) {
        setMigrationStats({
          total: (data.migrated_count || 0) + (data.errors?.length || 0),
          success: data.migrated_count || 0,
          failed: data.errors?.length || 0,
        });

        if (Array.isArray(data.migrated)) {
          data.migrated.forEach((m: any) => {
            setMigrationLogs((prev) => [...prev, `✅ [BERHASIL] ${m.name} -> ImageKit`]);
          });
        }
        if (Array.isArray(data.errors)) {
          data.errors.forEach((err: any) => {
            setMigrationLogs((prev) => [...prev, `❌ [GAGAL] ${err.name}: ${err.error}`]);
          });
        }

        showAlert('success', `🎉 Berhasil memigrasikan ${data.migrated_count} berkas ke ImageKit.io! Sisa: ${data.remaining_count}`);
        loadIntegrity();
        if (onSuccess) onSuccess();
      } else {
        showAlert('error', data.message || 'Migrasi gagal');
      }
    } catch (e: any) {
      showAlert('error', 'Terjadi kesalahan eksekusi migrasi: ' + e.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSyncFirestore = async () => {
    try {
      setFirestoreSyncing(true);
      setFirestoreResult(null);
      const res = await fetch('/api/admin/sync-firestore', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFirestoreResult(data);
        showAlert('success', '✅ ' + data.message);
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
      <div className="bg-[#0c0e14] border border-amber-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-[#121622] to-[#0c0e14]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Storage & ImageKit CDN Manager</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Primary Media
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Pusat kontrol migrasi media ImageKit.io, integritas storage, dan sinkronisasi metadata Firestore.
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
                ? 'bg-[#121622] text-amber-400 border-t-2 border-amber-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Status & Diagnostik</span>
          </button>
          <button
            onClick={() => setActiveTab('migrate')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'migrate'
                ? 'bg-[#121622] text-amber-400 border-t-2 border-amber-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>2. Migrasi ke ImageKit</span>
          </button>
          <button
            onClick={() => setActiveTab('integrity')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'integrity'
                ? 'bg-[#121622] text-amber-400 border-t-2 border-amber-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Integritas File ({summary?.total_db_files || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('firestore')}
            className={`px-4 py-2.5 rounded-t-lg transition flex items-center space-x-2 ${
              activeTab === 'firestore'
                ? 'bg-[#121622] text-amber-400 border-t-2 border-amber-500 border-x border-zinc-800 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>4. Firestore Sync</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Storage Architecture Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ImageKit Primary */}
                <div className="bg-[#0e121d] border border-amber-500/30 rounded-xl p-4 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase tracking-wider rounded-bl-lg">
                    PRIMARY STORAGE
                  </div>
                  <div className="flex items-center space-x-2 text-amber-400 font-bold">
                    <Cloud className="w-4 h-4" />
                    <span>ImageKit.io CDN</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Penyimpanan media utama & pengiriman CDN berkecepatan tinggi tanpa beban server.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 font-mono truncate">
                      {statusData?.imagekit_url_endpoint || 'https://ik.imagekit.io/...'}
                    </span>
                    <button
                      onClick={handleTestImageKit}
                      disabled={testingIK}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded text-[10px] transition"
                    >
                      {testingIK ? 'Testing...' : 'Test CDN'}
                    </button>
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
                    Source of truth metadata, relasi folder/vault, dan sinkronisasi cloud permanen.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Siap & Terhubung
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

                {/* Telegram Source/Bot */}
                <div className="bg-[#0e121d] border border-cyan-500/30 rounded-xl p-4 space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] font-extrabold uppercase tracking-wider rounded-bl-lg">
                    INTEGRATION & BOT
                  </div>
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <Send className="w-4 h-4" />
                    <span>Telegram Integration</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Bot auto-sync, vault group channels, dan fallback ingest media.
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400">
                      {statusData?.bot_name ? `Bot: @${statusData.bot_username || statusData.bot_name}` : 'Bot Linked'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                  </div>
                </div>
              </div>

              {/* Real-time Storage Diagnostics Metrics */}
              <div className="bg-[#080a0f] border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-500" />
                    <span>Distribusi File & Storage Provider</span>
                  </span>
                  <button
                    onClick={loadIntegrity}
                    disabled={integrityLoading}
                    className="text-zinc-400 hover:text-amber-400 text-[10px] flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${integrityLoading ? 'animate-spin' : ''}`} />
                    <span>Perbarui Statistik</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-zinc-800 text-center">
                    <span className="text-[10px] text-zinc-500 block">Total Berkas DB</span>
                    <span className="text-base font-extrabold text-white">{summary?.total_db_files ?? '-'}</span>
                  </div>
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-emerald-500/20 text-center">
                    <span className="text-[10px] text-emerald-400/80 block">Sehat di ImageKit</span>
                    <span className="text-base font-extrabold text-emerald-400">{summary?.healthy_count ?? '-'}</span>
                  </div>
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-amber-500/20 text-center">
                    <span className="text-[10px] text-amber-400/80 block">Telegram Legacy Only</span>
                    <span className="text-base font-extrabold text-amber-400">{summary?.telegram_only_count ?? '-'}</span>
                  </div>
                  <div className="bg-[#0f1422] p-3 rounded-lg border border-purple-500/20 text-center">
                    <span className="text-[10px] text-purple-400/80 block">Orphan di ImageKit</span>
                    <span className="text-base font-extrabold text-purple-300">{summary?.orphan_imagekit_files ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => setActiveTab('migrate')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition flex items-center space-x-1.5 shadow-lg shadow-amber-500/10"
                >
                  <Zap className="w-4 h-4" />
                  <span>Mulai Migrasi ke ImageKit.io CDN</span>
                </button>
                <button
                  onClick={handleSyncFirestore}
                  disabled={firestoreSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center space-x-1.5"
                >
                  <Database className="w-4 h-4" />
                  <span>{firestoreSyncing ? 'Menyinkronkan...' : 'Sinkronkan Database ke Firestore'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MIGRATE TO IMAGEKIT */}
          {activeTab === 'migrate' && (
            <div className="space-y-4">
              <div className="bg-[#0b0f19] border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>Alat Migrasi File Legacy ke ImageKit.io</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Memindahkan file yang sebelumnya hanya ada di Telegram langsung ke ImageKit CDN dengan aman dan otomatis memperbarui database.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                      Ukuran Batch per Eksekusi:
                    </label>
                    <select
                      value={batchLimit}
                      onChange={(e) => setBatchLimit(Number(e.target.value))}
                      disabled={isMigrating}
                      className="w-full bg-[#04060a] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value={5}>5 Berkas per Batch (Sangat Cepat)</option>
                      <option value={10}>10 Berkas per Batch (Direkomendasikan)</option>
                      <option value={25}>25 Berkas per Batch (Sedang)</option>
                      <option value={50}>50 Berkas per Batch (Maksimal)</option>
                    </select>
                  </div>

                  <div className="flex items-end space-x-2">
                    <button
                      type="button"
                      onClick={handleDryRun}
                      disabled={dryRunLoading || isMigrating}
                      className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-lg border border-zinc-700 transition text-xs flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>{dryRunLoading ? 'Memindai...' : '1. Simulasi (Dry-Run)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteMigration}
                      disabled={isMigrating || dryRunLoading}
                      className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>{isMigrating ? 'Memigrasikan...' : '2. Jalankan Migrasi'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dry-run Candidate Preview */}
              {dryRunResult && (
                <div className="bg-[#080a0f] border border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span>
                      📋 Daftar Berkas Antrian ({dryRunResult.batch_size} dari {dryRunResult.total_legacy_files} total)
                    </span>
                    <span className="text-[10px] text-zinc-400">Mode Simulasi Aman</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                    {dryRunResult.candidates?.map((item: any, idx: number) => (
                      <div key={item.id} className="p-2 bg-[#0d111a] rounded flex items-center justify-between border border-zinc-800/80">
                        <span className="text-zinc-200 truncate max-w-[280px]">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="text-[10px] text-zinc-400">{(item.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real-time Migration Logs Terminal */}
              <div className="bg-[#04060a] border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 border-b border-zinc-800 pb-1.5">
                  <span>Log Eksekusi Migrasi</span>
                  {migrationStats && (
                    <span className="text-emerald-400">
                      Selesai: {migrationStats.success} Berhasil / {migrationStats.failed} Gagal
                    </span>
                  )}
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg font-mono text-[10px] text-zinc-300 max-h-44 overflow-y-auto space-y-1">
                  {migrationLogs.length === 0 ? (
                    <span className="text-zinc-600">Klik &quot;Jalankan Migrasi&quot; atau &quot;Simulasi&quot; untuk melihat log progress di sini...</span>
                  ) : (
                    migrationLogs.map((log, index) => <div key={index}>{log}</div>)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTEGRITY */}
          {activeTab === 'integrity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-white">Status Integritas Seluruh Berkas</h3>
                  <p className="text-[11px] text-zinc-400">
                    Memastikan setiap berkas memiliki tautan ImageKit CDN dan terdaftar pada database.
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
                <div className="p-8 text-center text-zinc-500">Memeriksa integritas storage ImageKit & database...</div>
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
                          ID: {file.id} • {(file.size / 1024).toFixed(1)} KB • Provider: {file.storage_provider}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.has_imagekit && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ImageKit CDN
                          </span>
                        )}
                        {file.has_telegram && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Telegram Backup
                          </span>
                        )}
                        {file.status === 'missing' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Missing
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FIRESTORE SYNC */}
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
            ImageKit.io = Primary Storage • Firestore = Primary Database • Telegram = Source Bot
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
