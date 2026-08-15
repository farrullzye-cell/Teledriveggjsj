export interface BotLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  source: 'WEBHOOK' | 'POLLER' | 'DIRECT_API' | 'SYSTEM';
  type: 'CALLBACK_QUERY' | 'COMMAND' | 'MESSAGE' | 'VIDEO' | 'DOCUMENT' | 'PHOTO' | 'UNKNOWN';
  updateId?: number;
  chatId?: string | number;
  userId?: string | number;
  username?: string;
  senderName?: string;
  payloadSummary: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'PROCESSING';
  latencyMs?: number;
  steps: Array<{ time: string; message: string; ok: boolean }>;
  error?: string;
  rawPayload?: any;
}

// In-memory ring buffer (up to 150 items)
declare global {
  var __botLiveLogs: BotLogEntry[] | undefined;
}

if (!globalThis.__botLiveLogs) {
  globalThis.__botLiveLogs = [];
}

const MAX_LOGS = 150;

export class BotRequestLogger {
  private entry: BotLogEntry;
  private startTime: number;

  constructor(source: 'WEBHOOK' | 'POLLER' | 'DIRECT_API' | 'SYSTEM', type: BotLogEntry['type'], payloadSummary: string, updateId?: number) {
    this.startTime = Date.now();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

    this.entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      timeStr,
      source,
      type,
      updateId,
      payloadSummary,
      status: 'PROCESSING',
      steps: [{ time: timeStr, message: `Inbound request received [${source}]`, ok: true }],
    };

    this.save();
  }

  public setUserInfo(userId?: string | number, username?: string, senderName?: string, chatId?: string | number) {
    this.entry.userId = userId;
    this.entry.username = username;
    this.entry.senderName = senderName;
    this.entry.chatId = chatId;
    this.save();
    return this;
  }

  public setRawPayload(payload: any) {
    try {
      this.entry.rawPayload = typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : payload;
    } catch {}
    this.save();
    return this;
  }

  public step(message: string, ok = true) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    this.entry.steps.push({ time: timeStr, message, ok });
    if (!ok && this.entry.status !== 'ERROR') {
      this.entry.status = 'WARNING';
    }
    this.save();
    console.log(`[BOT_TRACE][${this.entry.source}][${this.entry.type}] ${message}`);
    return this;
  }

  public complete(successMessage = 'Selesai diproses dengan sukses') {
    this.step(successMessage, true);
    this.entry.status = this.entry.status === 'WARNING' ? 'WARNING' : 'SUCCESS';
    this.entry.latencyMs = Date.now() - this.startTime;
    this.save();
    return this.entry;
  }

  public fail(errorMessage: string) {
    this.step(`GAGAL: ${errorMessage}`, false);
    this.entry.status = 'ERROR';
    this.entry.error = errorMessage;
    this.entry.latencyMs = Date.now() - this.startTime;
    this.save();
    console.error(`[BOT_ERROR][${this.entry.source}][${this.entry.type}] ${errorMessage}`);
    return this.entry;
  }

  private save() {
    if (!globalThis.__botLiveLogs) {
      globalThis.__botLiveLogs = [];
    }
    const idx = globalThis.__botLiveLogs.findIndex((l) => l.id === this.entry.id);
    if (idx >= 0) {
      globalThis.__botLiveLogs[idx] = { ...this.entry };
    } else {
      globalThis.__botLiveLogs.unshift({ ...this.entry });
      if (globalThis.__botLiveLogs.length > MAX_LOGS) {
        globalThis.__botLiveLogs.pop();
      }
    }
  }
}

export function getBotLiveLogs(limit = 50, filterType?: string): BotLogEntry[] {
  let logs = globalThis.__botLiveLogs || [];
  if (filterType && filterType !== 'ALL') {
    logs = logs.filter((l) => l.type === filterType || l.source === filterType || l.status === filterType);
  }
  return logs.slice(0, limit);
}

export function clearBotLiveLogs(): void {
  globalThis.__botLiveLogs = [];
}

export function getBotLogsSummary() {
  const logs = globalThis.__botLiveLogs || [];
  const total = logs.length;
  const successCount = logs.filter((l) => l.status === 'SUCCESS').length;
  const errorCount = logs.filter((l) => l.status === 'ERROR').length;
  const warningCount = logs.filter((l) => l.status === 'WARNING').length;
  const callbacks = logs.filter((l) => l.type === 'CALLBACK_QUERY').length;
  const commands = logs.filter((l) => l.type === 'COMMAND').length;
  const messages = logs.filter((l) => l.type === 'MESSAGE' || l.type === 'VIDEO' || l.type === 'DOCUMENT').length;

  return {
    total,
    successCount,
    errorCount,
    warningCount,
    callbacks,
    commands,
    messages,
    lastLogTime: logs[0]?.timeStr || 'Belum ada log',
  };
}
