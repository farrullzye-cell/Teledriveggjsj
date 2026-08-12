import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { getCorsHeaders, handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const inline = searchParams.get('inline') === 'true' || searchParams.get('preview') === 'true';

    const file = await getFileById(id);
    if (!file) {
      return jsonWithCors(
        { success: false, message: 'File tidak ditemukan di storage privat' },
        404
      );
    }

    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return jsonWithCors(
        { success: false, message: 'Telegram storage belum dikonfigurasi pada server privat' },
        400
      );
    }

    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);
    if (!tgRes.ok || !tgRes.response) {
      return jsonWithCors(
        { success: false, message: tgRes.error || 'Gagal streaming file dari Telegram Cloud' },
        502
      );
    }

    const fileStream = tgRes.response.body;
    const corsHeaders = getCorsHeaders();

    const dispositionType = inline ? 'inline' : 'attachment';

    const responseHeaders = new Headers({
      ...corsHeaders,
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Disposition': `${dispositionType}; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    if (file.size) {
      responseHeaders.set('Content-Length', String(file.size));
    }

    return new NextResponse(fileStream as any, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('Public download route error:', err);
    return jsonWithCors(
      { success: false, message: 'Gagal mendownload media: ' + err.message },
      500
    );
  }
}
