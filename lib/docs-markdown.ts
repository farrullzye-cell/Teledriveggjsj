// Helper to generate full Markdown documentation for RULLZYE CLOUD REST API
export function generateApiDocsMarkdown(baseUrl = 'https://YOUR-BACKEND-URL'): string {
  return `# 🚀 RULLZYE CLOUD — REST API & AD MONETIZATION ENGINE DOCUMENTATION
> **Version:** 3.0.0 FULL SUITE  
> **Target Environment:** Google Cloud Platform / Firebase Firestore / Netlify Frontend / Telegram Cloud Storage  
> **Server Base URL:** \`${baseUrl}\`  
> **Format:** REST API / JSON / HTTP 206 Range Stream  

---

## 📑 DAFTAR ISI (TABLE OF CONTENTS)
1. [Arsitektur & Konsep Sistem](#1-arsitektur--konsep-sistem)
2. [Otentikasi & Keamanan PIN](#2-otentikasi--keamanan-pin)
3. [Daftar Lengkap 24 REST Endpoint](#3-daftar-lengkap-24-rest-endpoint)
   - [A. Public CDN & Video Streaming](#a-public-cdn--video-streaming)
   - [B. Iklan & Engine Monetisasi CPM (Adsterra)](#b-iklan--engine-monetisasi-cpm-adsterra)
   - [C. File Storage & Bulk Management](#c-file-storage--bulk-management)
   - [D. Topic Vaults & Kategori](#d-topic-vaults--kategori)
   - [E. Telegram Bot Engine & Sinkronisasi](#e-telegram-bot-engine--sinkronisasi)
   - [F. Sistem, Diagnostik & Health Probe](#f-sistem-diagnostik--health-probe)
4. [Panduan Integrasi Adsterra / CPM Monetization di Netlify](#4-panduan-integrasi-adsterra--cpm-monetization-di-netlify)
5. [Panduan Video Player HTTP 206 Partial Content](#5-panduan-video-player-http-206-partial-content)
6. [Contoh Kode Integrasi (cURL, JS, Python, PHP)](#6-contoh-kode-integrasi)

---

## 1. ARSITEKTUR & KONSEP SISTEM
RULLZYE CLOUD berfungsi sebagai backend media storage terdistribusi berkecepatan tinggi:
- **Backend & Database:** Google Cloud Firestore untuk metadata berkas, views/likes, konfigurasi iklan, dan Topic Vaults.
- **Storage Provider:** Telegram Bot Storage Vault dengan unlimited storage kapasitas per-file hingga 100MB.
- **Video Delivery:** HTTP 206 Range Stream untuk video player HTML5 tanpa jeda buffering.
- **Thumbnail Renderer:** Client-side 5th second auto-generation dengan server caching berkinerja tinggi.
- **Monetization Engine:** Auto-sync tag Popunder rate 100%, Top Banner HTML, Player Overlay HTML, dan In-feed Native Ads.

---

## 2. OTENTIKASI & KEAMANAN PIN
- **Public Endpoints (\`/api/v1/public/*\`):** Bebas diakses tanpa autentikasi oleh website Netlify frontend.
- **Admin Configuration Endpoints (\`/api/config/save\` dsb):** Membutuhkan otorisasi PIN 6-digit (Default: \`159357\`) dengan proteksi brute-force lockout (maksimal 5 percobaan sebelum cooldown 15 menit).

---

## 3. DAFTAR LENGKAP 24 REST ENDPOINT

### A. PUBLIC CDN & VIDEO STREAMING

#### 1. \`GET /api/v1/public/media\`
*Mengambil array media video dan foto terformat dengan thumbnail_url, media_url, views, likes, dan kategori vault.*
- **Query Params:**
  - \`category\` (optional, string): \`ALL\` | \`PHOTOS\` | \`VIDEOS\` | \`DOCUMENTS\`
  - \`vault_id\` (optional, string): ID Topic Vault spesifik
  - \`limit\` (optional, number): Batas item (default: 50)
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "count": 12,
  "media": [
    {
      "id": "file_1723548912_abc",
      "title": "Tutorial Seduh Kopi V60",
      "type": "video",
      "mime": "video/mp4",
      "size": 18456200,
      "size_formatted": "17.6 MB",
      "thumbnail_url": "${baseUrl}/api/v1/public/thumbnail/file_1723548912_abc",
      "media_url": "${baseUrl}/api/v1/public/download/file_1723548912_abc?inline=true",
      "download_url": "${baseUrl}/api/v1/public/download/file_1723548912_abc",
      "views": 1540,
      "likes": 320,
      "vault": { "id": "vault_coffee", "name": "Coffee Recipes" }
    }
  ]
}
\`\`\`

#### 2. \`POST /api/v1/public/media/like\`
*Menambahkan jumlah suka (likes) atau tayangan (views) secara real-time pada Firestore.*
- **Body (JSON):**
\`\`\`json
{
  "id": "file_1723548912_abc",
  "action": "like"
}
\`\`\`
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "likes": 321
}
\`\`\`

#### 3. \`GET /api/v1/public/thumbnail/{id}\`
*Menyajikan binary stream gambar thumbnail cepat dengan HTTP Cache-Control 7 hari.*
- **Path Params:** \`id\` (string) ID file target.
- **Response (200 OK):** \`image/jpeg\` binary stream.

#### 4. \`GET /api/v1/public/download/{id}\`
*Streaming video besar (>15MB, 50MB, 100MB) dengan HTTP 206 Partial Content Range header untuk seek frame instan.*
- **Path Params:** \`id\` (string) ID file.
- **Query Params:** \`inline=true\` untuk streaming langsung di browser video player.
- **Response (206 Partial Content / 200 OK):** \`video/mp4\` stream.

#### 5. \`GET /api/v1/public/files\`
*Daftar semua repositori berkas publik dengan pencarian nama & paginasi.*
- **Query Params:** \`search\`, \`type\`, \`vault_id\`, \`limit\`, \`offset\`
- **Response (200 OK):** \`{ "success": true, "total": 45, "files": [...] }\`

#### 6. \`GET /api/v1/public/status\`
*Mengecek ketersediaan server backend, uptime, dan koneksi Google Cloud Firestore.*
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "status": "ONLINE",
  "uptime": "99.99%",
  "total_files": 45,
  "database": "Google Cloud Firestore"
}
\`\`\`

#### 7. \`GET /api/v1/public/project-export\`
*Menghasilkan dan mengunduh bundle ZIP paket lengkap HTML, CSS, Vanilla JS frontend Netlify.*
- **Response (200 OK):** \`application/zip\` binary file.

#### 8. \`GET /api/v1/public/docs\`
*Menyajikan skema REST API standar OpenAPI 3.0.3 JSON.*
- **Response (200 OK):** \`application/json\` OpenAPI 3.0.3 Specification.

---

### B. IKLAN & ENGINE MONETISASI CPM (ADSTERRA)

#### 9. \`GET /api/v1/public/config\`
*Mengambil konfigurasi situs publik dan seluruh tag iklan aktif (Popunder, Banners, Native).*
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "site": {
    "title": "XVIDSHUB",
    "tagline": "RULLZYE CLOUD Media Hub",
    "server_url": "${baseUrl}"
  },
  "categories": [
    { "id": "vault_general", "name": "General Storage", "color": "cyan" }
  ],
  "monetization": {
    "enabled": true,
    "popunder_rate": 100,
    "popunder_url": "https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js",
    "banner_top_html": "<script type='text/javascript' src='//pl30817522.../banner.js'></script>",
    "player_overlay_html": "<div class='ad-player'>...</div>",
    "native_ad_html": "<div class='native-feed-ad'>...</div>"
  }
}
\`\`\`

#### 10. \`POST /api/config/save\`
*Menyimpan konfigurasi iklan CPM ke database Firestore dengan otorisasi Admin PIN.*
- **Body (JSON):**
\`\`\`json
{
  "current_pin": "159357",
  "ad_monetization_enabled": true,
  "ad_popunder_rate": 100,
  "ad_popunder_url": "https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js",
  "ad_banner_top_html": "<script>...</script>",
  "ad_player_overlay_html": "<div class='ad'>...</div>",
  "ad_native_html": "<div class='native'>...</div>"
}
\`\`\`
- **Response (200 OK):**
\`\`\`json
{
  "success": true,
  "message": "Konfigurasi berhasil disimpan ke Google Cloud Firestore"
}
\`\`\`

---

### C. FILE STORAGE & BULK MANAGEMENT

#### 11. \`POST /api/files\`
*Upload single / multi / bulk compressed video ke Telegram Storage Vault dengan thumbnail custom detik ke-5.*
- **Content-Type:** \`multipart/form-data\`
- **Form Fields:**
  - \`files\` (File Blob): Satu atau banyak file video/dokumen.
  - \`vault_id\` (string): ID Topic Vault tujuan (cth: \`vault_general\`).
  - \`keep_original_name\` (boolean): \`true\` untuk mempertahankan nama asli.
  - \`thumbnail_base64\` (string): Data URL base64 gambar thumbnail pada detik ke-5.
- **Response (200 OK):** \`{ "success": true, "count": 2, "files": [...] }\`

#### 12. \`GET /api/files\`
*Listing berkas internal dashboard dengan metadata teknis Telegram (chat_id, message_id, thread_id).*

#### 13. \`PATCH /api/files/{id}\`
*Mengubah nama file pada database Firestore.*
- **Body (JSON):** \`{ "name": "Nama Baru.mp4" }\`

#### 14. \`DELETE /api/files/{id}\`
*Menghapus berkas dari Firestore dan menghapus pesan berkas di Telegram Supergroup.*

#### 15. \`POST /api/files/{id}/move\`
*Memindahkan berkas antar Topic Vault tanpa upload ulang.*
- **Body (JSON):** \`{ "vault_id": "vault_target" }\`

#### 16. \`POST /api/files/stats\`
*Memperbarui angka views dan likes secara manual.*
- **Body (JSON):** \`{ "file_id": "file_123", "views": 2500, "likes": 640 }\`

---

### D. TOPIC VAULTS & KATEGORI

#### 17. \`GET /api/vaults\`
*Mengambil daftar semua Topic Vaults beserta jumlah file di dalamnya.*

#### 18. \`POST /api/vaults\`
*Membuat Vault baru dan membuat Forum Topic otomatis di Supergroup Telegram.*
- **Body (JSON):** \`{ "name": "Anime HD", "color": "rose", "icon": "Film" }\`

#### 19. \`DELETE /api/vaults?id={vaultId}\`
*Menghapus Vault dan merelokasi file-file di dalamnya ke General Storage.*

---

### E. TELEGRAM BOT ENGINE & SINKRONISASI

#### 20. \`GET /api/telegram/poll\` & \`POST /api/telegram/poll\`
*Status & kendali background long-polling daemon untuk mendengarkan upload video bot Telegram.*

#### 21. \`POST /api/telegram/webhook\`
*Menerima incoming webhook update dari Telegram server secara real-time.*

#### 22. \`POST /api/telegram/set-webhook\`
*Mendaftarkan HTTPS URL Webhook ke Telegram API.*

#### 23. \`POST /api/telegram/restore\`
*Disaster recovery: Rekonstruksi database dan riwayat berkas dari postingan snapshot backup di Telegram.*

---

### F. SISTEM, DIAGNOSTIK & HEALTH PROBE

#### 24. \`POST /api/verify-pin\`
*Verifikasi PIN Admin 6-digit dengan rate limiting lockout.*
- **Body (JSON):** \`{ "pin": "159357" }\`
- **Response (200 OK):** \`{ "success": true, "message": "PIN Valid" }\`

---

## 4. PANDUAN INTEGRASI ADSTERRA / CPM MONETIZATION DI NETLIFY

Untuk mengaktifkan seluruh iklan secara otomatis di frontend Netlify, tambahkan script berikut pada \`index.html\` atau \`app.js\`:

\`\`\`javascript
// Fetch Konfigurasi Iklan dari RULLZYE CLOUD Backend
fetch('${baseUrl}/api/v1/public/config')
  .then(res => res.json())
  .then(data => {
    if (!data.monetization || !data.monetization.enabled) return;
    const { popunder_rate, popunder_url, banner_top_html, player_overlay_html, native_ad_html } = data.monetization;

    // 1. Inject Popunder Script dengan Pemicu Klik
    if (popunder_url) {
      document.addEventListener('click', () => {
        const rand = Math.random() * 100;
        if (rand <= (popunder_rate || 100)) {
          if (!window._popunderInjected) {
            window._popunderInjected = true;
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = popunder_url;
            document.body.appendChild(script);
          }
        }
      }, { once: false });
    }

    // 2. Render Top Banner Container
    const topBannerContainer = document.getElementById('ad-banner-top');
    if (topBannerContainer && banner_top_html) {
      topBannerContainer.innerHTML = banner_top_html;
    }

    // 3. Render Native Ads In-Feed
    const nativeContainer = document.getElementById('ad-native-container');
    if (nativeContainer && native_ad_html) {
      nativeContainer.innerHTML = native_ad_html;
    }
  });
\`\`\`

---

## 5. PANDUAN VIDEO PLAYER HTTP 206 PARTIAL CONTENT

Gunakan URL streaming \`/api/v1/public/download/{id}?inline=true\` langsung pada tag HTML5 \`<video>\`:

\`\`\`html
<!-- HTML5 Video Player dengan Dukungan Seek Instan Range 206 -->
<video controls preload="metadata" playsinline poster="${baseUrl}/api/v1/public/thumbnail/FILE_ID">
  <source src="${baseUrl}/api/v1/public/download/FILE_ID?inline=true" type="video/mp4" />
  Browser Anda tidak mendukung HTML5 video.
</video>
\`\`\`

---

## 6. CONTOH KODE INTEGRASI

### cURL
\`\`\`bash
# 1. Ambil Katalog Media
curl -X GET "${baseUrl}/api/v1/public/media?category=ALL"

# 2. Like Video
curl -X POST "${baseUrl}/api/v1/public/media/like" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "file_1723548912_abc", "action": "like"}'
\`\`\`

### JavaScript (Fetch / Async)
\`\`\`javascript
async function loadMediaGallery() {
  const res = await fetch('${baseUrl}/api/v1/public/media');
  const { media } = await res.json();
  
  media.forEach(item => {
    console.log(item.title, item.thumbnail_url, item.media_url);
  });
}
loadMediaGallery();
\`\`\`

### Python (Requests)
\`\`\`python
import requests

res = requests.get("${baseUrl}/api/v1/public/media")
data = res.json()
print("Total Media:", data.get("count", 0))
for item in data.get("media", []):
    print(f"Title: {item['title']} | URL: {item['media_url']}")
\`\`\`

### PHP
\`\`\`php
<?php
$json = file_get_contents("${baseUrl}/api/v1/public/media");
$data = json_decode($json, true);

foreach ($data['media'] as $item) {
    echo "<h3>" . htmlspecialchars($item['title']) . "</h3>";
    echo "<img src='" . htmlspecialchars($item['thumbnail_url']) . "' width='320' />";
}
?>
\`\`\`

---
*Dokumentasi ini dihasilkan secara otomatis oleh RULLZYE CLOUD Engine v3.0.0. Dikelola oleh Google Cloud Firestore & Telegram Bot API.*
`;
}
