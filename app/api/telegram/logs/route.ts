import { NextRequest, NextResponse } from 'next/server';
import { getBotLiveLogs, clearBotLiveLogs, getBotLogsSummary } from '@/lib/bot-logger';
import { getPollerStatus } from '@/lib/bot-poller';
import { getConfigMap } from '@/lib/excel-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const filter = searchParams.get('filter') || 'ALL';

    const logs = getBotLiveLogs(limit, filter);
    const summary = getBotLogsSummary();
    const poller = getPollerStatus();
    const config = await getConfigMap();

    return NextResponse.json({
      ok: true,
      summary,
      poller,
      hasBotToken: !!config.telegram_bot_token,
      botTokenMasked: config.telegram_bot_token ? `${config.telegram_bot_token.substring(0, 7)}...${config.telegram_bot_token.slice(-4)}` : 'NOT_SET',
      logs,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearBotLiveLogs();
    return NextResponse.json({ ok: true, message: 'Bot logs cleared successfully' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
