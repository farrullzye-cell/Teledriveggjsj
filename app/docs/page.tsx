'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Code,
  ArrowLeft,
  Copy,
  Check,
  Globe,
  Sparkles,
  Server,
  Play,
  FileText,
  Image as ImageIcon,
  Download,
  Video,
  Layers,
  Zap,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleTestRequest = async (endpoint: string) => {
    setTestingEndpoint(endpoint);
    setTestResponse(null);
    try {
      const res = await fetch(`${baseUrl}${endpoint}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setTestResponse(JSON.stringify(data, null, 2));
      } else {
        setTestResponse(`[Binary / Media Response - HTTP ${res.status}]\nContent-Type: ${contentType}\nContent-Length: ${res.headers.get('content-length') || 'streaming'}`);
      }
    } catch (e: any) {
      setTestResponse(`Error: ${e.message}`);
    } finally {
      setTestingEndpoint(null);
    }
  };

  const endpoints = [
    {
      id: 'thumbnail',
      method: 'GET',
      path: '/api/v1/public/thumbnail/{id}',
      badge: 'NEW & ULTRA FAST',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Render & Stream Media Thumbnail',
      description: 'Menyajikan thumbnail resolusi tinggi untuk file video atau foto. Menggunakan cache ultra cepat tanpa membebani bandwidth dan tanpa perlu streaming seluruh file video.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID unik file pada sistem RULLZYE CLOUD' }
      ],
      returns: 'image/jpeg atau image/svg+xml binary image stream',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/thumbnail/file_1723548912_abc"`,
      js: (url: string) => `// Gunakan langsung di tag <img> pada website Netlify atau React
const thumbnailSrc = "${url}/api/v1/public/thumbnail/" + fileId;
document.getElementById('videoThumb').src = thumbnailSrc;`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/thumbnail/file_1723548912_abc")
with open("thumbnail.jpg", "wb") as f:
    f.write(res.content)`,
      php: (url: string) => `<?php
$thumbnailUrl = "${url}/api/v1/public/thumbnail/file_1723548912_abc";
echo '<img src="' . $thumbnailUrl . '" alt="Thumbnail Video" />';
?>`
    },
    {
      id: 'download-stream',
      method: 'GET',
      path: '/api/v1/public/download/{id}',
      badge: 'HTTP 206 RANGE STREAM',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Video Streaming (>15MB) & Direct Download',
      description: 'Streaming file video atau download binary dengan dukungan Range Header (HTTP 206 Partial Content) untuk seek frame instan dan anti-buffering pada video besar (>15MB, 50MB, 100MB).',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID unik file' },
        { name: 'inline', type: 'boolean (Query)', required: false, desc: 'Set `true` untuk pemutaran streaming langsung di tag <video> / browser' }
      ],
      returns: 'Binary video stream (video/mp4) atau file payload attachment',
      curl: (url: string) => `curl -X GET -H "Range: bytes=0-1048575" "${url}/api/v1/public/download/file_1723548912_abc?inline=true" -o chunk.mp4`,
      js: (url: string) => `// Streaming langsung di HTML5 video tag
<video controls preload="metadata" playsinline>
  <source src="${url}/api/v1/public/download/\${fileId}?inline=true" type="video/mp4" />
  Browser tidak mendukung video tag.
</video>`,
      python: (url: string) => `import requests

headers = {"Range": "bytes=0-1048575"}
res = requests.get("${url}/api/v1/public/download/file_1723548912_abc?inline=true", headers=headers)
print("HTTP Status:", res.status_code) # 206 Partial Content`,
      php: (url: string) => `<?php
$streamUrl = "${url}/api/v1/public/download/file_1723548912_abc?inline=true";
header("Location: " . $streamUrl);
exit;
?>`
    },
    {
      id: 'media',
      method: 'GET',
      path: '/api/v1/public/media',
      badge: 'NETLIFY GALLERY READY',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Get Formatted Media Gallery Collection',
      description: 'Mengambil daftar seluruh media video dan foto dengan metadata lengkap (thumbnail_url, media_url, views, likes, kategori vault) siap konsumsi untuk Netlify client site.',
      params: [
        { name: 'category', type: 'string', required: false, desc: 'Filter kategori (ALL | PHOTOS | VIDEOS | DOCUMENTS)' },
        { name: 'vault_id', type: 'string', required: false, desc: 'Filter berdasarkan ID Topic Vault' },
        { name: 'limit', type: 'integer', required: false, desc: 'Jumlah media maksimal (default: 50)' }
      ],
      returns: 'JSON Object { success: true, count: number, media: Array<MediaItem> }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/media?category=ALL"`,
      js: (url: string) => `fetch("${url}/api/v1/public/media?category=ALL")
  .then(res => res.json())
  .then(data => {
    console.log("Total Media:", data.count);
    data.media.forEach(item => {
      console.log(item.title, item.thumbnail_url, item.media_url);
    });
  });`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/media?category=ALL")
data = res.json()
print("Success:", data.get("success"))
print("Media count:", len(data.get("media", [])))`,
      php: (url: string) => `<?php
$json = file_get_contents("${url}/api/v1/public/media?category=ALL");
$data = json_decode($json, true);
foreach ($data['media'] as $item) {
    echo "<h3>" . htmlspecialchars($item['title']) . "</h3>";
    echo "<img src='" . $item['thumbnail_url'] . "' />";
}
?>`
    },
    {
      id: 'files',
      method: 'GET',
      path: '/api/v1/public/files',
      badge: 'SEARCH & PAGINATION',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      title: 'List Public Files with Filter & Pagination',
      description: 'Daftar semua repository file yang diunggah dengan pencarian nama dan filter tipe file.',
      params: [
        { name: 'search', type: 'string', required: false, desc: 'Pencarian kata kunci nama file' },
        { name: 'type', type: 'string', required: false, desc: 'ALL | PHOTOS | VIDEOS | FILES' },
        { name: 'vault_id', type: 'string', required: false, desc: 'Filter ID Vault' },
        { name: 'limit', type: 'integer', required: false, desc: 'Limit per halaman (default: 100)' },
        { name: 'offset', type: 'integer', required: false, desc: 'Offset item (default: 0)' }
      ],
      returns: 'JSON Object { success: true, total: number, files: Array<FileItem> }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/files?search=RULLZYE&limit=20"`,
      js: (url: string) => `fetch("${url}/api/v1/public/files?limit=20")
  .then(res => res.json())
  .then(data => console.log(data.files));`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/files?limit=20")
print(res.json())`,
      php: (url: string) => `<?php
$res = file_get_contents("${url}/api/v1/public/files?limit=20");
$files = json_decode($res, true)['files'];
?>`
    },
    {
      id: 'status',
      method: 'GET',
      path: '/api/v1/public/status',
      badge: 'HEALTH CHECK',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Backend Health & Storage Status',
      description: 'Mengecek ketersediaan server backend, uptime, dan sinkronisasi 24/7 Google Cloud Firestore.',
      params: [],
      returns: 'JSON Object { success: true, status: "ONLINE", uptime: "99.99%", total_files: number }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/status"`,
      js: (url: string) => `fetch("${url}/api/v1/public/status")
  .then(res => res.json())
  .then(data => console.log("Status Server:", data.status));`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/status")
print(res.json())`,
      php: (url: string) => `<?php
$status = json_decode(file_get_contents("${url}/api/v1/public/status"), true);
echo "Backend Status: " . $status['status'];
?>`
    }
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header Navigation */}
      <header className="bg-[#0b1222] border-b border-cyan-900/60 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center text-xs font-semibold border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <div className="w-7 h-7 bg-cyan-500/20 border border-cyan-500/50 rounded-lg flex items-center justify-center text-cyan-400">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                <span>RULLZYE CLOUD — REST API Documentation</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-700/80">
                  v2.5.0 FULL SUITE
                </span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono">Siap Integrasi Netlify, Video Streaming, & Thumbnail Engine</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/v1/public/docs"
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>OpenAPI JSON</span>
            <ExternalLink className="w-3 h-3 text-slate-500 ml-0.5" />
          </a>

          <a
            href="/public-portal"
            target="_blank"
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Netlify Portal Hub</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Banner Overview */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d182e] via-[#0b1324] to-[#120e24] border border-cyan-700/50 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">REST API 100% ONLINE & READY</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Integrasi Cloud Media, Video Stream 206, & Thumbnail
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                Gunakan REST API ini untuk menghubungkan website Netlify, portal video kustom, aplikasi mobile, atau bot telegram ke repositori penyimpanan awan berkecepatan tinggi dengan rendering video & thumbnail instan.
              </p>
            </div>

            <div className="bg-black/50 p-3.5 rounded-xl border border-cyan-500/30 space-y-1 shrink-0 font-mono text-xs">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">Base API URL:</span>
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold select-all">{baseUrl}/api/v1/public</span>
                <button
                  onClick={() => copyToClipboard(`${baseUrl}/api/v1/public`, 'base_url')}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Copy Base URL"
                >
                  {copiedIndex === 'base_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Highlight Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Ultra Fast Thumbnails</h4>
                <p className="text-[11px] text-slate-400 font-mono">Render thumbnail instan tanpa membebani browser</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Video Stream &gt;15MB</h4>
                <p className="text-[11px] text-slate-400 font-mono">HTTP 206 Partial Content range seek lancar</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Firestore 24/7 Sync</h4>
                <p className="text-[11px] text-slate-400 font-mono">Metadata terproteksi permanen di cloud</p>
              </div>
            </div>
          </div>
        </div>

        {/* Language Code Selector */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Endpoint REST API &amp; Panduan Integrasi
            </h3>
          </div>

          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono">
            <button
              onClick={() => setActiveLang('curl')}
              className={`px-3 py-1 rounded-lg transition ${activeLang === 'curl' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              cURL
            </button>
            <button
              onClick={() => setActiveLang('js')}
              className={`px-3 py-1 rounded-lg transition ${activeLang === 'js' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              JavaScript
            </button>
            <button
              onClick={() => setActiveLang('python')}
              className={`px-3 py-1 rounded-lg transition ${activeLang === 'python' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Python
            </button>
            <button
              onClick={() => setActiveLang('php')}
              className={`px-3 py-1 rounded-lg transition ${activeLang === 'php' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'}`}
            >
              PHP
            </button>
          </div>
        </div>

        {/* Endpoints List */}
        <div className="space-y-6">
          {endpoints.map((ep) => {
            const currentSnippet = activeLang === 'curl' ? ep.curl(baseUrl) : activeLang === 'js' ? ep.js(baseUrl) : activeLang === 'python' ? ep.python(baseUrl) : ep.php(baseUrl);

            return (
              <div
                key={ep.id}
                id={ep.id}
                className="bg-[#0b1222] border border-slate-800 hover:border-cyan-800/80 rounded-2xl p-5 sm:p-6 shadow-xl transition space-y-4"
              >
                {/* Method & Path Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg font-mono font-black text-xs bg-emerald-500 text-black">
                      {ep.method}
                    </span>
                    <span className="font-mono font-bold text-sm text-cyan-300 select-all">
                      {ep.path}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${ep.badgeColor}`}>
                      {ep.badge}
                    </span>
                  </div>

                  <button
                    onClick={() => handleTestRequest(ep.path.replace('{id}', 'demo'))}
                    disabled={testingEndpoint === ep.path}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition shrink-0"
                  >
                    <Play className="w-3 h-3 fill-cyan-400" />
                    <span>{testingEndpoint === ep.path ? 'Menguji...' : 'Test Request'}</span>
                  </button>
                </div>

                {/* Description & Details */}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{ep.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{ep.description}</p>
                </div>

                {/* Parameters Table */}
                {ep.params.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Parameter Request:
                    </span>
                    <div className="overflow-x-auto bg-[#070b14] border border-slate-800/80 rounded-xl p-3">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-slate-500 font-mono border-b border-slate-800 pb-1 text-[11px]">
                            <th className="pb-1.5">Nama</th>
                            <th className="pb-1.5">Tipe</th>
                            <th className="pb-1.5">Wajib</th>
                            <th className="pb-1.5">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {ep.params.map((p) => (
                            <tr key={p.name}>
                              <td className="py-1.5 text-cyan-400 font-bold">{p.name}</td>
                              <td className="py-1.5 text-slate-400">{p.type}</td>
                              <td className="py-1.5">
                                {p.required ? (
                                  <span className="text-rose-400 font-bold">Wajib</span>
                                ) : (
                                  <span className="text-slate-500">Opsional</span>
                                )}
                              </td>
                              <td className="py-1.5 text-slate-300">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Code Snippet Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="uppercase tracking-wider">Contoh Kode ({activeLang.toUpperCase()}):</span>
                    <button
                      onClick={() => copyToClipboard(currentSnippet, ep.id)}
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
                    >
                      {copiedIndex === ep.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[#040811] border border-slate-900 text-xs font-mono text-cyan-300/90 overflow-x-auto leading-relaxed">
                    <code>{currentSnippet}</code>
                  </pre>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Test Response Terminal Box */}
        {testResponse && (
          <div className="p-5 bg-black border border-cyan-500/50 rounded-2xl shadow-2xl space-y-2 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <Terminal className="w-4 h-4" />
                <span>Live Test Response Output</span>
              </div>
              <button
                onClick={() => setTestResponse(null)}
                className="text-xs text-slate-500 hover:text-white"
              >
                Tutup
              </button>
            </div>
            <pre className="text-xs text-emerald-400 max-h-64 overflow-y-auto p-2 bg-[#050505] rounded-lg leading-relaxed select-all">
              {testResponse}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
