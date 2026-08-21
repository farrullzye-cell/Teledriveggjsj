export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export async function testTelegramBot(token: string): Promise<{ ok: boolean; botName?: string; username?: string; error?: string }> {
  if (!token) {
    return { ok: false, error: 'Token Telegram Bot belum diisi' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
    });
    const data = await res.json();

    if (data.ok && data.result) {
      return {
        ok: true,
        botName: data.result.first_name,
        username: data.result.username ? `@${data.result.username}` : undefined,
      };
    } else {
      return {
        ok: false,
        error: data.description || 'Gagal terhubung ke Telegram Bot',
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Koneksi ke Telegram gagal',
    };
  }
}

export async function testStorageChat(token: string, chatId: string, topicId?: string): Promise<{ ok: boolean; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Token Bot dan Storage Chat ID wajib diisi' };
  }

  try {
    const bodyPayload: any = {
      chat_id: chatId,
      text: '🟢 RULLZYE CLOUD STORAGE TEST\n\nKoneksi storage chat berhasil!',
    };
    if (topicId && topicId.trim()) {
      bodyPayload.message_thread_id = Number(topicId.trim());
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await res.json();

    if (data.ok) {
      return { ok: true };
    } else {
      return {
        ok: false,
        error: data.description || 'Gagal mengirim pesan ke Storage Chat',
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Gagal menghubungi Telegram API',
    };
  }
}

function getRetryAfterSeconds(data: any): number | null {
  if (data?.parameters?.retry_after && typeof data.parameters.retry_after === 'number') {
    return data.parameters.retry_after;
  }
  const desc = data?.description || '';
  const match = desc.match(/retry after (\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

function isTopicThreadError(desc = ''): boolean {
  const d = desc.toLowerCase();
  return (
    d.includes('thread not found') ||
    d.includes('message thread not found') ||
    d.includes('topic not found') ||
    d.includes('topic closed') ||
    d.includes('topic_closed') ||
    d.includes('topic_deleted') ||
    d.includes('not a forum') ||
    d.includes('message_thread_id')
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadPhotoToTelegram(
  token: string,
  chatId: string,
  imageBuffer: Buffer,
  filename = 'thumbnail.jpg',
  topicId?: string
): Promise<{ ok: boolean; file_id?: string; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Konfigurasi Telegram belum lengkap' };
  }

  const maxAttempts = 3;
  let currentTopicId = topicId?.trim() || undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (currentTopicId) {
        formData.append('message_thread_id', currentTopicId);
      }
      formData.append('caption', `🖼️ THUMBNAIL PREVIEW\nFile: ${filename}\nGenerated: ${new Date().toLocaleString()}`);

      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
      formData.append('photo', blob, filename);

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.ok && data.result && data.result.photo && data.result.photo.length > 0) {
        const bestPhoto = data.result.photo[data.result.photo.length - 1];
        return {
          ok: true,
          file_id: bestPhoto.file_id,
        };
      }

      // Handle Telegram 429 Rate Limit (Too Many Requests)
      const retryAfter = getRetryAfterSeconds(data);
      if (retryAfter !== null && attempt < maxAttempts) {
        const waitTimeMs = (retryAfter + 1) * 1000;
        console.warn(`[TELEGRAM-UPLOAD-PHOTO] Rate limited (retry after ${retryAfter}s). Waiting ${waitTimeMs}ms before retry #${attempt + 1}...`);
        await sleep(waitTimeMs);
        continue;
      }

      // If topic/thread error specifically, fallback to main chat once
      if (!data.ok && currentTopicId && isTopicThreadError(data.description)) {
        console.warn(`[TELEGRAM-UPLOAD-PHOTO] Topic #${currentTopicId} invalid (${data.description}). Retrying to main chat...`);
        currentTopicId = undefined;
        continue;
      }

      return {
        ok: false,
        error: data.description || 'Upload thumbnail ke Telegram gagal',
      };
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return {
          ok: false,
          error: err.message || 'Terjadi kesalahan saat upload thumbnail',
        };
      }
      await sleep(1000 * attempt);
    }
  }

  return { ok: false, error: 'Upload thumbnail ke Telegram gagal setelah beberapa percobaan.' };
}

export async function uploadToTelegram(
  token: string,
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  topicId?: string
): Promise<{ ok: boolean; file_id?: string; message_id?: string; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Konfigurasi Telegram belum lengkap' };
  }

  const maxAttempts = 3;
  let currentTopicId = topicId?.trim() || undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (currentTopicId) {
        formData.append('message_thread_id', currentTopicId);
      }
      formData.append('caption', `📦 RULLZYE CLOUD\nFilename: ${filename}\nUploaded: ${new Date().toLocaleString()}`);

      const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType || 'application/octet-stream' });
      formData.append('document', blob, filename);

      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.ok && data.result) {
        const doc = data.result.document || data.result.video || data.result.audio;
        const fileId = doc ? doc.file_id : (data.result.photo ? data.result.photo[data.result.photo.length - 1].file_id : null);
        const messageId = String(data.result.message_id);

        if (fileId) {
          return {
            ok: true,
            file_id: fileId,
            message_id: messageId,
          };
        } else {
          return { ok: false, error: 'Telegram tidak mengembalikan file_id' };
        }
      }

      // Handle Telegram 429 Rate Limit (Too Many Requests)
      const retryAfter = getRetryAfterSeconds(data);
      if (retryAfter !== null && attempt < maxAttempts) {
        const waitTimeMs = (retryAfter + 1) * 1000;
        console.warn(`[TELEGRAM-UPLOAD] Rate limited (retry after ${retryAfter}s). Waiting ${waitTimeMs}ms before retry #${attempt + 1}...`);
        await sleep(waitTimeMs);
        continue;
      }

      // If topic/thread error specifically, fallback to main chat once
      if (!data.ok && currentTopicId && isTopicThreadError(data.description)) {
        console.warn(`[TELEGRAM-UPLOAD] Topic #${currentTopicId} invalid (${data.description}). Retrying to main chat...`);
        currentTopicId = undefined;
        continue;
      }

      const rawError = data.description || 'Upload ke Telegram gagal';
      const isTooBig = rawError.toLowerCase().includes('file is too big') || rawError.toLowerCase().includes('too big');
      const finalError = isTooBig
        ? `Bad Request: file is too big (Batas upload Telegram Bot API adalah 50 MB. Kirimkan file langsung ke chat Telegram bot untuk menyimpan berkas hingga 2 GB).`
        : rawError;

      return {
        ok: false,
        error: finalError,
      };
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return {
          ok: false,
          error: err.message || 'Terjadi kesalahan saat upload ke Telegram',
        };
      }
      await sleep(1000 * attempt);
    }
  }

  return { ok: false, error: 'Upload ke Telegram gagal setelah beberapa percobaan.' };
}

