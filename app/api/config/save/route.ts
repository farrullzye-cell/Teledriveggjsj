import { NextRequest, NextResponse } from 'next/server';
import { saveConfig, verifyPin } from '@/lib/excel-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { website_name, telegram_bot_token, telegram_chat_id, new_pin, current_pin } = body;

    // Verify session or current_pin
    const sessionCookie = req.cookies.get('rullzye_session')?.value;
    if (sessionCookie !== 'authenticated_admin') {
      if (!current_pin) {
        return NextResponse.json(
          { success: false, message: 'Wajib memasukkan Admin PIN untuk menyimpan perubahan' },
          { status: 401 }
        );
      }
      const pinCheck = await verifyPin(current_pin);
      if (!pinCheck.success) {
        return NextResponse.json(pinCheck, { status: 401 });
      }
    }

    const updatedConfig = await saveConfig({
      website_name,
      telegram_bot_token,
      telegram_chat_id,
      new_pin,
    });

    // Delete active webhook & start background polling (2s interval)
    if (updatedConfig.telegram_bot_token) {
      try {
        const { deleteTelegramWebhook } = await import('@/lib/telegram');
        const { startBackgroundPoller, pollUpdatesOnce } = await import('@/lib/bot-poller');
        await deleteTelegramWebhook(updatedConfig.telegram_bot_token);
        startBackgroundPoller(2000);
        pollUpdatesOnce().catch(() => {});
      } catch (err) {
        console.error('Auto poller start error:', err);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Konfigurasi berhasil disimpan',
      config: {
        website_name: updatedConfig.website_name,
        telegram_chat_id: updatedConfig.telegram_chat_id,
        is_token_set: !!updatedConfig.telegram_bot_token,
      },
    });

    // Ensure session cookie is active
    response.cookies.set('rullzye_session', 'authenticated_admin', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    console.error('Save config error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan konfigurasi: ' + err.message },
      { status: 500 }
    );
  }
}
