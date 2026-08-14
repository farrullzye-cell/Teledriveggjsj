import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { testStorageChat } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let token = '';
    let chatId = '';

    try {
      const body = await req.json();
      token = body.token || '';
      chatId = body.chatId || '';
    } catch (e) {
      // Body may be empty
    }

    const config = await getConfigMap();

    if (!token || token.startsWith('••••')) {
      token = config.telegram_bot_token;
    }

    if (!chatId) {
      chatId = config.telegram_chat_id;
    }

    if (!token || !chatId) {
      return NextResponse.json(
        { ok: false, error: 'Token Bot dan Storage Chat ID wajib diisi' },
        { status: 400 }
      );
    }

    const res = await testStorageChat(token, chatId);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Gagal melakukan tes Storage Chat: ' + err.message },
      { status: 500 }
    );
  }
}
