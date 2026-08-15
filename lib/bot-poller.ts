import { getConfigMap } from '@/lib/excel-db';
import { processTelegramUpdate } from '@/lib/bot-processor';
import { deleteTelegramWebhook } from '@/lib/telegram';
import { BotRequestLogger } from '@/lib/bot-logger';

declare global {
  var __telegramLastOffset: number | undefined;
  var __telegramPollerTimer: NodeJS.Timeout | undefined;
  var __telegramIsPolling: boolean | undefined;
  var __telegramLastPollError: string | undefined;
  var __telegramPollLock: boolean | undefined;
}

export async function pollUpdatesOnce(): Promise<{ ok: boolean; processedCount: number; lastOffset?: number; error?: string }> {
  if (globalThis.__telegramPollLock) {
    return { ok: true, processedCount: 0, lastOffset: globalThis.__telegramLastOffset, error: 'Poll in progress' };
  }

  globalThis.__telegramPollLock = true;
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      globalThis.__telegramPollLock = false;
      return { ok: false, processedCount: 0, error: 'Token Bot belum diatur' };
    }

    const token = config.telegram_bot_token;
    const offset = globalThis.__telegramLastOffset || 0;

    // Fetch updates from Telegram API with all allowed_updates
    const allAllowedUpdates = [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'inline_query',
      'chosen_inline_result',
      'callback_query',
      'shipping_query',
      'pre_checkout_query',
      'poll',
      'poll_answer',
      'my_chat_member',
      'chat_member',
      'chat_join_request',
    ];

    const getUpdatesPayload = {
      offset: offset,
      limit: 50,
      timeout: 0,
      allowed_updates: allAllowedUpdates,
    };

    let res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getUpdatesPayload),
      cache: 'no-store',
    });
    let data = await res.json();

    if (!data.ok) {
      // If error is due to active webhook, delete webhook and immediately retry
      if (data.description && data.description.includes('webhook is active')) {
        console.log('[BOT_POLLER] Webhook aktif terdeteksi. Menghapus webhook agar getUpdates polling berjalan...');
        await deleteTelegramWebhook(token);
        // Immediate retry
        res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getUpdatesPayload),
          cache: 'no-store',
        });
        data = await res.json();
      }
      if (!data.ok) {
        globalThis.__telegramLastPollError = data.description;
        return { ok: false, processedCount: 0, error: data.description || 'Gagal mengambil updates dari Telegram' };
      }
    }

    globalThis.__telegramLastPollError = undefined;
    const updates = data.result || [];
    let processedCount = 0;
    let nextOffset = offset;

    for (const update of updates) {
      const updateId = update.update_id;
      const isCallback = !!update.callback_query;
      const isMessage = !!update.message;

      const type = isCallback
        ? 'CALLBACK_QUERY'
        : update.message?.text?.startsWith('/')
        ? 'COMMAND'
        : update.message?.video
        ? 'VIDEO'
        : update.message?.document
        ? 'DOCUMENT'
        : update.message?.photo
        ? 'PHOTO'
        : isMessage
        ? 'MESSAGE'
        : 'UNKNOWN';

      const summary = isCallback
        ? `Button Click: "${update.callback_query.data}"`
        : update.message?.text
        ? `Text: "${update.message.text}"`
        : update.message?.video
        ? `Video: ${update.message.video.file_name || 'video.mp4'}`
        : update.message?.document
        ? `Doc: ${update.message.document.file_name || 'file'}`
        : `Update #${updateId}`;

      const logger = new BotRequestLogger('POLLER', type, summary, updateId);
      logger.setRawPayload(update);

      const sender = update.callback_query?.from || update.message?.from;
      const chat = update.callback_query?.message?.chat || update.message?.chat;

      if (sender) {
        logger.setUserInfo(sender.id, sender.username, sender.first_name, chat?.id);
      }

      logger.step(`Menerima update via background Long Poller (Offset: ${offset}, Update ID: ${updateId})`);

      try {
        await processTelegramUpdate(update, logger);
        logger.complete(`Update #${updateId} sukses diproses via Poller.`);
        processedCount++;
      } catch (err: any) {
        logger.fail(`Gagal saat memproses update: ${err.message}`);
        console.error('Error processing update in poller:', err);
      }

      if (update.update_id >= nextOffset) {
        nextOffset = update.update_id + 1;
      }
    }

    globalThis.__telegramLastOffset = nextOffset;

    return { ok: true, processedCount, lastOffset: nextOffset };
  } catch (err: any) {
    globalThis.__telegramLastPollError = err.message;
    return { ok: false, processedCount: 0, error: err.message || 'Polling error' };
  } finally {
    globalThis.__telegramPollLock = false;
  }
}


export function startBackgroundPoller(intervalMs = 2000) {
  if (process.env.NEXT_PHASE === 'phase-production-build' || typeof window !== 'undefined') {
    return;
  }

  if (globalThis.__telegramPollerTimer) {
    return; // Already running
  }

  globalThis.__telegramIsPolling = true;

  // Initial immediate poll
  pollUpdatesOnce().catch(() => {});

  // Set interval poller (~2 seconds)
  globalThis.__telegramPollerTimer = setInterval(() => {
    pollUpdatesOnce().catch((err) => {
      console.error('Interval poll error:', err);
    });
  }, intervalMs);
}

export function stopBackgroundPoller() {
  if (globalThis.__telegramPollerTimer) {
    clearInterval(globalThis.__telegramPollerTimer);
    globalThis.__telegramPollerTimer = undefined;
  }
  globalThis.__telegramIsPolling = false;
}

export function isPollerActive() {
  return !!globalThis.__telegramPollerTimer || !!globalThis.__telegramIsPolling;
}

export function getPollerStatus() {
  return {
    isPolling: isPollerActive(),
    processedCount: globalThis.__telegramLastOffset ? globalThis.__telegramLastOffset : 0,
    lastOffset: globalThis.__telegramLastOffset || 0,
    lastPollTime: Date.now(),
  };
}

export async function runSinglePolling() {
  const res = await pollUpdatesOnce();
  return {
    processed: res.processedCount,
    lastOffset: res.lastOffset || 0,
    ok: res.ok,
    error: res.error,
  };
}
