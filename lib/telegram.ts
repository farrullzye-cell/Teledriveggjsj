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

export async function testStorageChat(token: string, chatId: string): Promise<{ ok: boolean; error?: string }> {
  if (!token || !chatId) {
    return { ok: false, error: 'Token Bot dan Storage Chat ID wajib diisi' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🟢 RULLZYE CLOUD STORAGE TEST\n\nKoneksi storage chat berhasil!',
      }),
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

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (topicId && topicId.trim()) {
      formData.append('message_thread_id', topicId.trim());
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
      // Pick best resolution photo
      const bestPhoto = data.result.photo[data.result.photo.length - 1];
      return {
        ok: true,
        file_id: bestPhoto.file_id,
      };
    }

    // Fallback retry without topicId if topic error
    if (!data.ok && topicId) {
      const fallbackFormData = new FormData();
      fallbackFormData.append('chat_id', chatId);
      fallbackFormData.append('caption', `🖼️ THUMBNAIL PREVIEW\nFile: ${filename}\nGenerated: ${new Date().toLocaleString()}`);
      fallbackFormData.append('photo', blob, filename);

      const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: fallbackFormData,
      });
      const retryData = await retryRes.json();
      if (retryData.ok && retryData.result && retryData.result.photo && retryData.result.photo.length > 0) {
        const bestPhoto = retryData.result.photo[retryData.result.photo.length - 1];
        return {
          ok: true,
          file_id: bestPhoto.file_id,
        };
      }
      return {
        ok: false,
        error: retryData.description || data.description || 'Upload thumbnail ke Telegram gagal',
      };
    }

    return {
      ok: false,
      error: data.description || 'Upload thumbnail ke Telegram gagal',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Terjadi kesalahan saat upload thumbnail',
    };
  }
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

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (topicId && topicId.trim()) {
      formData.append('message_thread_id', topicId.trim());
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

    // Fallback retry without topicId if topic error occurs
    if (!data.ok && topicId) {
      console.warn(`[TELEGRAM-UPLOAD] SendDocument to topic #${topicId} failed (${data.description}). Retrying to main chat...`);
      const fallbackFormData = new FormData();
      fallbackFormData.append('chat_id', chatId);
      fallbackFormData.append('caption', `📦 RULLZYE CLOUD\nFilename: ${filename}\nUploaded: ${new Date().toLocaleString()}`);
      fallbackFormData.append('document', blob, filename);

      const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: fallbackFormData,
      });

      const retryData = await retryRes.json();
      if (retryData.ok && retryData.result) {
        const doc = retryData.result.document || retryData.result.video;
        const fileId = doc ? doc.file_id : (retryData.result.photo ? retryData.result.photo[retryData.result.photo.length - 1].file_id : null);
        const messageId = String(retryData.result.message_id);

        if (fileId) {
          return {
            ok: true,
            file_id: fileId,
            message_id: messageId,
          };
        }
      }

      return {
        ok: false,
        error: retryData.description || data.description || 'Upload ke Telegram gagal',
      };
    }

    return {
      ok: false,
      error: data.description || 'Upload ke Telegram gagal',
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Terjadi kesalahan saat upload ke Telegram',
    };
  }
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
    // Step 1: get file path
    const pathRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const pathData = await pathRes.json();

    if (!pathData.ok || !pathData.result || !pathData.result.file_path) {
      return { ok: false, error: pathData.description || 'Gagal mendapatkan lokasi file dari Telegram' };
    }

    const filePath = pathData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const headers: Record<string, string> = {};
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Step 2: fetch file content stream
    const fileRes = await fetch(downloadUrl, { headers });
    if (!fileRes.ok && fileRes.status !== 206) {
      return { ok: false, error: `Gagal mendownload file dari Telegram (HTTP ${fileRes.status})` };
    }

    return { ok: true, response: fileRes };
  } catch (err: any) {
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

export async function setTelegramWebhook(token: string, webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  if (!token || !webhookUrl) {
    return { ok: false, description: 'Token dan Webhook URL wajib diisi' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'channel_post'] }),
    });
    const data = await res.json();
    return { ok: !!data.ok, description: data.description || (data.ok ? 'Webhook berhasil dipasang' : 'Gagal memasang webhook') };
  } catch (err: any) {
    return { ok: false, description: err.message || 'Gagal menghubungi API Telegram' };
  }
}

export async function getTelegramWebhookInfo(token: string): Promise<{ ok: boolean; url?: string; description?: string }> {
  if (!token) return { ok: false };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (data.ok && data.result) {
      return { ok: true, url: data.result.url };
    }
    return { ok: false, description: data.description };
  } catch {
    return { ok: false };
  }
}

export async function deleteTelegramWebhook(token: string): Promise<{ ok: boolean; description?: string }> {
  if (!token) return { ok: false, description: 'Token tidak valid' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
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



