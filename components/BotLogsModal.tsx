'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Trash2,
  Zap,
  Activity,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Search,
  Filter,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { BotLogEntry } from '@/lib/bot-logger';

interface BotLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BotLogsModal({ isOpen, onClose }: BotLogsModalProps) {
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [poller, setPoller] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [testingPoll, setTestingPoll] = useState(false);

  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [fixingMode, setFixingMode] = useState(false);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [logsRes, diagRes] = await Promise.all([
        fetch(`/api/telegram/logs?limit=100&filter=${filterType}`),
        fetch('/api/telegram/diagnostic'),
      ]);
      const logsData = await logsRes.json();
      if (logsData.ok) {
        setLogs(logsData.logs || []);
        setSummary(logsData.summary || null);
        setPoller(logsData.poller || null);
      }
      const diagData = await diagRes.json();
      if (diagData.ok) {
        setDiagnostic(diagData);
      }
    } catch (e) {
      console.error('Error fetching bot logs:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterType]);

  const handleSwitchToPolling = async () => {
    setFixingMode(true);
    try {
      const res = await fetch('/api/telegram/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_to_poller' }),
      });
      const data = await res.json();
      alert(data.message || 'Mode Polling berhasil diaktifkan.');
      await fetchLogs(false);
    } catch (e: any) {
      alert(`Gagal: ${e.message}`);
    } finally {
      setFixingMode(false);
    }
  };

  const handleRegisterWebhookAuto = async () => {
    setFixingMode(true);
    try {
      const currentUrl = `${window.location.origin}/api/telegram/webhook`;
      const res = await fetch('/api/telegram/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_webhook', url: currentUrl }),
      });
      const data = await res.json();
      alert(data.message || 'Webhook berhasil diperbarui dengan semua event tombol!');
      await fetchLogs(false);
    } catch (e: any) {
      alert(`Gagal: ${e.message}`);
    } finally {
      setFixingMode(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchLogs();

    let timer: NodeJS.Timeout;
    if (autoRefresh) {
      timer = setInterval(() => {
        fetchLogs(true);
      }, 2000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, autoRefresh, fetchLogs]);

  if (!isOpen) return null;

  const handleClearLogs = async () => {
    if (!confirm('Bersihkan seluruh riwayat log request bot Telegram?')) return;
    setClearing(true);
    try {
      await fetch('/api/telegram/logs', { method: 'DELETE' });
      setLogs([]);
      fetchLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  const handleTriggerPollOnce = async () => {
    setTestingPoll(true);
    try {
      await fetch('/api/telegram/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'once' }),
      });
      await fetchLogs(true);
    } catch (e) {
      console.error(e);
    } finally {
      setTestingPoll(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchSummary = log.payloadSummary?.toLowerCase().includes(query);
      const matchUser = log.username?.toLowerCase().includes(query) || log.senderName?.toLowerCase().includes(query);
      const matchChat = String(log.chatId || '').includes(query);
      const matchType = log.type.toLowerCase().includes(query);
      if (!matchSummary && !matchUser && !matchChat && !matchType) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f0f11] border border-zinc-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        {/* HEADER */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Live Telegram Bot Request & Event Tracer
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Real-time Inspector
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Lacak setiap klik tombol, perintah, respons callback, latensi, dan error secara rinci.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
              title="Auto-refresh setiap 2 detik"
            >
              <Activity className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-sky-400' : ''}`} />
              <span>{autoRefresh ? 'Live Stream: ON' : 'Live Stream: OFF'}</span>
            </button>

            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition"
              title="Refresh manual"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 text-zinc-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-black/40 border-b border-zinc-800/60 text-xs shrink-0">
            <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase font-mono block">Total Event</span>
              <span className="text-sm font-bold text-white">{summary.total || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[10px] text-emerald-400 uppercase font-mono block">Sukses (200 OK)</span>
              <span className="text-sm font-bold text-emerald-300">{summary.successCount || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30">
              <span className="text-[10px] text-rose-400 uppercase font-mono block">Error Terdeteksi</span>
              <span className="text-sm font-bold text-rose-300">{summary.errorCount || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-950/20 border border-indigo-500/30">
              <span className="text-[10px] text-indigo-400 uppercase font-mono block">Klik Tombol</span>
              <span className="text-sm font-bold text-indigo-300">{summary.callbacks || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-500/30">
              <span className="text-[10px] text-amber-400 uppercase font-mono block">Perintah Teks</span>
              <span className="text-sm font-bold text-amber-300">{summary.commands || 0}</span>
            </div>
            <div className="p-2 rounded-lg bg-sky-950/20 border border-sky-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-sky-400 uppercase font-mono block">Daemon Poller</span>
                <span className="text-sm font-bold text-sky-300">
                  {poller?.isPolling ? 'ACTIVE' : 'READY'}
                </span>
              </div>
              <button
                onClick={handleTriggerPollOnce}
                disabled={testingPoll}
                className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 rounded text-[10px] font-semibold transition"
                title="Jalankan sinkronisasi 1x"
              >
                {testingPoll ? 'Sync...' : 'Sync 1x'}
              </button>
            </div>
          </div>
        )}

        {/* DIAGNOSTIC & CONNECTION HEALTH BANNER */}
        {diagnostic && (
          <div className="px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-zinc-400">Status Saluran:</span>
              {diagnostic.webhook?.active ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Webhook Aktif ({diagnostic.webhook.url})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                  Long-Polling Engine Aktif (Semua Tombol & Perintah Terbaca)
                </span>
              )}

              {diagnostic.webhook?.pending_updates > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
                  Antrean Pending: <b>{diagnostic.webhook.pending_updates}</b>
                </span>
              )}

              {diagnostic.webhook?.last_error_message && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px]" title={diagnostic.webhook.last_error_message}>
                  ⚠️ Error Webhook Telegram: {diagnostic.webhook.last_error_message}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSwitchToPolling}
                disabled={fixingMode}
                className="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 font-semibold text-[11px] transition flex items-center gap-1"
                title="Gunakan polling langsung agar Telegram tidak memfilter callback tombol"
              >
                <Zap className="w-3 h-3 text-purple-400" />
                <span>{fixingMode ? 'Memproses...' : 'Mode Polling (Rekomendasi)'}</span>
              </button>

              <button
                onClick={handleRegisterWebhookAuto}
                disabled={fixingMode}
                className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 font-semibold text-[11px] transition flex items-center gap-1"
                title="Daftarkan webhook URL domain ini dengan semua allowed_updates"
              >
                <RefreshCw className="w-3 h-3 text-sky-400" />
                <span>Pasang Webhook URL</span>
              </button>
            </div>
          </div>
        )}

        {/* FILTER & SEARCH BAR */}
        <div className="p-3 bg-zinc-950/40 border-b border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {['ALL', 'CALLBACK_QUERY', 'COMMAND', 'VIDEO', 'DOCUMENT', 'ERROR'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  filterType === tab
                    ? 'bg-sky-500 text-black shadow'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab === 'ALL' && 'Semua Log'}
                {tab === 'CALLBACK_QUERY' && '🔘 Tombol Interaktif'}
                {tab === 'COMMAND' && '⌨️ Perintah (/cmd)'}
                {tab === 'VIDEO' && '🎬 Video'}
                {tab === 'DOCUMENT' && '📄 Berkas'}
                {tab === 'ERROR' && '❌ Error Only'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Cari user, tombol, pesan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={handleClearLogs}
              disabled={clearing || logs.length === 0}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
              title="Bersihkan log"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan</span>
            </button>
          </div>
        </div>

        {/* LOGS LIST AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center text-zinc-500">
              <Terminal className="w-12 h-12 text-zinc-700 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-zinc-400">Belum ada request tercatat</p>
              <p className="text-xs text-zinc-600 max-w-sm mt-1">
                Kirim pesan atau klik salah satu tombol interaktif pada bot Telegram untuk melihat live stream log di sini secara instan.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isSuccess = log.status === 'SUCCESS';
              const isError = log.status === 'ERROR';
              const isWarning = log.status === 'WARNING';

              return (
                <div
                  key={log.id}
                  className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                    isError
                      ? 'bg-rose-950/10 border-rose-500/40 hover:border-rose-500/60'
                      : isWarning
                      ? 'bg-amber-950/10 border-amber-500/40 hover:border-amber-500/60'
                      : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  {/* LOG ROW HEADER */}
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button className="text-zinc-500 hover:text-zinc-300">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      {isError && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}

                      <span className="text-zinc-500 text-[11px] font-mono shrink-0">{log.timeStr}</span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          log.source === 'WEBHOOK'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {log.source}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          log.type === 'CALLBACK_QUERY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : log.type === 'COMMAND'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : log.type === 'VIDEO'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {log.type}
                      </span>

                      <span className="text-zinc-200 font-semibold truncate text-xs">{log.payloadSummary}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-zinc-400 text-xs">
                      {log.username && (
                        <span className="hidden sm:inline text-zinc-400">@{log.username}</span>
                      )}
                      {log.latencyMs !== undefined && (
                        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                          {log.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {/* EXPANDABLE DETAILS */}
                  {isExpanded && (
                    <div className="p-3.5 bg-black/60 border-t border-zinc-800/80 space-y-3">
                      {/* USER / CONTEXT INFO */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                        <div>
                          <span className="text-zinc-500 block">User:</span>
                          <span className="text-zinc-300 font-bold">
                            {log.senderName || 'Anonymous'} {log.username ? `(@${log.username})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Chat ID / User ID:</span>
                          <span className="text-zinc-300 font-mono">
                            Chat: {log.chatId || '-'} • User: {log.userId || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Update ID:</span>
                          <span className="text-zinc-300 font-mono">#{log.updateId || '-'}</span>
                        </div>
                      </div>

                      {/* STEP-BY-STEP TRACE */}
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-sky-400" />
                          <span>Execution Step Trace</span>
                        </div>
                        <div className="space-y-1 bg-zinc-950/90 p-2.5 rounded-lg border border-zinc-800/80">
                          {log.steps.map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-[11px]">
                              <span className="text-zinc-500 font-mono shrink-0">[{s.time}]</span>
                              <span className={s.ok ? 'text-zinc-300' : 'text-rose-400 font-semibold'}>
                                {s.ok ? '✓' : '✗'} {s.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ERROR MESSAGE IF ANY */}
                      {log.error && (
                        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-[11px]">
                          <span className="font-bold block mb-0.5">Error Detail:</span>
                          <code className="break-all">{log.error}</code>
                        </div>
                      )}

                      {/* RAW JSON PAYLOAD */}
                      {log.rawPayload && (
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                            <span>Raw Telegram Update JSON:</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(JSON.stringify(log.rawPayload, null, 2), log.id);
                              }}
                              className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                            >
                              {copiedId === log.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin JSON</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 text-[10px] text-zinc-400 overflow-x-auto max-h-40 no-scrollbar">
                            {JSON.stringify(log.rawPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Telegram Bot Engine terhubung langsung dengan auto-acknowledgement (&lt;100ms response time).
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500">
              Ketik <code>/botlogs</code> di Telegram untuk cek log dari HP
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
