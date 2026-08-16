import { NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { testTelegramBot, testStorageChat } from '@/lib/telegram';
import { startBackgroundPoller } from '@/lib/bot-poller';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getConfigMap();

    const isTokenSet = !!config.telegram_bot_token;
    const isChatIdSet = !!config.telegram_chat_id;

    if (isTokenSet) {
      startBackgroundPoller(2000);
    }


    let telegramConnected = false;
    let storageConnected = false;
    let botName = '';
    let botUsername = '';

    if (isTokenSet) {
      const botRes = await testTelegramBot(config.telegram_bot_token);
      telegramConnected = botRes.ok;
      if (botRes.botName) botName = botRes.botName;
      if (botRes.username) botUsername = botRes.username;
    }

    if (isTokenSet && isChatIdSet && telegramConnected) {
      // Don't send test message automatically on every status check, assume connected if format valid or check bot
      storageConnected = true;
    }

    return NextResponse.json({
      database: true, // Excel DB / Firestore initialized
      telegram: telegramConnected,
      storage: storageConnected,
      imagekit: !!(config.imagekit_public_key && config.imagekit_private_key && config.imagekit_url_endpoint),
      imagekit_enabled: config.imagekit_enabled !== false,
      imagekit_public_key: config.imagekit_public_key || '',
      imagekit_url_endpoint: config.imagekit_url_endpoint || '',
      imagekit_default_folder: config.imagekit_default_folder || '/rullzye_cloud',
      is_imagekit_key_set: !!(config.imagekit_public_key && config.imagekit_private_key && config.imagekit_url_endpoint),
      website_name: config.website_name || 'RULLZYE CLOUD',
      telegram_chat_id: config.telegram_chat_id || '',
      is_token_set: isTokenSet,
      bot_name: botName,
      bot_username: botUsername,
      ad_monetization_enabled: config.ad_monetization_enabled,
      ad_popunder_rate: config.ad_popunder_rate,
      ad_popunder_url: config.ad_popunder_url,
      ad_banner_top_html: config.ad_banner_top_html,
      ad_player_overlay_html: config.ad_player_overlay_html,
      ad_native_html: config.ad_native_html,
    });
  } catch (err: any) {
    console.error('Config status error:', err);
    return NextResponse.json({
      database: false,
      telegram: false,
      storage: false,
      website_name: 'RULLZYE CLOUD',
      telegram_chat_id: '',
      is_token_set: false,
    });
  }
}
