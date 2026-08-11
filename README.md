# RULLZYE CLOUD

Penyimpanan file sederhana dengan **Telegram Bot API** sebagai storage dan **Excel (.xlsx)** sebagai database metadata.

---

## 🚀 Fitur Utama

- **Telegram Storage**: Menggunakan Telegram Bot API sebagai penyimpanan file permanen tanpa menggunakan cloud storage berbayar.
- **Excel Database**: Metadata file dan konfigurasi disimpan otomatis di `database.xlsx` (`CONFIG`, `FILES`, `LOGS`).
- **Setup & PIN Security**: Konfigurasi mudah di `/setup.html` dengan verifikasi PIN aman.
- **Galeri Files**: Tampilan galeri file modern (Photos, Videos, Documents, Archives).
- **Upload & Stream Download**: Fitur upload file (hingga 100 MB per file) dan download aman via stream server proxy.
- **Dark + Cyan Theme**: Tampilan modern, bersih, dan ultra-responsive untuk perangkat mobile, tablet, dan desktop.

---

## 🛠️ Cara Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Server
```bash
npm start
# atau
npm run dev
```

### 3. Buka Konfigurasi Initial
Buka di browser:
```text
http://localhost:3000/setup.html
```

---

## ⚙️ Langkah Konfigurasi Telegram Bot

1. Buat Telegram Bot via [@BotFather](https://t.me/BotFather) di Telegram untuk mendapatkan **Bot Token**.
2. Buat Channel atau Grup Telegram baru sebagai tempat penyimpanan file, tambahkan Bot sebagai Admin, lalu ambil **Storage Chat ID** (contoh: `-100123456789`).
3. Buka halaman `/setup.html` di browser.
4. Masukkan **Website Name**, **Telegram Bot Token**, dan **Storage Chat ID**.
5. Masukkan **Admin PIN** awal (`159357`).
6. Klik **[ TEST TELEGRAM ]** dan **[ TEST STORAGE ]** untuk memverifikasi koneksi.
7. Klik **[ SAVE CONFIG ]**.
8. Buka dashboard utama melalui **[ OPEN RULLZYE CLOUD ]** atau navigasi ke `http://localhost:3000/`.

---

## 📌 Detail Informasi

- **Default Admin PIN**: `159357`
- **Port Server**: `3000`
- **Database File**: `database.xlsx` (dibuat otomatis jika belum ada)
