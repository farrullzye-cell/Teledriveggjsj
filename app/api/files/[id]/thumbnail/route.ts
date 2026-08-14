import { NextRequest, NextResponse } from 'next/server';
import { getFileById, getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

function generateSvgThumbnail(title: string, type: string, sizeFormatted: string): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#080c16"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="640" height="360" fill="url(#bg)"/>
  
  <!-- Grid lines pattern -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="90" x2="640" y2="90" />
    <line x1="0" y1="180" x2="640" y2="180" />
    <line x1="0" y1="270" x2="640" y2="270" />
    <line x1="160" y1="0" x2="160" y2="360" />
    <line x1="320" y1="0" x2="320" y2="360" />
    <line x1="480" y1="0" x2="480" y2="360" />
  </g>
  
  <!-- Center Play Button / Media Icon -->
  <g transform="translate(320, 160)">
    <circle r="42" fill="url(#accent)" filter="url(#glow)"/>
    <polygon points="-8,-16 18,0 -8,16" fill="#ffffff"/>
  </g>
  
  <!-- Top Badges -->
  <g transform="translate(24, 28)">
    <rect width="90" height="24" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="45" y="16" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1">HD MEDIA</text>
  </g>
  
  <g transform="translate(520, 28)">
    <rect width="96" height="24" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="48" y="16" fill="#94a3b8" font-family="system-ui, -apple-system, monospace" font-size="11" font-weight="bold" text-anchor="middle">${sizeFormatted}</text>
  </g>
  
  <!-- Bottom Info Container -->
  <rect x="0" y="270" width="640" height="90" fill="#000000" opacity="0.6"/>
  
  <!-- Title -->
  <text x="32" y="310" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold">${safeTitle.length > 55 ? safeTitle.slice(0, 52) + '...' : safeTitle}</text>
  <text x="32" y="335" fill="#f43f5e" font-family="system-ui, -apple-system, monospace" font-size="11" font-weight="bold" letter-spacing="1">RULLZYE CLOUD • HIGH DEFINITION STREAM</text>
</svg>`;
}

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

    const config = await getConfigMap();
    const token = config.telegram_bot_token;

    // 1. If thumbnail_file_id exists, fetch and stream it
    if (file.thumbnail_file_id && token) {
      const tgThumbRes = await getTelegramFileStream(token, file.thumbnail_file_id);
      if (tgThumbRes.ok && tgThumbRes.response && tgThumbRes.response.body) {
        const headers = new Headers(getCorsHeaders());
        headers.set('Content-Type', 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        return new NextResponse(tgThumbRes.response.body as any, {
          status: 200,
          headers,
        });
      }
    }

    // 2. If it's an image file, the file itself is the thumbnail
    if (file.type === 'image' && token && file.telegram_file_id) {
      const tgRes = await getTelegramFileStream(token, file.telegram_file_id);
      if (tgRes.ok && tgRes.response && tgRes.response.body) {
        const headers = new Headers(getCorsHeaders());
        headers.set('Content-Type', file.mime || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        return new NextResponse(tgRes.response.body as any, {
          status: 200,
          headers,
        });
      }
    }

    // 3. If base64 thumbnail is cached
    if (file.thumbnail_base64 && file.thumbnail_base64.startsWith('data:image/')) {
      const base64Data = file.thumbnail_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const headers = new Headers(getCorsHeaders());
      headers.set('Content-Type', 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      return new NextResponse(buffer, {
        status: 200,
        headers,
      });
    }

    // 4. Fallback: High-resolution SVG Poster Frame
    const sizeFormatted = file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
    const svg = generateSvgThumbnail(file.name, file.type, sizeFormatted);

    const headers = new Headers(getCorsHeaders());
    headers.set('Content-Type', 'image/svg+xml');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new NextResponse(svg, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error('Thumbnail route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal merender thumbnail: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
