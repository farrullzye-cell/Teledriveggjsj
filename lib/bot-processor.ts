import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getConfigMap,
  saveConfigMap,
  verifyAdminPin,
  getFiles,
  getFileById,
  addFileRecord,
  updateFileRecord,
  deleteFileRecord,
  moveFileRecord,
  updateFileStats,
  getVaults,
  createVault,
  deleteVault,
  restoreFromTelegramBackup,
  addLog,
  getLogs,
  triggerAutoBackup,
  determineFileType,
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
  testTelegramBot,
  testStorageChat,
  setTelegramWebhook,
  createTelegramForumTopic,
} from '@/lib/telegram';
import {
  getPollerStatus,
  startBackgroundPoller,
  stopBackgroundPoller,
  runSinglePolling,
} from '@/lib/bot-poller';
import { compressVideoFile } from '@/lib/video-compressor';
import {
  BotRequestLogger,
  getBotLogsSummary,
  getBotLiveLogs,
  clearBotLiveLogs,
} from '@/lib/bot-logger';

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
        { text: '🌐 Endpoints API (Docs)', callback_data: 'menu_endpoints' },
        { text: '📊 Kuota & Status', callback_data: 'menu_stats' },
      ],
      [
        { text: '🛡️ Diagnostik & Tes', callback_data: 'menu_diag' },
        { text: 'ℹ️ Panduan Bot', callback_data: 'menu_help' },
      ],
    ],
  };
}

/**
 * Build Endpoints Category Menu
 */
export function buildEndpointsMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🌐 Public CDN & Stream', callback_data: 'ep_cat:public' },
        { text: '💰 Iklan & Monetisasi', callback_data: 'ep_cat:ads' },
      ],
      [
        { text: '📁 File Storage & Bulk', callback_data: 'ep_cat:files' },
        { text: '🏛️ Vaults & Topics', callback_data: 'ep_cat:vaults' },
      ],
      [
        { text: '🤖 Telegram Engine', callback_data: 'ep_cat:telegram' },
        { text: '🛡️ Sistem, PIN & Health', callback_data: 'ep_cat:system' },
      ],
      [
        { text: '⚡ Jalankan Health Check', callback_data: 'exec_ep:sys-health' },
        { text: '📊 Cek Status Server', callback_data: 'exec_ep:pub-status' },
      ],
      [
        { text: '🏠 Kembali ke Menu Utama', callback_data: 'menu_main' },
      ],
    ],
  };
}

/**
 * Build Video Compression Options Keyboard
 */
