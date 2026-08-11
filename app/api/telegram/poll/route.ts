import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { pollUpdatesOnce, startBackgroundPoller, stopBackgroundPoller, isPollerActive } from '@/lib/bot-poller';
import { deleteTelegramWebhook } from '@/lib/telegram';

export async function GET() {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json({ ok: false, isPolling: false, message: 'Bot Token belum diatur' });
    }

    // Always ensure background poller is running if token is present
    startBackgroundPoller(2000);

    // Perform an immediate poll check
    const pollResult = await pollUpdatesOnce();

    return NextResponse.json({
      ok: true,
      isPolling: isPollerActive(),
      processedCount: pollResult.processedCount,
      lastOffset: pollResult.lastOffset,
      error: pollResult.error,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json({ ok: false, message: 'Bot token belum diatur di menu Setup.' }, { status: 400 });
    }

    let action = 'start';
    try {
      const body = await req.json();
      if (body.action) action = body.action;
    } catch {}

    if (action === 'stop') {
      stopBackgroundPoller();
      return NextResponse.json({ ok: true, isPolling: false, message: 'Long Polling dihentikan.' });
    }

    // 1. Clear any active webhook on Telegram so getUpdates can run without conflict
    const deleteWebhookResult = await deleteTelegramWebhook(config.telegram_bot_token);

    // 2. Start background interval (every 2 seconds)
    startBackgroundPoller(2000);

    // 3. Trigger immediate poll cycle
    const result = await pollUpdatesOnce();

    return NextResponse.json({
      ok: true,
      isPolling: true,
      message: '⚡ Long Polling 2 Detik Berhasil Diaktifkan (Tanpa Webhook)!',
      deleteWebhookResult,
      processedCount: result.processedCount,
      error: result.error,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
