import { NextRequest, NextResponse } from 'next/server';
import { getFileById, updateFileRecord, getFiles } from '@/lib/excel-db';
import {
  makeDriveFilePublic,
  batchMakeDriveFilesPublic,
  makeAllDriveFilesPublic,
  getValidDriveToken,
  fetchDriveFiles,
} from '@/lib/google-drive-server';
import { getOrRenderThumbnailUrl } from '@/lib/thumbnail-manager';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * POST /api/v1/drive/publicize
 * Make Google Drive video(s) publicly viewable (anyone with link can view)
 * and generate/synchronize CDN-cached high-definition thumbnails.
 *
 * Body Options:
 * 1. Single File: { "id": "file_123" } or { "fileId": "1g9xAbc..." }
 * 2. Batch: { "batch": ["1g9xAbc...", "1jK2lMn..."] }
 * 3. All Files: { "all": true }
 * 4. Folder: { "folderId": "1FolderId..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const origin = req.nextUrl.origin || '';
    const { id, fileId, videoId, gdriveId, batch, all, folderId } = body;

    const authToken = await getValidDriveToken();
    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GDRIVE_SESSION_NOT_CONNECTED',
            message: 'Sesi Google Drive belum terhubung atau token kadaluarsa. Silakan hubungkan Google Drive di panel admin.',
          },
        },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    // 1. ALL FILES IN DATABASE
    if (all === true) {
      const allRes = await makeAllDriveFilesPublic(authToken);
      return NextResponse.json(
        {
          success: true,
          data: allRes,
          message: allRes.message,
        },
        { headers: getCorsHeaders() }
      );
    }

    // 2. FOLDER BATCH
    if (folderId) {
      const driveList = await fetchDriveFiles(authToken, { folderId, pageSize: 100 });
      const nonFolders = driveList.files.filter((f) => !f.isFolder);
      const fileIds = nonFolders.map((f) => f.id);

      const batchRes = await batchMakeDriveFilesPublic(fileIds, authToken);
      return NextResponse.json(
        {
          success: true,
          data: {
            folderId,
            ...batchRes,
          },
          message: `Berhasil mempublikasikan ${batchRes.successCount} berkas di dalam folder Google Drive.`,
        },
        { headers: getCorsHeaders() }
      );
    }

    // 3. ARRAY BATCH OF IDS
    if (Array.isArray(batch) && batch.length > 0) {
      const batchRes = await batchMakeDriveFilesPublic(batch, authToken);
      return NextResponse.json(
        {
          success: true,
          data: batchRes,
          message: `Berhasil mempublikasikan ${batchRes.successCount} dari ${batch.length} video.`,
        },
        { headers: getCorsHeaders() }
      );
    }

    // 4. SINGLE FILE LOOKUP & PUBLICIZE
    const targetLookup = id || fileId || videoId || gdriveId;
    if (!targetLookup) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TARGET_ID',
            message: 'Parameter id, fileId, videoId, batch, atau all:true wajib disertakan.',
          },
        },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    let file = await getFileById(targetLookup);
    let rawGdriveId = targetLookup;

    if (file) {
      rawGdriveId = file.gdrive_file_id || (file.telegram_file_id?.startsWith('gdrive_') ? file.telegram_file_id.replace('gdrive_', '') : targetLookup);
    } else {
      // Find by gdrive_file_id in database
      const allFiles = await getFiles();
      const matched = allFiles.find(
        (f) => f.gdrive_file_id === targetLookup || f.telegram_file_id === `gdrive_${targetLookup}`
      );
      if (matched) {
        file = matched;
        rawGdriveId = matched.gdrive_file_id || targetLookup;
      }
    }

    // Make file public in Google Drive API
    const isPublic = await makeDriveFilePublic(authToken, rawGdriveId);
    if (!isPublic) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GDRIVE_PERMISSION_ERROR',
            message: 'Gagal mengatur izin Google Drive menjadi Publik. Pastikan akun memiliki hak akses edit.',
          },
        },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${rawGdriveId}`;
    const webViewUrl = `https://drive.google.com/file/d/${rawGdriveId}/view`;
    const defaultThumbnail = `https://lh3.googleusercontent.com/d/${rawGdriveId}=w800`;

    // If file exists in DB, update record & render thumbnail
    let finalThumbnailUrl = defaultThumbnail;
    if (file) {
      const thumbRes = await getOrRenderThumbnailUrl(file);
      finalThumbnailUrl = thumbRes.url || `${origin}/api/v1/drive/thumbnail/${file.id}`;

      await updateFileRecord(file.id, {
        gdrive_url: directStreamingUrl,
        source_url: directStreamingUrl,
        gdrive_web_link: webViewUrl,
        gdrive_thumbnail_url: defaultThumbnail,
        imagekit_thumbnail_url: thumbRes.url || file.imagekit_thumbnail_url,
        is_public: true,
      });
    }

    const payloadFileId = file ? file.id : rawGdriveId;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: payloadFileId,
          gdrive_file_id: rawGdriveId,
          name: file?.name || 'Google Drive Video',
          is_public: true,
          permission: 'anyoneWithLink (reader)',
          watch_url: `${origin}/watch/${payloadFileId}`,
          embed_url: `${origin}/embed/${payloadFileId}`,
          stream_url: `${origin}/api/v1/videos/stream/${payloadFileId}`,
          direct_stream_url: directStreamingUrl,
          gdrive_web_link: webViewUrl,
          thumbnail_url: finalThumbnailUrl,
          thumbnail_proxy_url: `${origin}/api/v1/drive/thumbnail/${payloadFileId}`,
        },
        message: 'Video Google Drive berhasil dijadikan Publik dan siap ditonton oleh semua orang!',
      },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error('[GDRIVE-PUBLICIZE-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PUBLICIZE_INTERNAL_ERROR',
          message: error.message || 'Terjadi kesalahan saat memproses izin publik.',
        },
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
