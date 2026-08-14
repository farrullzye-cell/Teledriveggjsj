'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { generateApiDocsMarkdown } from '@/lib/docs-markdown';
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
  Search,
  DollarSign,
  Tv,
  Radio,
  Sliders,
  Database,
  Lock,
  RefreshCw,
  FolderPlus,
  Trash2,
  Edit3,
  Bot,
  Activity,
  Filter,
} from 'lucide-react';

interface EndpointItem {
  id: string;
  category: 'public' | 'ads' | 'files' | 'vaults' | 'telegram' | 'system';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  params: Array<{ name: string; type: string; required: boolean; desc: string }>;
  requestBody?: string;
  returns: string;
  curl: (url: string) => string;
  js: (url: string) => string;
  python: (url: string) => string;
  php: (url: string) => string;
}

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const mdContent = generateApiDocsMarkdown(origin);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RULLZYE_CLOUD_API_DOCS.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTestRequest = async (endpoint: string, method = 'GET') => {
    setTestingEndpoint(endpoint);
    setTestResponse(null);
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, { method });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setTestResponse(JSON.stringify(data, null, 2));
      } else {
        setTestResponse(`[Binary / Media Stream - HTTP ${res.status}]\nContent-Type: ${contentType}\nContent-Length: ${res.headers.get('content-length') || 'streaming chunk'}`);
      }
    } catch (e: any) {
      setTestResponse(`Error: ${e.message}`);
    } finally {
      setTestingEndpoint(null);
    }
  };

  const categories = [
    { id: 'all', name: 'Semua Endpoint', icon: Layers, count: 25 },
    { id: 'public', name: 'Public CDN & Stream', icon: Globe, count: 9 },
    { id: 'ads', name: 'Iklan & Monetisasi', icon: DollarSign, count: 2 },
    { id: 'files', name: 'File Storage & Bulk', icon: FileText, count: 6 },
    { id: 'vaults', name: 'Vaults & Topics', icon: FolderPlus, count: 3 },
    { id: 'telegram', name: 'Telegram Bot Engine', icon: Bot, count: 5 },
    { id: 'system', name: 'Sistem, PIN & Health', icon: ShieldCheck, count: 6 },
  ];

  const endpoints: EndpointItem[] = [
    // --- 1. PUBLIC CDN & STREAMING ---
    {
      id: 'pub-media',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/media',
      badge: 'NETLIFY READY',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Get Formatted Media Gallery Collection',
      description: 'Mengambil array media video dan foto terformat dengan thumbnail_url, media_url, views, likes, dan kategori vault yang siap dikonsumsi langsung oleh website Netlify frontend.',
      params: [
        { name: 'category', type: 'string (Query)', required: false, desc: 'Filter kategori (ALL | PHOTOS | VIDEOS | DOCUMENTS)' },
        { name: 'vault_id', type: 'string (Query)', required: false, desc: 'Filter spesifik ID Topic Vault' },
        { name: 'limit', type: 'integer (Query)', required: false, desc: 'Batas maksimal item (default: 50)' }
      ],
      returns: 'JSON: { success: true, count: number, media: Array<MediaItem> }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/media?category=ALL&limit=20"`,
      js: (url: string) => `fetch("${url}/api/v1/public/media?category=ALL")
  .then(res => res.json())
  .then(data => {
    console.log("Total:", data.count);
    data.media.forEach(item => {
      console.log(item.title, item.thumbnail_url, item.media_url);
    });
  });`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/media?category=ALL")
data = res.json()
print("Total Media:", data.get("count", 0))`,
      php: (url: string) => `<?php
$data = json_decode(file_get_contents("${url}/api/v1/public/media?category=ALL"), true);
foreach ($data['media'] as $item) {
    echo "<h3>" . htmlspecialchars($item['title']) . "</h3>";
}
?>`
    },
    {
      id: 'pub-media-like',
      category: 'public',
      method: 'POST',
      path: '/api/v1/public/media/like',
      badge: 'INTERACTION COUNTER',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Increment Media Likes or Views Count',
      description: 'Menambahkan jumlah suka (likes) atau tayangan (views) secara real-time pada database Firestore tanpa autentikasi.',
      params: [
        { name: 'id', type: 'string (JSON Body)', required: true, desc: 'ID file target' },
        { name: 'action', type: 'string (JSON Body)', required: false, desc: '"like" (default) atau "view"' }
      ],
      requestBody: `{\n  "id": "file_1723548912_abc",\n  "action": "like"\n}`,
      returns: 'JSON: { success: true, likes: number } atau { success: true, views: number }',
      curl: (url: string) => `curl -X POST "${url}/api/v1/public/media/like" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "file_1723548912_abc", "action": "like"}'`,
      js: (url: string) => `fetch("${url}/api/v1/public/media/like", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "file_1723548912_abc", action: "like" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/v1/public/media/like", json={"id": "file_1723548912_abc", "action": "like"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/v1/public/media/like");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['id' => 'file_1723548912_abc', 'action' => 'like']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
?>`
    },
    {
      id: 'pub-thumbnail',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/thumbnail/{id}',
      badge: 'ULTRA FAST CACHE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Render High-Resolution Thumbnail Stream',
      description: 'Menyajikan gambar thumbnail cepat untuk video atau foto dengan HTTP cache header 7 hari tanpa membebani browser client.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID unik file pada sistem RULLZYE CLOUD' }
      ],
      returns: 'image/jpeg atau image/svg+xml binary image stream',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/thumbnail/file_1723548912_abc" -o thumb.jpg`,
      js: (url: string) => `// Gunakan langsung pada atribut src tag <img>
const thumbUrl = "${url}/api/v1/public/thumbnail/" + fileId;
document.querySelector("#videoPoster").src = thumbUrl;`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/thumbnail/file_1723548912_abc")
with open("thumbnail.jpg", "wb") as f:
    f.write(res.content)`,
      php: (url: string) => `<?php
