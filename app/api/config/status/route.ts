import { NextResponse } from 'next/server';
import { getConfigMap } from '@/lib/excel-db';
import { testTelegramBot, testStorageChat } from '@/lib/telegram';

export async function GET() {
  try {
    const config = await getConfigMap();

    const isTokenSet = !!config.telegram_bot_token;
    const isChatIdSet = !!config.telegram_chat_id;

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
      database: true, // Excel DB initialized
      telegram: telegramConnected,
      storage: storageConnected,
      website_name: config.website_name || 'RULLZYE CLOUD',
      telegram_chat_id: config.telegram_chat_id || '',
      is_token_set: isTokenSet,
      bot_name: botName,
      bot_username: botUsername,
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
