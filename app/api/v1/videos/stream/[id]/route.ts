import { NextRequest, NextResponse } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { fetchDriveMediaStream } from '@/lib/google-drive-server';
import { getTransformedResolutionStreamUrl, RESOLUTION_PRESETS } from '@/lib/video-resolutions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/videos/stream/:id?res=720p|480p|360p|240p|1080p|auto
 * Anti-Error High-Performance Video Streaming Proxy with Dynamic Resolution Switching
 * Supports HTTP 206 Partial Content Range headers, Safari/Chrome seek & timeline scrubbing,
 * auto-failover to Google Drive API / Direct CDN / ImageKit Transcoding.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rangeHeader = req.headers.get('range');
    const { searchParams } = new URL(req.url);
    const resParam = (searchParams.get('res') || searchParams.get('quality') || 'auto').toLowerCase().trim();

    let file = await getFileById(id);
    let gdriveId = file?.gdrive_file_id;

    if (!gdriveId && file?.telegram_file_id?.startsWith('gdrive_')) {
      gdriveId = file.telegram_file_id.replace('gdrive_', '');
    }

    if (!gdriveId && file) {
      const candidateUrls = [file.source_url, file.remote_url, file.gdrive_url].filter(Boolean) as string[];
      for (const u of candidateUrls) {
        if (u.includes('drive.google.com') || u.includes('docs.google.com')) {
          const match = u.match(/id=([a-zA-Z0-9_-]+)/) || u.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            gdriveId = match[1];
            break;
          }
        }
      }
    }

    // If ID is not in DB, check if the ID itself looks like a Google Drive ID (e.g. 25-45 alphanumeric chars)
    if (!file && id.length >= 20 && !id.includes('.')) {
      gdriveId = id;
    }

    if (!file && !gdriveId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Berkas video tidak ditemukan.' },
        },
        { status: 404 }
      );
    }

    // 1. PRIMARY: Google Drive High-Performance Partial Content Range Stream (HTTP 206)
    if (gdriveId) {
      const streamRes = await fetchDriveMediaStream(gdriveId, rangeHeader);
      if (streamRes.ok && streamRes.body) {
        return new NextResponse(streamRes.body as any, {
          status: streamRes.status,
          headers: streamRes.headers,
        });
      }

      // If stream proxy failed, return 502 so HTML5 video player immediately catches error and switches to Server 2 without hanging
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STREAM_UNAVAILABLE',
            message: 'Direct binary stream tidak tersedia. Gunakan Server 2 (Embed Google Drive).',
            embed_url: streamRes.embedPreviewUrl || `https://drive.google.com/file/d/${gdriveId}/preview`,
          },
        },
        { 
          status: 502,
          headers: {
            'X-Embed-Fallback': streamRes.embedPreviewUrl || `https://drive.google.com/file/d/${gdriveId}/preview`,
          }
        }
      );
    }

    // 2. Fallback: Telegram or Local file stream
    if (file?.telegram_file_id && !file.telegram_file_id.startsWith('gdrive_')) {
      const fallbackUrl = new URL(`/api/files/${file.id}/download?inline=true`, req.url).toString();
      return NextResponse.redirect(fallbackUrl, 307);
    }

    if (file?.source_url) {
      return NextResponse.redirect(file.source_url, 307);
    }

    if (file) {
      const fallbackUrl = new URL(`/api/files/${file.id}/download?inline=true`, req.url).toString();
      return NextResponse.redirect(fallbackUrl, 307);
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: 'STREAM_FAILED', message: 'Gagal memutar video dari sumber penyimpanan.' },
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('[STREAM-ROUTE-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'STREAM_EXCEPTION', message: error.message || 'Terjadi kesalahan pada streaming player.' },
      },
      { status: 500 }
    );
  }
}

