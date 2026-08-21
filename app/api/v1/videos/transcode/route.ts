import { NextRequest, NextResponse } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { getTransformedResolutionStreamUrl, RESOLUTION_PRESETS, VideoResolutionKey } from '@/lib/video-resolutions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/videos/transcode
 * Request on-the-fly resolution transcode stream or get optimized bitrate stream URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const videoId = body.videoId || body.id;
    const targetResolution = (body.targetResolution || body.resolution || '720p').toLowerCase().trim() as VideoResolutionKey;

    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARAMETERS', message: 'Parameter videoId wajib diisi.' },
        },
        { status: 400 }
      );
    }

    const file = await getFileById(videoId);
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Berkas video tidak ditemukan.' },
        },
        { status: 404 }
      );
    }

    const origin = req.nextUrl.origin || '';
    const preset = RESOLUTION_PRESETS[targetResolution];
    const streamUrl = getTransformedResolutionStreamUrl(file, targetResolution, origin);

    return NextResponse.json({
      success: true,
      data: {
        videoId: file.id,
        targetResolution,
        streamUrl,
        proxyStreamUrl: `${origin}/api/v1/videos/stream/${file.id}?res=${targetResolution}`,
        preset: preset || null,
        status: 'READY',
      },
      message: `Stream resolusi ${targetResolution} siap diputar.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'TRANSCODE_ERROR', message: error.message || 'Gagal memproses resolusi.' },
      },
      { status: 500 }
    );
  }
}
