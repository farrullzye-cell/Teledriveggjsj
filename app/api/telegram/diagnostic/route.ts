import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { testTelegramBot, getTelegramWebhookInfo, setTelegramWebhook, deleteTelegramWebhook } from '@/lib/telegram';
import { pollUpdatesOnce, getPollerStatus } from '@/lib/bot-poller';
import { getBotLogsSummary, getBotLiveLogs, BotRequestLogger } from '@/lib/bot-logger';

export async function GET() {
  try {
    const config = await getConfigMap();
    const token = config.telegram_bot_token;

    if (!token) {
      return NextResponse.json({
        ok: false,
        error: 'Bot token belum dikonfigurasi di Settings.',
      });
    }

    // 1. Check Bot connectivity
    const botInfo = await testTelegramBot(token);

    // 2. Check Webhook Info
    const webhookInfo = await getTelegramWebhookInfo(token);

    // 3. Check Poller Status
    const pollerStatus = getPollerStatus();

    // 4. Check Logs Summary
    const logsSummary = getBotLogsSummary();
    const recentLogs = getBotLiveLogs(10);

    return NextResponse.json({
      ok: true,
      bot: {
        connected: botInfo.ok,
        name: botInfo.botName,
        username: botInfo.username,
        error: botInfo.error,
      },
      webhook: {
        active: !!webhookInfo.url,
        url: webhookInfo.url || null,
        pending_updates: webhookInfo.pending_update_count || 0,
        last_error_date: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toISOString() : null,
        last_error_message: webhookInfo.last_error_message || null,
        allowed_updates: webhookInfo.allowed_updates || [],
        has_callback_query: webhookInfo.allowed_updates ? webhookInfo.allowed_updates.includes('callback_query') : true,
      },
      poller: pollerStatus,
      logsSummary,
      recentLogs,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const token = config.telegram_bot_token;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Bot token belum diatur.' }, { status: 400 });
    }

    const body = await req.json();
    const action = body.action || 'diagnose';

    if (action === 'reset_to_poller') {
      // Delete any webhook from Telegram so getUpdates can receive everything
      const delRes = await deleteTelegramWebhook(token, false);
      // Reset poller offset to 0 so it catches all updates
      globalThis.__telegramLastOffset = 0;
      // Immediately run 1 poll
      const pollRes = await pollUpdatesOnce();

      const logger = new BotRequestLogger('SYSTEM', 'COMMAND', 'Bot switch to Polling Mode (Webhook Deleted)');
      logger.complete(`Polled ${pollRes.processedCount} updates immediately.`);

      return NextResponse.json({
        ok: true,
        message: 'Mode Polling diaktifkan. Webhook telah dihapus dari Telegram server dan updates langsung ditarik.',
        deleteResult: delRes,
        pollResult: pollRes,
      });
    }

    if (action === 'set_webhook') {
      const targetUrl = body.url;
      if (!targetUrl) {
        return NextResponse.json({ ok: false, error: 'URL Webhook wajib disertakan.' }, { status: 400 });
      }

      const setRes = await setTelegramWebhook(token, targetUrl);
      const logger = new BotRequestLogger('SYSTEM', 'COMMAND', `Webhook registered: ${targetUrl}`);
      if (setRes.ok) {
        logger.complete('Webhook sukses terpasang dengan semua allowed_updates.');
      } else {
        logger.fail(setRes.description || 'Gagal memasang webhook.');
      }

      return NextResponse.json({
        ok: setRes.ok,
        message: setRes.ok ? 'Webhook berhasil dipasang!' : setRes.description,
        targetUrl,
      });
    }

    if (action === 'drop_pending') {
      await deleteTelegramWebhook(token, true);
      globalThis.__telegramLastOffset = 0;
      return NextResponse.json({
        ok: true,
        message: 'Pending updates di server Telegram berhasil direset.',
      });
    }

    if (action === 'poll_now') {
      const pollRes = await pollUpdatesOnce();
      return NextResponse.json({
        ok: pollRes.ok,
        processedCount: pollRes.processedCount,
        error: pollRes.error,
      });
    }

    return NextResponse.json({ ok: false, error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
