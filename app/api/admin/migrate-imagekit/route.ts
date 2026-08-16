import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, updateFileRecord, addLog } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { uploadToImageKit, getImageKitCredentials } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';
import { matchSelectedRemoteSource } from '@/lib/remote-source';

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
    const selectedFiles = Array.isArray(body.files) ? body.files : [];
    const customName = typeof body.custom_name === 'string' ? body.custom_name.trim() : '';
    const customFolder = typeof body.folder === 'string' ? body.folder.trim() : '';

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
      if (targetFileId) {
        return f.id === targetFileId && Boolean(f.telegram_file_id || f.source_url || f.terabox_url || f.remote_url);
      }

      const hasRemoteSource = Boolean(f.telegram_file_id || f.source_url || f.terabox_url || f.remote_url);
      return hasRemoteSource && (!f.imagekit_url || !f.imagekit_file_id || f.storage_provider === 'telegram');
    });

    const explicitSelection = selectedFiles.length > 0
      ? allFiles.filter((f) => matchSelectedRemoteSource(f, selectedFiles))
      : [];

    const finalLegacyFiles = explicitSelection.length > 0 ? explicitSelection : legacyFiles;
    const candidates = finalLegacyFiles.slice(0, limit);

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
        const uploadName = customName || file.name;
        const targetFolder = customFolder || `${creds.defaultFolder}/${(file.vault_name || 'General').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        let buffer: Buffer;
        if (file.telegram_file_id) {
          const tgStreamRes = await getTelegramFileStream(config.telegram_bot_token, file.telegram_file_id);
          if (!tgStreamRes.ok || !tgStreamRes.response) {
            errors.push({ id: file.id, name: file.name, error: tgStreamRes.error || 'Failed downloading from Telegram' });
            continue;
          }
          const arrayBuffer = await tgStreamRes.response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else {
          errors.push({ id: file.id, name: file.name, error: 'Telegram file ID tidak ditemukan pada record' });
          continue;
        }

        const ikRes = await uploadToImageKit({
          file: buffer,
          fileName: uploadName,
          folder: targetFolder,
          tags: ['migrated', file.type, file.vault_name || 'general'],
          useUniqueFileName: true,
        });

        if (!ikRes.ok || !ikRes.url) {
          errors.push({ id: file.id, name: file.name, error: ikRes.error || 'ImageKit upload failed' });
          continue;
        }

        const updated = await updateFileRecord(file.id, {
          name: uploadName,
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
