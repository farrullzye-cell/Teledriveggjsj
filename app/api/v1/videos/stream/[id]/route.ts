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

    // 1. If ImageKit URL exists and a specific resolution is requested (e.g. 720p, 480p, 360p)
    if (file?.imagekit_url) {
      if (resParam !== 'auto' && resParam !== 'original' && RESOLUTION_PRESETS[resParam]) {
        const transformedUrl = getTransformedResolutionStreamUrl(file, resParam, '');
        return NextResponse.redirect(transformedUrl, 307);
      }
      // If auto/original
      return NextResponse.redirect(file.imagekit_url, 307);
    }

    // 2. If Google Drive file exists, attempt high-speed Range Stream
    if (gdriveId) {
      const streamRes = await fetchDriveMediaStream(gdriveId, rangeHeader);
      if (streamRes.ok && streamRes.body) {
        return new NextResponse(streamRes.body as any, {
          status: streamRes.status,
          headers: streamRes.headers,
        });
      }

      // If streaming proxy failed, fallback to direct download URL
      if (streamRes.directFallbackUrl) {
        return NextResponse.redirect(streamRes.directFallbackUrl, 307);
      }
    }

    // 3. If source_url or telegram exists
    if (file?.source_url) {
      return NextResponse.redirect(file.source_url, 307);
    }

    if (file) {
      const fallbackUrl = new URL(`/api/files/${file.id}/download`, req.url).toString();
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

