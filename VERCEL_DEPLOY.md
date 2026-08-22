# 🚀 Panduan Auto-Deploy ke Vercel (100% Gratis & Auto-Setup)

Website ini sudah dioptimalkan secara otomatis untuk **Vercel** dengan konfigurasi `vercel.json` dan Next.js App Router serverless.

---

## ⚡ Langkah 1: Push Proyek ke GitHub
1. Pastikan seluruh file proyek ini sudah di-push / diunggah ke repository **GitHub** Anda.

---

## ⚡ Langkah 2: Hubungkan ke Vercel
1. Buka [https://vercel.com/new](https://vercel.com/new) dan login dengan akun **GitHub**.
2. Di halaman **Import Git Repository**, pilih repository proyek Anda lalu klik **Import**.

---

## ⚡ Langkah 3: Auto-Setup Environment Variables
Di bagian **Environment Variables**, Anda cukup **Copy** blok di bawah ini lalu **Paste** langsung ke kolom isian Vercel:

```env
NODE_ENV=production
ADMIN_PIN=159357
SESSION_SECRET=rullzye_secret_session_key_9381a8c901e23
ALLOWED_ADMIN_EMAIL=farrullzye@gmail.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=845198712806-2a1fij4pubtbacq17vjh1e98b3nq0uic.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_ID=845198712806-2a1fij4pubtbacq17vjh1e98b3nq0uic.apps.googleusercontent.com
TELEGRAM_BOT_TOKEN=8642354242:AAEoyACLWYhjWcqC4jsD0c1NXNMQNoftqDg
TELEGRAM_CHAT_ID=-1004477537736
TELEGRAM_TOPIC_ID=10
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCNwpDe7GKW_LzE4aXUhdDAT_VumIuiIog
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gen-lang-client-0504349540.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gen-lang-client-0504349540
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gen-lang-client-0504349540.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=845198712806
NEXT_PUBLIC_FIREBASE_APP_ID=1:845198712806:web:4a3be9b2c6c4b4be9e0027
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=ai-studio-teledriveggjsj-40f29d10-78f2-4d25-aba1-02258e7c932d
```

*(Jika Anda juga memakai ImageKit, tambahkan:*
`IMAGEKIT_PUBLIC_KEY=...`
`IMAGEKIT_PRIVATE_KEY=...`
`IMAGEKIT_URL_ENDPOINT=...`*)*

---

## ⚡ Langkah 4: Klik Deploy
1. Klik tombol biru **Deploy**.
2. Vercel akan otomatis melakukan proses build dalam 1–2 menit.
3. Website Anda langsung **AKTIF 24 JAM** di domain gratis: `https://[nama-repo].vercel.app`.
