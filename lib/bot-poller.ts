import { getConfigMap } from '@/lib/excel-db';
import { processTelegramUpdate } from '@/lib/bot-processor';
import { deleteTelegramWebhook } from '@/lib/telegram';

declare global {
  var __telegramLastOffset: number | undefined;
  var __telegramPollerTimer: NodeJS.Timeout | undefined;
  var __telegramIsPolling: boolean | undefined;
}

export async function pollUpdatesOnce(): Promise<{ ok: boolean; processedCount: number; lastOffset?: number; error?: string }> {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return { ok: false, processedCount: 0, error: 'Token Bot belum diatur' };
    }

    const token = config.telegram_bot_token;
    const offset = globalThis.__telegramLastOffset || 0;

    // Fetch updates from Telegram API
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&limit=50&timeout=0`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (!data.ok) {
      // If error is due to active webhook, try deleting webhook automatically
      if (data.description && data.description.includes('webhook is active')) {
        await deleteTelegramWebhook(token);
      }
      return { ok: false, processedCount: 0, error: data.description || 'Gagal mengambil updates dari Telegram' };
    }

    const updates = data.result || [];
    let processedCount = 0;
    let nextOffset = offset;

    for (const update of updates) {
      try {
        await processTelegramUpdate(update);
        processedCount++;
      } catch (err) {
        console.error('Error processing update in poller:', err);
      }
      if (update.update_id >= nextOffset) {
        nextOffset = update.update_id + 1;
      }
    }

    globalThis.__telegramLastOffset = nextOffset;

    return { ok: true, processedCount, lastOffset: nextOffset };
  } catch (err: any) {
    return { ok: false, processedCount: 0, error: err.message || 'Polling error' };
  }
}

export function startBackgroundPoller(intervalMs = 2000) {
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
