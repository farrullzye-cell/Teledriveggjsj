import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, updateFileRecord } from '@/lib/excel-db';
import { listImageKitFiles, getImageKitCredentials } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const creds = await getImageKitCredentials();

    const dbFiles = await getFiles('', 'ALL', 'ALL');
    let ikFiles: any[] = [];
    let ikAvailable = false;

    if (creds.publicKey && creds.privateKey && creds.urlEndpoint) {
      const listRes = await listImageKitFiles(creds.defaultFolder, 100);
      if (listRes.ok && Array.isArray(listRes.files)) {
        ikFiles = listRes.files;
        ikAvailable = true;
      }
    }

    const ikFileIdSet = new Set(ikFiles.map((f) => f.fileId));

    let healthyCount = 0;
    let missingStorageCount = 0;
    let telegramOnlyCount = 0;
    let bothCount = 0;

    const fileStatuses = dbFiles.map((file) => {
      let status: 'healthy' | 'missing' | 'telegram_only' | 'imagekit_only' | 'both' = 'healthy';
      const hasIK = Boolean(file.imagekit_file_id || file.imagekit_url);
      const hasTG = Boolean(file.telegram_file_id);

      if (hasIK && hasTG) {
        status = 'both';
        bothCount++;
        healthyCount++;
      } else if (hasIK) {
        if (ikAvailable && file.imagekit_file_id && !ikFileIdSet.has(file.imagekit_file_id)) {
          // File might be outside default folder or older page
          status = 'healthy';
        } else {
          status = 'healthy';
        }
        healthyCount++;
      } else if (hasTG) {
        status = 'telegram_only';
        telegramOnlyCount++;
      } else {
        status = 'missing';
        missingStorageCount++;
      }

      return {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        storage_provider: file.storage_provider || (hasIK ? 'imagekit' : 'telegram'),
        has_imagekit: hasIK,
        has_telegram: hasTG,
        imagekit_file_id: file.imagekit_file_id || null,
        imagekit_url: file.imagekit_url || null,
        telegram_file_id: file.telegram_file_id ? '✓ set' : null,
        status,
      };
    });

    // Detect orphan ImageKit files (files on ImageKit not linked in database)
    const dbIKFileIds = new Set(dbFiles.map((f) => f.imagekit_file_id).filter(Boolean));
    const orphans = ikFiles
      .filter((ikF) => !dbIKFileIds.has(ikF.fileId))
      .map((ikF) => ({
        fileId: ikF.fileId,
        name: ikF.name,
        url: ikF.url,
        size: ikF.size,
        filePath: ikF.filePath,
      }));

    return NextResponse.json(
      {
        success: true,
        summary: {
          total_db_files: dbFiles.length,
          healthy_count: healthyCount,
          telegram_only_count: telegramOnlyCount,
          both_storage_count: bothCount,
          missing_count: missingStorageCount,
          imagekit_connected: ikAvailable,
          imagekit_listed_files: ikFiles.length,
          orphan_imagekit_files: orphans.length,
        },
        orphans,
        files: fileStatuses,
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Storage integrity check error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menjalankan pemeriksaan integritas: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
