import { NextRequest, NextResponse } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { generateVideoResolutionProfiles } from '@/lib/video-resolutions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/videos/resolutions/:id
 * Retrieve available video resolution options (1080p, 720p, 480p, 360p, 240p, auto)
 * with direct CDN streaming URLs and proxy streaming URLs.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = await getFileById(id);

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
    const profiles = generateVideoResolutionProfiles(file, origin);

    return NextResponse.json({
      success: true,
      data: profiles,
      message: 'Berhasil memuat daftar resolusi video.',
    });
  } catch (error: any) {
    console.error('[RESOLUTIONS-ROUTE-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'RESOLUTION_LOOKUP_ERROR', message: error.message || 'Gagal memuat resolusi video.' },
      },
      { status: 500 }
    );
  }
}
