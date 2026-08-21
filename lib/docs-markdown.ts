// Helper to generate full Markdown documentation for RULLZYE CLOUD REST API
export function generateApiDocsMarkdown(baseUrl = 'https://YOUR-BACKEND-URL'): string {
  return `# 🚀 RULLZYE CLOUD — REST API & GOOGLE DRIVE VAULT ENGINE
> **Version:** 4.0.0 ENTERPRISE SUITE  
> **Primary Storage:** Google Drive (Folder Vaults + Auto-Detection)  
> **Backup Storage:** Telegram Supergroup Bot Storage  
> **Database & Metadata:** Google Cloud Firestore  
> **Server Base URL:** \`${baseUrl}\`  
> **Format:** REST API / JSON / HTTP 206 Range Stream  

---

## 📑 DAFTAR ISI (TABLE OF CONTENTS)
1. [Arsitektur & Konsep Sistem](#1-arsitektur--konsep-sistem)
2. [Google Drive Vault & Auto-Detection](#2-google-drive-vault--auto-detection)
3. [Daftar REST API Endpoints](#3-daftar-rest-api-endpoints)
   - [A. Video REST API (Standard Catalog)](#a-video-rest-api-standard-catalog)
   - [B. Video Player & Iframe Embed](#b-video-player--iframe-embed)
   - [C. Google Drive Vault & Auto-Detection](#c-google-drive-vault--auto-detection)
   - [D. Public CDN & Video Streaming](#d-public-cdn--video-streaming)
   - [E. Iklan & Smartlink Monetisasi CPM (Adsterra)](#e-iklan--smartlink-monetisasi-cpm-adsterra)
   - [F. File Storage & Upload Management](#f-file-storage--upload-management)
   - [G. Topic Vaults Management](#g-topic-vaults-management)
   - [H. Telegram Admin Bot Engine](#h-telegram-admin-bot-engine)
   - [I. Sistem & Health Probe](#i-sistem--health-probe)
4. [Telegram Admin Bot Commands](#4-telegram-admin-bot-commands)
5. [Contoh Kode Integrasi (cURL, JS, Python, PHP)](#5-contoh-kode-integrasi)

---

## 1. ARSITEKTUR & KONSEP SISTEM
RULLZYE CLOUD berfungsi sebagai platform penyimpanan dan streaming video terdistribusi:
- **Primary Media Storage:** Google Drive API v3 dengan arsitektur **Folder Vaults** per kategori.
- **Auto-Detection Engine:** Pemindaian otomatis berkas baru yang diunggah langsung ke Google Drive folder untuk diindeks ke Firestore.
- **Dual Persistence Config:** Konfigurasi tersimpan di \`config.json\` (agar aman saat migrasi hosting) dan tersinkronisasi dengan Firestore.
- **Video Delivery:** Pemutaran langsung via Web Video Player (\`/watch/:id\`), Iframe Embed (\`/embed/:id\`), dan HTTP 206 Range Stream.
- **Monetization Engine:** Adsterra Smartlink CPM dengan interval klik configurable (1-5) dan per-video / per-vault inheritance.

---

## 2. GOOGLE DRIVE VAULT & AUTO-DETECTION
Setiap Topic Vault di RULLZYE CLOUD terhubung dengan satu Google Drive folder:
1. **General Storage** -> Folder \`General Storage\` di Google Drive
2. **Photos & Video** -> Folder \`Photos & Video\` di Google Drive
3. **Documents & Archives** -> Folder \`Documents & Archives\` di Google Drive
4. **Encrypted Vault** -> Folder \`Encrypted Vault\` di Google Drive

Ketika Anda mengunggah file langsung melalui Google Drive (Web / Mobile App / Desktop), sistem mendeteksi dan mengindeks berkas secara instan melalui endpoint sinkronisasi \`POST /api/v1/drive/sync\`.

---

## 3. DAFTAR REST API ENDPOINTS

### A. VIDEO REST API (STANDARD CATALOG)

#### 1. \`GET /api/v1/videos\`
*Daftar seluruh video dengan paginasi dan filter kategori/vault.*
- **Query Params:** \`page\`, \`limit\`, \`category\`, \`vault_id\`, \`search\`
- **Response (200 OK):** \`{ "success": true, "total": 24, "videos": [...] }\`

#### 2. \`GET /api/v1/videos/{id}\`
*Detail metadata video, stream URL, thumbnail, dan embed URL.*

#### 3. \`GET /api/v1/videos/search?q={query}\`
*Pencarian video berdasarkan judul dan tag.*

#### 4. \`GET /api/v1/videos/latest\`
*Mengambil daftar video terbaru.*

#### 5. \`GET /api/v1/videos/popular\`
*Mengambil daftar video terpopuler berdasarkan views dan likes.*

#### 6. \`GET /api/v1/videos/category/{category}\`
*Filter video berdasarkan kategori atau nama Vault.*

#### 7. \`POST /api/v1/videos\`
*Upload video baru langsung ke Google Drive Vault.*
- **Body:** \`multipart/form-data\` (\`file\`, \`title\`, \`vault_id\`, \`thumbnail\`)

#### 8. \`DELETE /api/v1/videos/{id}\`
*Menghapus video dari Google Drive dan database Firestore.*

---

### B. VIDEO PLAYER & IFRAME EMBED

#### 9. \`GET /watch/{id}\`
*Halaman responsif pemutar video mandiri dengan dukungan auto-fullscreen dan smartlink monetization.*

#### 10. \`GET /embed/{id}\`
*Iframe-compatible video player:*
\`\`\`html
<iframe src="${baseUrl}/embed/VIDEO_ID" width="100%" height="500" frameborder="0" allowfullscreen></iframe>
\`\`\`

---

### C. GOOGLE DRIVE VAULT & AUTO-DETECTION

#### 11. \`GET /api/v1/drive/vaults\`
*Melihat status tautan folder Google Drive untuk seluruh Vaults.*
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "rootFolderId": "1a2b3c...",
  "vaults": [
    {
      "id": "vault_general",
      "name": "General Storage",
      "gdrive_folder_id": "1xyz...",
      "gdrive_file_count": 14,
      "gdrive_last_synced": "2026-08-19T08:00:00.000Z"
    }
  ]
}
\`\`\`

#### 12. \`POST /api/v1/drive/vaults\`
*Membuat atau menyelaraskan seluruh folder Vault di Google Drive secara otomatis.*
- **Headers:** \`Authorization: Bearer <GDRIVE_ACCESS_TOKEN>\`

#### 13. \`POST /api/v1/drive/sync\` & \`GET /api/v1/drive/sync\`
*Mendeteksi berkas baru di Google Drive Vaults dan mengindeksnya ke Firestore.*

#### 14. \`POST /api/v1/drive/burst-sync\` & \`GET /api/v1/drive/burst-sync\` ⚡ [AUTO BURST]
*Sinkronisasi massal berkecepatan tinggi dengan auto-deteksi duplikat dan kebijakan (skip/overwrite/rename).*
- **Request Body (POST):**
\`\`\`json
{
  "duplicatePolicy": "skip",
  "folderId": "optional_drive_folder_id",
  "initVaults": false
}
\`\`\`
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "data": {
    "totalScanned": 120,
    "newCount": 18,
    "duplicatesCount": 102,
    "vaultsScanned": 4,
    "importedFiles": [...]
  },
  "message": "⚡ Auto Burst Sync Selesai: 18 file baru berhasil diimpor, 102 duplikat dilewati."
}
\`\`\`

#### 15. \`POST /api/v1/drive/burst-upload\` ⚡ [AUTO BURST INGESTION]
*Mengimpor daftar banyak file Google Drive sekaligus secara paralel dengan proteksi anti-duplikat.*
- **Request Body:**
\`\`\`json
{
  "items": [
    { "driveFileId": "1a2b3c...", "name": "Video1.mp4", "size": 104857600, "mimeType": "video/mp4" },
    { "driveFileId": "4d5e6f...", "name": "Video2.mp4", "size": 209715200, "mimeType": "video/mp4" }
  ],
  "duplicatePolicy": "skip"
}
\`\`\`

#### 16. \`POST /api/v1/videos/check-duplicate\` & \`POST /api/v1/drive/check-duplicate\` 🔍 [DUPLICATE DETECTOR]
*Memeriksa apakah berkas tunggal atau daftar berkas sudah pernah diunggah/diindeks sebelumnya.*
- **Request Body:**
\`\`\`json
{
  "items": [
    { "name": "Trailer_4k.mp4", "size": 52428800, "gdrive_file_id": "1abc..." }
  ]
}
\`\`\`
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "totalChecked": 1,
  "duplicateCount": 1,
  "uniqueCount": 0,
  "results": [
    {
      "index": 0,
      "name": "Trailer_4k.mp4",
      "isDuplicate": true,
      "existingId": "file_1724...",
      "existingVault": "Photos & Video"
    }
  ]
}
\`\`\`

#### 17. \`GET /api/v1/drive/files\`
*Melihat daftar file di folder Google Drive.*

#### 18. \`POST /api/v1/drive/upload\`
*Upload berkas binary langsung ke folder Google Drive.*

#### 19. \`POST /api/v1/drive/import\`
*Impor berkas yang sudah ada di Google Drive ke katalog RULLZYE CLOUD dengan auto-public permission & auto thumbnail render.*

#### 20. \`POST /api/v1/drive/publicize\` 🌐 [MAKE PUBLIC & THUMBNAIL SYNC]
*Mengubah izin video Google Drive menjadi Publik (anyone with link: reader) sehingga dapat ditonton oleh semua orang tanpa perlu login Google, serta menggenerasi dan menyinkronkan thumbnail ke ImageKit CDN.*
- **Request Body (Contoh Buat Semua Publik):**
\`\`\`json
{
  "all": true
}
\`\`\`
- **Request Body (Contoh File Tunggal):**
\`\`\`json
{
  "id": "file_174000123"
}
\`\`\`
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "file_174000123",
    "gdrive_file_id": "1a2b3c4d...",
    "is_public": true,
    "permission": "anyoneWithLink (reader)",
    "watch_url": "https://domain.com/watch/file_174000123",
    "embed_url": "https://domain.com/embed/file_174000123",
    "stream_url": "https://domain.com/api/v1/videos/stream/file_174000123",
    "thumbnail_url": "https://domain.com/api/thumbnail/file_174000123"
  },
  "message": "Video Google Drive berhasil dijadikan Publik dan siap ditonton oleh semua orang!"
}
\`\`\`

#### 21. \`GET /api/v1/drive/thumbnail/{id}?sz={resolution}\` 🖼️ [HIGH-RES THUMBNAIL ENGINE]
*Menyajikan stream gambar thumbnail Google Drive beresolusi tinggi dengan caching CDN 7 hari dan bypass proteksi referrer.*
- **Query Params:** \`sz=w800|w1280|w1920\`
- **Response:** Binary Image Stream (\`image/jpeg\` / \`image/png\`) with \`Cache-Control: public, max-age=604800\`

---

### D. PUBLIC CDN, VIDEO STREAMING & RESOLUTION CONVERSION

#### 20. \`GET /api/v1/videos/stream/{id}?res={resolution}\` 🛡️ [ANTI-ERROR RESOLUTION RANGE STREAM]
*Streaming proxy video anti-error dengan dukungan HTTP 206 Partial Content dan pengubahan resolusi dinamis untuk pemutaran super lancar.*
- **Query Params:** \`res=1080p|720p|480p|360p|240p|auto\`
- **Headers:** \`Range: bytes=0-1048576\`
- **Fitur:** Dukungan multi-server auto-failover, pengubahan resolusi instan tanpa jeda, adaptasi jaringan lambat / hemat kuota.

#### 21. \`GET /api/v1/videos/resolutions/{id}\` ⚡ [RESOLUTIONS PROFILES & VARIANTS]
*Mendapatkan seluruh profil dan URL stream untuk semua tingkatan resolusi video (1080p, 720p, 480p, 360p, 240p, auto).*

#### 22. \`POST /api/v1/videos/resolution\` & \`POST /api/v1/videos/transcode\` 🎬 [DYNAMIC TRANSCODE DISPATCHER]
*Meminta URL pemutaran cepat dengan resolusi yang ditentukan (1080p, 720p, 480p, 360p, 240p).*
- **Request Body:**
\`\`\`json
{
  "videoId": "file_174000123",
  "resolution": "480p"
}
\`\`\`

#### 23. \`GET /api/v1/public/media\`
*Mengambil array media video dan foto terformat untuk website frontend.*

#### 24. \`POST /api/v1/public/media/like\`
*Menambahkan jumlah suka (likes) atau tayangan (views).*

#### 25. \`GET /api/v1/public/thumbnail/{id}\`
*Menyajikan stream gambar thumbnail dengan cache HTTP 7 hari.*

#### 26. \`GET /api/v1/public/download/{id}?inline=true\`
*Download atau stream video langsung.*

---

### E. IKLAN & SMARTLINK MONETISASI CPM (ADSTERRA)

#### 21. \`GET /api/v1/public/config\`
*Membaca konfigurasi iklan publik dan Smartlink.*

#### 22. \`GET /api/v1/monetization/config\` & \`GET /api/v1/monetization/status\`
*Konfigurasi Smartlink interval (1-5), trigger, mode, dan cooldown.*

#### 23. \`POST /api/v1/monetization/click\`
*Server-side click counter validator untuk memicu aksi Smartlink monetization secara aman.*

---

### F. FILE STORAGE & UPLOAD MANAGEMENT

#### 24. \`POST /api/files\`
*Upload berkas multipart/form-data ke Google Drive Vault dengan Telegram bot backup.*

#### 25. \`GET /api/files\`
*Listing berkas internal dengan metadata Google Drive & Telegram.*

#### 26. \`PATCH /api/files/{id}\`
*Mengubah nama berkas.*

#### 27. \`DELETE /api/files/{id}\`
*Menghapus berkas dari Google Drive, Firestore, dan Telegram.*

---

## 4. TELEGRAM ADMIN BOT COMMANDS
Admin Telegram yang terotorisasi dapat mengelola portal menggunakan perintah berikut:
- \`/start\` & \`/help\` — Menampilkan daftar perintah dan status
- \`/panel\` — Membuka Web Admin Dashboard
- \`/status\` & \`/server\` — Informasi kesehatan backend & storage
- \`/stats\` — Statistik tayangan, likes, dan jumlah berkas
- \`/videos\` — Daftar 10 video terbaru
- \`/search <keyword>\` — Mencari berkas di database
- \`/upload\` — Upload video ke Google Drive Vault via Telegram
- \`/delete <id>\` — Menghapus video
- \`/categories\` — Mengelola Topic Vaults
- \`/monetization\` — Status iklan & Smartlink
- \`/setinterval <1-5>\` — Mengatur interval klik Smartlink
- \`/setslink <url>\` — Mengubah URL Adsterra Smartlink
- \`/monetization_on\` & \`/monetization_off\` — Toggle monetisasi
- \`/maintenance\` — Toggle mode pemeliharaan

---

## 5. CONTOH KODE INTEGRASI

### cURL
\`\`\`bash
# 1. Sync & auto-detect files from Google Drive
curl -X POST "${baseUrl}/api/v1/drive/sync"

# 2. Get formatted media collection
curl -X GET "${baseUrl}/api/v1/public/media?category=VIDEOS&limit=10"

# 3. Upload video to Google Drive Vault
curl -X POST "${baseUrl}/api/files" \\
  -F "files=@my_video.mp4" \\
  -F "vault_id=vault_media" \\
  -F "keep_original_name=true"
\`\`\`

### JavaScript / Node.js
\`\`\`javascript
// Fetch latest videos for frontend catalog
const response = await fetch("${baseUrl}/api/v1/videos?limit=12");
const data = await response.json();
console.log("Total Videos:", data.total);
\`\`\`

### Python
\`\`\`python
import requests

# Trigger Google Drive Vault Auto-Detection
res = requests.post("${baseUrl}/api/v1/drive/sync")
result = res.json()
print("Auto-detected new files:", result["data"]["newCount"])
\`\`\`

### PHP
\`\`\`php
<?php
$data = json_decode(file_get_contents("${baseUrl}/api/v1/videos?limit=10"), true);
foreach ($data['videos'] as $video) {
    echo "<h3>" . htmlspecialchars($video['title']) . "</h3>";
    echo "<iframe src='" . htmlspecialchars($video['embed_url']) . "' width='100%' height='450'></iframe>";
}
?>
\`\`\`

---
*Dokumentasi ini dihasilkan secara otomatis oleh RULLZYE CLOUD Engine v4.0.0. Dikelola oleh Google Drive Vaults & Google Cloud Firestore.*
`;
}
