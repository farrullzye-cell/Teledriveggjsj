'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, X, Plus, Trash2, RefreshCw, CheckCircle2, 
  ExternalLink, Copy, Check, Sliders, BarChart3, Globe, 
  Zap, ShieldAlert, Layers, PlayCircle, Eye, ArrowRight, MousePointerClick
} from 'lucide-react';
import { SmartlinkRecord, MonetizationSettings, MonetizationMode, RotationStrategy } from '@/lib/monetization';

interface MonetizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MonetizationModal({ isOpen, onClose }: MonetizationModalProps) {
  const [activeTab, setActiveTab] = useState<'smartlinks' | 'settings' | 'simulator' | 'analytics'>('smartlinks');
  const [config, setConfig] = useState<MonetizationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Single Smartlink Form
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkWeight, setNewLinkWeight] = useState(50);
  const [newLinkPriority, setNewLinkPriority] = useState(1);

  // Multi-Smartlink Generator Form
  const [genBaseUrl, setGenBaseUrl] = useState('https://otieuwou.net/4/8912345');
  const [genCount, setGenCount] = useState(5);
  const [genNamePrefix, setGenNamePrefix] = useState('Adsterra Stream Direct');
  const [genSubIdPrefix, setGenSubIdPrefix] = useState('adst_sub');
  const [genPlacement, setGenPlacement] = useState('video_player');
  const [generating, setGenerating] = useState(false);

  // Click Simulator State
  const [simClicks, setSimClicks] = useState<Array<{ clickNumber: number; triggered: boolean; smartlink?: string; mode: string }>>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/monetization/smartlinks');
      const data = await res.json();
      
      const configRes = await fetch('/api/v1/monetization/config');
      const configData = await configRes.json();

      if (configData.success) {
        setConfig({
          ...configData.monetization,
          smartlinks: data.smartlinks || [],
        });
      }
    } catch (e) {
      console.error('Failed to load monetization config:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (updates: Partial<MonetizationSettings>) => {
    try {
      setSaving(true);
      const res = await fetch('/api/v1/monetization/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => prev ? { ...prev, ...updates } : null);
        setStatusMsg({ text: 'Pengaturan monetisasi berhasil disimpan.', type: 'success' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setStatusMsg({ text: data.error?.message || 'Gagal menyimpan pengaturan.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSingleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkName || !newLinkUrl) return;

    try {
      setSaving(true);
      const res = await fetch('/api/v1/monetization/smartlinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLinkName,
          url: newLinkUrl,
          weight: newLinkWeight,
          priority: newLinkPriority,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewLinkName('');
        setNewLinkUrl('');
        fetchConfig();
        setStatusMsg({ text: 'Smartlink baru berhasil ditambahkan.', type: 'success' });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBatch = async () => {
    if (!genBaseUrl) return;
    try {
      setGenerating(true);
      const res = await fetch('/api/v1/monetization/smartlinks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: genBaseUrl,
          count: genCount,
          namePrefix: genNamePrefix,
          subIdPrefix: genSubIdPrefix,
          placementTag: genPlacement,
          weight: 50,
          priority: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `Berhasil meng-generate ${data.generatedCount} smartlink baru!`, type: 'success' });
        fetchConfig();
        setTimeout(() => setStatusMsg(null), 4000);
      } else {
        setStatusMsg({ text: data.error?.message || 'Gagal generate smartlink.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (link: SmartlinkRecord) => {
    try {
      const res = await fetch(`/api/v1/monetization/smartlinks/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !link.active }),
      });
      const data = await res.json();
      if (data.success) {
        fetchConfig();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Hapus smartlink ini dari pool?')) return;
    try {
      const res = await fetch(`/api/v1/monetization/smartlinks/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchConfig();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Test Simulator Click Step
  const simulateClick = async () => {
    try {
      setSimLoading(true);
      const res = await fetch('/api/v1/monetization/smartlinks/test-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: 'admin_live_test',
        }),
      });
      const data = await res.json();
      if (data.success && data.simulation) {
        setSimClicks(prev => [
          ...prev,
          {
            clickNumber: data.simulation.clickNumber,
            triggered: data.simulation.triggered,
            smartlink: data.simulation.selectedSmartlinkName || data.simulation.smartlinkUrl,
            mode: data.simulation.mode,
          }
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSimLoading(false);
    }
  };

  const resetSimulator = () => {
    setSimClicks([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-amber-500/10 text-slate-100 overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold text-white">Adsterra Smartlink & Monetization Engine</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${config?.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                  {config?.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Multi-Smartlink Generator, Interval Rotation 1-5, anti-abuse cooldown, & direct traffic routing.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMsg && (
          <div className={`py-2 px-6 text-xs font-bold flex items-center space-x-2 ${statusMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-b border-rose-500/30'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800/80 px-6 bg-slate-950/40 gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('smartlinks')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'smartlinks' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Smartlink Pool & Generator ({config?.smartlinks?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'settings' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Interval & Engine Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'simulator' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointerClick className="w-4 h-4" />
            <span>Live Click Simulator (1-5)</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'analytics' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Statistik Klik & CTR</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: SMARTLINK POOL & GENERATOR */}
          {activeTab === 'smartlinks' && (
            <div className="space-y-6">
              {/* Multi-Smartlink Generator Card */}
              <div className="p-5 bg-gradient-to-br from-amber-950/30 to-slate-900/80 border border-amber-500/30 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-extrabold text-white">⚡ Auto-Generate Banyak Smartlink Adsterra</h3>
                  </div>
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 font-mono px-2.5 py-0.5 rounded-full border border-amber-500/40">
                    Bulk SubID Variation
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Fitur ini akan secara otomatis membuat sekumpulan Smartlink dengan parameter tracking SubID, Placement, dan Random Hashing yang berbeda-beda untuk rotasi trafik optimal.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Base Smartlink URL Adsterra</label>
                    <input
                      type="url"
                      value={genBaseUrl}
                      onChange={(e) => setGenBaseUrl(e.target.value)}
                      placeholder="https://otieuwou.net/4/8912345 atau https://pl30817522..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Jumlah Link Dibuat</label>
                    <select
                      value={genCount}
                      onChange={(e) => setGenCount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-amber-400 outline-none font-mono"
                    >
                      <option value={3}>3 Smartlinks</option>
                      <option value={5}>5 Smartlinks</option>
                      <option value={10}>10 Smartlinks</option>
                      <option value={20}>20 Smartlinks</option>
                      <option value={30}>30 Smartlinks</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Nama Prefix</label>
                    <input
                      type="text"
                      value={genNamePrefix}
                      onChange={(e) => setGenNamePrefix(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">SubID Prefix</label>
                    <input
                      type="text"
                      value={genSubIdPrefix}
                      onChange={(e) => setGenSubIdPrefix(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">Placement Tag</label>
                    <input
                      type="text"
                      value={genPlacement}
                      onChange={(e) => setGenPlacement(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateBatch}
                  disabled={generating || !genBaseUrl}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-black" />}
                  <span>{generating ? 'Meng-generate Smartlinks...' : `Generate ${genCount} Smartlink Adsterra Sekarang`}</span>
                </button>
              </div>

              {/* Add Single Link Form */}
              <form onSubmit={handleAddSingleLink} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>Tambah Single Smartlink Manual</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Nama Label (contoh: Direct Popunder High-CPM)"
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="url"
                      placeholder="URL Smartlink (https://...)"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || !newLinkName || !newLinkUrl}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan ke Pool</span>
                  </button>
                </div>
              </form>

              {/* Smartlink Pool Table */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Daftar Smartlink Pool ({config?.smartlinks?.length || 0})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Rotasi Aktif: <strong className="text-amber-400">{config?.rotationStrategy}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Nama & URL Target</th>
                        <th className="px-4 py-3">SubID</th>
                        <th className="px-4 py-3 text-center">Klik</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {config?.smartlinks?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            Belum ada Smartlink dalam pool. Gunakan generator di atas untuk membuat.
                          </td>
                        </tr>
                      ) : (
                        config?.smartlinks?.map((link) => (
                          <tr key={link.id} className={`hover:bg-slate-800/40 transition ${!link.active ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleActive(link)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                                  link.active
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {link.active ? 'Aktif' : 'Nonaktif'}
                              </button>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <div className="font-sans font-bold text-slate-200 truncate">{link.name}</div>
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">{link.url}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-[10px]">
                              {link.subIds?.subid1 || '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-amber-400">
                              {link.clicks || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => copyToClipboard(link.url, link.id)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                                  title="Salin URL"
                                >
                                  {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition"
                                  title="Test Buka Link"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={() => handleDeleteLink(link.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                                  title="Hapus Link"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERVAL & ENGINE SETTINGS */}
          {activeTab === 'settings' && config && (
            <div className="space-y-6">
              {/* Master Switch & Interval Selector */}
              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Status Master Monetisasi</h3>
                    <p className="text-xs text-slate-400">Aktifkan atau nonaktifkan semua aksi monetisasi di seluruh website.</p>
                  </div>
                  <button
                    onClick={() => handleSaveSettings({ enabled: !config.enabled })}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition ${
                      config.enabled
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {config.enabled ? 'Monetisasi ON' : 'Monetisasi OFF'}
                  </button>
                </div>

                {/* Interval Selector (1 to 5) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-white block">Adsterra Click Interval (1 - 5)</label>
                      <p className="text-[11px] text-slate-400">Berapa klik user yang diperlukan untuk memicu aksi Smartlink sponsor.</p>
                    </div>
                    <span className="text-base font-mono font-black text-amber-400 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      Interval: {config.interval}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSaveSettings({ interval: num })}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                          config.interval === num
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-extrabold shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-sm font-mono">{num}</span>
                        <span className="text-[10px] uppercase tracking-tighter text-slate-400">
                          {num === 1 ? 'Tiap Klik' : `Klik ke-${num}`}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Visual Click Diagram */}
                  <div className="p-3 bg-black/60 border border-slate-800/80 rounded-2xl mt-2 text-xs font-mono">
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-2">Simulasi Alur Klik (Interval {config.interval}):</span>
                    <div className="flex items-center space-x-2 overflow-x-auto py-1">
                      {Array.from({ length: 6 }).map((_, idx) => {
                        const clickNum = idx + 1;
                        const isAd = (clickNum % config.interval) === 0;
                        return (
                          <React.Fragment key={clickNum}>
                            <div className={`px-2.5 py-1.5 rounded-lg border text-center shrink-0 ${
                              isAd ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}>
                              <span className="block text-[9px] text-slate-500">Klik #{clickNum}</span>
                              <span className="text-[11px]">{isAd ? '💎 SMARTLINK' : '🎬 Video'}</span>
                            </div>
                            {clickNum < 6 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Mode and Rotation Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">Monetization Trigger Mode</label>
                    <select
                      value={config.mode}
                      onChange={(e) => handleSaveSettings({ mode: e.target.value as MonetizationMode })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono outline-none focus:border-amber-400"
                    >
                      <option value="new_tab">new_tab (Buka tab baru - Direkomendasikan)</option>
                      <option value="interstitial">interstitial (Modal pop-up hitung mundur)</option>
                      <option value="redirect">redirect (Alihkan halaman langsung)</option>
                      <option value="disabled">disabled (Nonaktifkan sementara)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">Strategi Rotasi Smartlink Pool</label>
                    <select
                      value={config.rotationStrategy}
                      onChange={(e) => handleSaveSettings({ rotationStrategy: e.target.value as RotationStrategy })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono outline-none focus:border-amber-400"
                    >
                      <option value="round_robin">Round Robin (Bergantian berurutan)</option>
                      <option value="weighted_random">Weighted Random (Berdasarkan bobot %)</option>
                      <option value="priority">Priority (Tingkat prioritas tertinggi dulu)</option>
                      <option value="category_target">Category Targetting (Sesuai kategori video)</option>
                    </select>
                  </div>
                </div>

                {/* Cooldown Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">Cooldown Anti-Spam (Detik)</label>
                    <input
                      type="number"
                      value={config.cooldownSeconds}
                      onChange={(e) => handleSaveSettings({ cooldownSeconds: Number(e.target.value) })}
                      min={0}
                      max={300}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono outline-none focus:border-amber-400"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Jeda waktu minimum antar penayangan iklan untuk user yang sama.</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">Trigger Event</label>
                    <select
                      value={config.trigger}
                      onChange={(e) => handleSaveSettings({ trigger: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono outline-none focus:border-amber-400"
                    >
                      <option value="video_click">video_click (Klik Video Card)</option>
                      <option value="play_button">play_button (Klik Tombol Play Video)</option>
                      <option value="download_button">download_button (Klik Unduh File)</option>
                      <option value="any_action">any_action (Semua Interaksi Media)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE CLICK SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Simulator Klik Server Adsterra</h3>
                    <p className="text-xs text-slate-400">
                      Uji coba respons endpoint <code>POST /api/v1/monetization/click</code> untuk memverifikasi interval hitungan klik 1..5.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={resetSimulator}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                    >
                      Reset Simulasi
                    </button>
                    <button
                      onClick={simulateClick}
                      disabled={simLoading}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs transition shadow-lg shadow-amber-500/20 flex items-center space-x-2"
                    >
                      <MousePointerClick className="w-4 h-4" />
                      <span>{simLoading ? 'Mengirim Klik...' : `Klik #${simClicks.length + 1} (Simulasikan)`}</span>
                    </button>
                  </div>
                </div>

                {/* Simulation Click Log Stream */}
                <div className="space-y-2 pt-2">
                  {simClicks.length === 0 ? (
                    <div className="p-8 text-center bg-black/40 border border-slate-800 rounded-2xl text-slate-500 text-xs font-mono">
                      Klik tombol <strong>&quot;Simulasikan Klik&quot;</strong> di atas untuk melihat bagaimana interval trigger bekerja secara real-time.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {simClicks.map((c, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition ${
                            c.triggered
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center font-bold text-white">
                              #{c.clickNumber}
                            </span>
                            <div>
                              <strong className="text-white block">
                                {c.triggered ? '🎯 SMARTLINK TRIGGERED!' : '🎬 Normal Video View'}
                              </strong>
                              {c.smartlink && (
                                <span className="text-[10px] text-slate-400 truncate block max-w-md">
                                  Target: {c.smartlink}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.triggered ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                            }`}>
                              Mode: {c.mode}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">TOTAL SMARTLINKS</span>
                  <div className="text-2xl font-black text-white font-mono">{config?.smartlinks?.length || 0} Link</div>
                  <p className="text-[10px] text-slate-400">{config?.smartlinks?.filter(s => s.active).length} link aktif dalam rotasi</p>
                </div>

                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">TOTAL TAYANGAN IKLAN</span>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {config?.smartlinks?.reduce((acc, s) => acc + (s.clicks || 0), 0)} Klik
                  </div>
                  <p className="text-[10px] text-slate-400">Tercatat di Firestore click_events</p>
                </div>

                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase font-mono">INTERVAL SETTING</span>
                  <div className="text-2xl font-black text-cyan-400 font-mono">{config?.interval} Klik / Iklan</div>
                  <p className="text-[10px] text-slate-400">Mode: {config?.mode}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
