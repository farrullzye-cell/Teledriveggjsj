import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, updateFileRecord, addLog } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { uploadToImageKit, getImageKitCredentials } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const isDryRun = body.dryRun === true || body.dry_run === true;
    const limit = parseInt(body.limit || '10', 10);
    const targetFileId = body.fileId || body.file_id;

    const creds = await getImageKitCredentials();
    if (!creds.publicKey || !creds.privateKey || !creds.urlEndpoint) {
      return NextResponse.json(
        { success: false, message: 'ImageKit belum dikonfigurasi secara lengkap.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const config = await getConfigMap();
    if (!config.telegram_bot_token) {
      return NextResponse.json(
        { success: false, message: 'Bot Token Telegram belum dikonfigurasi.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const allFiles = await getFiles('', 'ALL', 'ALL');
    const legacyFiles = allFiles.filter((f) => {
      if (targetFileId) return f.id === targetFileId;
      return (!f.imagekit_url || !f.imagekit_file_id) && Boolean(f.telegram_file_id);
    });

    const candidates = legacyFiles.slice(0, limit);

    if (isDryRun) {
      return NextResponse.json(
        {
          success: true,
          dry_run: true,
          total_legacy_files: legacyFiles.length,
          batch_size: candidates.length,
          candidates: candidates.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            telegram_file_id: f.telegram_file_id,
          })),
        },
        { headers: getCorsHeaders() }
      );
    }

    const migrated = [];
    const errors = [];

    for (const file of candidates) {
      try {
        const tgStreamRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);
        if (!tgStreamRes.ok || !tgStreamRes.response) {
          errors.push({ id: file.id, name: file.name, error: tgStreamRes.error || 'Failed downloading from Telegram' });
          continue;
        }

        const arrayBuffer = await tgStreamRes.response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const ikRes = await uploadToImageKit({
          file: buffer,
          fileName: file.name,
          folder: `${creds.defaultFolder}/${(file.vault_name || 'General').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          tags: ['migrated', file.type, file.vault_name || 'general'],
          useUniqueFileName: true,
        });

        if (!ikRes.ok || !ikRes.url) {
          errors.push({ id: file.id, name: file.name, error: ikRes.error || 'ImageKit upload failed' });
          continue;
        }

        const updated = await updateFileRecord(file.id, {
          imagekit_file_id: ikRes.fileId,
          imagekit_url: ikRes.url,
          imagekit_thumbnail_url: ikRes.thumbnailUrl || ikRes.url,
          imagekit_path: ikRes.filePath,
          storage_provider: 'both',
        });

        await addLog('MIGRATE_IMAGEKIT', file.name, 'SUCCESS');
        migrated.push({
          id: file.id,
          name: file.name,
          imagekit_url: ikRes.url,
          imagekit_file_id: ikRes.fileId,
        });
      } catch (err: any) {
        errors.push({ id: file.id, name: file.name, error: err.message });
      }
    }

    return NextResponse.json(
      {
        success: true,
        migrated_count: migrated.length,
        remaining_count: Math.max(0, legacyFiles.length - migrated.length),
        migrated,
        errors: errors.length > 0 ? errors : undefined,
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menjalankan migrasi: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