export async function deleteFromTelegram(token: string, chatId: string, messageId: string): Promise<boolean> {
  if (!token || !chatId || !messageId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    console.error('Delete from telegram failed:', e);
    return false;
  }
}

export async function getTelegramFileStream(
  token: string,
  fileId: string,
  rangeHeader?: string | null
): Promise<{ ok: boolean; response?: Response; error?: string }> {
  if (!token || !fileId) {
    return { ok: false, error: 'Token atau File ID tidak valid' };
  }

  try {
    // Step 1: get file path with 10s timeout
    const pathController = new AbortController();
    const pathTimeout = setTimeout(() => pathController.abort(), 10000);
    
    const pathRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`, {
      signal: pathController.signal
    });
    clearTimeout(pathTimeout);
    
    const pathData = await pathRes.json();

    if (!pathData.ok || !pathData.result || !pathData.result.file_path) {
      const desc = pathData.description || '';
      if (desc.toLowerCase().includes('file is too big') || desc.toLowerCase().includes('too big')) {
        return {
          ok: false,
          error: 'Bad Request: file is too big (Batas unduh Telegram Bot API adalah 20 MB). Berkas tetap aman tersimpan di Telegram dan dapat dibuka langsung via Telegram.',
        };
      }
      return { ok: false, error: desc || 'Gagal mendapatkan lokasi file dari Telegram' };
    }

    const filePath = pathData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const headers: Record<string, string> = {
      'Connection': 'keep-alive',
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Step 2: fetch file content stream with 120s timeout
    const fileController = new AbortController();
    const fileTimeout = setTimeout(() => fileController.abort(), 120000);
    
    const fileRes = await fetch(downloadUrl, { 
      headers,
      signal: fileController.signal 
    });
    clearTimeout(fileTimeout);
    
    if (!fileRes.ok && fileRes.status !== 206) {
      return { ok: false, error: `Gagal mendownload file dari Telegram (HTTP ${fileRes.status})` };
    }

    return { ok: true, response: fileRes };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Download timeout: File terlalu besar atau koneksi terganggu. Gunakan tautan unduh langsung atau coba lagi.' };
    }
    return { ok: false, error: err.message || 'Gagal mengambil file dari Telegram' };
  }
}

export async function createForumTopic(token: string, chatId: string, name = '☁️ DATABASE METADATA'): Promise<{ ok: boolean; message_thread_id?: number; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Token dan Chat ID wajib diisi' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/createForumTopic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        name,
        icon_custom_emoji_id: undefined,
      }),
    });
    const data = await res.json();
    if (data.ok && data.result) {
      return { ok: true, message_thread_id: data.result.message_thread_id };
    }
    return { ok: false, error: data.description || 'Gagal membuat forum topic (pastikan group mengaktifkan Topics/Topics/Forum)' };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export const createTelegramForumTopic = createForumTopic;

export async function setTelegramWebhook(token: string, webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  if (!token || !webhookUrl) {
    return { ok: false, description: 'Token dan Webhook URL wajib diisi' };
  }

  const allAllowedUpdates = [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'inline_query',
    'chosen_inline_result',
    'callback_query',
    'shipping_query',
    'pre_checkout_query',
    'poll',
    'poll_answer',
    'my_chat_member',
    'chat_member',
    'chat_join_request',
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: allAllowedUpdates,
        drop_pending_updates: false,
      }),
    });
    const data = await res.json();
    return { ok: !!data.ok, description: data.description || (data.ok ? 'Webhook berhasil dipasang' : 'Gagal memasang webhook') };
  } catch (err: any) {
    return { ok: false, description: err.message || 'Gagal menghubungi API Telegram' };
  }
}

export async function getTelegramWebhookInfo(token: string): Promise<{
  ok: boolean;
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
  description?: string;
}> {
  if (!token) return { ok: false };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        ok: true,
        url: data.result.url,
        has_custom_certificate: data.result.has_custom_certificate,
        pending_update_count: data.result.pending_update_count,
        last_error_date: data.result.last_error_date,
        last_error_message: data.result.last_error_message,
        last_synchronization_error_date: data.result.last_synchronization_error_date,
        max_connections: data.result.max_connections,
        allowed_updates: data.result.allowed_updates,
      };
    }
    return { ok: false, description: data.description };
  } catch (e: any) {
    return { ok: false, description: e.message };
  }
}

export async function deleteTelegramWebhook(token: string, dropPendingUpdates = false): Promise<{ ok: boolean; description?: string }> {
  if (!token) return { ok: false, description: 'Token tidak valid' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: dropPendingUpdates }),
    });
    const data = await res.json();
    return { ok: !!data.ok, description: data.description || (data.ok ? 'Webhook berhasil dihapus' : 'Gagal menghapus webhook') };
  } catch (err: any) {
    return { ok: false, description: err.message || 'Gagal menghubungi API Telegram' };
  }
}

export async function uploadAutoBackupToTelegram(
  token: string,
  chatId: string,
  dbJsonString: string,
  topicId?: string,
  oldBackupMessageId?: string
): Promise<{ ok: boolean; message_id?: string; file_id?: string; error?: string }> {
  if (!token || !chatId) return { ok: false, error: 'Token/Chat ID belum terkonfigurasi' };

  try {
    const filename = `database.json`;
    const buffer = Buffer.from(dbJsonString, 'utf-8');

    const uploadRes = await uploadToTelegram(
      token,
      chatId,
      buffer,
      filename,
      'application/json',
      topicId
    );

    if (uploadRes.ok && uploadRes.message_id) {
      // Hapus backup lama secara otomatis dari Telegram jika ada oldBackupMessageId
      if (oldBackupMessageId && oldBackupMessageId !== uploadRes.message_id) {
        try {
          await deleteFromTelegram(token, chatId, oldBackupMessageId);
        } catch (e) {
          console.warn('Peringatan: Gagal menghapus backup lama di Telegram:', e);
        }
      }

      return {
        ok: true,
        message_id: uploadRes.message_id,
        file_id: uploadRes.file_id,
      };
    } else {
      return { ok: false, error: uploadRes.error || 'Gagal upload auto-backup ke Telegram' };
    }
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function downloadTelegramFileAsJson(token: string, fileId: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const streamRes = await getTelegramFileStream(token, fileId);
    if (!streamRes.ok || !streamRes.response) {
      return { ok: false, error: streamRes.error || 'Gagal streaming file dari Telegram' };
    }
    const jsonText = await streamRes.response.text();
    const parsed = JSON.parse(jsonText);
    return { ok: true, data: parsed };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Gagal memproses JSON dari Telegram' };
  }
}

export async function sendTelegramMessageWithKeyboard(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  replyToMessageId?: string | number,
  topicId?: string
): Promise<{ ok: boolean; message_id?: string; error?: string }> {
  const maxAttempts = 3;
  let currentTopicId = topicId ? String(topicId).trim() : undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }
      if (replyToMessageId) {
        body.reply_to_message_id = Number(replyToMessageId);
      }
      if (currentTopicId) {
        body.message_thread_id = Number(currentTopicId);
      }

      let res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data = await res.json();
      if (data.ok && data.result) {
        return { ok: true, message_id: String(data.result.message_id) };
      }

      // Handle Telegram 429 Rate Limit (Too Many Requests)
      const retryAfter = getRetryAfterSeconds(data);
      if (retryAfter !== null && attempt < maxAttempts) {
        const waitTimeMs = (retryAfter + 1) * 1000;
        console.warn(`[TELEGRAM-SEND-MSG] Rate limited (retry after ${retryAfter}s). Waiting ${waitTimeMs}ms before retry #${attempt + 1}...`);
        await sleep(waitTimeMs);
        continue;
      }

      // Fallback if HTML entity parse error occurs
      if (!data.ok && data.description && data.description.includes('can\'t parse entities')) {
        delete body.parse_mode;
        res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        data = await res.json();
        if (data.ok && data.result) {
          return { ok: true, message_id: String(data.result.message_id) };
        }
      }

      // Fallback if topic/thread invalid
      if (!data.ok && currentTopicId && isTopicThreadError(data.description)) {
        console.warn(`[TELEGRAM-SEND-MSG] Topic #${currentTopicId} invalid (${data.description}). Retrying to main chat...`);
        currentTopicId = undefined;
        continue;
      }

      return { ok: false, error: data.description || 'Gagal mengirim pesan Telegram' };
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return { ok: false, error: err.message };
      }
      await sleep(1000 * attempt);
    }
  }

  return { ok: false, error: 'Gagal mengirim pesan Telegram setelah beberapa percobaan.' };
}

