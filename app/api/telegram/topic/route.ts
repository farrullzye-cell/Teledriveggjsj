import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap, saveConfig } from '@/lib/excel-db';
import { createForumTopic, uploadToTelegram } from '@/lib/telegram';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token || !config.telegram_chat_id) {
      return NextResponse.json(
        { ok: false, message: 'Telegram Bot Token dan Storage Chat ID belum diisi.' },
        { status: 400 }
      );
    }

    // 1. Create Forum Topic
    const topicRes = await createForumTopic(config.telegram_bot_token, config.telegram_chat_id, '☁️ DATABASE METADATA');

    let threadId = '';
    if (topicRes.ok && topicRes.message_thread_id) {
      threadId = String(topicRes.message_thread_id);
      await saveConfig({ telegram_topic_id: threadId });
    }

    // 2. Upload current database.json to Telegram Group
    const dbPath = path.join(process.cwd(), 'database.json');
    if (fs.existsSync(dbPath)) {
      const dbContent = fs.readFileSync(dbPath);
      await uploadToTelegram(
        config.telegram_bot_token,
        config.telegram_chat_id,
        dbContent,
        `database_backup_${Date.now()}.json`,
        'application/json'
      );
    }

    return NextResponse.json({
      ok: true,
      message: topicRes.ok
        ? `✅ Topik '☁️ DATABASE METADATA' berhasil dibuat di Group (Topic ID: ${threadId}) dan database.json disinkronkan!`
        : `⚠️ Database JSON disinkronkan ke Group Telegram! (${topicRes.error || 'Topic tidak didukung pada group biasa'})`,
      threadId,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