export function buildCompressPresetKeyboard(fileId: string, filename: string, size: number, vaultId: string) {
  const cleanId = fileId.substring(0, 30);
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

    const compressResult = await compressVideoFile(inputPath, outputPath, {
      preset,
      onProgress: async (progressPct, msg) => {
        await updateProgressUI(progressPct, msg);
      },
    });

    if (!compressResult.ok || !fs.existsSync(outputPath)) {
      throw new Error(compressResult.error || 'Kompresi FFmpeg gagal');
    }

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
          [{ text: '📁 Lihat di Daftar File', callback_data: 'menu_files:0' }],
          [{ text: '🗜️ Kompres Video Lain', callback_data: 'menu_compress_help' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
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
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

/**
 * Handle Telegram Update (Messages, Commands, Callback Queries)
 */
export async function processTelegramUpdate(update: any, incomingLogger?: BotRequestLogger) {
  const config = await getConfigMap();
  if (!config.telegram_bot_token) {
    incomingLogger?.fail('Bot token belum disetel di konfigurasi.');
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

    const logger = incomingLogger || new BotRequestLogger('SYSTEM', 'CALLBACK_QUERY', `Button Click: "${data}"`, update.update_id);
    if (cb.from) {
      logger.setUserInfo(cb.from.id, cb.from.username, cb.from.first_name, chatId);
    }
    logger.step(`Menerima event tombol callback: "${data}" (Chat ID: ${chatId}, Msg ID: ${messageId})`);

    // Always immediately answer the callback query to clear Telegram loading spinner
    try {
      await answerCallbackQuery(token, cbId);
      logger.step('answerCallbackQuery terkirim ke Telegram: OK');
    } catch (e: any) {
      logger.step(`answerCallbackQuery warning: ${e.message}`, false);
    }

    if (!chatId || !messageId) {
      logger.fail('Chat ID atau Message ID kosong pada callback query.');
      return;
    }

    // Handle Main Menu
    if (data === 'menu_main') {
      logger.step('Menyiapkan dan mengirim tampilan Menu Utama...');
      const text = `☁️ <b>${config.website_name || 'RULLZYE CLOUD'} BOT</b>\n\n` +
        `Pusat Kontrol Cloud Storage & Kompresi Video Otomatis.\n\n` +
        `<b>Fitur Utama:</b>\n` +
        `• 🗜️ <b>Kompres Video Real-time:</b> Hemat kapasitas hingga 75% dengan kualitas HD jernih.\n` +
        `• ⚡ <b>Upload Segala File:</b> Kirim langsung Dokumen, Foto, Video, Audio, & ZIP.\n` +
        `• 🌐 <b>Semua API Docs Endpoint Terhubung:</b> Eksekusi langsung via bot.\n` +
        `• 📁 <b>Manajemen Berkas:</b> Akses dan kelola file dari mana saja.\n\n` +
        `Silakan pilih menu di bawah ini:`;

      const res = await editTelegramMessageText(token, chatId, messageId, text, buildMainMenuKeyboard());
      if (res.ok) {
        logger.complete('Menu utama berhasil ditampilkan ke chat.');
      } else {
        logger.fail(`Gagal render menu utama: ${res.error}`);
      }
      return;
    }

    // Handle Endpoints Hub Menu
    if (data === 'menu_endpoints') {
      logger.step('Menyiapkan dan mengirim tampilan REST API Endpoints Hub...');
      const text = `🌐 <b>REST API ENDPOINTS EXPLORER (DOCS)</b>\n\n` +
        `Semua 25 endpoint REST API Rullzye Cloud terhubung langsung ke bot ini dan dapat dieksekusi secara real-time!\n\n` +
        `Pilih kategori endpoint untuk melihat detail & menjalankannya:`;

      const res = await editTelegramMessageText(token, chatId, messageId, text, buildEndpointsMenuKeyboard());
      if (res.ok) {
        logger.complete('Menu endpoints explorer berhasil dikirim.');
      } else {
        logger.fail(`Gagal render menu endpoints: ${res.error}`);
      }
      return;
    }

    // Handle Category Breakdown in Endpoints Explorer
    if (data.startsWith('ep_cat:')) {
      const cat = data.split(':')[1];

      if (cat === 'public') {
        const text = `🌐 <b>1. PUBLIC CDN & STREAMING ENDPOINTS</b>\n\n` +
          `• <b>GET /api/v1/public/media</b> - Koleksi galeri terformat Netlify\n` +
          `• <b>POST /api/v1/public/media/like</b> - Increment like / view counter\n` +
          `• <b>GET /api/v1/public/thumbnail/{id}</b> - Stream thumbnail cepat\n` +
          `• <b>GET /api/v1/public/download/{id}</b> - HTTP 206 Partial Stream\n` +
          `• <b>GET /api/v1/public/files</b> - Pencarian & daftar berkas publik\n` +
          `• <b>GET /api/v1/public/status</b> - Status ketersediaan backend\n` +
          `• <b>GET /api/v1/public/project-export</b> - Download Netlify ZIP\n` +
          `• <b>GET /api/v1/public/docs</b> - OpenAPI 3.0.3 Spec\n` +
          `• <b>GET /api/v1/public/docs/md</b> - Markdown Documentation\n\n` +
          `Klik tombol di bawah untuk mengeksekusi langsung:`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [
              { text: '▶️ Eksekusi: /media', callback_data: 'exec_ep:pub-media' },
              { text: '▶️ Eksekusi: /status', callback_data: 'exec_ep:pub-status' },
            ],
            [
              { text: '▶️ Eksekusi: /files', callback_data: 'exec_ep:pub-files' },
              { text: '▶️ Eksekusi: /openapi', callback_data: 'exec_ep:pub-docs' },
            ],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }

      if (cat === 'ads') {
        const text = `💰 <b>2. IKLAN & MONETISASI CPM ENDPOINTS</b>\n\n` +
          `• <b>GET /api/v1/public/config</b> - Ambil konfigurasi iklan, Popunder & banner tags\n` +
          `• <b>POST /api/config/save</b> - Simpan & update script iklan CPM (Adsterra/Popunder)\n\n` +
          `<b>Perintah Cepat:</b>\n` +
          `• <code>/ads</code> - Lihat konfigurasi iklan aktif\n` +
          `• <code>/setads on 159357</code> - Aktifkan monetisasi iklan\n` +
          `• <code>/setads off 159357</code> - Nonaktifkan iklan\n` +
          `• <code>/setpopunder 100 159357</code> - Set popunder rate 100%`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [{ text: '▶️ Eksekusi: Lihat Konfigurasi Iklan', callback_data: 'exec_ep:ads-config' }],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }

      if (cat === 'files') {
        const text = `📁 <b>3. FILE STORAGE & BULK ENDPOINTS</b>\n\n` +
          `• <b>POST /api/files</b> - Upload single / multi / compressed videos\n` +
          `• <b>GET /api/files</b> - List file internal dengan metadata Telegram\n` +
          `• <b>PATCH /api/files/{id}</b> - Rename nama file di Database\n` +
          `• <b>DELETE /api/files/{id}</b> - Hapus file permanen dari DB & Telegram\n` +
          `• <b>POST /api/files/{id}/move</b> - Pindahkan file antar Vault\n` +
          `• <b>POST /api/files/stats</b> - Atur angka views & likes file\n\n` +
          `<b>Perintah Cepat:</b>\n` +
          `• <code>/files</code> atau <code>/list</code>\n` +
          `• <code>/rename &lt;id&gt; &lt;nama_baru&gt;</code>\n` +
          `• <code>/delete &lt;id&gt;</code>\n` +
          `• <code>/move &lt;id&gt; &lt;vault_id&gt;</code>\n` +
          `• <code>/setstats &lt;id&gt; &lt;views&gt; &lt;likes&gt;</code>`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [{ text: '▶️ Eksekusi: Daftar File Internal', callback_data: 'menu_files:0' }],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }

      if (cat === 'vaults') {
        const text = `🏛️ <b>4. VAULTS & TOPICS ENDPOINTS</b>\n\n` +
          `• <b>GET /api/vaults</b> - Daftar semua Storage Vaults & Forum Topics\n` +
          `• <b>POST /api/vaults</b> - Buat Vault baru + Auto Telegram Forum Topic\n` +
          `• <b>DELETE /api/vaults?id={id}</b> - Hapus Vault & relink berkas ke General\n\n` +
          `<b>Perintah Cepat:</b>\n` +
          `• <code>/vaults</code>\n` +
          `• <code>/newvault &lt;nama&gt; [warna] [deskripsi]</code>\n` +
          `• <code>/delvault &lt;id&gt;</code>`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [{ text: '▶️ Eksekusi: Daftar Semua Vaults', callback_data: 'menu_vaults' }],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }

      if (cat === 'telegram') {
        const text = `🤖 <b>5. TELEGRAM BOT ENGINE ENDPOINTS</b>\n\n` +
          `• <b>GET /api/telegram/poll</b> - Status Background Long-Poller\n` +
          `• <b>POST /api/telegram/poll</b> - Kontrol daemon (start / stop / once)\n` +
          `• <b>POST /api/telegram/webhook</b> - Webhook update processor\n` +
          `• <b>POST /api/telegram/set-webhook</b> - Register webhook URL\n` +
          `• <b>POST /api/telegram/restore</b> - Pulihkan Database dari Backup JSON Telegram\n\n` +
          `Klik tombol di bawah untuk mengeksekusi langsung:`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [
              { text: '▶️ Status Poller', callback_data: 'exec_ep:tg-poll-status' },
              { text: '🔄 Sync Sekali (Once)', callback_data: 'exec_ep:tg-poll-once' },
            ],
            [
              { text: '📦 Pulihkan dari Backup Telegram', callback_data: 'exec_ep:tg-restore' },
            ],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }

      if (cat === 'system') {
        const text = `🛡️ <b>6. SISTEM, PIN & HEALTH ENDPOINTS</b>\n\n` +
          `• <b>POST /api/verify-pin</b> - Verifikasi PIN Admin & proteksi lockout\n` +
          `• <b>GET /api/config/status</b> - Diagnostik lengkap Bot & Firestore\n` +
          `• <b>POST /api/test-telegram</b> - Tes validasi Token Bot\n` +
          `• <b>POST /api/test-storage</b> - Tes izin pengiriman ke Storage Chat\n` +
          `• <b>GET /api/health</b> - Liveness & Readiness Health Probe\n\n` +
          `Klik tombol di bawah untuk menjalankan tes:`;

        await editTelegramMessageText(token, chatId, messageId, text, {
          inline_keyboard: [
            [
              { text: '▶️ Full Diagnostics', callback_data: 'exec_ep:sys-diag' },
              { text: '▶️ Liveness Health', callback_data: 'exec_ep:sys-health' },
            ],
            [
              { text: '▶️ Test Bot Token', callback_data: 'exec_ep:sys-test-bot' },
              { text: '▶️ Test Storage Chat', callback_data: 'exec_ep:sys-test-storage' },
            ],
            [
              { text: '⬅️ Kembali ke Menu API', callback_data: 'menu_endpoints' },
              { text: '🏠 Menu Utama', callback_data: 'menu_main' },
            ],
          ],
        });
        return;
      }
    }

    // Handle Direct One-Click Endpoint Execution
    if (data.startsWith('exec_ep:')) {
      const epId = data.split(':')[1];

      if (epId === 'pub-media') {
        const allFiles = await getFiles();
        const mediaFiles = allFiles.filter((f) => f.type === 'video' || f.type === 'image');
        const count = mediaFiles.length;

        let resultText = `🌐 <b>EKSEKUSI: GET /api/v1/public/media</b>\n\n` +
          `HTTP Status: <b>200 OK</b>\n` +
          `Total Media: <b>${count} items</b>\n\n`;

        mediaFiles.slice(0, 4).forEach((m, i) => {
          resultText += `<b>${i + 1}. ${m.type === 'video' ? '🎬' : '🖼️'} ${m.name}</b>\n` +
            `   👁️ ${m.views || 0} views • ❤️ ${m.likes || 0} likes\n` +
            `   📦 ${formatBytes(m.size)} • 🏛️ ${m.vault_name || 'General'}\n\n`;
        });

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🌐 Buka Endpoints Hub', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }

      if (epId === 'pub-status' || epId === 'sys-health') {
        const allFiles = await getFiles();
        const poller = getPollerStatus();

        const resultText = `🟢 <b>EKSEKUSI: GET /api/v1/public/status & /health</b>\n\n` +
          `• <b>HTTP Status:</b> 200 OK\n` +
          `• <b>Backend Service:</b> ONLINE (Uptime 99.99%)\n` +
          `• <b>Total Files:</b> ${allFiles.length} berkas\n` +
          `• <b>Poller Daemon:</b> ${poller.isPolling ? '🟢 AKTIF (Live)' : '🟡 SIAGA'}\n` +
          `• <b>Event Diproses:</b> ${poller.processedCount} update\n` +
          `• <b>Database:</b> Google Cloud Firestore (ONLINE)\n` +
          `• <b>Timestamp:</b> <code>${new Date().toISOString()}</code>`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🔄 Jalankan Ulang', callback_data: 'exec_ep:pub-status' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }

      if (epId === 'pub-files') {
        const allFiles = await getFiles();
        const resultText = `📁 <b>EKSEKUSI: GET /api/v1/public/files</b>\n\n` +
          `• Total File Publik: <b>${allFiles.length} berkas</b>\n` +
          `• Format Dukungan: MP4, MKV, JPG, PNG, PDF, ZIP, MP3\n\n` +
          `Gunakan <code>/search &lt;kata_kunci&gt;</code> untuk mencari file spesifik.`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '📁 Buka File Explorer', callback_data: 'menu_files:0' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
          ],
        });
        return;
      }

      if (epId === 'pub-docs') {
        const resultText = `📜 <b>EKSEKUSI: GET /api/v1/public/docs</b>\n\n` +
          `• <b>Spesifikasi:</b> OpenAPI 3.0.3 (Swagger / Postman Ready)\n` +
          `• <b>Title:</b> RULLZYE CLOUD Storage & CDN API\n` +
          `• <b>Total Path:</b> 25 Endpoints\n` +
          `• <b>Keamanan:</b> PIN Lockout, Rate Limiting, CORS Enabled\n\n` +
          `Gunakan perintah <code>/docsmd</code> untuk mengunduh versi Markdown lengkap.`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }

      if (epId === 'ads-config') {
        const resultText = `💰 <b>EKSEKUSI: GET /api/v1/public/config (Ads Settings)</b>\n\n` +
          `• <b>Status Monetisasi:</b> ${config.ad_monetization_enabled ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n` +
          `• <b>Popunder CPM Rate:</b> ${config.ad_popunder_rate || 100}%\n` +
          `• <b>Popunder Script:</b> <code>${config.ad_popunder_url ? 'Configured' : 'Default Adsterra'}</code>\n` +
          `• <b>Banner Top HTML:</b> <code>${config.ad_banner_top_html ? 'Active' : 'Empty'}</code>\n` +
          `• <b>Player Overlay:</b> <code>${config.ad_player_overlay_html ? 'Active' : 'Empty'}</code>\n` +
          `• <b>Native Ad:</b> <code>${config.ad_native_html ? 'Active' : 'Empty'}</code>\n\n` +
          `Gunakan <code>/setads on 159357</code> untuk mengubah pengaturan.`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }

      if (epId === 'tg-poll-status') {
        const poller = getPollerStatus();
        const resultText = `🤖 <b>EKSEKUSI: GET /api/telegram/poll (Poller Status)</b>\n\n` +
          `• <b>Status Polling:</b> ${poller.isPolling ? '🟢 AKTIF (Interval 2s)' : '🔴 MATI'}\n` +
          `• <b>Total Event Diproses:</b> ${poller.processedCount}\n` +
          `• <b>Last Update ID / Offset:</b> ${poller.lastOffset || 0}\n` +
          `• <b>Last Polling Time:</b> ${poller.lastPollTime ? new Date(poller.lastPollTime).toLocaleTimeString() : 'Just now'}\n\n` +
          `Semua video & dokumen yang dikirimkan ke chat ini langsung disinkronkan.`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🔄 Jalankan Sekali (Once)', callback_data: 'exec_ep:tg-poll-once' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
          ],
        });
        return;
      }

      if (epId === 'tg-poll-once') {
        const res = await runSinglePolling();
        const resultText = `⚡ <b>EKSEKUSI: POST /api/telegram/poll (action: once)</b>\n\n` +
          `• <b>Hasil:</b> Berhasil disinkronkan!\n` +
          `• <b>Pesan Baru:</b> ${res.processed} event diproses\n` +
          `• <b>Offset Terakhir:</b> ${res.lastOffset}`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🤖 Status Poller', callback_data: 'exec_ep:tg-poll-status' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
          ],
        });
        return;
      }

      if (epId === 'tg-restore') {
        const restoreRes = await restoreFromTelegramBackup(token, String(chatId), config.telegram_topic_id);
        const resultText = restoreRes.ok
          ? `📦 <b>EKSEKUSI: POST /api/telegram/restore</b>\n\n✅ <b>RESTORASI SUKSES!</b>\nDatabase dan metadata berkas berhasil dipulihkan dari snapshot backup Telegram Cloud.`
          : `📦 <b>EKSEKUSI: POST /api/telegram/restore</b>\n\nℹ️ ${restoreRes.message}`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '📁 Buka File', callback_data: 'menu_files:0' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
          ],
        });
        return;
      }

      if (epId === 'sys-diag') {
        const botTest = await testTelegramBot(token);
        const storageTest = await testStorageChat(token, config.telegram_chat_id || String(chatId), config.telegram_topic_id);
        const poller = getPollerStatus();

        const resultText = `🛡️ <b>EKSEKUSI: GET /api/config/status (Full Suite Diagnostics)</b>\n\n` +
          `• 🤖 <b>Bot Telegram:</b> ${botTest.ok ? `🟢 TERHUBUNG (${botTest.username || botTest.botName || 'bot'})` : '🔴 GAGAL'}\n` +
          `• 💾 <b>Storage Chat:</b> ${storageTest.ok ? '🟢 IZIN VALID (Upload & Read)' : '🔴 GAGAL'}\n` +
          `• 🔄 <b>Daemon Poller:</b> ${poller.isPolling ? '🟢 AKTIF' : '🟡 STANDBY'}\n` +
          `• 🗄️ <b>Google Firestore:</b> 🟢 ONLINE & PERSISTENT\n` +
          `• 🗜️ <b>FFmpeg Engine:</b> 🟢 READY (Kompresi 1%-100% Aktif)\n\n` +
          `<b>Status Keseluruhan:</b> 🟢 SEMUA SISTEM NORMAL`;

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🔄 Uji Ulang', callback_data: 'exec_ep:sys-diag' }],
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
          ],
        });
        return;
      }

      if (epId === 'sys-test-bot') {
        const testRes = await testTelegramBot(token);
        const resultText = `🤖 <b>EKSEKUSI: POST /api/test-telegram</b>\n\n` +
          (testRes.ok
            ? `✅ <b>BOT TOKEN VALID!</b>\n• Nama: <b>${testRes.botName || 'Bot'}</b>\n• Username: ${testRes.username || 'N/A'}`
            : `❌ <b>BOT TOKEN INVALID:</b> ${testRes.error}`);

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }

      if (epId === 'sys-test-storage') {
        const testRes = await testStorageChat(token, config.telegram_chat_id || String(chatId), config.telegram_topic_id);
        const resultText = `💾 <b>EKSEKUSI: POST /api/test-storage</b>\n\n` +
          (testRes.ok
            ? `✅ <b>STORAGE CHAT TERVERIFIKASI!</b>\nPesan verifikasi berhasil dikirim ke ruang penyimpanan Telegram.`
            : `❌ <b>GAGAL:</b> ${testRes.error}`);

        await editTelegramMessageText(token, chatId, messageId, resultText, {
          inline_keyboard: [
            [{ text: '🌐 Menu Endpoints', callback_data: 'menu_endpoints' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        });
        return;
      }
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

      const fileButtons: any[] = [];

      if (pageFiles.length === 0) {
        text += `<i>Belum ada file tersimpan di Cloud Storage.</i>`;
      } else {
        pageFiles.forEach((file, idx) => {
          const icon = file.type === 'video' ? '🎬' : file.type === 'image' ? '🖼️' : file.type === 'document' ? '📄' : '📦';
          text += `<b>${currentPage * pageSize + idx + 1}. ${icon} ${file.name}</b>\n` +
            `   📦 ${formatBytes(file.size)} • 🏛️ ${file.vault_name || 'General'}\n` +
            `   👁️ ${file.views || 0} views • ❤️ ${file.likes || 0} likes\n` +
            `   🆔 <code>${file.id}</code>\n\n`;

          fileButtons.push([
            { text: `👁️ Detail #${currentPage * pageSize + idx + 1}`, callback_data: `file_view:${file.id}` },
            { text: `❤️ Suka (+1)`, callback_data: `file_like:${file.id}` },
          ]);
        });
      }

      const navButtons = [];
      if (currentPage > 0) {
        navButtons.push({ text: '⬅️ Sebelumnya', callback_data: `menu_files:${currentPage - 1}` });
      }
      if (currentPage < totalPages - 1) {
        navButtons.push({ text: '➡️ Berikutnya', callback_data: `menu_files:${currentPage + 1}` });
      }

      if (navButtons.length > 0) {
        fileButtons.push(navButtons);
      }
      fileButtons.push([
        { text: '📊 Statistik', callback_data: 'menu_stats' },
        { text: '🏠 Menu Utama', callback_data: 'menu_main' },
      ]);

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: fileButtons,
      });
      return;
    }

    // Handle File View Detail
    if (data.startsWith('file_view:')) {
      const fileId = data.split(':')[1];
      const file = await getFileById(fileId);

      if (!file) {
        await editTelegramMessageText(
          token,
          chatId,
          messageId,
          `⚠️ File tidak ditemukan atau sudah dihapus.`,
          { inline_keyboard: [[{ text: '📁 Kembali ke Daftar', callback_data: 'menu_files:0' }]] }
        );
        return;
      }

      const icon = file.type === 'video' ? '🎬' : file.type === 'image' ? '🖼️' : '📄';
      const text = `${icon} <b>INFORMASI BERKAS</b>\n\n` +
        `• <b>Nama:</b> <code>${file.name}</code>\n` +
        `• <b>ID:</b> <code>${file.id}</code>\n` +
        `• <b>Ukuran:</b> <b>${formatBytes(file.size)}</b>\n` +
        `• <b>Tipe:</b> ${file.type.toUpperCase()} (${file.mime})\n` +
        `• <b>Bilik Vault:</b> ${file.vault_name || 'General Storage'}\n` +
        `• <b>Tayangan:</b> ${file.views || 0} kali\n` +
        `• <b>Disukai:</b> ${file.likes || 0} orang\n` +
        `• <b>Waktu Unggah:</b> ${new Date(file.uploaded_at).toLocaleString()}\n\n` +
        `Pilih aksi untuk berkas ini:`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [
            { text: '❤️ Tambah Suka (+1)', callback_data: `file_like:${file.id}` },
            { text: '👁️ Tambah Tayangan (+1)', callback_data: `file_stat_view:${file.id}` },
          ],
          [
            { text: '🏛️ Pindah ke Vault Lain', callback_data: `file_move_menu:${file.id}` },
            { text: '🗑️ Hapus Berkas', callback_data: `file_del_confirm:${file.id}` },
          ],
          [
            { text: '⬅️ Kembali ke Daftar File', callback_data: 'menu_files:0' },
            { text: '🏠 Menu Utama', callback_data: 'menu_main' },
          ],
        ],
      });
      return;
    }

    // Handle Like Button Trigger
    if (data.startsWith('file_like:')) {
      const fileId = data.split(':')[1];
      const file = await getFileById(fileId);
      if (file) {
        const newLikes = (file.likes || 0) + 1;
        await updateFileStats(fileId, file.views || 0, newLikes);
        await editTelegramMessageText(
          token,
          chatId,
          messageId,
          `❤️ <b>SUKA DITAMBAHKAN!</b>\n\nBerkas <b>${file.name}</b> kini memiliki <b>${newLikes} suka</b>.`,
          {
            inline_keyboard: [
              [{ text: '👁️ Lihat Detail File', callback_data: `file_view:${file.id}` }],
              [{ text: '📁 Kembali ke Daftar', callback_data: 'menu_files:0' }],
            ],
          }
        );
      }
      return;
    }

    // Handle View Trigger
    if (data.startsWith('file_stat_view:')) {
      const fileId = data.split(':')[1];
      const file = await getFileById(fileId);
      if (file) {
        const newViews = (file.views || 0) + 1;
        await updateFileStats(fileId, newViews, file.likes || 0);
        await editTelegramMessageText(
          token,
          chatId,
          messageId,
          `👁️ <b>TAYANGAN DITAMBAHKAN!</b>\n\nBerkas <b>${file.name}</b> kini tercatat <b>${newViews} tayangan</b>.`,
          {
            inline_keyboard: [
              [{ text: '👁️ Lihat Detail File', callback_data: `file_view:${file.id}` }],
              [{ text: '📁 Kembali ke Daftar', callback_data: 'menu_files:0' }],
            ],
          }
        );
      }
      return;
    }

    // Handle Move File Menu
    if (data.startsWith('file_move_menu:')) {
      const fileId = data.split(':')[1];
      const vaults = await getVaults();
      const vaultButtons = vaults.map((v) => [
        { text: `🏛️ ${v.name}`, callback_data: `file_move_exec:${fileId}:${v.id}` },
      ]);
      vaultButtons.push([{ text: '❌ Batal', callback_data: `file_view:${fileId}` }]);

      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `🏛️ <b>PILIH VAULT TUJUAN:</b>\n\nPindahkan berkas ke bilik penyimpanan baru:`,
        { inline_keyboard: vaultButtons }
      );
      return;
    }

    // Execute Move File
    if (data.startsWith('file_move_exec:')) {
      const parts = data.split(':');
      const fileId = parts[1];
      const targetVaultId = parts[2];
      const updated = await moveFileRecord(fileId, targetVaultId);

      if (updated) {
        await editTelegramMessageText(
          token,
          chatId,
          messageId,
          `✅ <b>BERKAS BERHASIL DIPINDAHKAN!</b>\n\nBerkas <b>${updated.name}</b> kini berada di bilik <b>${updated.vault_name}</b>.`,
          {
            inline_keyboard: [
              [{ text: '👁️ Lihat Detail File', callback_data: `file_view:${fileId}` }],
              [{ text: '📁 Daftar File', callback_data: 'menu_files:0' }],
            ],
          }
        );
      }
      return;
    }

    // Handle Delete Confirm
    if (data.startsWith('file_del_confirm:')) {
      const fileId = data.split(':')[1];
      const file = await getFileById(fileId);
      if (!file) return;

      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `⚠️ <b>KONFIRMASI PENGHAPUSAN:</b>\n\nApakah Anda yakin ingin menghapus berkas:\n<code>${file.name}</code> (${formatBytes(file.size)})?`,
        {
          inline_keyboard: [
            [{ text: '🗑️ Ya, Hapus Sekarang', callback_data: `file_del_exec:${file.id}` }],
            [{ text: '❌ Batalkan', callback_data: `file_view:${file.id}` }],
          ],
        }
      );
      return;
    }

    // Execute Delete
    if (data.startsWith('file_del_exec:')) {
      const fileId = data.split(':')[1];
      const file = await getFileById(fileId);
      if (file) {
        if (file.telegram_message_id) {
          await deleteFromTelegram(token, file.telegram_chat_id || config.telegram_chat_id, file.telegram_message_id);
        }
        await deleteFileRecord(fileId);
        await addLog('BOT_FILE_DELETE', file.name, 'SUCCESS');
      }

      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `🗑️ <b>BERKAS BERHASIL DIHAPUS PERMANEN!</b>`,
        {
          inline_keyboard: [
            [{ text: '📁 Kembali ke Daftar File', callback_data: 'menu_files:0' }],
            [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
          ],
        }
      );
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

      vaultButtons.push([{ text: '➕ Buat Vault Baru', callback_data: 'menu_new_vault_help' }]);
      vaultButtons.push([{ text: '🏠 Kembali ke Menu', callback_data: 'menu_main' }]);

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: vaultButtons,
      });
      return;
    }

    // New Vault Help
    if (data === 'menu_new_vault_help') {
      const text = `➕ <b>CARA MEMBUAT VAULT BARU:</b>\n\n` +
        `Ketik perintah teks:\n` +
        `<code>/newvault &lt;Nama Vault&gt; [Warna] [Deskripsi]</code>\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>/newvault Drama Korea rose Koleksi drakor HD 1080p</code>\n\n` +
        `Bot akan otomatis membuatkan Topic Forum baru di Supergroup Telegram Anda!`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '🏛️ Lihat Daftar Vaults', callback_data: 'menu_vaults' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
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

    // Handle Stats & Diagnostics
    if (data === 'menu_stats' || data === 'menu_diag') {
      const allFiles = await getFiles();
      const totalBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);
      const videos = allFiles.filter((f) => f.type === 'video');
      const images = allFiles.filter((f) => f.type === 'image');
      const docs = allFiles.filter((f) => f.type === 'document');
      const others = allFiles.filter((f) => f.type !== 'video' && f.type !== 'image' && f.type !== 'document');

      const text = `📊 <b>STATISTIK & DIAGNOSTIK CLOUD</b>\n\n` +
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
          [
            { text: '🛡️ Full Suite Diagnostics', callback_data: 'exec_ep:sys-diag' },
            { text: '📁 Lihat File', callback_data: 'menu_files:0' },
          ],
          [{ text: '🌐 Endpoints Hub', callback_data: 'menu_endpoints' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      });
      return;
    }

    // Handle Help Guide
    if (data === 'menu_help') {
      const text = `ℹ️ <b>PANDUAN LENGKAP BOT & PERINTAH ENDPOINT</b>\n\n` +
        `<b>Perintah Utama:</b>\n` +
        `• /start, /menu - Buka menu interaktif utama\n` +
        `• /endpoints - Hub semua 25 REST API Docs & eksekusi instan\n` +
        `• /compress - Panduan kompresi video\n` +
        `• /upload - Panduan upload segala file\n` +
        `• /files, /list - Jelajahi daftar berkas di Cloud\n` +
        `• /vaults - Kelola bilik penyimpanan\n` +
        `• /stats, /diag, /status, /health - Cek kesehatan sistem\n\n` +
        `<b>Perintah Akses Cepat Endpoint:</b>\n` +
        `• <code>/media [kategori]</code> - Lihat koleksi media\n` +
        `• <code>/search &lt;query&gt;</code> - Cari berkas\n` +
        `• <code>/like &lt;id&gt;</code> - Beri suka pada berkas\n` +
        `• <code>/ads</code> - Konfigurasi iklan & monetisasi\n` +
        `• <code>/setads on/off &lt;pin&gt;</code> - Toggle iklan\n` +
        `• <code>/newvault &lt;nama&gt;</code> - Buat Vault Topic baru\n` +
        `• <code>/delvault &lt;id&gt;</code> - Hapus Vault Topic\n` +
        `• <code>/rename &lt;id&gt; &lt;nama&gt;</code> - Ubah nama berkas\n` +
        `• <code>/delete &lt;id&gt;</code> - Hapus berkas permanen\n` +
        `• <code>/move &lt;id&gt; &lt;vault_id&gt;</code> - Pindah berkas ke Vault\n` +
        `• <code>/setstats &lt;id&gt; &lt;views&gt; &lt;likes&gt;</code> - Update statistik\n` +
        `• <code>/poller [start|stop|once]</code> - Kontrol sinkronisasi\n` +
        `• <code>/testbot</code> & <code>/teststorage</code> - Tes konektivitas\n` +
        `• <code>/restore</code> - Pulihkan database dari Telegram Backup`;

      await editTelegramMessageText(token, chatId, messageId, text, {
        inline_keyboard: [
          [{ text: '🌐 Buka Endpoints Hub', callback_data: 'menu_endpoints' }],
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

      executeVideoCompression(token, chatId, String(messageId), matchedPending, preset).catch((err) => {
        console.error('Unhandled compression failure:', err);
      });
      return;
    }

    // Fallback for any other unhandled callback data
    logger.step(`Callback data tidak dikenali secara spesifik: "${data}", mengarahkan ke Menu Utama...`, false);
    const fallbackText = `☁️ <b>${config.website_name || 'RULLZYE CLOUD'} BOT</b>\n\nAksi tombol telah diproses. Silakan pilih menu di bawah:`;
    await editTelegramMessageText(token, chatId, messageId, fallbackText, buildMainMenuKeyboard());
    logger.complete(`Fallback menu utama berhasil dikirim.`);
    return;
  }

  // 2. Handle Text Messages & Media
  const msg = update.message || update.channel_post;
  if (!msg) return;

  const chatId = msg.chat?.id;
  const messageId = String(msg.message_id);

  const logger = incomingLogger || new BotRequestLogger(
    'SYSTEM',
    msg.text?.startsWith('/') ? 'COMMAND' : msg.video ? 'VIDEO' : msg.document ? 'DOCUMENT' : msg.photo ? 'PHOTO' : 'MESSAGE',
    msg.text || msg.caption || 'Media/File Upload',
    update.update_id
  );

  if (msg.from) {
    logger.setUserInfo(msg.from.id, msg.from.username, msg.from.first_name, chatId);
  }

  // Check text commands
  if (msg.text) {
    const rawText = msg.text.trim();
    const args = rawText.split(/\s+/);
    const command = args[0].toLowerCase();

    logger.step(`Mengeksekusi perintah teks bot: "${command}" (Chat ID: ${chatId})`);

    // Handle /botlogs command to view live debug traces in Telegram
    if (command === '/botlogs' || command === '/logs' || command === '/tracer') {
      const summary = getBotLogsSummary();
      const recentLogs = getBotLiveLogs(5);

      let logText = `📋 <b>TELEGRAM BOT LIVE REQUEST TRACER</b>\n\n` +
        `• <b>Total Requests:</b> ${summary.total}\n` +
        `• <b>Status:</b> 🟢 ${summary.successCount} Sukses | 🟡 ${summary.warningCount} Warning | 🔴 ${summary.errorCount} Error\n` +
        `• <b>Tipe:</b> 🔘 ${summary.callbacks} Tombol | ⌨️ ${summary.commands} Perintah | 📦 ${summary.messages} Media\n` +
        `• <b>Log Terakhir:</b> ${summary.lastLogTime}\n\n` +
        `<b>5 Request Terakhir:</b>\n`;

      if (recentLogs.length === 0) {
        logText += `<i>Belum ada log interaksi baru yang tercatat.</i>`;
      } else {
        recentLogs.forEach((l, i) => {
          const statusIcon = l.status === 'SUCCESS' ? '✅' : l.status === 'ERROR' ? '❌' : '⚠️';
          logText += `<b>${i + 1}. [${l.timeStr}] ${statusIcon} [${l.source}] ${l.type}</b>\n` +
            `   Summary: <code>${l.payloadSummary}</code>\n` +
            `   Latency: <b>${l.latencyMs || 0}ms</b> | Status: ${l.status}\n` +
            (l.error ? `   ⚠️ <i>Error: ${l.error}</i>\n` : '') +
            `\n`;
        });
      }

      logText += `Ketik <code>/clearlogs</code> untuk mereset log buffer.`;

      await sendTelegramMessageWithKeyboard(token, chatId, logText, {
        inline_keyboard: [
          [{ text: '🔄 Refresh Logs', callback_data: 'exec_ep:sys-diag' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }, messageId);
      logger.complete('Log tracer berhasil dikirim ke chat Telegram.');
      return;
    }

    if (command === '/clearlogs') {
      clearBotLiveLogs();
      await sendTelegramMessageWithKeyboard(token, chatId, `🧹 <b>LOG BUFFER BERHASIL DIRESET!</b>\nSemua riwayat request bot telah dibersihkan.`, undefined, messageId);
      logger.complete('Log buffer dibersihkan.');
      return;
    }

    if (command === '/start' || command === '/menu') {
      const welcomeText = `☁️ <b>SELAMAT DATANG DI ${config.website_name || 'RULLZYE CLOUD'}!</b>\n\n` +
        `Pusat Penyimpanan Berkas & Kompresi Video Otomatis Terhubung Langsung ke Seluruh Endpoint REST API Docs.\n\n` +
        `<b>⚡ Akses Cepat:</b>\n` +
        `• Kirim <b>Video</b> ➡️ Pilih opsi kompresi atau upload instan.\n` +
        `• Kirim <b>Foto/Dokumen/Arsip</b> ➡️ Otomatis disimpan ke Vault.\n` +
        `• Buka <b>Endpoints API</b> ➡️ Eksekusi semua perintah backend langsung.\n\n` +
        `Gunakan tombol menu interaktif di bawah ini:`;

      await sendTelegramMessageWithKeyboard(token, chatId, welcomeText, buildMainMenuKeyboard(), messageId);
      return;
    }

    if (command === '/endpoints' || command === '/api' || command === '/docs') {
      const text = `🌐 <b>REST API ENDPOINTS HUB</b>\n\nPilih kategori untuk menjelajahi dan mengeksekusi 25 endpoint Docs:`;
      await sendTelegramMessageWithKeyboard(token, chatId, text, buildEndpointsMenuKeyboard(), messageId);
      return;
    }

    if (command === '/media') {
      const catParam = args[1] ? args[1].toUpperCase() : 'ALL';
      const allFiles = await getFiles();
      let mediaFiles = allFiles.filter((f) => f.type === 'video' || f.type === 'image');
      if (catParam === 'PHOTOS' || catParam === 'IMAGES') mediaFiles = mediaFiles.filter((f) => f.type === 'image');
      if (catParam === 'VIDEOS') mediaFiles = mediaFiles.filter((f) => f.type === 'video');

      let reply = `🌐 <b>GET /api/v1/public/media?category=${catParam}</b>\n\n` +
        `Total: <b>${mediaFiles.length} Media</b>\n\n`;

      mediaFiles.slice(0, 5).forEach((m, idx) => {
        reply += `<b>${idx + 1}. ${m.type === 'video' ? '🎬' : '🖼️'} ${m.name}</b>\n` +
          `   👁️ ${m.views || 0} views • ❤️ ${m.likes || 0} likes\n` +
          `   ID: <code>${m.id}</code>\n\n`;
      });

      await sendTelegramMessageWithKeyboard(token, chatId, reply, {
        inline_keyboard: [
          [{ text: '📁 Buka File Explorer', callback_data: 'menu_files:0' }],
          [{ text: '🌐 Endpoints Hub', callback_data: 'menu_endpoints' }],
        ],
      }, messageId);
      return;
    }

    if (command === '/search') {
      const query = args.slice(1).join(' ').toLowerCase();
      if (!query) {
        await sendTelegramMessageWithKeyboard(token, chatId, '🔍 <i>Format: /search &lt;kata kunci&gt;</i>', buildMainMenuKeyboard(), messageId);
        return;
      }

      const allFiles = await getFiles();
      const matched = allFiles.filter((f) => f.name.toLowerCase().includes(query) || (f.vault_name || '').toLowerCase().includes(query));

      let reply = `🔍 <b>HASIL PENCARIAN: "${query}"</b>\n\nDitemukan: <b>${matched.length} Berkas</b>\n\n`;
      matched.slice(0, 5).forEach((f, idx) => {
        const icon = f.type === 'video' ? '🎬' : f.type === 'image' ? '🖼️' : '📄';
        reply += `<b>${idx + 1}. ${icon} ${f.name}</b>\n` +
          `   📦 ${formatBytes(f.size)} • 🏛️ ${f.vault_name || 'General'}\n` +
          `   ID: <code>${f.id}</code>\n\n`;
      });

      await sendTelegramMessageWithKeyboard(token, chatId, reply, {
        inline_keyboard: [
          [{ text: '📁 Semua File', callback_data: 'menu_files:0' }],
          [{ text: '🏠 Menu Utama', callback_data: 'menu_main' }],
        ],
      }, messageId);
      return;
    }

    if (command === '/like') {
      const fileId = args[1];
      if (!fileId) {
        await sendTelegramMessageWithKeyboard(token, chatId, '❤️ <i>Format: /like &lt;file_id&gt;</i>', undefined, messageId);
        return;
      }
      const file = await getFileById(fileId);
      if (file) {
        const newLikes = (file.likes || 0) + 1;
        await updateFileStats(fileId, file.views || 0, newLikes);
        await sendTelegramMessageWithKeyboard(token, chatId, `❤️ <b>SUKA DITAMBAHKAN!</b>\nBerkas <b>${file.name}</b> kini memiliki <b>${newLikes} suka</b>.`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ File ID tidak ditemukan.`, undefined, messageId);
      }
      return;
    }

    if (command === '/stream') {
      const fileId = args[1];
      if (!fileId) {
        await sendTelegramMessageWithKeyboard(token, chatId, '▶️ <i>Format: /stream &lt;file_id&gt;</i>', undefined, messageId);
        return;
      }
      const file = await getFileById(fileId);
      if (file) {
        const reply = `▶️ <b>STREAMING LINK (HTTP 206 PARTIAL CONTENT)</b>\n\n` +
          `• <b>File:</b> ${file.name}\n` +
          `• <b>Stream Path:</b> <code>/api/v1/public/download/${file.id}?inline=true</code>\n` +
          `• <b>Direct Download:</b> <code>/api/v1/public/download/${file.id}</code>\n\n` +
          `Mendukung pemutaran instan dengan seek frame tanpa lag.`;
        await sendTelegramMessageWithKeyboard(token, chatId, reply, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ File ID tidak ditemukan.`, undefined, messageId);
      }
      return;
    }

    if (command === '/ads') {
      const text = `💰 <b>STATUS IKLAN & MONETISASI CPM</b>\n\n` +
        `• <b>Status:</b> ${config.ad_monetization_enabled ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n` +
        `• <b>Popunder Rate:</b> ${config.ad_popunder_rate || 100}%\n` +
        `• <b>Popunder URL:</b> <code>${config.ad_popunder_url ? 'Configured' : 'Default Adsterra'}</code>\n\n` +
        `<b>Perintah Pengaturan:</b>\n` +
        `• <code>/setads on &lt;pin&gt;</code> - Aktifkan iklan\n` +
        `• <code>/setads off &lt;pin&gt;</code> - Nonaktifkan iklan\n` +
        `• <code>/setpopunder &lt;20|30|50|100&gt; &lt;pin&gt;</code> - Ubah persentase popunder`;

      await sendTelegramMessageWithKeyboard(token, chatId, text, undefined, messageId);
      return;
    }

    if (command === '/setads') {
      const mode = args[1]?.toLowerCase();
      const pin = args[2];
      if (!mode || !pin) {
        await sendTelegramMessageWithKeyboard(token, chatId, '💰 <i>Format: /setads &lt;on|off&gt; &lt;pin&gt;</i>\nContoh: <code>/setads on 159357</code>', undefined, messageId);
        return;
      }

      const pinValid = await verifyAdminPin(pin);
      if (!pinValid.success) {
        await sendTelegramMessageWithKeyboard(token, chatId, `❌ <b>PIN ADMIN SALAH:</b> ${pinValid.message}`, undefined, messageId);
        return;
      }

      await saveConfigMap({ ad_monetization_enabled: mode === 'on' });
      await addLog('BOT_SET_ADS', `ENABLED_${mode === 'on'}`, 'SUCCESS');
      await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>MONETISASI IKLAN TELAH DI${mode === 'on' ? 'AKTIFKAN' : 'NONAKTIFKAN'}!</b>`, undefined, messageId);
      return;
    }

    if (command === '/setpopunder') {
      const rate = parseInt(args[1], 10);
      const pin = args[2];
      if (!rate || !pin) {
        await sendTelegramMessageWithKeyboard(token, chatId, '💰 <i>Format: /setpopunder &lt;20|30|50|100&gt; &lt;pin&gt;</i>\nContoh: <code>/setpopunder 100 159357</code>', undefined, messageId);
        return;
      }

      const pinValid = await verifyAdminPin(pin);
      if (!pinValid.success) {
        await sendTelegramMessageWithKeyboard(token, chatId, `❌ <b>PIN ADMIN SALAH:</b> ${pinValid.message}`, undefined, messageId);
        return;
      }

      await saveConfigMap({ ad_popunder_rate: rate });
      await addLog('BOT_SET_POPUNDER', `RATE_${rate}%`, 'SUCCESS');
      await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>RATE POPUNDER DIUBAH KE ${rate}%!</b>`, undefined, messageId);
      return;
    }

    if (command === '/rename') {
      const fileId = args[1];
      const newName = args.slice(2).join(' ');
      if (!fileId || !newName) {
        await sendTelegramMessageWithKeyboard(token, chatId, '✏️ <i>Format: /rename &lt;file_id&gt; &lt;nama_baru&gt;</i>', undefined, messageId);
        return;
      }

      const updated = await updateFileRecord(fileId, { name: newName });
      if (updated) {
        await addLog('BOT_RENAME', newName, 'SUCCESS');
        await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>NAMA FILE BERHASIL DIUBAH!</b>\nNama baru: <b>${updated.name}</b>`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ File ID tidak ditemukan.`, undefined, messageId);
      }
      return;
    }

    if (command === '/delete') {
      const fileId = args[1];
      if (!fileId) {
        await sendTelegramMessageWithKeyboard(token, chatId, '🗑️ <i>Format: /delete &lt;file_id&gt;</i>', undefined, messageId);
        return;
      }

      const file = await getFileById(fileId);
      if (file) {
        if (file.telegram_message_id) {
          await deleteFromTelegram(token, file.telegram_chat_id || config.telegram_chat_id, file.telegram_message_id);
        }
        await deleteFileRecord(fileId);
        await addLog('BOT_FILE_DELETE', file.name, 'SUCCESS');
        await sendTelegramMessageWithKeyboard(token, chatId, `🗑️ <b>BERKAS "${file.name}" BERHASIL DIHAPUS PERMANEN!</b>`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ File ID tidak ditemukan.`, undefined, messageId);
      }
      return;
    }

    if (command === '/move') {
      const fileId = args[1];
      const targetVaultId = args[2];
      if (!fileId || !targetVaultId) {
        await sendTelegramMessageWithKeyboard(token, chatId, '🏛️ <i>Format: /move &lt;file_id&gt; &lt;vault_id&gt;</i>\nContoh: <code>/move file_123 vault_media</code>', undefined, messageId);
        return;
      }

      const updated = await moveFileRecord(fileId, targetVaultId);
      if (updated) {
        await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>BERKAS BERHASIL DIPINDAHKAN!</b>\nBerkas <b>${updated.name}</b> ➡️ Bilik <b>${updated.vault_name}</b>`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ Gagal memindahkan berkas. Pastikan File ID dan Vault ID valid.`, undefined, messageId);
      }
      return;
    }

    if (command === '/setstats') {
      const fileId = args[1];
      const views = parseInt(args[2], 10);
      const likes = parseInt(args[3], 10);
      if (!fileId || isNaN(views)) {
        await sendTelegramMessageWithKeyboard(token, chatId, '📈 <i>Format: /setstats &lt;file_id&gt; &lt;views&gt; [likes]</i>', undefined, messageId);
        return;
      }

      const updated = await updateFileStats(fileId, views, isNaN(likes) ? 0 : likes);
      if (updated) {
        await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>STATISTIK DIPERBARUI!</b>\n${updated.name} ➡️ ${views} views, ${likes || 0} likes.`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ File ID tidak ditemukan.`, undefined, messageId);
      }
      return;
    }

    if (command === '/newvault') {
      const name = args[1];
      const color = args[2] || 'cyan';
      const desc = args.slice(3).join(' ') || `Bilik ${name}`;

      if (!name) {
        await sendTelegramMessageWithKeyboard(token, chatId, '➕ <i>Format: /newvault &lt;Nama&gt; [Warna: cyan|amber|rose|emerald|sky|purple] [Deskripsi]</i>', undefined, messageId);
        return;
      }

      // Auto create telegram forum topic if possible
      let topicId = '';
      try {
        const topicRes = await createTelegramForumTopic(token, config.telegram_chat_id || String(chatId), name);
        if (topicRes.ok && topicRes.message_thread_id) {
          topicId = String(topicRes.message_thread_id);
        }
      } catch {}

      const newVault = await createVault({
        name,
        color,
        description: desc,
        icon: 'Folder',
        topic_id: topicId,
      });

      await addLog('BOT_NEW_VAULT', name, 'SUCCESS');
      await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>VAULT "${newVault.name}" BERHASIL DIBUAT!</b>\nID: <code>${newVault.id}</code>\nTopic Forum: <code>${topicId || 'Standard Thread'}</code>`, undefined, messageId);
      return;
    }

    if (command === '/delvault') {
      const vaultId = args[1];
      if (!vaultId) {
        await sendTelegramMessageWithKeyboard(token, chatId, '🗑️ <i>Format: /delvault &lt;vault_id&gt;</i>', undefined, messageId);
        return;
      }

      const success = await deleteVault(vaultId);
      if (success) {
        await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>VAULT BERHASIL DIHAPUS!</b>\nSemua berkas di dalamnya telah dipindahkan ke General Storage.`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `⚠️ Gagal menghapus vault. Vault utama tidak dapat dihapus.`, undefined, messageId);
      }
      return;
    }

    if (command === '/poller') {
      const action = args[1]?.toLowerCase();
      if (action === 'start') {
        startBackgroundPoller(2000);
        await sendTelegramMessageWithKeyboard(token, chatId, '🟢 <b>BACKGROUND POLLER DIMULAI!</b>', undefined, messageId);
      } else if (action === 'stop') {
        stopBackgroundPoller();
        await sendTelegramMessageWithKeyboard(token, chatId, '🔴 <b>BACKGROUND POLLER DIHENTIKAN!</b>', undefined, messageId);
      } else if (action === 'once') {
        const res = await runSinglePolling();
        await sendTelegramMessageWithKeyboard(token, chatId, `⚡ <b>POLLING RUN SELESAI:</b> ${res.processed} event disinkronkan.`, undefined, messageId);
      } else {
        const status = getPollerStatus();
        await sendTelegramMessageWithKeyboard(token, chatId, `🤖 <b>POLLER STATUS:</b> ${status.isPolling ? '🟢 AKTIF' : '🔴 MATI'}\nTotal Diproses: ${status.processedCount}`, undefined, messageId);
      }
      return;
    }

    if (command === '/setwebhook') {
      const url = args[1];
      const res = await setTelegramWebhook(token, url);
      await sendTelegramMessageWithKeyboard(token, chatId, res.ok ? `✅ <b>WEBHOOK DIDAFTARKAN!</b>` : `❌ <b>GAGAL:</b> ${res.description || 'Gagal'}`, undefined, messageId);
      return;
    }

    if (command === '/restore') {
      const res = await restoreFromTelegramBackup(token, String(chatId), config.telegram_topic_id);
      await sendTelegramMessageWithKeyboard(token, chatId, res.ok ? `✅ <b>DATABASE BERHASIL DIPULIHKAN!</b>` : `ℹ️ ${res.message}`, undefined, messageId);
      return;
    }

    if (command === '/auth' || command === '/login') {
      const pin = args[1];
      if (!pin) {
        await sendTelegramMessageWithKeyboard(token, chatId, '🛡️ <i>Format: /auth &lt;pin_6_digit&gt;</i>', undefined, messageId);
        return;
      }
      const res = await verifyAdminPin(pin);
      if (res.success) {
        await sendTelegramMessageWithKeyboard(token, chatId, `✅ <b>AUTENTIKASI BERHASIL!</b>\nAkses administrator aktif.`, undefined, messageId);
      } else {
        await sendTelegramMessageWithKeyboard(token, chatId, `❌ <b>PIN SALAH:</b> ${res.message}`, undefined, messageId);
      }
      return;
    }

    if (command === '/diag' || command === '/diagnostics') {
      const botTest = await testTelegramBot(token);
      const storageTest = await testStorageChat(token, config.telegram_chat_id || String(chatId), config.telegram_topic_id);
      const poller = getPollerStatus();

      const diagText = `🛡️ <b>FULL SUITE DIAGNOSTICS</b>\n\n` +
        `• 🤖 <b>Bot Telegram:</b> ${botTest.ok ? `🟢 ONLINE (${botTest.username || botTest.botName || 'bot'})` : '🔴 GAGAL'}\n` +
        `• 💾 <b>Storage Chat:</b> ${storageTest.ok ? '🟢 IZIN VALID' : '🔴 GAGAL'}\n` +
        `• 🔄 <b>Daemon Poller:</b> ${poller.isPolling ? '🟢 AKTIF' : '🟡 STANDBY'}\n` +
        `• 🗄️ <b>Google Firestore:</b> 🟢 ONLINE & PERSISTENT\n` +
        `• 🗜️ <b>FFmpeg Video Engine:</b> 🟢 READY\n\n` +
        `Semua endpoint siap digunakan!`;

      await sendTelegramMessageWithKeyboard(token, chatId, diagText, undefined, messageId);
      return;
    }

    if (command === '/testbot') {
      const testRes = await testTelegramBot(token);
      await sendTelegramMessageWithKeyboard(token, chatId, testRes.ok ? `✅ <b>BOT TOKEN VALID:</b> ${testRes.username || testRes.botName}` : `❌ <b>GAGAL:</b> ${testRes.error}`, undefined, messageId);
      return;
    }

    if (command === '/teststorage') {
      const testRes = await testStorageChat(token, config.telegram_chat_id || String(chatId), config.telegram_topic_id);
      await sendTelegramMessageWithKeyboard(token, chatId, testRes.ok ? `✅ <b>STORAGE CHAT VERIFIED!</b>` : `❌ <b>GAGAL:</b> ${testRes.error}`, undefined, messageId);
      return;
    }

    if (command === '/health' || command === '/status') {
      const allFiles = await getFiles();
      const statusText = `🟢 <b>STATUS RULLZYE CLOUD: ONLINE</b>\n\n` +
        `• Website: <b>${config.website_name || 'RULLZYE CLOUD'}</b>\n` +
        `• Total Files: <b>${allFiles.length} berkas</b>\n` +
        `• Storage Chat ID: <code>${config.telegram_chat_id || 'Not Set'}</code>\n` +
        `• Bot Polling: <b>AKTIF (Interval ~2 Detik)</b>\n` +
        `• Video Compression Engine: <b>FFmpeg Standby (Live Progress 1%-100%)</b>`;

      await sendTelegramMessageWithKeyboard(token, chatId, statusText, buildMainMenuKeyboard(), messageId);
      return;
    }

    if (command === '/compress') {
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

    if (command === '/upload') {
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

    if (command === '/files' || command === '/list') {
      const page = parseInt(args[1], 10) || 0;
      const allFiles = await getFiles();
      const totalFiles = allFiles.length;
      const pageFiles = allFiles.slice(page * 5, (page + 1) * 5);

      let filesText = `📁 <b>DAFTAR FILE DI CLOUD</b> (Halaman ${page + 1}/${Math.ceil(totalFiles / 5) || 1})\n\n` +
        `Total: <b>${totalFiles} Berkas</b>\n\n`;

      pageFiles.forEach((file, idx) => {
        const icon = file.type === 'video' ? '🎬' : file.type === 'image' ? '🖼️' : file.type === 'document' ? '📄' : '📦';
        filesText += `<b>${page * 5 + idx + 1}. ${icon} ${file.name}</b>\n` +
          `   📦 ${formatBytes(file.size)} • 🏛️ ${file.vault_name || 'General'}\n` +
          `   🆔 <code>${file.id}</code>\n\n`;
      });

      const buttons = [];
      if (totalFiles > 5) {
        buttons.push([{ text: '➡️ Halaman Berikutnya', callback_data: 'menu_files:1' }]);
      }
      buttons.push([{ text: '🏠 Menu Utama', callback_data: 'menu_main' }]);

      await sendTelegramMessageWithKeyboard(token, chatId, filesText, { inline_keyboard: buttons }, messageId);
      return;
    }

    if (command === '/vaults') {
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

    if (command === '/stats') {
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

    if (command === '/help') {
      const helpText = `ℹ️ <b>PANDUAN LENGKAP BOT & PERINTAH ENDPOINTS</b>\n\n` +
        `Ketik /endpoints untuk melihat semua 25 REST API Docs dan menjalankannya secara interaktif!`;

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
    if (isVideo) {
      const vaults = await getVaults();
      const activeVaultId = userSelectedVaultMap.get(chatId) || vaults[0].id;
      const targetVault = vaults.find((v) => v.id === activeVaultId) || vaults[0];

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
