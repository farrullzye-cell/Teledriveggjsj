import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

const thumbnailCache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer | null>>();
const MAX_CACHE_ITEMS = 80;

export async function OPTIONS() {
  return handleCorsOptions();
}

function remember(id: string, data: Buffer) {
  thumbnailCache.delete(id);
  thumbnailCache.set(id, data);
  while (thumbnailCache.size > MAX_CACHE_ITEMS) {
    const first = thumbnailCache.keys().next().value;
    if (!first) break;
    thumbnailCache.delete(first);
  }
}

async function getPersistedThumbnail(id: string, token: string): Promise<Buffer | null> {
  try {
    const snap = await getDoc(doc(firestoreDb, 'thumbnail_cache', id));
    if (!snap.exists()) return null;

    const data = snap.data() as { telegram_file_id?: string };
    if (!data.telegram_file_id) return null;

    const tgRes = await getTelegramFileStream(token, data.telegram_file_id);
    if (!tgRes.ok || !tgRes.response?.body) return null;

    const buffer = Buffer.from(await tgRes.response.arrayBuffer());
    if (buffer.length < 100) return null;

    remember(id, buffer);
    return buffer;
  } catch (err) {
    console.warn(`[THUMBNAIL] Persistent lookup failed for ${id}:`, err);
    return null;
  }
}

async function uploadThumbnailToTelegram(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  topicId?: string
): Promise<{ ok: boolean; file_id?: string; message_id?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (topicId?.trim()) {
      formData.append('message_thread_id', topicId.trim());
    }
    formData.append('caption', `🖼️ XVIDSHUB THUMBNAIL\n${filename}`);
    formData.append(
      'document',
      new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }),
      filename
    );

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!data.ok || !data.result?.document?.file_id) {
      return { ok: false, error: data.description || 'Telegram tidak mengembalikan file_id thumbnail' };
    }

    return {
      ok: true,
      file_id: data.result.document.file_id,
      message_id: String(data.result.message_id),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Upload thumbnail ke Telegram gagal' };
  }
}

async function generateAndPersistThumbnail(id: string): Promise<Buffer | null> {
  const cached = thumbnailCache.get(id);
  if (cached) return cached;

  const existing = pending.get(id);
  if (existing) return existing;

  const job = (async () => {
    const file = await getFileById(id);
    if (!file || file.type !== 'video') return null;

    const config = await getConfigMap();
    if (!config.telegram_bot_token || !config.telegram_chat_id) return null;

    const persisted = await getPersistedThumbnail(id, config.telegram_bot_token);
    if (persisted) return persisted;

    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);
    if (!tgRes.ok || !tgRes.response?.body) return null;

    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', '1',
      '-i', 'pipe:0',
      '-frames:v', '1',
      '-an',
      '-vf', 'scale=640:-2:force_original_aspect_ratio=decrease',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '6',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const chunks: Buffer[] = [];
    let stderr = '';

    const outputPromise = new Promise<Buffer>((resolve, reject) => {
      ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', (code) => {
        const result = Buffer.concat(chunks);
        if (code === 0 && result.length > 100) resolve(result);
        else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      });
    });

    const input = Readable.fromWeb(tgRes.response.body as any);
    input.on('error', (err) => ffmpeg.stdin.destroy(err));
    input.pipe(ffmpeg.stdin);

    try {
      const result = await outputPromise;
      remember(id, result);

      const upload = await uploadThumbnailToTelegram(
        config.telegram_bot_token,
        config.telegram_chat_id,
        result,
        `thumbnail_${id}.jpg`,
        config.telegram_topic_id
      );

      if (upload.ok && upload.file_id) {
        await setDoc(doc(firestoreDb, 'thumbnail_cache', id), {
          telegram_file_id: upload.file_id,
          telegram_message_id: upload.message_id || '',
          mime: 'image/jpeg',
          created_at: new Date().toISOString(),
          source_file_id: file.telegram_file_id,
        }, { merge: true });
      } else {
        console.warn(`[THUMBNAIL] Generated but could not persist ${id}:`, upload.error);
      }

      return result;
    } catch (err) {
      console.warn(`[THUMBNAIL] Failed for ${id}:`, err);
      try { ffmpeg.kill('SIGKILL'); } catch {}
      return null;
    }
  })();

  pending.set(id, job);
  try {
    return await job;
  } finally {
    pending.delete(id);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    if (file.type !== 'video') {
      return NextResponse.json(
        { success: false, message: 'Thumbnail hanya tersedia untuk video' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const thumbnail = await generateAndPersistThumbnail(id);
    if (!thumbnail) {
      return NextResponse.redirect(
        new URL(`/api/v1/public/download/${id}?inline=true`, req.url),
        302
      );
    }

    const headers = new Headers(getCorsHeaders());
    headers.set('Content-Type', 'image/jpeg');
    headers.set('Content-Length', String(thumbnail.length));
    headers.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
    headers.set('X-Thumbnail-Source', 'telegram-persistent');

    return new NextResponse(new Uint8Array(thumbnail), { status: 200, headers });
  } catch (err: any) {
    console.error('Public thumbnail route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat thumbnail: ' + (err?.message || 'Unknown error') },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
