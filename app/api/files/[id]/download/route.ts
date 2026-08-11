import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';

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
        { status: 404 }
      );
    }

    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json(
        { success: false, message: 'Bot Token Telegram belum dikonfigurasi' },
        { status: 400 }
      );
    }

    const tgRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);

    if (!tgRes.ok || !tgRes.response) {
      return NextResponse.json(
        { success: false, message: tgRes.error || 'Gagal mengambil file dari Telegram' },
        { status: 502 }
      );
    }

    const fileStream = tgRes.response.body;
    const headers = new Headers();

    headers.set('Content-Type', file.mime || 'application/octet-stream');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.name)}"`
    );
    if (file.size) {
      headers.set('Content-Length', String(file.size));
    }

    return new NextResponse(fileStream as any, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('Download route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mendownload file: ' + err.message },
      { status: 500 }
    );
  }
}
