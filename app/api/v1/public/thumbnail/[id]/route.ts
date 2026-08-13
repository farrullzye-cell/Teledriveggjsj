import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

// Small in-process cache prevents repeated ffmpeg work while the same server
// instance is alive. Browser/CDN caching handles the long-lived case.
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

async function generateThumbnail(id: string): Promise<Buffer | null> {
  const cached = thumbnailCache.get(id);
  if (cached) return cached;

  const existing = pending.get(id);
  if (existing) return existing;

  const job = (async () => {
    const file = await getFileById(id);
    if (!file || file.type !== 'video') return null;

    const config = await getConfigMap();
    if (!config.telegram_bot_token) return null;

    // Stream the original video from Telegram directly into ffmpeg. This
    // avoids downloading the entire file to disk and avoids browser-side
    // 1-second video rendering.
    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);
    if (!tgRes.ok || !tgRes.response?.body) return null;

    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ss', '1',
      '-frames:v', '1',
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

    const config = await getConfigMap();

    const thumbnail = await generateThumbnail(id);
    if (!thumbnail) {
      // Do not break existing clients if thumbnail extraction is unavailable.
      return NextResponse.redirect(
        new URL(`/api/v1/public/download/${id}?inline=true`, req.url),
        302
      );
    }

    const headers = new Headers(getCorsHeaders());
    headers.set('Content-Type', 'image/jpeg');
    headers.set('Content-Length', String(thumbnail.length));
    headers.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
    headers.set('X-Thumbnail-Source', 'server-ffmpeg');

    return new NextResponse(new Uint8Array(thumbnail), { status: 200, headers });
  } catch (err: any) {
    console.error('Public thumbnail route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat thumbnail: ' + (err?.message || 'Unknown error') },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
