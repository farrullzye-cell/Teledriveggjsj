import { NextRequest, NextResponse } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { getOrRenderThumbnailUrl } from '@/lib/thumbnail-manager';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/public/thumbnail/[id] - High-speed ImageKit thumbnail delivery & caching
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const thumbResult = await getOrRenderThumbnailUrl(file);

    // 1. PRIMARY: Redirect to direct ImageKit CDN URL
    if (thumbResult.url) {
      return NextResponse.redirect(thumbResult.url, {
        status: 307,
        headers: getCorsHeaders(),
      });
    }

    // 2. Stream image buffer with 7 days cache
    if (thumbResult.buffer) {
      const headers = new Headers(getCorsHeaders());
      headers.set('Content-Type', thumbResult.contentType || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
      return new NextResponse(thumbResult.buffer as any, {
        status: 200,
        headers,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Gagal merender thumbnail' },
      { status: 500, headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Public thumbnail route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal merender thumbnail: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
