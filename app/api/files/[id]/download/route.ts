import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
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

    const { searchParams } = new URL(req.url);
    const inlineParam = searchParams.get('inline');
    const isMedia = file.type === 'image' || file.type === 'video' || (file.mime && (file.mime.startsWith('image/') || file.mime.startsWith('video/')));
    const isInline = inlineParam === 'true' || isMedia;

    // 1. PRIMARY: If file is stored on ImageKit, deliver via ImageKit CDN
    if (file.imagekit_url) {
      let cdnUrl = file.imagekit_url;
      if (!isInline) {
        // Force download attachment via ImageKit parameter
        const sep = cdnUrl.includes('?') ? '&' : '?';
        cdnUrl = `${cdnUrl}${sep}ik-attachment=true`;
      }
      return NextResponse.redirect(cdnUrl, { status: 302, headers: getCorsHeaders() });
    }

    // 2. FALLBACK: Legacy Telegram file stream
    const config = await getConfigMap();
    if (!config.telegram_bot_token || !file.telegram_file_id) {
      return NextResponse.json(
        { success: false, message: 'File tidak memiliki sumber data yang valid' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const rangeHeader = req.headers.get('range');
    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id, rangeHeader);

    if (!tgRes.ok || !tgRes.response) {
      console.error('Telegram stream error:', tgRes.error);
      // Check if it's a timeout or large file error
      const isTimeoutError = tgRes.error?.includes('timeout') || tgRes.error?.includes('too big');
      const statusCode = isTimeoutError ? 413 : 502;
      
      return NextResponse.json(
        { 
          success: false, 
          message: tgRes.error || 'Gagal mengambil file dari Telegram',
          retryable: !isTimeoutError
        },
        { status: statusCode, headers: getCorsHeaders() }
      );
    }

    const fileStream = tgRes.response.body;
    if (!fileStream) {
      return NextResponse.json(
        { success: false, message: 'File stream tidak tersedia' },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    const headers = new Headers(getCorsHeaders());

    headers.set('Content-Type', file.mime || (file.type === 'video' ? 'video/mp4' : file.type === 'image' ? 'image/jpeg' : 'application/octet-stream'));
    headers.set(
      'Content-Disposition',
      `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    const contentRange = tgRes.response.headers.get('content-range');
    const contentLength = tgRes.response.headers.get('content-length');

    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    } else if (file.size) {
      headers.set('Content-Length', String(file.size));
    }

    const responseStatus = tgRes.response.status === 206 ? 206 : 200;

    // Wrap stream with error handling
    const wrappedStream = new ReadableStream({
      async start(controller) {
        const reader = fileStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          console.error('Stream read error:', err);
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new NextResponse(wrappedStream as any, {
      status: responseStatus,
      headers,
    });
  } catch (err: any) {
    console.error('Download route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mendownload file: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

