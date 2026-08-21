import { NextRequest, NextResponse } from 'next/server';
import { getFileById, updateFileRecord } from '@/lib/excel-db';
import { getTransformedResolutionStreamUrl, RESOLUTION_PRESETS, VideoResolutionKey } from '@/lib/video-resolutions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/videos/resolution
 * Change or query video resolution URL dynamically.
 * Body: { videoId: string, resolution: "1080p" | "720p" | "480p" | "360p" | "240p" | "auto" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const videoId = body.videoId || body.id;
    const resolution = (body.resolution || body.quality || body.targetResolution || 'auto').toLowerCase().trim() as VideoResolutionKey;

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
    const preset = RESOLUTION_PRESETS[resolution];
    const streamUrl = getTransformedResolutionStreamUrl(file, resolution, origin);
    const proxyStreamUrl = `${origin}/api/v1/videos/stream/${file.id}?res=${resolution}`;

    return NextResponse.json({
      success: true,
      data: {
        videoId: file.id,
        videoName: file.name,
        resolution: resolution,
        preset: preset || null,
        streamUrl,
        proxyStreamUrl,
        isCdnTranscoded: Boolean(file.imagekit_url && file.imagekit_url.includes('imagekit.io')),
      },
      message: `Berhasil mendapatkan stream URL untuk resolusi ${preset?.label || resolution}.`,
    });
  } catch (error: any) {
    console.error('[RESOLUTION-POST-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'RESOLUTION_ERROR', message: error.message || 'Terjadi kesalahan sistem.' },
      },
      { status: 500 }
    );
  }
}
