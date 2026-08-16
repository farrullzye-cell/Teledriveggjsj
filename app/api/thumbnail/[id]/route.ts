import { NextRequest, NextResponse } from 'next/server';
import { getFileById, updateFileRecord } from '@/lib/excel-db';
import { getOrRenderThumbnailUrl } from '@/lib/thumbnail-manager';
import { uploadThumbnailToImageKit } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/thumbnail/[id] - Render or redirect to ImageKit CDN thumbnail
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

    // If direct ImageKit CDN URL is available, redirect with 307 temporary redirect
    if (thumbResult.url) {
      return NextResponse.redirect(thumbResult.url, {
        status: 307,
        headers: getCorsHeaders(),
      });
    }

    // Otherwise serve binary buffer with robust caching headers
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
      { success: false, message: 'Gagal memuat thumbnail' },
      { status: 500, headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Thumbnail route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal merender thumbnail: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * POST /api/thumbnail/[id] - Upload / replace custom thumbnail to ImageKit.io for a file
 */
export async function POST(
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

    const contentType = req.headers.get('content-type') || '';
    let thumbSource: Buffer | string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const thumbFile = (formData.get('thumbnail') as File) || (formData.get('file') as File);
      const base64Input = (formData.get('thumbnail_base64') as string) || (formData.get('base64') as string);

      if (thumbFile && typeof thumbFile.arrayBuffer === 'function') {
        const arrayBuf = await thumbFile.arrayBuffer();
        thumbSource = Buffer.from(arrayBuf);
      } else if (base64Input) {
        thumbSource = base64Input;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      thumbSource = body.thumbnail_base64 || body.base64 || body.url || null;
    }

    if (!thumbSource) {
      return NextResponse.json(
        { success: false, message: 'Thumbnail tidak disertakan (file atau base64 diperlukan)' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Upload to ImageKit.io
    const ikRes = await uploadThumbnailToImageKit({
      file: thumbSource,
      fileName: `thumb_${file.id}`,
      tags: ['custom_thumbnail', file.type, file.vault_name || 'vault'],
    });

    if (!ikRes.ok || !ikRes.url) {
      return NextResponse.json(
        { success: false, message: 'Gagal mengunggah thumbnail ke ImageKit: ' + (ikRes.error || 'Unknown error') },
        { status: 500, headers: getCorsHeaders() }
      );
    }

    const finalThumbUrl = ikRes.thumbnailUrl || ikRes.url;

    // Update database record
    await updateFileRecord(file.id, {
      imagekit_thumbnail_url: finalThumbUrl,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Thumbnail berhasil diunggah dan disimpan ke ImageKit.io',
        thumbnail_url: finalThumbUrl,
        file_id: ikRes.fileId,
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Upload thumbnail error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat upload thumbnail: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
