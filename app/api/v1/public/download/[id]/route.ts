import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

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

    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json(
        { success: false, message: 'Bot Token Telegram belum dikonfigurasi' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const rangeHeader = req.headers.get('range');
    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id, rangeHeader);

    if (!tgRes.ok || !tgRes.response) {
      return NextResponse.json(
        { success: false, message: tgRes.error || 'Gagal mengambil file dari Telegram' },
        { status: 502, headers: getCorsHeaders() }
      );
    }

    const { searchParams } = new URL(req.url);
    const inlineParam = searchParams.get('inline');
    const isMedia = file.type === 'image' || file.type === 'video' || (file.mime && (file.mime.startsWith('image/') || file.mime.startsWith('video/')));
    const isInline = inlineParam === 'true' || isMedia;

    const fileStream = tgRes.response.body;
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

    return new NextResponse(fileStream as any, {
      status: responseStatus,
      headers,
    });
  } catch (err: any) {
    console.error('Public download route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mendownload file: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
