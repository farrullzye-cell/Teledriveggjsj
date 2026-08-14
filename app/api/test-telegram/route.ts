import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { testTelegramBot } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let token = '';
    try {
      const body = await req.json();
      token = body.token || '';
    } catch (e) {
      // Body may be empty
    }

    if (!token || token.startsWith('••••')) {
      const config = await getConfigMap();
      token = config.telegram_bot_token;
    }

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Telegram Bot Token belum dikonfigurasi' },
        { status: 400 }
      );
    }

    const res = await testTelegramBot(token);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Gagal melakukan tes Telegram Bot: ' + err.message },
      { status: 500 }
    );
  }
}
