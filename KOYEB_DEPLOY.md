# Panduan Deploy ke Koyeb (100% Gratis Tanpa Kartu Kredit)

Aplikasi ini menggunakan **Next.js 15 App Router** dan sudah siap 100% untuk di-deploy ke **Koyeb Eco Tier Free**.

---

## 📋 Langkah-Langkah Deploy ke Koyeb

### 1. Daftar Akun di Koyeb
1. Buka [https://www.koyeb.com](https://www.koyeb.com)
2. Klik **Sign Up** -> Pilih **Sign up with GitHub** (Tidak membutuhkan kartu kredit).

---

### 2. Hubungkan Repository GitHub Anda
1. Di Dashboard Koyeb, klik **Create Service** atau **Create App**.
2. Pilih deployment method: **GitHub**.
3. Pilih repository proyek ini yang sudah Anda push ke GitHub.
4. Pilih branch: `main` (atau `master`).

---

### 3. Konfigurasi Service di Koyeb
Atur opsi build & run sebagai berikut:

* **Build & Deployment method**: `Buildpack` atau `NodeJS` (Koyeb akan mendeteksi Next.js secara otomatis).
* **Build Command**: `npm run build`
* **Run Command**: `npm start`
* **Instance Type**: `Nano` (Eco Free - 100% Gratis).
* **Port**: `3000` (atau biarkan default HTTP port 3000).

---

### 4. Tambahkan Environment Variables (Opsional / Sesuai Kebutuhan)
Di bagian **Environment Variables**, tambahkan variabel berikut:

```env
NODE_ENV=production
PORT=3000
ADMIN_PIN=123456
SESSION_SECRET=buat-rahasia-acak-anda-disini

# ImageKit (Jika menggunakan penyimpanan file/video ImageKit)
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=

# Firebase (Jika menggunakan sinkronisasi database Firestore)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Telegram Bot (Jika menggunakan notifikasi Telegram)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

---

### 5. Deploy App
1. Klik **Deploy**.
2. Tunggu proses build (sekitar 1-2 menit).
3. Setelah selesai status menjadi **Healthy**, Anda akan mendapatkan domain publik HTTPS gratis seperti:
   `https://[app-name]-[username].koyeb.app`
