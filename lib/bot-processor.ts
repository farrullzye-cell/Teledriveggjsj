import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getConfigMap,
  addFileRecord,
  addLog,
  determineFileType,
  getVaults,
  getFiles,
  getFileById,
  deleteFileRecord,
  VaultTopic,
  FileRecord,
} from '@/lib/excel-db';

import {
  sendTelegramMessageWithKeyboard,
  editTelegramMessageText,
  answerCallbackQuery,
  getTelegramFileStream,
  uploadVideoFileToTelegram,
  uploadToTelegram,
  deleteFromTelegram,
} from '@/lib/telegram';
import { compressVideoFile } from '@/lib/video-compressor';

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function generateProgressBar(percent: number, length = 10): string {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const filledCount = Math.round((clamped / 100) * length);
  const emptyCount = length - filledCount;
  const filled = '█'.repeat(filledCount);
  const empty = '░'.repeat(emptyCount);
  return `[${filled}${empty}] ${clamped}%`;
}

// Temporary in-memory state for user active vault selection in telegram bot
const userSelectedVaultMap = new Map<number | string, string>();

/**
 * Build Main Interactive Keyboard
 */
export function buildMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🗜️ Kompres Video', callback_data: 'menu_compress_help' },
        { text: '⚡ Upload Cepat', callback_data: 'menu_upload_help' },
      ],
      [
        { text: '📁 File Saya', callback_data: 'menu_files:0' },
        { text: '🏛️ Bilik Vault', callback_data: 'menu_vaults' },
      ],
      [
        { text: '📊 Kuota & Status', callback_data: 'menu_stats' },
        { text: 'ℹ️ Panduan Bot', callback_data: 'menu_help' },
      ],
    ],
  };
}

/**
 * Build Video Compression Options Keyboard
 */
export function buildCompressPresetKeyboard(fileId: string, filename: string, size: number, vaultId: string) {
  const shortName = filename.length > 20 ? filename.substring(0, 18) + '..' : filename;
  const cleanId = fileId.substring(0, 30); // safe callback data length

  return {
    inline_keyboard: [
      [
        { text: '⚡ Ultra Hemat (~75%)', callback_data: `c_ultra:${cleanId}` },
      ],
      [
        { text: '⚖️ Balanced (~55%)', callback_data: `c_balanced:${cleanId}` },
      ],
      [
        { text: '💎 High Quality (~35%)', callback_data: `c_light:${cleanId}` },
      ],
      [
        { text: '⏩ Upload Asli Tanpa Kompres (0s)', callback_data: `c_orig:${cleanId}` },
      ],
      [
        { text: '🏛️ Ganti Bilik Vault', callback_data: `c_vaults:${cleanId}` },
        { text: '❌ Batal', callback_data: 'menu_main' },
      ],
    ],
  };
}

/**
 * Temporary metadata store for incoming pending videos
 */
interface PendingVideo {
  fileId: string;
  filename: string;
  mime: string;
  size: number;
  chatId: number | string;
  messageId: string;
  timestamp: number;
  vaultId?: string;
  duration?: number;
  width?: number;
  height?: number;
}

declare global {
  var __pendingVideosMap: Map<string, PendingVideo> | undefined;
}

if (!globalThis.__pendingVideosMap) {
  globalThis.__pendingVideosMap = new Map<string, PendingVideo>();
}
const pendingVideos = globalThis.__pendingVideosMap;

/**
 * Process live video compression and upload with real-time percentage message animation
 */