export async function editTelegramMessageText(
  token: string,
  chatId: number | string,
  messageId: string | number,
  text: string,
  replyMarkup?: any
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: any = {
      chat_id: chatId,
      message_id: Number(messageId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    let res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let data = await res.json();

    // Handle Telegram 429 Rate Limit (Too Many Requests)
    const retryAfter = getRetryAfterSeconds(data);
    if (retryAfter !== null) {
      const waitTimeMs = (retryAfter + 1) * 1000;
      await sleep(waitTimeMs);
      res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = await res.json();
    }

    // If already modified or identical, treat as success
    if (!data.ok && data.description && data.description.includes('message is not modified')) {
      return { ok: true };
    }

    // Fallback if HTML entity parse error occurs
    if (!data.ok && data.description && data.description.includes('can\'t parse entities')) {
      delete body.parse_mode;
      res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = await res.json();
      if (data.ok) return { ok: true };
    }

    // Fallback: If message cannot be edited, send as a new message
    if (!data.ok && data.description && (data.description.includes('message to edit not found') || data.description.includes('message can\'t be edited'))) {
      const sendRes = await sendTelegramMessageWithKeyboard(token, chatId, text, replyMarkup);
      return { ok: sendRes.ok, error: sendRes.error };
    }

    return { ok: !!data.ok, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

export async function uploadVideoFileToTelegram(
  token: string,
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string,
  duration?: number,
  width?: number,
  height?: number,
  topicId?: string
): Promise<{ ok: boolean; file_id?: string; message_id?: string; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Konfigurasi Telegram belum lengkap' };
  }

  const maxAttempts = 3;
  let currentTopicId = topicId?.trim() || undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (currentTopicId) {
        formData.append('message_thread_id', currentTopicId);
      }
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      if (duration && duration > 0) {
        formData.append('duration', String(Math.round(duration)));
      }
      if (width && width > 0) {
        formData.append('width', String(Math.round(width)));
      }
      if (height && height > 0) {
        formData.append('height', String(Math.round(height)));
      }
      formData.append('supports_streaming', 'true');

      const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'video/mp4' });
      formData.append('video', blob, filename);

      const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.ok && data.result) {
        const doc = data.result.video || data.result.document;
        const fileId = doc ? doc.file_id : (data.result.photo ? data.result.photo[data.result.photo.length - 1].file_id : null);
        const messageId = String(data.result.message_id);

        if (fileId) {
          return { ok: true, file_id: fileId, message_id: messageId };
        }
      }

      // Handle Telegram 429 Rate Limit (Too Many Requests)
      const retryAfter = getRetryAfterSeconds(data);
      if (retryAfter !== null && attempt < maxAttempts) {
        const waitTimeMs = (retryAfter + 1) * 1000;
        console.warn(`[TELEGRAM-UPLOAD-VIDEO] Rate limited (retry after ${retryAfter}s). Waiting ${waitTimeMs}ms before retry #${attempt + 1}...`);
        await sleep(waitTimeMs);
        continue;
      }

      // If topic error specifically, fallback to main chat
      if (!data.ok && currentTopicId && isTopicThreadError(data.description)) {
        console.warn(`[TELEGRAM-UPLOAD-VIDEO] Topic #${currentTopicId} invalid (${data.description}). Retrying to main chat...`);
        currentTopicId = undefined;
        continue;
      }

      // Fallback: upload as Document if sendVideo fails
      return await uploadToTelegram(token, chatId, fileBuffer, filename, 'video/mp4', currentTopicId);
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return await uploadToTelegram(token, chatId, fileBuffer, filename, 'video/mp4', currentTopicId);
      }
      await sleep(1000 * attempt);
    }
  }

  return await uploadToTelegram(token, chatId, fileBuffer, filename, 'video/mp4', currentTopicId);
}




