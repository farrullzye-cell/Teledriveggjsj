'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { 
  Play, Download, Share2, Eye, ThumbsUp, ArrowLeft, 
  ExternalLink, Copy, Check, Code, ShieldCheck, Film, Sparkles, AlertCircle
} from 'lucide-react';

interface FileDetail {
  id: string;
  name: string;
  type: string;
  mime: string;
  size: number;
  size_formatted?: string;
  uploaded_at: string;
  views?: number;
  likes?: number;
  vault_id?: string;
  vault_name?: string;
  media_url?: string;
  download_url?: string;
  thumbnail_url?: string;
}

export default function WatchVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const videoId = resolvedParams.id;

  const [video, setVideo] = useState<FileDetail | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<FileDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [interstitialAd, setInterstitialAd] = useState<{ url: string; openInNewTab?: boolean } | null>(null);
  const [adCountdown, setAdCountdown] = useState(5);

  useEffect(() => {
    async function loadVideo() {
      try {
        setLoading(true);
        const res = await fetch(`/api/files/${videoId}`);
        const data = await res.json();
        
        if (data.success && data.file) {
          const f = data.file;
          const host = window.location.origin;
          const directUrl = f.imagekit_url || `/api/files/${f.id}/download`;
          
          setVideo({
            id: f.id,
            name: f.name,
            type: f.type,
            mime: f.mime,
            size: f.size,
            uploaded_at: f.uploaded_at,
            views: f.views || 0,
            likes: f.likes || 0,
            vault_name: f.vault_name || 'General Storage',
            media_url: directUrl,
            download_url: `/api/files/${f.id}/download`,
            thumbnail_url: f.imagekit_thumbnail_url || `/api/thumbnail/${f.id}`,
          });
          setLikeCount(f.likes || 0);

          // Send view count
          fetch('/api/v1/public/media/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: f.id, action: 'view' })
          }).catch(() => {});
        }

        // Fetch related videos
        const relRes = await fetch('/api/v1/public/media');
        const relData = await relRes.json();
        if (relData.success && Array.isArray(relData.media)) {
          setRelatedVideos(relData.media.filter((m: any) => m.id !== videoId).slice(0, 8));
        }
      } catch (err) {
        console.error('Failed to load video:', err);
      } finally {
        setLoading(false);
      }
    }

    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  // Handle Play Click / User Action with Monetization Trigger
  const handlePlayAction = async () => {
    try {
      const res = await fetch('/api/v1/monetization/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          categoryId: video?.vault_id,
          triggerType: 'play_button',
        }),
      });
      const data = await res.json();
      
      if (data.success && data.data?.triggered && data.data?.smartlinkUrl) {
        const smartUrl = data.data.smartlinkUrl;
        const mode = data.data.mode;

        if (mode === 'new_tab') {
          window.open(smartUrl, '_blank');
        } else if (mode === 'redirect') {
          window.location.href = smartUrl;
        } else if (mode === 'interstitial') {
          setInterstitialAd({ url: smartUrl });
          setAdCountdown(5);
        }
      }
    } catch (e) {
      console.warn('Monetization click dispatch error:', e);
    }
  };

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(prev => prev + 1);
    fetch('/api/v1/public/media/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, action: 'like' })
    }).catch(() => {});
  };

  const copyEmbedCode = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/${videoId}" width="100%" height="450" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-mono">Memuat Video Player...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[#070A13] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Video Tidak Ditemukan</h2>
          <p className="text-sm text-slate-400">Berkas video mungkin telah dipindahkan atau dihapus dari penyimpanan.</p>
          <Link href="/public-portal" className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/public-portal"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition flex items-center text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Katalog Publik</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black text-xs shadow-md">
              RC
            </div>
            <span className="font-extrabold text-sm tracking-tight hidden sm:inline text-white">RULLZYE VIDEO STREAM</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={copyShareLink}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
          >
            {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copiedShare ? 'Tersalin' : 'Bagikan'}</span>
          </button>
          <button
            onClick={copyEmbedCode}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
          >
            {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copiedEmbed ? 'Embed Tersalin' : 'Embed Code'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main Player & Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* High Speed Responsive Video Player */}
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <video
              src={video.media_url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onPlay={handlePlayAction}
              className="w-full h-full object-contain"
              poster={video.thumbnail_url}
            >
              Browser Anda tidak mendukung HTML5 video tag.
            </video>
          </div>

          {/* Video Title & Actions */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold uppercase tracking-wider">
                  {video.vault_name}
                </span>
                <h1 className="text-lg sm:text-xl font-extrabold text-white mt-1.5 leading-snug">{video.name}</h1>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleLike}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center space-x-1.5 ${
                    liked 
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>{likeCount}</span>
                </button>

                <a
                  href={video.download_url}
                  onClick={handlePlayAction}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-cyan-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File ({formatSize(video.size)})</span>
                </a>
              </div>
            </div>

            {/* Video Stats & Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono text-slate-400 pt-1">
              <div>
                <span className="text-slate-500 block text-[10px]">TOTAL TAYANG</span>
                <strong className="text-slate-200 flex items-center gap-1 mt-0.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" /> {video.views} Tayangan
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">UKURAN BERKAS</span>
                <strong className="text-slate-200 mt-0.5 block">{formatSize(video.size)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">FORMAT & MIME</span>
                <strong className="text-slate-200 mt-0.5 block">{video.mime || 'video/mp4'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TANGGAL UPLOAD</span>
                <strong className="text-slate-200 mt-0.5 block">{new Date(video.uploaded_at).toLocaleDateString()}</strong>
              </div>
            </div>
          </div>

          {/* Embed Code Snippet Box */}
          <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-cyan-400" />
                Sematkan Video di Website Eksternal (iFrame Embed)
              </span>
              <button
                onClick={copyEmbedCode}
                className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
              >
                {copiedEmbed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedEmbed ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <div className="p-3 bg-black/70 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-400 select-all overflow-x-auto">
              {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${videoId}" width="100%" height="450" frameborder="0" allowfullscreen></iframe>`}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Related Videos & Monetization Slot */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" />
              Video Menarik Lainnya
            </h3>

            <div className="space-y-3">
              {relatedVideos.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada video terkait lainnya.</p>
              ) : (
                relatedVideos.map((item) => (
                  <Link
                    key={item.id}
                    href={`/watch/${item.id}`}
                    className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition group"
                  >
                    <div className="w-24 h-16 bg-black rounded-xl overflow-hidden shrink-0 relative">
                      <img
                        src={item.thumbnail_url || `/api/thumbnail/${item.id}`}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 line-clamp-2 group-hover:text-cyan-400 transition leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">{item.vault_name}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Interstitial Monetization Modal */}
      {interstitialAd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl shadow-amber-500/10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white">Sponsor RULLZYE STREAM</h3>
            <p className="text-xs text-slate-400">
              Tautan sponsor akan terbuka untuk mendukung kelangsungan hosting server video kami.
            </p>
            <div className="p-3 bg-black/50 border border-slate-800 rounded-2xl text-xs font-mono text-amber-400 truncate">
              {interstitialAd.url}
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setInterstitialAd(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                Tutup Iklan
              </button>
              <a
                href={interstitialAd.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setInterstitialAd(null)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                Buka Sponsor
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
