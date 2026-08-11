import { NextRequest, NextResponse } from 'next/server';
import { getConfigMap, restoreDatabaseFromJson, getFiles } from '@/lib/excel-db';
import { processTelegramUpdate } from '@/lib/bot-processor';
import { getTelegramFileStream } from '@/lib/telegram';

export async function GET() {
  try {
    const config = await getConfigMap();
    const files = await getFiles();
    return NextResponse.json({
      ok: true,
      currentFilesCount: files.length,
      hasToken: !!config.telegram_bot_token,
      chatId: config.telegram_chat_id || 'Not set',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json(
        { ok: false, message: 'Bot token belum diatur. Silakan atur di menu Setup.' },
        { status: 400 }
      );
    }

    const token = config.telegram_bot_token;
    let restoredJsonBackupCount = 0;

    // 1. Fetch updates from Telegram to find database backup files or media
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=0&limit=100`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (data.ok && Array.isArray(data.result)) {
      const updates = data.result;

      for (const update of updates) {
        const msg = update.message || update.channel_post;
        if (!msg) continue;

        // Check if message has a JSON database backup file
        if (msg.document && msg.document.file_name && msg.document.file_name.includes('database')) {
          try {
            const streamRes = await getTelegramFileStream(token, msg.document.file_id);
            if (streamRes.ok && streamRes.response) {
              const text = await streamRes.response.text();
              const parsed = JSON.parse(text);
              if (parsed && Array.isArray(parsed.files)) {
                const result = await restoreDatabaseFromJson(parsed);
                restoredJsonBackupCount += result.restoredFilesCount;
              }
            }
          } catch (err) {
            console.error('Error restoring database backup document from Telegram:', err);
          }
        }

        // Process any media file message into database
        await processTelegramUpdate(update);
      }
    }

    const currentFiles = await getFiles();

    return NextResponse.json({
      ok: true,
      message: `✅ Pemulihan Data Selesai! Total File Aktif: ${currentFiles.length} file.`,
      totalFiles: currentFiles.length,
      restoredJsonBackupCount,
    });
  } catch (err: any) {
    console.error('Restore error:', err);
    return NextResponse.json({ ok: false, message: err.message || 'Gagal memulihkan data' }, { status: 500 });
  }
}