echo '<img src="${url}/api/v1/public/thumbnail/file_1723548912_abc" alt="Video Thumbnail" />';
?>`
    },
    {
      id: 'pub-download-stream',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/download/{id}',
      badge: 'HTTP 206 RANGE STREAM',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Video Streaming (>15MB) & Binary Download',
      description: 'Streaming file video resolusi tinggi langsung dari cloud storage dengan dukungan Range Header (HTTP 206 Partial Content) untuk seek frame instan tanpa buffering.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID unik file' },
        { name: 'inline', type: 'boolean (Query)', required: false, desc: 'Set `true` untuk pemutaran streaming langsung di browser video player' }
      ],
      returns: 'Binary video stream (video/mp4 / webm) atau attachment payload',
      curl: (url: string) => `curl -X GET -H "Range: bytes=0-1048575" "${url}/api/v1/public/download/file_1723548912_abc?inline=true" -o chunk.mp4`,
      js: (url: string) => `// Gunakan pada HTML5 Video Tag
<video controls preload="metadata" playsinline>
  <source src="${url}/api/v1/public/download/\${fileId}?inline=true" type="video/mp4" />
</video>`,
      python: (url: string) => `import requests

headers = {"Range": "bytes=0-1048575"}
res = requests.get("${url}/api/v1/public/download/file_1723548912_abc?inline=true", headers=headers)
print("HTTP Status:", res.status_code) # 206 Partial Content`,
      php: (url: string) => `<?php
header("Location: ${url}/api/v1/public/download/file_1723548912_abc?inline=true");
exit;
?>`
    },
    {
      id: 'pub-files',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/files',
      badge: 'SEARCH & FILTER',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      title: 'List Public Files with Keyword Search',
      description: 'Daftar semua repository berkas publik dengan pencarian nama, filter tipe berkas, dan paginasi offset.',
      params: [
        { name: 'search', type: 'string (Query)', required: false, desc: 'Kata kunci pencarian nama file' },
        { name: 'type', type: 'string (Query)', required: false, desc: 'ALL | PHOTOS | VIDEOS | FILES' },
        { name: 'vault_id', type: 'string (Query)', required: false, desc: 'Filter ID Vault' },
        { name: 'limit', type: 'integer (Query)', required: false, desc: 'Limit per halaman (default: 100)' },
        { name: 'offset', type: 'integer (Query)', required: false, desc: 'Offset item (default: 0)' }
      ],
      returns: 'JSON: { success: true, total: number, files: Array<FileItem> }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/files?search=RULLZYE&limit=20"`,
      js: (url: string) => `fetch("${url}/api/v1/public/files?limit=20")
  .then(res => res.json())
  .then(data => console.log(data.files));`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/files?limit=20")
print(res.json())`,
      php: (url: string) => `<?php
$res = json_decode(file_get_contents("${url}/api/v1/public/files?limit=20"), true);
$files = $res['files'];
?>`
    },
    {
      id: 'pub-status',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/status',
      badge: 'HEALTH MONITOR',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Backend Health & Storage Status',
      description: 'Mengecek ketersediaan server backend, uptime 99.99%, jumlah file, dan status koneksi Google Cloud Firestore.',
      params: [],
      returns: 'JSON: { success: true, status: "ONLINE", uptime: "99.99%", total_files: number, database: string }',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/status"`,
      js: (url: string) => `fetch("${url}/api/v1/public/status")
  .then(r => r.json())
  .then(d => console.log("Status:", d.status));`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/status")
print(res.json())`,
      php: (url: string) => `<?php
$status = json_decode(file_get_contents("${url}/api/v1/public/status"), true);
echo "Status: " . $status['status'];
?>`
    },
    {
      id: 'pub-export',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/project-export',
      badge: 'NETLIFY ZIP EXPORT',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      title: 'Download Netlify Frontend Project ZIP',
      description: 'Menghasilkan dan mengunduh berkas arsip ZIP paket lengkap HTML, CSS, Vanilla JS frontend Netlify yang siap di-deploy ke hosting statis manapun.',
      params: [],
      returns: 'application/zip Binary Stream (xvidshub-netlify-client.zip)',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/project-export" -o netlify-site.zip`,
      js: (url: string) => `window.location.href = "${url}/api/v1/public/project-export";`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/project-export")
with open("netlify-site.zip", "wb") as f:
    f.write(res.content)`,
      php: (url: string) => `<?php
header("Location: ${url}/api/v1/public/project-export");
exit;
?>`
    },
    {
      id: 'pub-docs-json',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/docs',
      badge: 'OPENAPI 3.0.3',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      title: 'Get OpenAPI 3.0.3 Specification JSON',
      description: 'Menyediakan spesifikasi REST API standar OpenAPI 3.0.3 untuk diimpor ke Postman, Swagger UI, Insomnia, atau generator SDK.',
      params: [],
      returns: 'application/json OpenAPI 3.0.3 Schema Object',
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/docs"`,
      js: (url: string) => `fetch("${url}/api/v1/public/docs").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

spec = requests.get("${url}/api/v1/public/docs").json()
print("API Title:", spec["info"]["title"])`,
      php: (url: string) => `<?php
$spec = json_decode(file_get_contents("${url}/api/v1/public/docs"), true);
print_r($spec['paths']);
?>`
    },
    {
      id: 'pub-docs-md',
      category: 'public',
      method: 'GET',
      path: '/api/v1/public/docs/md',
      badge: 'MARKDOWN EXPORT',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Download Complete API Documentation as Markdown File (.md)',
      description: 'Menyediakan seluruh dokumentasi API Rullzye Cloud termasuk parameter, model respons, contoh CURL, dan seluruh endpoint dalam format Markdown standar untuk integrasi AI prompt atau offline docs.',
      params: [],
      returns: 'Text/Markdown Attachment (RULLZYE_CLOUD_API_DOCS.md)',
      curl: (url: string) => `curl -OJ "${url}/api/v1/public/docs/md"`,
      js: (url: string) => `window.open("${url}/api/v1/public/docs/md", "_blank");`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/docs/md")
with open("RULLZYE_CLOUD_API_DOCS.md", "w") as f:
    f.write(res.text)`,
      php: (url: string) => `<?php
$md = file_get_contents("${url}/api/v1/public/docs/md");
file_put_contents("RULLZYE_CLOUD_API_DOCS.md", $md);
?>`
    },

    // --- 2. ADS & MONETIZATION ---
    {
      id: 'ads-config',
      category: 'ads',
      method: 'GET',
      path: '/api/v1/public/config',
      badge: 'ADS & MONETIZATION',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Get Public Site Settings & All Ads Monetization Tags',
      description: 'Mengambil data konfigurasi publik lengkap mencakup branding nama portal, daftar Vaults, dan seluruh script iklan ads (Popunder CPM rate & URL, Banner Top HTML, Player Overlay HTML, Native In-Feed Ad HTML).',
      params: [],
      returns: `JSON Object:
{
  "success": true,
  "site": { "title": "XVIDSHUB", "tagline": "...", "server_url": "..." },
  "categories": [ { "id": "vault_general", "name": "General Storage", "icon": "Folder", "color": "cyan" } ],
  "monetization": {
    "enabled": true,
    "popunder_rate": 100,
    "popunder_url": "https://pl30817522.effectivecpmnetwork.com/...",
    "banner_top_html": "<script>...</script>",
    "player_overlay_html": "<script>...</script>",
    "native_ad_html": "<script>...</script>"
  }
}`,
      curl: (url: string) => `curl -X GET "${url}/api/v1/public/config"`,
      js: (url: string) => `fetch("${url}/api/v1/public/config")
  .then(res => res.json())
  .then(data => {
    console.log("Monetization Enabled:", data.monetization.enabled);
    console.log("Popunder URL:", data.monetization.popunder_url);
    console.log("Banner HTML:", data.monetization.banner_top_html);
  });`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/v1/public/config")
cfg = res.json()
print("Popunder Rate:", cfg["monetization"]["popunder_rate"])`,
      php: (url: string) => `<?php
$config = json_decode(file_get_contents("${url}/api/v1/public/config"), true);
if ($config['monetization']['enabled']) {
    echo $config['monetization']['banner_top_html'];
}
?>`
    },
    {
      id: 'ads-save',
      category: 'ads',
      method: 'POST',
      path: '/api/config/save',
      badge: 'ADMIN CONFIG',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      title: 'Update & Save Ads Monetization Tags & Scripts',
      description: 'Menyimpan konfigurasi iklan CPM ke database Google Cloud Firestore secara permanen. Memerlukan autentikasi PIN admin.',
      params: [
        { name: 'current_pin', type: 'string (JSON Body)', required: true, desc: 'PIN Admin 6-digit untuk otorisasi' },
        { name: 'ad_monetization_enabled', type: 'boolean', required: false, desc: 'Status aktifasi iklan' },
        { name: 'ad_popunder_rate', type: 'number', required: false, desc: 'Persentase pemicu popunder (20, 30, 50, 100)' },
        { name: 'ad_popunder_url', type: 'string', required: false, desc: 'URL script popunder Adsterra / CPM' },
        { name: 'ad_banner_top_html', type: 'string', required: false, desc: 'Snippet HTML/Script Banner Atas' },
        { name: 'ad_player_overlay_html', type: 'string', required: false, desc: 'Snippet HTML Iklan Overlay Video Player' },
        { name: 'ad_native_html', type: 'string', required: false, desc: 'Snippet HTML Native Ad In-Feed' }
      ],
      requestBody: `{\n  "current_pin": "159357",\n  "ad_monetization_enabled": true,\n  "ad_popunder_rate": 100,\n  "ad_popunder_url": "https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js",\n  "ad_banner_top_html": "<div class=\\"banner\\">...</div>"\n}`,
      returns: 'JSON: { success: true, message: "Konfigurasi berhasil disimpan" }',
      curl: (url: string) => `curl -X POST "${url}/api/config/save" \\
  -H "Content-Type: application/json" \\
  -d '{"current_pin": "159357", "ad_monetization_enabled": true, "ad_popunder_rate": 100}'`,
      js: (url: string) => `fetch("${url}/api/config/save", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    current_pin: "159357",
    ad_monetization_enabled: true,
    ad_popunder_rate: 100,
    ad_popunder_url: "https://pl30817522.effectivecpmnetwork.com/..."
  })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

payload = {
    "current_pin": "159357",
    "ad_monetization_enabled": True,
    "ad_popunder_rate": 100
}
res = requests.post("${url}/api/config/save", json=payload)
print(res.json())`,
      php: (url: string) => `<?php
$payload = [
    'current_pin' => '159357',
    'ad_monetization_enabled' => true,
    'ad_popunder_rate' => 100
];
$ch = curl_init("${url}/api/config/save");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },

    // --- 3. FILES & CORE STORAGE ---
    {
      id: 'file-upload',
      category: 'files',
      method: 'POST',
      path: '/api/files',
      badge: 'BULK & COMPRESSED UPLOAD',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Upload Single / Multi / Bulk Compressed Videos',
      description: 'Mengunggah file atau batch video hasil kompresi langsung ke Telegram Storage Vault dengan live progress tracking, auto-naming sequence, dan thumbnail base64 generator.',
      params: [
        { name: 'file / files', type: 'Binary File(s)', required: true, desc: 'Payload file binary (bisa single atau multiple)' },
        { name: 'vault_id', type: 'string (Form Field)', required: false, desc: 'ID Topic Vault target (default: vault_general)' },
        { name: 'custom_name', type: 'string (Form Field)', required: false, desc: 'Kustom nama file dasar' },
        { name: 'keep_original_name', type: 'string (Form Field)', required: false, desc: '"true" untuk mempertahankan nama asli tanpa sequence' },
        { name: 'thumbnail_base64', type: 'string (Form Field)', required: false, desc: 'Data URL base64 thumbnail video' }
      ],
      returns: 'JSON: { success: true, count: number, files: Array<UploadedFileRecord> }',
      curl: (url: string) => `curl -X POST "${url}/api/files" \\
  -F "files=@video.mp4" \\
  -F "vault_id=vault_general" \\
  -F "keep_original_name=true"`,
      js: (url: string) => `const formData = new FormData();
formData.append("files", fileInput.files[0]);
formData.append("vault_id", "vault_general");
formData.append("keep_original_name", "true");

fetch("${url}/api/files", {
  method: "POST",
  body: formData
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

files = {'files': open('video.mp4', 'rb')}
data = {'vault_id': 'vault_general', 'keep_original_name': 'true'}
res = requests.post("${url}/api/files", files=files, data=data)
print(res.json())`,
      php: (url: string) => `<?php
$cFile = new CURLFile('video.mp4');
$data = ['files' => $cFile, 'vault_id' => 'vault_general'];
$ch = curl_init("${url}/api/files");
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
?>`
    },
    {
      id: 'file-list-internal',
      category: 'files',
      method: 'GET',
      path: '/api/files',
      badge: 'DASHBOARD REPO',
      badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      title: 'List Internal Files with Telegram Metadata',
      description: 'Mengambil katalog berkas dashboard dengan metadata teknis Telegram (chat_id, message_id, telegram_file_id) dan filtering Vault.',
      params: [
        { name: 'search', type: 'string (Query)', required: false, desc: 'Kata kunci nama file' },
        { name: 'type', type: 'string (Query)', required: false, desc: 'ALL | PHOTOS | VIDEOS | FILES' },
        { name: 'vault_id', type: 'string (Query)', required: false, desc: 'Filter Vault ID' },
        { name: 'page', type: 'integer (Query)', required: false, desc: 'Nomor halaman' },
        { name: 'limit', type: 'integer (Query)', required: false, desc: 'Jumlah item per halaman' }
      ],
      returns: 'JSON: { success: true, files: Array<FileRecord>, pagination: { ... } }',
      curl: (url: string) => `curl -X GET "${url}/api/files?limit=50&vault_id=vault_general"`,
      js: (url: string) => `fetch("${url}/api/files?limit=50").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/files?limit=50")
print(res.json())`,
      php: (url: string) => `<?php
$files = json_decode(file_get_contents("${url}/api/files?limit=50"), true);
?>`
    },
    {
      id: 'file-rename',
      category: 'files',
      method: 'PATCH',
      path: '/api/files/{id}',
      badge: 'DATABASE RENAME',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      title: 'Rename File Record',
      description: 'Mengubah nama file pada database Firestore tanpa merusak tautan file di Telegram Cloud.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID file target' },
        { name: 'name', type: 'string (JSON Body)', required: true, desc: 'Nama file baru' }
      ],
      requestBody: `{\n  "name": "Video Edukasi Baru.mp4"\n}`,
      returns: 'JSON: { success: true, message: "Nama file berhasil diubah" }',
      curl: (url: string) => `curl -X PATCH "${url}/api/files/file_1723548912_abc" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Video Edukasi Baru.mp4"}'`,
      js: (url: string) => `fetch("${url}/api/files/file_1723548912_abc", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Video Edukasi Baru.mp4" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.patch("${url}/api/files/file_1723548912_abc", json={"name": "Video Edukasi Baru.mp4"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/files/file_1723548912_abc");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['name' => 'Video Edukasi Baru.mp4']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'file-delete',
      category: 'files',
      method: 'DELETE',
      path: '/api/files/{id}',
      badge: 'DELETE PERMANENT',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Delete File from Storage & Telegram',
      description: 'Menghapus data berkas dari Firestore dan menghapus pesan berkas di channel/supergroup Telegram.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID file target' }
      ],
      returns: 'JSON: { success: true, message: "File berhasil dihapus" }',
      curl: (url: string) => `curl -X DELETE "${url}/api/files/file_1723548912_abc"`,
      js: (url: string) => `fetch("${url}/api/files/file_1723548912_abc", { method: "DELETE" })
  .then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.delete("${url}/api/files/file_1723548912_abc")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/files/file_1723548912_abc");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'file-move',
      category: 'files',
      method: 'POST',
      path: '/api/files/{id}/move',
      badge: 'VAULT TRANSFER',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      title: 'Move File to Another Topic Vault',
      description: 'Memindahkan file antar Topic Vault/Kategori tanpa perlu mengunggah ulang ke Telegram.',
      params: [
        { name: 'id', type: 'string (Path)', required: true, desc: 'ID file target' },
        { name: 'vault_id', type: 'string (JSON Body)', required: true, desc: 'ID Topic Vault tujuan' }
      ],
      requestBody: `{\n  "vault_id": "vault_premium"\n}`,
      returns: 'JSON: { ok: true, message: "File berhasil dipindahkan", file: { ... } }',
      curl: (url: string) => `curl -X POST "${url}/api/files/file_1723548912_abc/move" \\
  -H "Content-Type: application/json" \\
  -d '{"vault_id": "vault_premium"}'`,
      js: (url: string) => `fetch("${url}/api/files/file_1723548912_abc/move", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vault_id: "vault_premium" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/files/file_1723548912_abc/move", json={"vault_id": "vault_premium"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/files/file_1723548912_abc/move");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['vault_id' => 'vault_premium']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'file-stats',
      category: 'files',
      method: 'POST',
      path: '/api/files/stats',
      badge: 'MANUAL METRICS',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Update Manual Views & Likes Metrics',
      description: 'Mengatur atau memperbarui angka tayangan (views) dan jumlah suka (likes) file secara langsung.',
      params: [
        { name: 'file_id', type: 'string (JSON Body)', required: true, desc: 'ID file target' },
        { name: 'views', type: 'number (JSON Body)', required: false, desc: 'Jumlah views' },
        { name: 'likes', type: 'number (JSON Body)', required: false, desc: 'Jumlah likes' }
      ],
      requestBody: `{\n  "file_id": "file_1723548912_abc",\n  "views": 1500,\n  "likes": 320\n}`,
      returns: 'JSON: { ok: true, message: "Stats berhasil diupdate", file: { ... } }',
      curl: (url: string) => `curl -X POST "${url}/api/files/stats" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id": "file_1723548912_abc", "views": 1500, "likes": 320}'`,
      js: (url: string) => `fetch("${url}/api/files/stats", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ file_id: "file_1723548912_abc", views: 1500, likes: 320 })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/files/stats", json={"file_id": "file_1723548912_abc", "views": 1500, "likes": 320})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/files/stats");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['file_id' => 'file_1723548912_abc', 'views' => 1500, 'likes' => 320]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },

    // --- 4. VAULTS & TOPICS ---
    {
      id: 'vault-list',
      category: 'vaults',
      method: 'GET',
      path: '/api/vaults',
      badge: 'TOPIC DIRECTORY',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'List All Storage Vaults & Telegram Topics',
      description: 'Mengambil daftar semua Topic Vaults beserta jumlah file di dalamnya, warna badge, icon, dan ID Thread Telegram.',
      params: [],
      returns: 'JSON: { ok: true, vaults: Array<VaultTopic> }',
      curl: (url: string) => `curl -X GET "${url}/api/vaults"`,
      js: (url: string) => `fetch("${url}/api/vaults").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/vaults")
print(res.json())`,
      php: (url: string) => `<?php
$vaults = json_decode(file_get_contents("${url}/api/vaults"), true);
?>`
    },
    {
      id: 'vault-create',
      category: 'vaults',
      method: 'POST',
      path: '/api/vaults',
      badge: 'AUTO FORUM TOPIC',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Create New Topic Vault with Auto Telegram Topic',
      description: 'Membuat Vault baru dan secara otomatis membuat Forum Topic baru di Supergroup Telegram bot.',
      params: [
        { name: 'name', type: 'string (JSON Body)', required: true, desc: 'Nama kategori Vault' },
        { name: 'description', type: 'string (JSON Body)', required: false, desc: 'Deskripsi vault' },
        { name: 'icon', type: 'string (JSON Body)', required: false, desc: 'Folder | Film | FileText | ShieldLock | Database | Sparkles' },
        { name: 'color', type: 'string (JSON Body)', required: false, desc: 'cyan | amber | sky | emerald | rose | purple' },
        { name: 'topic_id', type: 'string (JSON Body)', required: false, desc: 'ID Thread Telegram (opsional jika manual)' }
      ],
      requestBody: `{\n  "name": "Anime HD",\n  "description": "Koleksi serial animasi",\n  "icon": "Film",\n  "color": "rose"\n}`,
      returns: 'JSON: { ok: true, message: "Vault berhasil dibuat", vault: { ... } }',
      curl: (url: string) => `curl -X POST "${url}/api/vaults" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Anime HD", "icon": "Film", "color": "rose"}'`,
      js: (url: string) => `fetch("${url}/api/vaults", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Anime HD", icon: "Film", color: "rose" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/vaults", json={"name": "Anime HD", "icon": "Film", "color": "rose"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/vaults");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['name' => 'Anime HD', 'icon' => 'Film', 'color' => 'rose']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'vault-delete',
      category: 'vaults',
      method: 'DELETE',
      path: '/api/vaults?id={vaultId}',
      badge: 'DELETE VAULT',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Delete Vault Topic & Relink Files',
      description: 'Menghapus kategori Vault dan memindahkan file-file di dalamnya ke General Storage.',
      params: [
        { name: 'id', type: 'string (Query)', required: true, desc: 'ID Vault yang akan dihapus' }
      ],
      returns: 'JSON: { ok: true, message: "Vault berhasil dihapus" }',
      curl: (url: string) => `curl -X DELETE "${url}/api/vaults?id=vault_1723548912"` ,
      js: (url: string) => `fetch("${url}/api/vaults?id=vault_1723548912", { method: "DELETE" })
  .then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.delete("${url}/api/vaults?id=vault_1723548912")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/vaults?id=vault_1723548912");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },

    // --- 5. TELEGRAM BOT ENGINE ---
    {
      id: 'tg-poll-status',
      category: 'telegram',
      method: 'GET',
      path: '/api/telegram/poll',
      badge: 'BACKGROUND POLLER',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Check Background Long-Poller Status & Sync Updates',
      description: 'Mengecek apakah daemon poller bot aktif dan mengambil event berkas terbaru dari Telegram Bot API.',
      params: [],
      returns: 'JSON: { ok: true, isPolling: true, processedCount: number, lastOffset: number }',
      curl: (url: string) => `curl -X GET "${url}/api/telegram/poll"`,
      js: (url: string) => `fetch("${url}/api/telegram/poll").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/telegram/poll")
print(res.json())`,
      php: (url: string) => `<?php
$poll = json_decode(file_get_contents("${url}/api/telegram/poll"), true);
?>`
    },
    {
      id: 'tg-poll-trigger',
      category: 'telegram',
      method: 'POST',
      path: '/api/telegram/poll',
      badge: 'SYNC CONTROL',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Start, Stop or Force Single Polling Run',
      description: 'Mengontrol background polling daemon untuk menyinkronkan video/dokumen yang dikirim pengguna langsung ke Bot Telegram.',
      params: [
        { name: 'action', type: 'string (JSON Body)', required: true, desc: '"start" | "stop" | "once"' }
      ],
      requestBody: `{\n  "action": "start"\n}`,
      returns: 'JSON: { ok: true, message: "Background poller dimulai", isPolling: true }',
      curl: (url: string) => `curl -X POST "${url}/api/telegram/poll" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "start"}'`,
      js: (url: string) => `fetch("${url}/api/telegram/poll", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "start" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/telegram/poll", json={"action": "start"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/telegram/poll");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['action' => 'start']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'tg-webhook',
      category: 'telegram',
      method: 'POST',
      path: '/api/telegram/webhook',
      badge: 'LIVE WEBHOOK',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      title: 'Telegram Incoming Webhook Handler',
      description: 'Menerima callback payload real-time dari server Telegram Bot saat berkas media baru diunggah.',
      params: [],
      returns: 'JSON: { ok: true, processed: boolean }',
      curl: (url: string) => `curl -X POST "${url}/api/telegram/webhook" \\
  -H "Content-Type: application/json" \\
  -d '{"update_id": 12345678, "message": { ... }}'`,
      js: (url: string) => `// Dikelola otomatis oleh server Telegram`,
      python: (url: string) => `# Dikelola otomatis oleh server Telegram`,
      php: (url: string) => `<?php // Dikelola otomatis oleh server Telegram ?>`
    },
    {
      id: 'tg-set-webhook',
      category: 'telegram',
      method: 'POST',
      path: '/api/telegram/set-webhook',
      badge: 'REGISTER WEBHOOK',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      title: 'Register Webhook URL with Secret Token',
      description: 'Mendaftarkan URL webhook aplikasi ke Telegram Bot API server.',
      params: [
        { name: 'webhook_url', type: 'string (JSON Body)', required: false, desc: 'URL Webhook HTTPS kustom' },
        { name: 'secret_token', type: 'string (JSON Body)', required: false, desc: 'Secret header token' }
      ],
      returns: 'JSON: { ok: true, message: "Webhook Telegram berhasil didaftarkan" }',
      curl: (url: string) => `curl -X POST "${url}/api/telegram/set-webhook"`,
      js: (url: string) => `fetch("${url}/api/telegram/set-webhook", { method: "POST" }).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/telegram/set-webhook")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/telegram/set-webhook");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'tg-restore',
      category: 'telegram',
      method: 'POST',
      path: '/api/telegram/restore',
      badge: 'METADATA DISASTER RECOVERY',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Restore Database & Media from Telegram Backup JSON',
      description: 'Merekonstruksi database dan seluruh riwayat berkas dari postingan snapshot backup di chat storage Telegram secara otomatis jika terjadi data loss.',
      params: [],
      returns: 'JSON: { ok: true, message: "Database berhasil dipulihkan", restoredCount: number }',
      curl: (url: string) => `curl -X POST "${url}/api/telegram/restore"`,
      js: (url: string) => `fetch("${url}/api/telegram/restore", { method: "POST" }).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/telegram/restore")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/telegram/restore");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },

    // --- 6. SYSTEM, PIN & HEALTH ---
    {
      id: 'sys-verify-pin',
      category: 'system',
      method: 'POST',
      path: '/api/verify-pin',
      badge: 'PIN AUTH & LOCKOUT',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Authenticate & Verify Admin PIN',
      description: 'Verifikasi keamanan PIN 6-digit dengan proteksi rate limit lockout (maksimal 5 percobaan sebelum cooldown 15 menit).',
      params: [
        { name: 'pin', type: 'string (JSON Body)', required: true, desc: 'PIN 6-digit (default: 159357)' }
      ],
      requestBody: `{\n  "pin": "159357"\n}`,
      returns: 'JSON: { success: true, message: "PIN Valid" } atau { success: false, attemptsLeft: 4 }',
      curl: (url: string) => `curl -X POST "${url}/api/verify-pin" \\
  -H "Content-Type: application/json" \\
  -d '{"pin": "159357"}'`,
      js: (url: string) => `fetch("${url}/api/verify-pin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pin: "159357" })
}).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/verify-pin", json={"pin": "159357"})
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/verify-pin");
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['pin' => '159357']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'sys-config-status',
      category: 'system',
      method: 'GET',
      path: '/api/config/status',
      badge: 'DIAGNOSTICS SUITE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Full System & Bot Diagnostics Health Check',
      description: 'Menguji konektivitas Bot Token, akses Storage Chat ID, dan status sinkronisasi 24/7 Google Cloud Firestore.',
      params: [],
      returns: 'JSON: { isBotValid: true, isStorageValid: true, botInfo: { ... }, isFirestoreOnline: true }',
      curl: (url: string) => `curl -X GET "${url}/api/config/status"`,
      js: (url: string) => `fetch("${url}/api/config/status").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/config/status")
print(res.json())`,
      php: (url: string) => `<?php
$diag = json_decode(file_get_contents("${url}/api/config/status"), true);
?>`
    },
    {
      id: 'sys-test-telegram',
      category: 'system',
      method: 'POST',
      path: '/api/test-telegram',
      badge: 'BOT TEST',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      title: 'Test Telegram Bot Token API Connection',
      description: 'Menguji kevalidan Bot Token dengan memanggil endpoint getMe Telegram Bot API.',
      params: [
        { name: 'token', type: 'string (JSON Body)', required: false, desc: 'Bot Token untuk diuji (opsional)' }
      ],
      returns: 'JSON: { ok: true, bot: { id: 8642354242, first_name: "...", username: "..." } }',
      curl: (url: string) => `curl -X POST "${url}/api/test-telegram"`,
      js: (url: string) => `fetch("${url}/api/test-telegram", { method: "POST" }).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/test-telegram")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/test-telegram");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'sys-test-storage',
      category: 'system',
      method: 'POST',
      path: '/api/test-storage',
      badge: 'CHAT PERMISSION TEST',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      title: 'Test Telegram Storage Chat Access & Send Verification',
      description: 'Mengirim pesan verifikasi ke Telegram Group / Channel untuk memastikan bot memiliki izin upload dokumen dan video.',
      params: [
        { name: 'token', type: 'string (JSON Body)', required: false, desc: 'Bot Token' },
        { name: 'chatId', type: 'string (JSON Body)', required: false, desc: 'Storage Chat ID' }
      ],
      returns: 'JSON: { ok: true, message: "Koneksi storage Telegram berhasil diverifikasi!" }',
      curl: (url: string) => `curl -X POST "${url}/api/test-storage"`,
      js: (url: string) => `fetch("${url}/api/test-storage", { method: "POST" }).then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.post("${url}/api/test-storage")
print(res.json())`,
      php: (url: string) => `<?php
$ch = curl_init("${url}/api/test-storage");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($ch);
?>`
    },
    {
      id: 'sys-health',
      category: 'system',
      method: 'GET',
      path: '/api/health',
      badge: 'LIVENESS PROBE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      title: 'Liveness & Readiness Health Probe',
      description: 'Endpoint sederhana untuk monitoring uptime container, Kubernetes, Cloud Run, dan load balancer.',
      params: [],
      returns: 'JSON: { status: "ok", timestamp: 1723548912000 }',
      curl: (url: string) => `curl -X GET "${url}/api/health"`,
      js: (url: string) => `fetch("${url}/api/health").then(r => r.json()).then(console.log);`,
      python: (url: string) => `import requests

res = requests.get("${url}/api/health")
print(res.json())`,
      php: (url: string) => `<?php
$res = json_decode(file_get_contents("${url}/api/health"), true);
?>`
    }
  ];

  // Filtering logic
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const matchCat = selectedCategory === 'all' || ep.category === selectedCategory;
      const matchMethod = methodFilter === 'ALL' || ep.method === methodFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        ep.path.toLowerCase().includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.badge.toLowerCase().includes(q);
      return matchCat && matchMethod && matchSearch;
    });
  }, [selectedCategory, methodFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header Navigation */}
      <header className="bg-[#0b1222]/90 border-b border-cyan-900/60 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between backdrop-blur-md">
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
                <span>RULLZYE CLOUD — REST API &amp; Ads Engine Documentation</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-700/80">
                  v3.0.0 FULL SUITE
                </span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono">100% Endpoint Lengkap: Media CDN, Stream 206, Vaults, Telegram &amp; Iklan CPM</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
            title="Download dokumentasi API lengkap format Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Markdown (.MD)</span>
          </button>

          <a
            href="/api/v1/public/docs"
            target="_blank"
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>OpenAPI 3.0.3</span>
            <ExternalLink className="w-3 h-3 text-slate-500 ml-0.5" />
          </a>

          <a
            href="/public-portal"
            target="_blank"
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Portal Netlify</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Banner Overview */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d182e] via-[#0b1324] to-[#1a0e28] border border-cyan-700/50 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  25 ENDPOINTS REST API &amp; AD ENGINE READY
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Integrasi Cloud Media, Video Stream 206, Vaults &amp; Iklan CPM
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                Dokumentasi resmi seluruh endpoint backend RULLZYE CLOUD. Menyediakan integrasi instan untuk pemutaran video range 206, thumbnail caching, database sync Telegram, serta <strong>Ad Monetization Engine (Popunder, Top Banner, Native Ads, Video Overlay)</strong>. Anda juga dapat mengunduh seluruh dokumentasi sebagai berkas Markdown.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Docs (.MD)</span>
              </button>

              <div className="bg-black/50 p-3.5 rounded-xl border border-cyan-500/30 space-y-1 font-mono text-xs">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">Base Public API URL:</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold select-all">{baseUrl}/api/v1/public</span>
                  <button
                    onClick={() => copyToClipboard(`${baseUrl}/api/v1/public`, 'base_url')}
                    className="p-1 hover:text-white text-zinc-400"
                    title="Copy URL"
                  >
                    {copiedIndex === 'base_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Highlight Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Ultra Fast Thumbnails</h4>
                <p className="text-[11px] text-slate-400 font-mono">Render thumbnail instan tanpa beban bandwidth</p>
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
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Iklan CPM &amp; Popunder</h4>
                <p className="text-[11px] text-slate-400 font-mono">Popunder rate, Banner, Player Overlay</p>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">24/7 Firestore Sync</h4>
                <p className="text-[11px] text-slate-400 font-mono">Proteksi permanen di cloud database</p>
              </div>
            </div>
          </div>
        </div>

        {/* SPECIAL IN-DEPTH SECTION: AD MONETIZATION ENGINE GUIDE */}
        <div className="p-6 rounded-2xl bg-[#0e1628] border border-amber-500/40 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Panduan Integrasi Engine Iklan &amp; Monetisasi (Adsterra / CPM)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  AUTO-INJECT MONETIZATION
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Bagaimana website Netlify atau client frontend memuat dan mengeksekusi semua iklan dari API <code>/api/v1/public/config</code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="space-y-3 bg-[#080d1a] p-4 rounded-xl border border-slate-800">
              <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                <Tv className="w-4 h-4" />
                <span>1. Struktur Objek Monetisasi API (`monetization`)</span>
              </h4>
              <ul className="space-y-2 font-mono text-[11px] text-slate-300">
                <li><b className="text-cyan-400">enabled</b>: <span className="text-emerald-400">true / false</span> — Saklar utama aktifasi iklan</li>
                <li><b className="text-cyan-400">popunder_rate</b>: <span className="text-amber-400">20 | 30 | 50 | 100</span> — Persentase peluang klik memicu popunder</li>
                <li><b className="text-cyan-400">popunder_url</b>: Script direct link / CPM popunder (contoh: EffectiveCPMNetwork / Adsterra)</li>
                <li><b className="text-cyan-400">banner_top_html</b>: Script HTML banner header atas (728x90 / responsive container)</li>
                <li><b className="text-cyan-400">player_overlay_html</b>: Script HTML banner pemutar video (468x60 / companion)</li>
                <li><b className="text-cyan-400">native_ad_html</b>: Script HTML native in-feed untuk daftar video</li>
              </ul>
            </div>

            <div className="space-y-3 bg-[#080d1a] p-4 rounded-xl border border-slate-800">
              <h4 className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Radio className="w-4 h-4" />
                <span>2. Contoh Penerapan Popunder di Vanilla JS (Netlify)</span>
              </h4>
              <pre className="p-3 bg-black/80 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed border border-slate-900">
                <code>{`// Ambil config dari endpoint
fetch('/api/v1/public/config')
  .then(r => r.json())
  .then(({ monetization }) => {
    if (!monetization || !monetization.enabled) return;

    // Trigger Popunder sesuai popunder_rate %
    document.addEventListener('click', () => {
      const chance = Math.random() * 100;
      if (chance <= monetization.popunder_rate && monetization.popunder_url) {
        window.open(monetization.popunder_url, '_blank');
      }
    }, { once: false });

    // Render Banner Atas
    if (monetization.banner_top_html) {
      document.getElementById('ad-banner-top').innerHTML = monetization.banner_top_html;
    }
  });`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Search, Category Tabs & Method Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b1222] p-3 rounded-2xl border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari endpoint, nama route, atau kata kunci (contoh: thumbnail, download, config, ads, vault)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* HTTP Method Filter */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              {['ALL', 'GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                    methodFilter === m
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Language Code Selector */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono">
              {(['curl', 'js', 'python', 'php'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                    activeLang === lang
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition border ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-[#0b1222] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Endpoints Count Header */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
          <span>Menampilkan <b className="text-cyan-400">{filteredEndpoints.length}</b> dari {endpoints.length} Endpoint API</span>
          <span>Bahasa aktif: <b className="text-emerald-400">{activeLang.toUpperCase()}</b></span>
        </div>

        {/* Endpoints List */}
        <div className="space-y-6">
          {filteredEndpoints.length === 0 ? (
            <div className="p-12 text-center bg-[#0b1222] rounded-2xl border border-slate-800 space-y-3">
              <Search className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300">Tidak ada endpoint yang cocok</h4>
              <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian atau ganti filter kategori / metode HTTP.</p>
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const currentSnippet =
                activeLang === 'curl'
                  ? ep.curl(baseUrl)
                  : activeLang === 'js'
                  ? ep.js(baseUrl)
                  : activeLang === 'python'
                  ? ep.python(baseUrl)
                  : ep.php(baseUrl);

              const methodBg =
                ep.method === 'GET'
                  ? 'bg-emerald-500 text-black'
                  : ep.method === 'POST'
                  ? 'bg-cyan-500 text-black'
                  : ep.method === 'PATCH'
                  ? 'bg-amber-500 text-black'
                  : 'bg-rose-500 text-white';

              return (
                <div
                  key={ep.id}
                  id={ep.id}
                  className="bg-[#0b1222] border border-slate-800 hover:border-cyan-800/80 rounded-2xl p-5 sm:p-6 shadow-xl transition space-y-4"
                >
                  {/* Method & Path Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${methodBg}`}>
                        {ep.method}
                      </span>
                      <span className="font-mono font-bold text-sm text-cyan-300 select-all">
                        {ep.path}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${ep.badgeColor}`}>
                        {ep.badge}
                      </span>
                    </div>

                    {ep.method === 'GET' && (
                      <button
                        onClick={() => handleTestRequest(ep.path.replace('{id}', 'demo').replace('{vaultId}', 'vault_general'))}
                        disabled={testingEndpoint === ep.path}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition shrink-0"
                      >
                        <Play className="w-3 h-3 fill-cyan-400" />
                        <span>{testingEndpoint === ep.path ? 'Menguji...' : 'Test GET Request'}</span>
                      </button>
                    )}
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
                              <th className="pb-1.5">Nama Field</th>
                              <th className="pb-1.5">Tipe &amp; Lokasi</th>
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

                  {/* Request Body JSON (if available) */}
                  {ep.requestBody && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                        Request Body (JSON):
                      </span>
                      <pre className="p-3 rounded-xl bg-[#040811] border border-slate-900 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                        <code>{ep.requestBody}</code>
                      </pre>
                    </div>
                  )}

                  {/* Response Schema */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Tipe Respons (Return):
                    </span>
                    <div className="p-2.5 rounded-xl bg-[#050913] border border-slate-900 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                      {ep.returns}
                    </div>
                  </div>

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
            })
          )}
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
