import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { processTelegramUpdate } from '@/lib/bot-processor';

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Telegram Webhook Endpoint is Active' });
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json({ ok: false, error: 'Bot token not configured' });
    }

    const update = await req.json();
    await processTelegramUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
