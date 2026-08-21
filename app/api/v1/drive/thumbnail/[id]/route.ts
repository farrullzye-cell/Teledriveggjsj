import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getFiles } from '@/lib/excel-db';
import { getOrRenderThumbnailUrl } from '@/lib/thumbnail-manager';
import { getValidDriveToken } from '@/lib/google-drive-server';
import { uploadThumbnailToImageKit, getImageKitCredentials } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/v1/drive/thumbnail/:id
 * High-definition Google Drive thumbnail rendering engine with ImageKit CDN caching,
 * auto-bypass CORS/referrer blocking, and SVG fallback.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const sizeParam = searchParams.get('sz') || searchParams.get('size') || 'w800';

    let file = await getFileById(id);
    let gdriveId = id;

    if (file) {
      gdriveId = file.gdrive_file_id || (file.telegram_file_id?.startsWith('gdrive_') ? file.telegram_file_id.replace('gdrive_', '') : id);
    } else {
      const allFiles = await getFiles();
      const matched = allFiles.find(
        (f) => f.gdrive_file_id === id || f.telegram_file_id === `gdrive_${id}` || f.id === id
      );
      if (matched) {
        file = matched;
        gdriveId = matched.gdrive_file_id || id;
      }
    }

    // 1. If we have a file record, execute smart thumbnail engine (which also auto-caches to ImageKit)
    if (file) {
      const thumbResult = await getOrRenderThumbnailUrl(file);

      if (thumbResult.url) {
        return NextResponse.redirect(thumbResult.url, {
          status: 307,
          headers: getCorsHeaders(),
        });
      }

      if (thumbResult.buffer) {
        const headers = new Headers(getCorsHeaders());
        headers.set('Content-Type', thumbResult.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
        headers.set('Access-Control-Allow-Origin', '*');
        return new NextResponse(thumbResult.buffer as any, {
          status: 200,
          headers,
        });
      }
    }

    // 2. If it's a raw Google Drive ID or file without record, fetch from Google Drive directly
    const candidateUrls = [
      `https://lh3.googleusercontent.com/d/${gdriveId}=${sizeParam}`,
      `https://drive.google.com/thumbnail?id=${gdriveId}&sz=${sizeParam}`,
    ];

    const token = await getValidDriveToken();
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    for (const cUrl of candidateUrls) {
      try {
        const res = await fetch(cUrl, { headers });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const buffer = Buffer.from(await res.arrayBuffer());

          if (buffer.byteLength > 500) {
            // Upload to ImageKit in background if credentials available
            const creds = await getImageKitCredentials();
            if (creds.privateKey && creds.publicKey) {
              uploadThumbnailToImageKit({
                file: buffer,
                fileName: `gdrive_thumb_${gdriveId}`,
                tags: ['gdrive_thumbnail', 'gdrive'],
              }).catch(() => {});
            }

            const responseHeaders = new Headers(getCorsHeaders());
            responseHeaders.set('Content-Type', contentType);
            responseHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
            responseHeaders.set('Access-Control-Allow-Origin', '*');

            return new NextResponse(buffer as any, {
              status: 200,
              headers: responseHeaders,
            });
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to default high-definition SVG thumbnail
    const { generateSvgThumbnail } = await import('@/lib/thumbnail-manager');
    const svg = generateSvgThumbnail(file?.name || 'Google Drive Video', 'video', 'HD');
    const resHeaders = new Headers(getCorsHeaders());
    resHeaders.set('Content-Type', 'image/svg+xml');
    resHeaders.set('Cache-Control', 'public, max-age=86400');
    return new NextResponse(Buffer.from(svg, 'utf-8') as any, {
      status: 200,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('[DRIVE-THUMBNAIL-ROUTE-ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'THUMBNAIL_RENDER_ERROR', message: err.message || 'Gagal merender thumbnail Google Drive.' },
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
