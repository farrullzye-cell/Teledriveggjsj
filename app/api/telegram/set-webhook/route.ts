import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { setTelegramWebhook, getTelegramWebhookInfo } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json({ ok: false, message: 'Bot token belum diatur' }, { status: 400 });
    }

    const info = await getTelegramWebhookInfo(config.telegram_bot_token);
    return NextResponse.json({ ok: true, info });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json(
        { ok: false, message: 'Bot Telegram belum dikonfigurasi di menu Setup.' },
        { status: 400 }
      );
    }

    let customUrl = '';
    try {
      const body = await req.json();
      customUrl = body.url || '';
    } catch {}

    let webhookUrl = customUrl;

    if (!webhookUrl) {
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      
      if (!host) {
        return NextResponse.json(
          { ok: false, message: 'Tidak dapat mendeteksi Host URL domain. Harap masukkan Webhook URL manual.' },
          { status: 400 }
        );
      }

      webhookUrl = `${proto}://${host}/api/telegram/webhook`;
    }

    const result = await setTelegramWebhook(config.telegram_bot_token, webhookUrl);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        message: 'Webhook Telegram Bot berhasil didaftarkan!',
        webhookUrl,
        description: result.description,
      });
    } else {
      return NextResponse.json(
        { ok: false, message: 'Gagal memasang webhook Telegram: ' + (result.description || '') },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: 'Error: ' + err.message }, { status: 500 });
  }
}
