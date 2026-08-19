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
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "data": {
    "newCount": 3,
    "totalScanned": 28,
    "vaultsScanned": 4,
    "newFiles": [...]
  },
  "message": "Berhasil mendeteksi & menyinkronkan 3 file baru dari Google Drive Vault!"
}
\`\`\`

#### 14. \`GET /api/v1/drive/files\`
*Melihat daftar file di folder Google Drive.*

#### 15. \`POST /api/v1/drive/upload\`
*Upload berkas binary langsung ke folder Google Drive.*

#### 16. \`POST /api/v1/drive/import\`
*Impor berkas yang sudah ada di Google Drive ke katalog RULLZYE CLOUD.*

---

### D. PUBLIC CDN & VIDEO STREAMING

#### 17. \`GET /api/v1/public/media\`
*Mengambil array media video dan foto terformat untuk website frontend.*

#### 18. \`POST /api/v1/public/media/like\`
*Menambahkan jumlah suka (likes) atau tayangan (views).*

#### 19. \`GET /api/v1/public/thumbnail/{id}\`
*Menyajikan stream gambar thumbnail dengan cache HTTP 7 hari.*

#### 20. \`GET /api/v1/public/download/{id}?inline=true\`
*Streaming video langsung dengan HTTP 206 Partial Content Range header.*

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
