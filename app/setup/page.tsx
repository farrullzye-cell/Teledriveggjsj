'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  HardDrive,
  Bot,
  Send,
  Database,
  CheckCircle2,
  XCircle,
  Save,
  ArrowRight,
  ShieldAlert,
  Lock,
  RefreshCw,
  Sparkles,
  Zap,
  Download,
  Cloud,
  Server,
  Layers,
  Activity,
} from 'lucide-react';

interface ConfigStatus {
  database: boolean;
  telegram: boolean;
  storage: boolean;
  imagekit?: boolean;
  website_name: string;
  telegram_chat_id: string;
  is_token_set: boolean;
  bot_name?: string;
  bot_username?: string;
  imagekit_public_key?: string;
  imagekit_url_endpoint?: string;
  imagekit_default_folder?: string;
  imagekit_default_upload?: boolean;
  is_imagekit_key_set?: boolean;
  is_firestore_ready?: boolean;
}

export default function SetupPage() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [websiteName, setWebsiteName] = useState('RULLZYE CLOUD');
  const [telegramToken, setTelegramToken] = useState('');
  const [isChangingToken, setIsChangingToken] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // ImageKit Configuration States
  const [imagekitPublicKey, setImagekitPublicKey] = useState('');
  const [imagekitPrivateKey, setImagekitPrivateKey] = useState('');
  const [isChangingImagekitKey, setIsChangingImagekitKey] = useState(false);
  const [imagekitUrlEndpoint, setImagekitUrlEndpoint] = useState('');
  const [imagekitDefaultFolder, setImagekitDefaultFolder] = useState('/teledrive');
  const [imagekitDefaultUpload, setImagekitDefaultUpload] = useState(true);
  const [testingImageKit, setTestingImageKit] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);

  // Monetization & Ad Config States
  const [adMonetizationEnabled, setAdMonetizationEnabled] = useState(true);
  const [adPopunderRate, setAdPopunderRate] = useState<number>(100);
  const [adPopunderUrl, setAdPopunderUrl] = useState('https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js');
  const [adBannerTopHtml, setAdBannerTopHtml] = useState('<div class="w-full max-w-[800px] aspect-[4/1] mx-auto overflow-hidden flex items-center justify-center bg-[#0f1422] border border-amber-500/30 rounded-2xl p-2 shadow-lg"><script async="async" data-cfasync="false" src="https://pl30817733.effectivecpmnetwork.com/4045af9e74f05790b727b7c208314777/invoke.js"></script><div id="container-4045af9e74f05790b727b7c208314777"></div></div>');
  const [adPlayerOverlayHtml, setAdPlayerOverlayHtml] = useState('<div class="flex justify-center items-center my-1"><script>atOptions = {\'key\' : \'f8eb57861126a6d63865b2645c52d941\',\'format\' : \'iframe\',\'height\' : 60,\'width\' : 468,\'params\' : {}};</script><script src="https://www.highperformanceformat.com/f8eb57861126a6d63865b2645c52d941/invoke.js"></script></div>');

  // Adsterra Preset Generator States
  const [adsterraDirectLink, setAdsterraDirectLink] = useState('');
  const [adsterraBannerKey, setAdsterraBannerKey] = useState('');
  const [adsterraPlayerKey, setAdsterraPlayerKey] = useState('');

  const applyAdsterraPreset = (type: 'direct' | 'banner' | 'overlay' | 'all') => {
    let applied = 0;
    if ((type === 'direct' || type === 'all') && adsterraDirectLink.trim()) {
      let cleanUrl = adsterraDirectLink.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      setAdPopunderUrl(cleanUrl);
      applied++;
    }

    if ((type === 'banner' || type === 'all') && adsterraBannerKey.trim()) {
      const key = adsterraBannerKey.trim();
      const iframeHtml = `<iframe src="//www.highperformanceformat.com/${key}/invoke.html" width="728" height="90" frameborder="0" scrolling="no" style="max-width:100%; border:none; border-radius:12px;"></iframe>`;
      setAdBannerTopHtml(iframeHtml);
      applied++;
    }

    if ((type === 'overlay' || type === 'all') && adsterraPlayerKey.trim()) {
      const key = adsterraPlayerKey.trim();
      const iframeHtml = `<iframe src="//www.highperformanceformat.com/${key}/invoke.html" width="300" height="250" frameborder="0" scrolling="no" style="max-width:100%; border:none; border-radius:12px;"></iframe>`;
      setAdPlayerOverlayHtml(iframeHtml);
      applied++;
    }

    if (applied > 0) {
      showToast('success', `⚡ Preset Adsterra Berhasil Diterapkan ke Form Konfigurasi! Klik "Save Configuration" untuk menyimpan.`);
    } else {
      showToast('error', 'Masukkan URL Direct Link atau Key Unit Iklan Adsterra terlebih dahulu.');
    }
  };
  const [adNativeHtml, setAdNativeHtml] = useState('');

  // Action states
  const [saving, setSaving] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);

  // Notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    let isMounted = true;
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/config/status');
        const data = await res.json();
        if (isMounted) {
          setStatus(data);
          if (data.website_name) setWebsiteName(data.website_name);
          if (data.telegram_chat_id) setTelegramChatId(data.telegram_chat_id);
          if (data.imagekit_public_key) setImagekitPublicKey(data.imagekit_public_key);
          if (data.imagekit_url_endpoint) setImagekitUrlEndpoint(data.imagekit_url_endpoint);
          if (data.imagekit_default_folder) setImagekitDefaultFolder(data.imagekit_default_folder);
          if (data.imagekit_default_upload !== undefined) setImagekitDefaultUpload(data.imagekit_default_upload);
          if (data.ad_monetization_enabled !== undefined) setAdMonetizationEnabled(data.ad_monetization_enabled);
          if (data.ad_popunder_rate !== undefined) setAdPopunderRate(data.ad_popunder_rate);
          if (data.ad_popunder_url) setAdPopunderUrl(data.ad_popunder_url);
          if (data.ad_banner_top_html) setAdBannerTopHtml(data.ad_banner_top_html);
          if (data.ad_player_overlay_html) setAdPlayerOverlayHtml(data.ad_player_overlay_html);
          if (data.ad_native_html) setAdNativeHtml(data.ad_native_html);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (isMounted) {
          showToast('error', 'Gagal memuat status konfigurasi');
          setLoading(false);
        }
      }
    };
    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config/status');
      const data = await res.json();
      setStatus(data);
      if (data.website_name) setWebsiteName(data.website_name);
      if (data.telegram_chat_id) setTelegramChatId(data.telegram_chat_id);
      if (data.imagekit_public_key) setImagekitPublicKey(data.imagekit_public_key);
      if (data.imagekit_url_endpoint) setImagekitUrlEndpoint(data.imagekit_url_endpoint);
      if (data.imagekit_default_folder) setImagekitDefaultFolder(data.imagekit_default_folder);
      if (data.imagekit_default_upload !== undefined) setImagekitDefaultUpload(data.imagekit_default_upload);
      if (data.ad_monetization_enabled !== undefined) setAdMonetizationEnabled(data.ad_monetization_enabled);
      if (data.ad_popunder_rate !== undefined) setAdPopunderRate(data.ad_popunder_rate);
      if (data.ad_popunder_url) setAdPopunderUrl(data.ad_popunder_url);
      if (data.ad_banner_top_html) setAdBannerTopHtml(data.ad_banner_top_html);
      if (data.ad_player_overlay_html) setAdPlayerOverlayHtml(data.ad_player_overlay_html);
      if (data.ad_native_html) setAdNativeHtml(data.ad_native_html);
    } catch (e) {
      console.error(e);
      showToast('error', 'Gagal memuat status konfigurasi');
    } finally {
      setLoading(false);
    }
  };

  const handleTestImageKit = async () => {
    setTestingImageKit(true);
    try {
      const activePrivKey = (!status?.is_imagekit_key_set || isChangingImagekitKey) ? imagekitPrivateKey : '';
      const res = await fetch('/api/test-imagekit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: imagekitPublicKey,
          privateKey: activePrivKey,
          urlEndpoint: imagekitUrlEndpoint,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('success', `✅ ImageKit Terhubung (${data.message || 'Akun Valid & Aktif'})`);
        fetchStatus();
      } else {
        showToast('error', `❌ ImageKit Gagal: ${data.message || data.error}`);
      }
    } catch (err: any) {
      showToast('error', '❌ Gagal menguji koneksi ImageKit');
    } finally {
      setTestingImageKit(false);
    }
  };

  const handleSyncFirestore = async () => {
    setSyncingFirestore(true);
    try {
      showToast('info', 'Sedang menyinkronkan seluruh database & konfigurasi ke Firestore...');
      const res = await fetch('/api/admin/sync-firestore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `✅ Sync Berhasil! ${data.syncedFiles || 0} file & database terunggah permanen ke Firestore.`);
        fetchStatus();
      } else {
        showToast('error', `❌ Sync Gagal: ${data.message}`);
      }
    } catch (err: any) {
      showToast('error', '❌ Gagal melakukan sinkronisasi ke Firestore');
    } finally {
      setSyncingFirestore(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTg(true);
    try {
      const activeToken = (!status?.is_token_set || isChangingToken) ? telegramToken : '';
      const res = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('success', `✅ Telegram Connected (${data.botName || 'Bot'} ${data.username || ''})`);
        fetchStatus();
      } else {
        showToast('error', `❌ Telegram Connection Failed: ${data.error}`);
      }
    } catch (err: any) {
      showToast('error', '❌ Gagal menghubungi server');
    } finally {
      setTestingTg(false);
    }
  };

  const handleTestStorage = async () => {
    setTestingStorage(true);
    try {
      const activeToken = (!status?.is_token_set || isChangingToken) ? telegramToken : '';
      const res = await fetch('/api/test-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          chatId: telegramChatId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('success', '✅ Storage Chat Connected! Pesan tes telah terkirim.');
        fetchStatus();
      } else {
        showToast('error', `❌ Storage Chat Failed: ${data.error}`);
      }
    } catch (err: any) {
      showToast('error', '❌ Gagal tes storage chat');
    } finally {
      setTestingStorage(false);
    }
  };

  const handleStartPolling = async () => {
    setSettingWebhook(true);
    try {
      const res = await fetch('/api/telegram/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('success', '⚡ Long Polling 2 Detik Berhasil Diaktifkan! Silakan upload file dari Bot Telegram.');
        fetchStatus();
      } else {
        showToast('error', `❌ Gagal Mengaktifkan Polling: ${data.message || data.error}`);
      }
    } catch {
      showToast('error', '❌ Gagal menghubungi server polling');
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleCreateTopic = async () => {
    try {
      showToast('info', 'Sedang mengkonfigurasi topik & mengunggah backup database.json ke Telegram Group...');
      const res = await fetch('/api/telegram/topic', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('success', data.message);
      } else {
        showToast('error', `❌ ${data.message}`);
      }
    } catch {
      showToast('error', '❌ Gagal menghubungi endpoint topic');
    }
  };

  const handleRestoreFromCloud = async () => {
    try {
      showToast('info', 'Sedang memindai Telegram Cloud Storage & memulihkan file...');
      const res = await fetch('/api/telegram/restore', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('success', data.message);
        fetchStatus();
      } else {
        showToast('error', `❌ Gagal Restore: ${data.message}`);
      }
    } catch {
      showToast('error', '❌ Gagal melakukan restore dari Telegram');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminPin) {
      showToast('error', 'Admin PIN saat ini wajib diisi untuk menyimpan konfigurasi!');
      return;
    }

    setSaving(true);
    try {
      const activeToken = (!status?.is_token_set || isChangingToken) ? telegramToken : '';
      const activeImagekitKey = (!status?.is_imagekit_key_set || isChangingImagekitKey) ? imagekitPrivateKey : '';
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_name: websiteName,
          telegram_bot_token: activeToken,
          telegram_chat_id: telegramChatId,
          imagekit_public_key: imagekitPublicKey,
          imagekit_private_key: activeImagekitKey,
          imagekit_url_endpoint: imagekitUrlEndpoint,
          imagekit_default_folder: imagekitDefaultFolder,
          imagekit_default_upload: imagekitDefaultUpload,
          current_pin: adminPin,
          new_pin: newPin || undefined,
          ad_monetization_enabled: adMonetizationEnabled,
          ad_popunder_rate: adPopunderRate,
          ad_popunder_url: adPopunderUrl,
          ad_banner_top_html: adBannerTopHtml,
          ad_player_overlay_html: adPlayerOverlayHtml,
          ad_native_html: adNativeHtml,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showToast('success', '✅ Configuration & ImageKit Settings Saved!');
        setSaveSuccess(true);
        setIsChangingToken(false);
        setIsChangingImagekitKey(false);
        setTelegramToken('');
        setImagekitPrivateKey('');
        setAdminPin('');
        setNewPin('');
        fetchStatus();
      } else {
        showToast('error', `❌ ${data.message}`);
      }
    } catch (err: any) {
      showToast('error', '❌ Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#e5e5e5] flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
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

      <div className="w-full max-w-xl space-y-6 my-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-amber-500 rotate-45 mb-2 shadow-lg shadow-amber-500/10">
            <div className="w-5 h-5 bg-[#080808] rotate-45"></div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif-italic tracking-tight text-white">
            {websiteName} Setup
          </h1>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-zinc-500">
            System Initialization & Cloud Storage Config
          </p>
        </div>

        {/* Saved Confirmation Banner */}
        {saveSuccess && (
          <div className="bg-[#0c0c0c] border border-emerald-500/50 rounded-xl p-5 space-y-3 backdrop-blur-md animate-fade-in text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm uppercase tracking-wider">
              <CheckCircle2 className="w-5 h-5" />
              <span>Configuration Synchronized</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 bg-[#080808] p-3 rounded-lg border border-[#222222]">
              <div>
                Telegram: <span className="font-semibold text-emerald-400">Connected</span>
              </div>
              <div>
                Database: <span className="font-semibold text-emerald-400">Ready</span>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs tracking-wider uppercase transition shadow-lg shadow-emerald-500/10"
            >
              <span>RETURN TO MAIN DASHBOARD</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* System Status Panel */}
        <div className="bg-[#0c0c0c] border border-[#222222] rounded-xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#1a1a1a]">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              <span>SYSTEM DIAGNOSTICS</span>
            </h2>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="text-zinc-500 hover:text-amber-500 transition text-[11px] uppercase tracking-wider flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#080808] border border-[#1a1a1a] p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Firestore DB</span>
              {status?.is_firestore_ready || status?.database ? (
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  {status?.is_firestore_ready ? 'Firestore' : 'Local DB'}
                </span>
              ) : (
                <span className="text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  Offline
                </span>
              )}
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">ImageKit CDN</span>
              {status?.imagekit ? (
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  Active
                </span>
              ) : (
                <span className="text-amber-400 font-semibold text-xs uppercase tracking-wider">
                  Unconfigured
                </span>
              )}
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Telegram Bot</span>
              {status?.telegram ? (
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  Connected
                </span>
              ) : (
                <span className="text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  Unlinked
                </span>
              )}
            </div>

            <div className="bg-[#080808] border border-[#1a1a1a] p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Storage Chat</span>
              {status?.storage ? (
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  Active
                </span>
              ) : (
                <span className="text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  Unlinked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Setup Form */}
        <form onSubmit={handleSaveConfig} className="bg-[#0c0c0c] border border-[#222222] rounded-xl p-6 shadow-2xl space-y-5">
          {/* Website Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Website Name</label>
            <input
              type="text"
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              placeholder="RULLZYE CLOUD"
              required
              className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
            />
          </div>

          {/* IMAGEKIT.IO PRIMARY STORAGE CONFIGURATION */}
          <div className="border border-amber-500/40 rounded-xl p-4 bg-[#0a0f16] space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  ImageKit.io (Primary Media Storage &amp; CDN)
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold border ${
                status?.imagekit
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}>
                {status?.imagekit ? 'Aktif' : 'Belum Dikonfigurasi'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                ImageKit Public Key
              </label>
              <input
                type="text"
                value={imagekitPublicKey}
                onChange={(e) => setImagekitPublicKey(e.target.value)}
                placeholder="public_xxxxxxxxxxxxxxxxxxxxxxxxxx="
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  ImageKit Private Key
                </label>
                {status?.is_imagekit_key_set && !isChangingImagekitKey && (
                  <button
                    type="button"
                    onClick={() => setIsChangingImagekitKey(true)}
                    className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 hover:text-amber-400 transition"
                  >
                    [ GANTI PRIVATE KEY ]
                  </button>
                )}
              </div>
              {status?.is_imagekit_key_set && !isChangingImagekitKey ? (
                <input
                  type="text"
                  disabled
                  value="••••••••••••••••••••••••••••"
                  className="w-full bg-[#080808] border border-[#1a1a1a] rounded-md px-3.5 py-2 text-xs text-zinc-600 cursor-not-allowed"
                />
              ) : (
                <input
                  type="password"
                  value={imagekitPrivateKey}
                  onChange={(e) => setImagekitPrivateKey(e.target.value)}
                  placeholder="private_xxxxxxxxxxxxxxxxxxxxxxxxxx="
                  className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition font-mono"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  URL-Endpoint
                </label>
                <input
                  type="text"
                  value={imagekitUrlEndpoint}
                  onChange={(e) => setImagekitUrlEndpoint(e.target.value)}
                  placeholder="https://ik.imagekit.io/your_id"
                  className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Default Folder
                </label>
                <input
                  type="text"
                  value={imagekitDefaultFolder}
                  onChange={(e) => setImagekitDefaultFolder(e.target.value)}
                  placeholder="/teledrive"
                  className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="imagekitDefaultUpload"
                  checked={imagekitDefaultUpload}
                  onChange={(e) => setImagekitDefaultUpload(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-[#080808]"
                />
                <label htmlFor="imagekitDefaultUpload" className="text-xs text-zinc-300 cursor-pointer">
                  Jadikan ImageKit sebagai <strong>Default Upload &amp; Streaming Target</strong>
                </label>
              </div>

              <button
                type="button"
                onClick={handleTestImageKit}
                disabled={testingImageKit}
                className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1.5"
              >
                <Activity className={`w-3 h-3 ${testingImageKit ? 'animate-spin' : ''}`} />
                <span>{testingImageKit ? 'Testing...' : 'Test ImageKit'}</span>
              </button>
            </div>
          </div>

          {/* Telegram Bot Token */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-amber-500" />
                <span>Telegram Bot Token</span>
              </label>
              {status?.is_token_set && !isChangingToken && (
                <button
                  type="button"
                  onClick={() => setIsChangingToken(true)}
                  className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 hover:text-amber-400 transition"
                >
                  [ CHANGE TOKEN ]
                </button>
              )}
            </div>

            {status?.is_token_set && !isChangingToken ? (
              <input
                type="text"
                disabled
                value="••••••••••••••••••••••••••••"
                className="w-full bg-[#080808] border border-[#1a1a1a] rounded-md px-3.5 py-2.5 text-xs text-zinc-600 cursor-not-allowed"
              />
            ) : (
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ"
                required={!status?.is_token_set}
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
            )}
          </div>

          {/* Storage Chat ID */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-amber-500" />
              <span>Storage Chat ID</span>
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="-100xxxxxxxxxx"
              required
              className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
            />
          </div>

          {/* Admin PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Admin Passcode PIN</span>
              </label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Default: 159357"
                required
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                New Passcode PIN (Optional)
              </label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New Passcode"
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
            </div>
          </div>

          {/* XVIDSHUB MONETIZATION & AD CONFIGURATION MANAGER */}
          <div className="border-t border-[#1a1a1a] pt-4 mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>XVIDSHUB Monetisasi & Script Iklan</span>
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={adMonetizationEnabled}
                  onChange={(e) => setAdMonetizationEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#1a1a1a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* ADSTERRA AUTO GENERATOR CARD */}
            <div className="bg-[#0b0f19] border border-amber-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded uppercase">Adsterra Preset Helper</span>
                  <span className="text-xs font-bold text-slate-200">Generator Iklan Adsterra</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">Tanpa Ubah File Publik Netlify</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Direct Link */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-300 block">
                    1. Adsterra Direct Link URL:
                  </label>
                  <input
                    type="text"
                    value={adsterraDirectLink}
                    onChange={(e) => setAdsterraDirectLink(e.target.value)}
                    placeholder="https://www.highratecpmgate.com/..."
                    className="w-full bg-[#04060a] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono placeholder-zinc-700"
                  />
                </div>

                {/* Banner 728x90 Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-300 block">
                    2. Banner 728x90 Adsterra Key:
                  </label>
                  <input
                    type="text"
                    value={adsterraBannerKey}
                    onChange={(e) => setAdsterraBannerKey(e.target.value)}
                    placeholder="Misal: a1b2c3d4e5f6..."
                    className="w-full bg-[#04060a] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono placeholder-zinc-700"
                  />
                </div>

                {/* Player Overlay 300x250 Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-300 block">
                    3. Overlay 300x250 Adsterra Key:
                  </label>
                  <input
                    type="text"
                    value={adsterraPlayerKey}
                    onChange={(e) => setAdsterraPlayerKey(e.target.value)}
                    placeholder="Misal: 9f8e7d6c5b4a..."
                    className="w-full bg-[#04060a] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono placeholder-zinc-700"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => applyAdsterraPreset('all')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded transition flex items-center space-x-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Terapkan Semua Preset Adsterra</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyAdsterraPreset('direct')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded border border-slate-700 transition"
                >
                  Terapkan Direct Link Saja
                </button>
              </div>
            </div>

            {/* Popunder Click Probability Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Popunder Click Rate (%)
                </label>
                <select
                  value={adPopunderRate}
                  onChange={(e) => setAdPopunderRate(Number(e.target.value))}
                  className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-amber-400 font-mono focus:outline-none transition"
                >
                  <option value={20}>20% (Setiap ~5 Klik User)</option>
                  <option value={30}>30% (Setiap ~3 Klik User - Recommended)</option>
                  <option value={50}>50% (Setiap 2 Klik User - Aggressive)</option>
                  <option value={100}>100% (Setiap Klik Layar)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Direct Link / Popunder URL
                </label>
                <input
                  type="url"
                  value={adPopunderUrl}
                  onChange={(e) => setAdPopunderUrl(e.target.value)}
                  placeholder="https://directlink-ad-url.com"
                  className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition font-mono"
                />
              </div>
            </div>

            {/* Banner Ad HTML */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                HTML / Script Banner Top (728x90)
              </label>
              <textarea
                rows={2}
                value={adBannerTopHtml}
                onChange={(e) => setAdBannerTopHtml(e.target.value)}
                placeholder="<a href='...'><img src='banner.jpg'/></a>"
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
              />
            </div>

            {/* In-Player Overlay Ad HTML */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                HTML / Script In-Player Overlay (Video Player)
              </label>
              <textarea
                rows={2}
                value={adPlayerOverlayHtml}
                onChange={(e) => setAdPlayerOverlayHtml(e.target.value)}
                placeholder="Script iklan banner overlay pemutar video..."
                className="w-full bg-[#080808] border border-[#222222] focus:border-amber-500 rounded-md px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Synchronizing...' : 'Save Configuration'}</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTg}
                className="py-2.5 px-3 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] text-amber-500 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{testingTg ? 'Testing...' : 'Test Bot'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestStorage}
                disabled={testingStorage}
                className="py-2.5 px-3 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] text-amber-500 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testingStorage ? 'Testing...' : 'Test Storage'}</span>
              </button>
            </div>

            {/* SYNC TO FIRESTORE PERMANENT BUTTON */}
            <button
              type="button"
              onClick={handleSyncFirestore}
              disabled={syncingFirestore}
              className="w-full py-2.5 px-3 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <Database className={`w-3.5 h-3.5 text-amber-400 ${syncingFirestore ? 'animate-spin' : ''}`} />
              <span>{syncingFirestore ? 'Sedang Menyinkronkan...' : '⚡ Push Database & Config ke Firestore (Permanen)'}</span>
            </button>

            <button
              type="button"
              onClick={handleStartPolling}
              disabled={settingWebhook}
              className="w-full py-2.5 px-3 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-amber-500/30 text-amber-400 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{settingWebhook ? 'Aktifkan Polling...' : '⚡ Aktifkan Bot Polling 2 Detik (Tanpa Webhook)'}</span>
            </button>

            <button
              type="button"
              onClick={handleCreateTopic}
              className="w-full py-2.5 px-3 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-blue-500/30 text-blue-400 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>📂 Buat Topik Metadata Group & Sync database.json</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreFromCloud}
              className="w-full py-2.5 px-3 rounded-md bg-[#111111] hover:bg-[#1a1a1a] border border-emerald-500/30 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>🔄 Restore / Sync Data (Pindah Hosting / Cloud Migration)</span>
            </button>

            <a
              href={`/api/v1/public/project-export?pin=${adminPin || '1234'}`}
              target="_blank"
              download
              className="w-full py-2.5 px-3 rounded-md bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 font-semibold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span>📦 Unduh Source Code Project ZIP (Khusus Halaman Privat Admin)</span>
            </a>

            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-md bg-[#080808] hover:bg-[#111111] border border-[#1a1a1a] text-zinc-400 hover:text-white font-medium text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