export async function executeVideoCompression(
  token: string,
  chatId: number | string,
  statusMessageId: string,
  pending: PendingVideo,
  preset: 'ultra' | 'balanced' | 'light' | 'original'
) {
  const tmpDir = os.tmpdir();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const inputExt = path.extname(pending.filename) || '.mp4';
  const inputPath = path.join(tmpDir, `in_${Date.now()}_${randomSuffix}${inputExt}`);
  const outputPath = path.join(tmpDir, `out_${Date.now()}_${randomSuffix}.mp4`);

  try {
    // If original without compression is requested
    if (preset === 'original') {
      await editTelegramMessageText(
        token,
        chatId,
        statusMessageId,
        `⚡ <b>MEMPROSES UPLOAD ASLI...</b>\n\n` +
        `📄 <b>File:</b> ${pending.filename}\n` +
        `📦 <b>Ukuran:</b> ${formatBytes(pending.size)}\n\n` +
        `${generateProgressBar(50)}\n` +
        `⏳ <i>Mendata file ke Vault Cloud...</i>`
      );

      const vaults = await getVaults();
      const targetVaultId = pending.vaultId || userSelectedVaultMap.get(chatId) || vaults[0].id;
      const targetVault = vaults.find((v) => v.id === targetVaultId) || vaults[0];

      const record = await addFileRecord({
        name: pending.filename,
        type: 'video',
        mime: pending.mime || 'video/mp4',
        size: pending.size,
        telegram_file_id: pending.fileId,
        telegram_message_id: pending.messageId,
        telegram_chat_id: String(chatId),
        vault_id: targetVault.id,
        vault_name: targetVault.name,
      });

      await addLog('BOT_UPLOAD_ORIGINAL', pending.filename, 'SUCCESS');

      await editTelegramMessageText(
        token,
        chatId,
        statusMessageId,
        `✅ <b>UPLOAD ASLI BERHASIL (100%)!</b>\n\n` +
        `📄 <b>File:</b> ${record.name}\n` +
        `📦 <b>Ukuran:</b> ${formatBytes(record.size)}\n` +
        `🏛️ <b>Bilik Vault:</b> ${record.vault_name || 'General Storage'}\n` +
        `🏷 <b>Kategori:</b> VIDEO (ASLI)\n\n` +
        `🌐 <i>File tersimpan aman di Cloud Storage.</i>`,
        {
          inline_keyboard: [
            [{ text: '📁 Lihat di Daftar File', callback_data: 'menu_files:0' }],
            [{ text: '🗜️ Kompres Video Lain', callback_data: 'menu_compress_help' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        }
      );
      return;
    }

    // Step 1: Download video from Telegram
    let lastReport = 0;
    const updateProgressUI = async (pct: number, stepText: string) => {
      const now = Date.now();
      if (now - lastReport < 1000 && pct < 99) return;
      lastReport = now;

      const progressCard = `🗜️ <b>MEMPROSES KOMPRESI VIDEO</b>\n\n` +
        `📄 <b>File:</b> <code>${pending.filename}</code>\n` +
        `📦 <b>Ukuran Awal:</b> ${formatBytes(pending.size)}\n` +
        `⚙️ <b>Preset:</b> ${preset.toUpperCase()}\n\n` +
        `<b>Progress:</b>\n` +
        `<code>${generateProgressBar(pct, 12)}</code>\n\n` +
        `<i>${stepText}</i>`;

      await editTelegramMessageText(token, chatId, statusMessageId, progressCard);
    };

    await updateProgressUI(5, '📥 Mengunduh video dari Telegram Server...');

    // Download stream to disk
    const streamRes = await getTelegramFileStream(token, pending.fileId);
    if (!streamRes.ok || !streamRes.response || !streamRes.response.body) {
      throw new Error(streamRes.error || 'Gagal mengunduh file video dari Telegram');
    }

    const fileStream = fs.createWriteStream(inputPath);
    // @ts-ignore
    const reader = streamRes.response.body.getReader();

    let downloadedBytes = 0;
    const totalBytes = pending.size || 1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        downloadedBytes += value.length;
        const dlPct = Math.min(25, Math.round((downloadedBytes / totalBytes) * 25));
        if (dlPct % 5 === 0) {
          await updateProgressUI(dlPct, `📥 Mengunduh video... (${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)})`);
        }
      }
    }
    fileStream.end();

    await updateProgressUI(26, '🗜️ Video siap, memulai FFmpeg Video Compression Engine...');

    // Step 2: Run FFmpeg compression with progress tracking (26% to 85%)
    const compressResult = await compressVideoFile(inputPath, outputPath, {
      preset,
      onProgress: async (progressPct, msg) => {
        await updateProgressUI(progressPct, msg);
      },
    });

    if (!compressResult.ok || !fs.existsSync(outputPath)) {
      throw new Error(compressResult.error || 'Kompresi FFmpeg gagal');
    }

    // Step 3: Upload compressed video to Telegram Storage (85% to 98%)
    await updateProgressUI(88, '☁️ Mengunggah video terkompresi ke Telegram Cloud Storage...');

    const compressedBuffer = fs.readFileSync(outputPath);
    const compressedStat = fs.statSync(outputPath);
    const newSize = compressedStat.size;

    const baseName = path.parse(pending.filename).name;
    const outputFilename = `${baseName}_compressed.mp4`;

    const vaults = await getVaults();
    const targetVaultId = pending.vaultId || userSelectedVaultMap.get(chatId) || vaults[0].id;
    const targetVault = vaults.find((v) => v.id === targetVaultId) || vaults[0];

    const uploadRes = await uploadVideoFileToTelegram(
      token,
      String(chatId),
      compressedBuffer,
      outputFilename,
      `🗜️ RULLZYE CLOUD COMPRESSED VIDEO\nFile: ${outputFilename}\nSize: ${formatBytes(newSize)} (Hemat ${compressResult.savedPercent}%)`,
      compressResult.duration,
      compressResult.width,
      compressResult.height,
      targetVault.topic_id
    );

    if (!uploadRes.ok || !uploadRes.file_id) {
      throw new Error(uploadRes.error || 'Gagal mengunggah video hasil kompresi ke Telegram');
    }

    await updateProgressUI(98, '💾 Menyimpan metadata video ke Database Cloud...');

    // Step 4: Add file record to DB
    const record = await addFileRecord({
      name: outputFilename,
      type: 'video',
      mime: 'video/mp4',
      size: newSize,
      telegram_file_id: uploadRes.file_id,
      telegram_message_id: uploadRes.message_id || pending.messageId,
      telegram_chat_id: String(chatId),
      vault_id: targetVault.id,
      vault_name: targetVault.name,
    });

    await addLog('BOT_VIDEO_COMPRESS', outputFilename, `SUCCESS_SAVED_${compressResult.savedPercent}%`);

    // Step 5: Final Completed Message (100%)
    const durMins = Math.floor(compressResult.duration / 60);
    const durSecs = Math.floor(compressResult.duration % 60);
    const durStr = `${durMins.toString().padStart(2, '0')}:${durSecs.toString().padStart(2, '0')}`;
    const dimStr = compressResult.width && compressResult.height ? `${compressResult.width}x${compressResult.height}` : '720p HD';

    const finalSuccessCard = `✅ <b>KOMPRESI & UPLOAD BERHASIL (100%)!</b>\n\n` +
      `📄 <b>Nama File:</b> <code>${record.name}</code>\n` +
      `📉 <b>Ukuran:</b> <s>${formatBytes(pending.size)}</s> ➡️ <b>${formatBytes(newSize)}</b>\n` +
      `🎉 <b>Penghematan Kuota:</b> <b>${compressResult.savedPercent}% LEBIH HEMAT!</b>\n` +
      `⏱️ <b>Durasi:</b> ${durStr} • <b>Resolusi:</b> ${dimStr}\n` +
      `🏛️ <b>Bilik Vault:</b> ${record.vault_name || 'General Storage'}\n` +
      `🏷 <b>Kategori:</b> VIDEO (MP4 H.264/AAC)\n\n` +
      `🌐 <i>Video siap ditonton dengan lancar & tersimpan permanen di Cloud.</i>`;

    await editTelegramMessageText(
      token,
      chatId,
      statusMessageId,
      finalSuccessCard,
      {
        inline_keyboard: [
          [
            { text: '📁 Lihat di Daftar File', callback_data: 'menu_files:0' },
          ],
          [
            { text: '🗜️ Kompres Video Lain', callback_data: 'menu_compress_help' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' },
          ],
        ],
      }
    );
  } catch (err: any) {
    console.error('Error during video compression:', err);
    await editTelegramMessageText(
      token,
      chatId,
      statusMessageId,
      `❌ <b>KOMPRESI GAGAL</b>\n\n` +
      `Terjadi kesalahan saat memproses video:\n` +
      `<code>${err.message || 'Unknown error'}</code>\n\n` +
      `Silakan coba kirim ulang video atau gunakan preset lain.`,
      {
        inline_keyboard: [
          [{ text: '🔄 Coba Lagi', callback_data: `c_balanced:${pending.fileId.substring(0, 30)}` }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }
    );
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

/**
 * Handle Telegram Update (Messages, Commands, Callback Queries)
 */
export async function processTelegramUpdate(update: any) {
  const config = await getConfigMap();
  if (!config.telegram_bot_token) {
    return;
  }
  const token = config.telegram_bot_token;

  // 1. Handle Inline Button Callbacks (callback_query)
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbId = cb.id;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const data = cb.data || '';

    await answerCallbackQuery(token, cbId);

    if (!chatId || !messageId) return;

    // Handle Main Menu
    if (data === 'menu_main') {
      const text = `☁️ <b>${config.website_name || 'RULLZYE CLOUD'} BOT</b>\n\n` +
        `Pusat Kontrol Cloud Storage & Kompresi Video Otomatis.\n\n` +
        `<b>Fitur Utama:</b>\n` +
        `• 🗜️ <b>Kompres Video Real-time:</b> Hemat kapasitas hingga 75% dengan kualitas HD jernih.\n` +
        `• ⚡ <b>Upload Segala File:</b> Kirim langsung Dokumen, Foto, Video, Audio, & ZIP.\n` +
        `• 📁 <b>Manajemen Berkas:</b> Akses dan kelola file dari mana saja.\n\n` +
        `Silakan pilih menu di bawah ini:`;

      await editTelegramMessageText(token, chatId, messageId, text, buildMainMenuKeyboard());
      return;
    }

    // Handle Compress Help
    if (data === 'menu_compress_help') {
      const text = `🗜️ <b>PANDUAN KOMPRESI VIDEO</b>\n\n` +
        `<b>Cara Mengompres Video:</b>\n` +
        `1. Cukup kirimkan file video (MP4/MKV/MOV/AVI) langsung ke bot ini.\n` +
        `2. Bot akan menampilkan pilihan preset kompresi:\n` +
        `   • ⚡ <b>Ultra Hemat:</b> ~75% lebih kecil (resolusi 480p, bitrate ~350 kbps)\n` +
        `   • ⚖️ <b>Balanced:</b> ~55% lebih kecil (resolusi 720p HD, bitrate ~650 kbps)\n` +
        `   • 💎 <b>High Quality:</b> ~35% lebih kecil (resolusi 1080p, bitrate ~1100 kbps)\n` +
        `3. Pantau animasi progress 1% hingga 100% secara real-time!\n\n` +
        `<i>Kirimkan video Anda sekarang untuk memulai.</i>`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '📁 Lihat File Video Tersimpan', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Kembali ke Menu', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Upload Help
    if (data === 'menu_upload_help') {
      const text = `⚡ <b>PANDUAN UPLOAD CEPAT</b>\n\n` +
        `Anda dapat mengunggah file apa saja secara langsung:\n` +
        `• 📸 <b>Foto & Gambar:</b> JPG, PNG, WEBP, GIF\n` +
        `• 🎬 <b>Video:</b> MP4, MKV, MOV (Bisa dikompres / upload asli)\n` +
        `• 📄 <b>Dokumen:</b> PDF, DOCX, XLSX, TXT, PPTX\n` +
        `• 📦 <b>Arsip:</b> ZIP, RAR, 7Z, TAR, GZ\n` +
        `• 🎵 <b>Audio:</b> MP3, M4A, FLAC, WAV, Voice\n\n` +
        `<b>Cara Upload:</b> Cukup Drag & Drop atau Lampirkan (Attach) berkas ke chat ini.`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '🏛️ Pilih Bilik Vault Tujuan', callback_data: 'menu_vaults' }],
          [{ text: '🏠 Kembali ke Menu', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Files List Pagination
    if (data.startsWith('menu_files:')) {
      const page = parseInt(data.split(':')[1], 10) || 0;
      const pageSize = 5;
      const allFiles = await getFiles();
      const totalFiles = allFiles.length;
      const totalPages = Math.ceil(totalFiles / pageSize) || 1;
      const currentPage = Math.max(0, Math.min(totalPages - 1, page));

      const pageFiles = allFiles.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

      let text = `📁 <b>DAFTAR FILE DI CLOUD</b> (Halaman ${currentPage + 1}/${totalPages})\n\n` +
        `Total Penyimpanan: <b>${totalFiles} File</b>\n\n`;

      if (pageFiles.length === 0) {
        text += `<i>Belum ada file tersimpan di Cloud Storage.</i>`;
      } else {
        pageFiles.forEach((file, idx) => {
          const icon = file.type === 'video' ? '🎬' : file.type === 'image' ? '🖼️' : file.type === 'document' ? '📄' : '📦';
          text += `<b>${currentPage * pageSize + idx + 1}. ${icon} ${file.name}</b>\n` +
            `   📦 ${formatBytes(file.size)} • 🏛️ ${file.vault_name || 'General'}\n` +
            `   📅 ${new Date(file.uploaded_at).toLocaleDateString()}\n\n`;
        });
      }

      const navButtons = [];
      if (currentPage > 0) {
        navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `menu_files:${currentPage - 1}` });
      }
      if (currentPage < totalPages - 1) {
        navButtons.push({ text: '➡️ Berikutnya', callback_data: `menu_files:${currentPage + 1}` });
      }

      const keyboardRows = [];
      if (navButtons.length > 0) {
        keyboardRows.push(navButtons);
      }
      keyboardRows.push([
        { text: '📊 Statistik', callback_data: 'menu_stats' },
        { text: '🏠 Menu Utama', callback_data: 'menu_main' },
      ]);

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: keyboardRows,
      });
      return;
    }

    // Handle Vaults List
    if (data === 'menu_vaults') {
      const vaults = await getVaults();
      const activeVaultId = userSelectedVaultMap.get(chatId) || vaults[0].id;

      let text = `🏛️ <b>BILIK PENYIMPANAN (VAULTS)</b>\n\n` +
        `Pilih bilik tujuan default untuk upload berkas Anda:\n\n`;

      const vaultButtons = vaults.map((v) => {
        const isSelected = v.id === activeVaultId;
        const mark = isSelected ? '✅ ' : '';
        return [{ text: `${mark}${v.name}`, callback_data: `set_vault:${v.id}` }];
      });

      vaultButtons.push([{ text: '🏠 Kembali ke Menu', callback_data: 'menu_main' }]);

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: vaultButtons,
      });
      return;
    }

    // Set Active Vault
    if (data.startsWith('set_vault:')) {
      const targetVaultId = data.split(':')[1];
      userSelectedVaultMap.set(chatId, targetVaultId);
      const vaults = await getVaults();
      const selectedVault = vaults.find((v) => v.id === targetVaultId) || vaults[0];

      const text = `✅ <b>BILIK VAULT AKTIF DIUBAH!</b>\n\n` +
        `Semua upload baru sekarang akan otomatis disimpan ke:\n` +
        `🏛️ <b>${selectedVault.name}</b>\n` +
        `<i>${selectedVault.description || ''}</i>`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '⚡ Mulai Upload', callback_data: 'menu_upload_help' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Stats & Quota
    if (data === 'menu_stats') {
      const allFiles = await getFiles();
      const totalBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);
      const videos = allFiles.filter((f) => f.type === 'video');
      const images = allFiles.filter((f) => f.type === 'image');
      const docs = allFiles.filter((f) => f.type === 'document');
      const others = allFiles.filter((f) => f.type !== 'video' && f.type !== 'image' && f.type !== 'document');

      const text = `📊 <b>STATISTIK PENYIMPANAN CLOUD</b>\n\n` +
        `• <b>Total Berkas:</b> ${allFiles.length} file\n` +
        `• <b>Total Kapasitas Digunakan:</b> <b>${formatBytes(totalBytes)}</b>\n\n` +
        `<b>Rincian Kategori:</b>\n` +
        `🎬 <b>Video:</b> ${videos.length} file (${formatBytes(videos.reduce((a, b) => a + b.size, 0))})\n` +
        `🖼️ <b>Foto / Gambar:</b> ${images.length} file (${formatBytes(images.reduce((a, b) => a + b.size, 0))})\n` +
        `📄 <b>Dokumen:</b> ${docs.length} file (${formatBytes(docs.reduce((a, b) => a + b.size, 0))})\n` +
        `📦 <b>Lainnya / Arsip:</b> ${others.length} file (${formatBytes(others.reduce((a, b) => a + b.size, 0))})\n\n` +
        `🟢 <b>Server Status:</b> ONLINE & SYNCED`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '📁 Lihat Semua File', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Help Guide
    if (data === 'menu_help') {
      const text = `ℹ️ <b>PANDUAN & DAFTAR PERINTAH BOT</b>\n\n` +
        `<b>Daftar Perintah Teks:</b>\n` +
        `/start - Buka menu utama & dasbor bot\n` +
        `/menu - Tampilkan tombol menu interaktif\n` +
        `/compress - Panduan & opsi kompresi video\n` +
        `/upload - Panduan upload cepat semua format\n` +
        `/files - Daftar file di Cloud dengan tombol link\n` +
        `/vaults - Pengaturan bilik penyimpanan (Vault)\n` +
        `/stats - Statistik & total kapasitas terpakai\n` +
        `/status - Cek status koneksi dan polling\n` +
        `/help - Tampilkan panduan ini\n\n` +
        `<i>Tip: Kirimkan video apa saja untuk langsung mulai mengompres dan menyimpannya.</i>`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Video Compression Preset Triggers
    if (data.startsWith('c_ultra:') || data.startsWith('c_balanced:') || data.startsWith('c_light:') || data.startsWith('c_orig:')) {
      const parts = data.split(':');
      const actionType = parts[0];
      const targetFileIdShort = parts[1];

      // Find matched pending video
      let matchedPending: PendingVideo | undefined;
      for (const [_, item] of pendingVideos.entries()) {
        if (item.fileId.startsWith(targetFileIdShort) || targetFileIdShort.startsWith(item.fileId.substring(0, 30))) {
          matchedPending = item;
          break;
        }
      }

      if (!matchedPending) {
        await editTelegramMessageText(
          token,
          chatId,
          messageId,
          `⚠️ <i>Data video telah kedaluwarsa. Silakan kirimkan kembali video Anda.</i>`,
          buildMainMenuKeyboard()
        );
        return;
      }

      let preset: 'ultra' | 'balanced' | 'light' | 'original' = 'balanced';
      if (actionType === 'c_ultra') preset = 'ultra';
      else if (actionType === 'c_light') preset = 'light';
      else if (actionType === 'c_orig') preset = 'original';

      // Execute compression background task with live updates
      executeVideoCompression(token, chatId, String(messageId), matchedPending, preset).catch((err) => {
        console.error('Unhandled compression failure:', err);
      });
      return;
    }
  }

  // 2. Handle Text Messages & Media
  const msg = update.message || update.channel_post;
  if (!msg) return;

  const chatId = msg.chat?.id;
  const messageId = String(msg.message_id);

  // Check text commands
  if (msg.text) {
    const text = msg.text.trim();

    if (text.startsWith('/start') || text.startsWith('/menu')) {
      const welcomeText = `☁️ <b>SELAMAT DATANG DI ${config.website_name || 'RULLZYE CLOUD'}!</b>\n\n` +
        `Pusat Penyimpanan Berkas & Kompresi Video Otomatis Terhubung Langsung ke Web Dashboard.\n\n` +
        `<b>⚡ Akses Cepat:</b>\n` +
        `• Kirim <b>Video</b> ➡️ Pilih opsi kompresi atau upload instan.\n` +
        `• Kirim <b>Foto/Dokumen/Arsip</b> ➡️ Otomatis disimpan ke Vault.\n\n` +
        `Gunakan tombol menu interaktif di bawah ini:`;

      await sendTelegramMessageWithKeyboard(token, chatId, welcomeText, buildMainMenuKeyboard(), messageId);
      return;
    }

    if (text.startsWith('/compress')) {
      const compressText = `🗜️ <b>KOMPRESI VIDEO BERKECEPATAN TINGGI</b>\n\n` +
        `Kirimkan file video (MP4/MKV/MOV) langsung ke bot ini.\n` +
        `Anda akan dapat memilih preset penghematan kuota dengan animasi progress real-time!`;

      await sendTelegramMessageWithKeyboard(token, chatId, compressText, {
        inline_keyboard: [
          [{ text: '📁 Lihat File Tersimpan', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }, messageId);
      return;
    }

    if (text.startsWith('/upload')) {
      const uploadText = `⚡ <b>UPLOAD CEPAT KE CLOUD</b>\n\n` +
        `Kirimkan file apa saja (Dokumen, Gambar, Video, Lagu, ZIP) ke chat ini untuk disimpan langsung ke Cloud Storage.`;

      await sendTelegramMessageWithKeyboard(token, chatId, uploadText, {
        inline_keyboard: [
          [{ text: '🏛️ Pilih Bilik Vault', callback_data: 'menu_vaults' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }, messageId);
      return;
    }

    if (text.startsWith('/files')) {
      const allFiles = await getFiles();
      const totalFiles = allFiles.length;
      const pageFiles = allFiles.slice(0, 5);

      let filesText = `📁 <b>DAFTAR FILE DI CLOUD</b> (Halaman 1/${Math.ceil(totalFiles / 5) || 1})\n\n` +
        `Total: <b>${totalFiles} Berkas</b>\n\n`;

      pageFiles.forEach((file, idx) => {
        const icon = file.type === 'video' ? '🎬' : file.type === 'image' ? '🖼️' : file.type === 'document' ? '📄' : '📦';
        filesText += `<b>${idx + 1}. ${icon} ${file.name}</b>\n` +
          `   📦 ${formatBytes(file.size)} • 🏛️ ${file.vault_name || 'General'}\n\n`;
      });

      const buttons = [];
      if (totalFiles > 5) {
        buttons.push([{ text: '➡️ Halaman Berikutnya', callback_data: 'menu_files:1' }]);
      }
      buttons.push([{ text: '🏠 Menu Utama', callback_data: 'menu_main' }]);

      await sendTelegramMessageWithKeyboard(token, chatId, filesText, { inline_keyboard: buttons }, messageId);
      return;
    }

    if (text.startsWith('/vaults')) {
      const vaults = await getVaults();
      const activeVaultId = userSelectedVaultMap.get(chatId) || vaults[0].id;

      let vText = `🏛️ <b>BILIK PENYIMPANAN (VAULTS)</b>\n\nPilih bilik tujuan upload:\n\n`;
      const vaultButtons = vaults.map((v) => {
        const mark = v.id === activeVaultId ? '✅ ' : '';
        return [{ text: `${mark}${v.name}`, callback_data: `set_vault:${v.id}` }];
      });
      vaultButtons.push([{ text: '🏠 Menu Utama', callback_data: 'menu_main' }]);

      await sendTelegramMessageWithKeyboard(token, chatId, vText, { inline_keyboard: vaultButtons }, messageId);
      return;
    }

    if (text.startsWith('/stats')) {
      const allFiles = await getFiles();
      const totalBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      const statsText = `📊 <b>STATISTIK CLOUD STORAGE</b>\n\n` +
        `• <b>Website:</b> ${config.website_name || 'RULLZYE CLOUD'}\n` +
        `• <b>Total Berkas:</b> ${allFiles.length} file\n` +
        `• <b>Kapasitas Terpakai:</b> <b>${formatBytes(totalBytes)}</b>\n` +
        `• <b>Status Bot:</b> 🟢 AKTIF (Live)`;

      await sendTelegramMessageWithKeyboard(token, chatId, statsText, {
        inline_keyboard: [
          [{ text: '📁 Lihat File', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }, messageId);
      return;
    }

    if (text.startsWith('/status')) {
      const statusText = `🟢 <b>STATUS RULLZYE CLOUD: ONLINE</b>\n\n` +
        `• Website: <b>${config.website_name || 'RULLZYE CLOUD'}</b>\n` +
        `• Storage Chat ID: <code>${config.telegram_chat_id || 'Not Set'}</code>\n` +
        `• Bot Polling: <b>AKTIF (Interval ~2 Detik)</b>\n` +
        `• Video Compression Engine: <b>FFmpeg Standby (Live Progress 1%-100%)</b>`;

      await sendTelegramMessageWithKeyboard(token, chatId, statusText, buildMainMenuKeyboard(), messageId);
      return;
    }

    if (text.startsWith('/help')) {
      const helpText = `ℹ️ <b>PANDUAN LENGKAP BOT</b>\n\n` +
        `Gunakan perintah berikut:\n` +
        `• /start - Buka menu utama\n` +
        `• /compress - Info kompresi video\n` +
        `• /upload - Info upload berkas\n` +
        `• /files - Daftar file tersimpan\n` +
        `• /vaults - Pilih bilik Vault\n` +
        `• /stats - Statistik kapasitas\n` +
        `• /status - Status koneksi`;

      await sendTelegramMessageWithKeyboard(token, chatId, helpText, buildMainMenuKeyboard(), messageId);
      return;
    }
  }

  // 3. Extract media (Video, Document, Photo, Audio, Voice)
  let isVideo = false;
  let fileId = '';
  let filename = '';
  let mime = 'application/octet-stream';
  let size = 0;
  let duration = 0;
  let width = 0;
  let height = 0;

  if (msg.video) {
    isVideo = true;
    fileId = msg.video.file_id;
    filename = msg.video.file_name || (msg.caption ? msg.caption.substring(0, 30) : `video_${Date.now()}.mp4`);
    if (!filename.includes('.')) filename += '.mp4';
    mime = msg.video.mime_type || 'video/mp4';
    size = msg.video.file_size || 0;
    duration = msg.video.duration || 0;
    width = msg.video.width || 0;
    height = msg.video.height || 0;
  } else if (msg.document) {
    fileId = msg.document.file_id;
    filename = msg.document.file_name || `document_${Date.now()}`;
    mime = msg.document.mime_type || 'application/octet-stream';
    size = msg.document.file_size || 0;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', '3gp'].includes(ext || '') || mime.startsWith('video/')) {
      isVideo = true;
    }
  } else if (msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    fileId = largestPhoto.file_id;
    const cleanCaption = msg.caption ? msg.caption.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30) : '';
    filename = cleanCaption ? (cleanCaption.endsWith('.jpg') ? cleanCaption : `${cleanCaption}.jpg`) : `photo_${Date.now()}.jpg`;
    mime = 'image/jpeg';
    size = largestPhoto.file_size || 0;
  } else if (msg.audio) {
    fileId = msg.audio.file_id;
    filename = msg.audio.file_name || (msg.caption ? msg.caption.substring(0, 30) : `audio_${Date.now()}.mp3`);
    if (!filename.includes('.')) filename += '.mp3';
    mime = msg.audio.mime_type || 'audio/mpeg';
    size = msg.audio.file_size || 0;
  } else if (msg.voice) {
    fileId = msg.voice.file_id;
    filename = `voice_${Date.now()}.ogg`;
    mime = msg.voice.mime_type || 'audio/ogg';
    size = msg.voice.file_size || 0;
  }

  if (fileId) {
    // If incoming file is a VIDEO: Offer interactive compression preset buttons
    if (isVideo) {
      const vaults = await getVaults();
      const activeVaultId = userSelectedVaultMap.get(chatId) || vaults[0].id;
      const targetVault = vaults.find((v) => v.id === activeVaultId) || vaults[0];

      // Save to pending map for callback triggers
      pendingVideos.set(fileId, {
        fileId,
        filename,
        mime,
        size,
        chatId,
        messageId,
        timestamp: Date.now(),
        vaultId: targetVault.id,
        duration,
        width,
        height,
      });

      const videoPromptCard = `🗜️ <b>VIDEO TERDETEKSI!</b>\n\n` +
        `📄 <b>File:</b> <code>${filename}</code>\n` +
        `📦 <b>Ukuran:</b> <b>${formatBytes(size)}</b>\n` +
        `🏛️ <b>Bilik Vault:</b> ${targetVault.name}\n\n` +
        `Pilih tindakan kompresi yang Anda inginkan:\n` +
        `• <b>Ultra Hemat:</b> ~75% lebih kecil (resolusi 480p)\n` +
        `• <b>Balanced:</b> ~55% lebih kecil (resolusi 720p HD - Disarankan)\n` +
        `• <b>High Quality:</b> ~35% lebih kecil (resolusi 1080p)\n` +
        `• <b>Upload Asli:</b> Simpan langsung tanpa kompresi`;

      await sendTelegramMessageWithKeyboard(
        token,
        chatId,
        videoPromptCard,
        buildCompressPresetKeyboard(fileId, filename, size, targetVault.id),
        messageId
      );
      return;
    }

    // If incoming file is Non-Video (Photo, Document, Audio, ZIP): Upload Directly to Vault
    const fileType = determineFileType(filename, mime);
    const vaults = await getVaults();
    const activeVaultId = userSelectedVaultMap.get(chatId) || vaults[0].id;
    const targetVault = vaults.find((v) => v.id === activeVaultId) || vaults[0];

    const record = await addFileRecord({
      name: filename,
      type: fileType,
      mime,
      size,
      telegram_file_id: fileId,
      telegram_message_id: messageId,
      telegram_chat_id: String(chatId),
      vault_id: targetVault.id,
      vault_name: targetVault.name,
    });

    if (record.isDuplicate) {
      await addLog('BOT_UPLOAD', filename, 'SKIPPED_DUPLICATE');
      const dupMsg = `ℹ️ <b>FILE SUDAH TERSEDIA (DUPLIKAT)</b>\n\n` +
        `📄 <b>File:</b> ${record.name}\n` +
        `📦 <b>Ukuran:</b> ${formatBytes(size)}\n` +
        `🏛️ <b>Bilik Vault:</b> ${record.vault_name || 'General Storage'}\n\n` +
        `File ini sudah ada di Cloud Storage dan tidak diduplikasi.`;

      await sendTelegramMessageWithKeyboard(token, chatId, dupMsg, buildMainMenuKeyboard(), messageId);
      return;
    }

    await addLog('BOT_UPLOAD', filename, 'SUCCESS');

    const replyMsg = `✅ <b>BERHASIL DISIMPAN KE CLOUD!</b>\n\n` +
      `📄 <b>File:</b> ${record.name}\n` +
      `📦 <b>Ukuran:</b> ${formatBytes(size)}\n` +
      `🏷 <b>Kategori:</b> ${fileType.toUpperCase()}\n` +
      `🏛️ <b>Bilik Vault:</b> ${record.vault_name || 'General Storage'}\n\n` +
      `🌐 Berkas otomatis tersinkronisasi di Dashboard Web.`;

    await sendTelegramMessageWithKeyboard(
      token,
      chatId,
      replyMsg,
      {
        inline_keyboard: [
          [{ text: '📁 Lihat di Daftar File', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      },
      messageId
    );
  }
}
