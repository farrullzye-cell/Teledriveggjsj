'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Cloud,
  HardDrive,
  UploadCloud,
  Search,
  List,
  RefreshCw,
  XCircle,
  Play,
  File,
  CheckCircle,
  AlertCircle,
  Database,
  Link as LinkIcon
} from 'lucide-react';

interface Job {
  id: string;
  filename: string;
  sourceUrl: string;
  status: string;
  progress: number;
  speed: number;
  etaSeconds: number | null;
  bytesProcessed: number;
  totalBytes: number | null;
  createdAt: string;
  errorMessage?: string;
  videoId?: string;
}

export default function TeraboxDashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'jobs' | 'files' | 'settings'>('upload');
  
  // Upload State
  const [sourceUrl, setSourceUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [directory, setDirectory] = useState('/From: Other Applications/rullzyecloud/');
  const [category, setCategory] = useState('movie');
  const [autoRegister, setAutoRegister] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Jobs State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Storage State
  const [quota, setQuota] = useState<{ total: number, used: number } | null>(null);

  useEffect(() => {
    if (activeTab === 'jobs') fetchJobs();
    if (activeTab === 'settings') fetchQuota();
    
    let interval: any;
    if (activeTab === 'jobs') {
      interval = setInterval(fetchJobs, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchJobs = async () => {
    try {
      setLoadingJobs(true);
      const res = await fetch('/api/v1/terabox/remote-upload');
      const data = await res.json();
      if (data.success) {
        setJobs(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/v1/terabox/quota');
      const data = await res.json();
      if (data.success) {
        setQuota({ total: data.data.total, used: data.data.used });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartUpload = async () => {
    if (!sourceUrl) {
      setMessage({ text: 'Source URL is required', type: 'error' });
      return;
    }
    setUploading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const res = await fetch('/api/v1/terabox/remote-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl,
          filename,
          directory,
          category,
          autoRegisterVideo: autoRegister
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ text: 'Upload job created successfully!', type: 'success' });
        setSourceUrl('');
        setFilename('');
        setActiveTab('jobs');
      } else {
        setMessage({ text: data.error?.message || 'Failed to start upload', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm('Cancel this upload?')) return;
    await fetch(`/api/v1/terabox/remote-upload/${jobId}/cancel`, { method: 'POST' });
    fetchJobs();
  };

  const retryJob = async (jobId: string) => {
    await fetch(`/api/v1/terabox/remote-upload/${jobId}/retry`, { method: 'POST' });
    fetchJobs();
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/v1/terabox/remote-upload/${jobId}`, { method: 'DELETE' });
    fetchJobs();
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#080808] text-slate-200 font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <Cloud className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">TeraBox Integration</h1>
              <p className="text-sm text-slate-400">Remote Upload & Media Management</p>
            </div>
          </div>
          <Link href="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition">
            Back to Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('upload')} 
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upload' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <UploadCloud className="w-4 h-4 inline-block mr-2 mb-0.5" /> Remote Upload
          </button>
          <button 
            onClick={() => setActiveTab('jobs')} 
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'jobs' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <List className="w-4 h-4 inline-block mr-2 mb-0.5" /> Active Jobs
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Database className="w-4 h-4 inline-block mr-2 mb-0.5" /> Storage & Quota
          </button>
        </div>

        {/* Content - Upload */}
        {activeTab === 'upload' && (
          <div className="bg-[#111111] p-6 rounded-xl border border-slate-800 max-w-2xl">
            <h2 className="text-lg font-bold mb-4 text-white">Create Remote Upload Job</h2>
            
            {message.text && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Source URL <span className="text-rose-400">*</span></label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="url" 
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4" 
                    className="w-full bg-[#1a1a1a] border border-slate-700 rounded-lg py-2 pl-10 pr-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Filename (Optional)</label>
                <input 
                  type="text" 
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="Leave empty to auto-detect" 
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Directory (TeraBox)</label>
                <input 
                  type="text" 
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="movie">Movie</option>
                    <option value="episode">Episode</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoRegister}
                      onChange={(e) => setAutoRegister(e.target.checked)}
                      className="form-checkbox bg-[#1a1a1a] border-slate-700 rounded text-cyan-500 w-4 h-4 mr-2"
                    />
                    <span className="text-sm">Auto-register Video</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleStartUpload}
                  disabled={uploading}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center"
                >
                  {uploading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Starting Job...</>
                  ) : (
                    <><UploadCloud className="w-4 h-4 mr-2" /> Start Remote Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content - Jobs */}
        {activeTab === 'jobs' && (
          <div className="bg-[#111111] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-white">Upload Queue</h2>
              <button onClick={fetchJobs} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">
                <RefreshCw className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#1a1a1a] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Filename</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Speed</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active or historical jobs found.</td>
                    </tr>
                  ) : jobs.map(job => (
                    <tr key={job.id} className="hover:bg-[#151515] transition-colors">
                      <td className="px-4 py-3 max-w-[200px] truncate" title={job.filename}>
                        <div className="font-medium text-slate-200">{job.filename}</div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{job.sourceUrl}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          job.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          job.status === 'cancelled' ? 'bg-slate-700 text-slate-300' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {job.status === 'uploading' ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
                          {job.status}
                        </span>
                        {job.errorMessage && <div className="text-[10px] text-rose-400 mt-1 max-w-[150px] truncate" title={job.errorMessage}>{job.errorMessage}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${job.status === 'failed' ? 'bg-rose-500' : 'bg-cyan-500'}`} 
                              style={{ width: `${job.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{job.progress || 0}%</span>
                        </div>
                        {job.etaSeconds && <div className="text-[10px] text-slate-500 mt-0.5">ETA: {Math.ceil(job.etaSeconds / 60)}m {job.etaSeconds % 60}s</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{job.speed ? `${formatBytes(job.speed)}/s` : '-'}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {job.totalBytes ? formatBytes(job.totalBytes) : (job.bytesProcessed ? formatBytes(job.bytesProcessed) : '-')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          {['queued', 'downloading', 'preparing', 'uploading', 'finalizing'].includes(job.status) && (
                            <button onClick={() => cancelJob(job.id)} className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition" title="Cancel">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {['failed', 'cancelled'].includes(job.status) && (
                            <button onClick={() => retryJob(job.id)} className="p-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded transition" title="Retry">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {['completed', 'failed', 'cancelled'].includes(job.status) && (
                            <button onClick={() => deleteJob(job.id)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition" title="Delete Record">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {job.status === 'completed' && job.videoId && (
                            <Link href={`#`} className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition flex items-center" title="View Video">
                              <Play className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content - Settings */}
        {activeTab === 'settings' && (
          <div className="bg-[#111111] p-6 rounded-xl border border-slate-800 max-w-2xl">
            <h2 className="text-lg font-bold mb-4 text-white">TeraBox Account & Storage</h2>
            
            <div className="space-y-6">
              <div className="p-4 bg-[#1a1a1a] rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Connection Status</h3>
                  <p className="text-xs text-slate-400">Your backend is configured with TeraBox credentials.</p>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Connected
                </div>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-3">Cloud Quota</h3>
                
                {quota ? (
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Used: {formatBytes(quota.used)}</span>
                      <span className="text-slate-200 font-bold">{formatBytes(quota.total)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-cyan-500 rounded-full" 
                        style={{ width: `${(quota.used / quota.total) * 100}%` }}
                      />
                    </div>
                    <div className="text-right mt-2 text-xs text-slate-500">
                      {((quota.used / quota.total) * 100).toFixed(1)}% Utilized
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 animate-pulse">Loading quota information...</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
