import { getConfigMap, addFileRecord, addLog, determineFileType, getVaults } from '@/lib/excel-db';

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function sendTelegramMessage(token: string, chatId: number | string, text: string, replyToMessageId?: string | number) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyToMessageId ? Number(replyToMessageId) : undefined,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Failed to send telegram message reply:', err);
  }
}

export async function processTelegramUpdate(update: any) {
  const config = await getConfigMap();
  if (!config.telegram_bot_token) {
    return;
  }

  const msg = update.message || update.channel_post;
  if (!msg) return;

  const chatId = msg.chat?.id;
  const messageId = String(msg.message_id);

  // Check for text commands
  if (msg.text) {
    const text = msg.text.trim();
    if (text.startsWith('/start') || text.startsWith('/help')) {
      const helpText = `<b>☁️ RULLZYE CLOUD BOT</b>\n\n` +
        `Selamat datang di <b>${config.website_name || 'RULLZYE CLOUD'}</b>!\n\n` +
        `<b>Cara Mengunggah File (Tanpa Webhook / Long Polling 2s):</b>\n` +
        `1. Kirimkan file (Dokumen, Foto, Video, Lagu, atau Voice) langsung ke pesan bot ini atau ke dalam Group Storage.\n` +
        `2. File Anda akan secara otomatis diproses dan masuk ke daftar Cloud Storage di Web Dashboard dalam hitungan detik!\n\n` +
        `<b>Command Tersedia:</b>\n` +
        `/start - Tampilkan pesan ini\n` +
        `/status - Cek status koneksi storage`;
      
      await sendTelegramMessage(config.telegram_bot_token, chatId, helpText, messageId);
      return;
    }

    if (text.startsWith('/status')) {
      const statusText = `🟢 <b>RULLZYE CLOUD STATUS: ONLINE</b>\n\n` +
        `• Website: <b>${config.website_name || 'RULLZYE CLOUD'}</b>\n` +
        `• Storage Chat ID: <code>${config.telegram_chat_id || 'Not Set'}</code>\n` +
        `• Mode: <b>LONG POLLING (INTERVAL ~2 DETIK)</b>`;
      
      await sendTelegramMessage(config.telegram_bot_token, chatId, statusText, messageId);
      return;
    }
  }

  // Extract file details if present
  let fileId = '';
  let filename = '';
  let mime = 'application/octet-stream';
  let size = 0;

  if (msg.document) {
    fileId = msg.document.file_id;
    filename = msg.document.file_name || `document_${Date.now()}`;
    mime = msg.document.mime_type || 'application/octet-stream';
    size = msg.document.file_size || 0;
  } else if (msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    fileId = largestPhoto.file_id;
    const cleanCaption = msg.caption ? msg.caption.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30) : '';
    filename = cleanCaption ? (cleanCaption.endsWith('.jpg') ? cleanCaption : `${cleanCaption}.jpg`) : `photo_${Date.now()}.jpg`;
    mime = 'image/jpeg';
    size = largestPhoto.file_size || 0;
  } else if (msg.video) {
    fileId = msg.video.file_id;
    filename = msg.video.file_name || (msg.caption ? msg.caption.substring(0, 30) : `video_${Date.now()}.mp4`);
    if (!filename.includes('.')) filename += '.mp4';
    mime = msg.video.mime_type || 'video/mp4';
    size = msg.video.file_size || 0;
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
    const fileType = determineFileType(filename, mime);
    
    // Check if message belongs to a specific Telegram Forum Topic
    const vaults = await getVaults();
    const threadIdStr = msg.message_thread_id ? String(msg.message_thread_id) : '';
    const matchedVault = threadIdStr ? vaults.find((v) => v.topic_id === threadIdStr) : null;
    const targetVault = matchedVault || vaults[0];

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
        `File ini sudah pernah diunggah sebelumnya ke RULLZYE CLOUD Storage dan tidak diduplikasi.`;
      await sendTelegramMessage(config.telegram_bot_token, chatId, dupMsg, messageId);
      return;
    }

    await addLog('BOT_UPLOAD', filename, 'SUCCESS');

    const replyMsg = `✅ <b>BERHASIL DISIMPAN KE CLOUD!</b>\n\n` +
      `📄 <b>File:</b> ${record.name}\n` +
      `📦 <b>Ukuran:</b> ${formatBytes(size)}\n` +
      `🏷 <b>Kategori:</b> ${fileType.toUpperCase()}\n` +
      `🏛️ <b>Bilik Vault:</b> ${record.vault_name || 'General Storage'}\n\n` +
      `🌐 File ini sudah otomatis tersimpan di RULLZYE CLOUD dan dapat diakses dari Web Dashboard.`;

    await sendTelegramMessage(config.telegram_bot_token, chatId, replyMsg, messageId);
  }
}
