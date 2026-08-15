import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { processTelegramUpdate } from '@/lib/bot-processor';
import { BotRequestLogger } from '@/lib/bot-logger';

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: 'ACTIVE',
    service: 'Telegram Webhook Handler',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  let update: any;

  try {
    update = await req.json();
  } catch (err: any) {
    const logger = new BotRequestLogger('WEBHOOK', 'UNKNOWN', 'Invalid JSON body');
    logger.fail(`Gagal membaca body JSON: ${err.message}`);
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const updateId = update.update_id;
  const isCallback = !!update.callback_query;
  const isMessage = !!update.message;
  const isChannelPost = !!update.channel_post;

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

  const logger = new BotRequestLogger('WEBHOOK', type, summary, updateId);
  logger.setRawPayload(update);

  const sender = update.callback_query?.from || update.message?.from || update.channel_post?.from;
  const chat = update.callback_query?.message?.chat || update.message?.chat || update.channel_post?.chat;

  if (sender) {
    logger.setUserInfo(sender.id, sender.username, sender.first_name, chat?.id);
  }

  logger.step(`Menerima payload Webhook dari Telegram (IP: ${ip}, Update ID: ${updateId})`);

  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      logger.fail('Bot token belum dikonfigurasi di pengaturan database');
      return NextResponse.json({ ok: false, error: 'Bot token not configured' });
    }

    logger.step(`Memulai eksekusi handler bot untuk jenis ${type}...`);
    await processTelegramUpdate(update, logger);
    logger.complete(`Update #${updateId} sukses diproses via Webhook.`);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.fail(`Eksekusi gagal: ${err.message}`);
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

