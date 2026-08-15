import { NextRequest } from 'next/server';
import { getFiles } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'ALL';
    const vaultId = searchParams.get('vault_id') || searchParams.get('vaultId') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const rawFiles = await getFiles(search, type, vaultId);

    // Get origin or fallback to host header
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const formattedFiles = rawFiles.slice(offset, offset + limit).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      mime: f.mime,
      size: f.size,
      size_formatted: (f.size / 1024 > 1024
        ? (f.size / (1024 * 1024)).toFixed(2) + ' MB'
        : (f.size / 1024).toFixed(1) + ' KB'),
      vault_id: f.vault_id || 'vault_general',
      vault_name: f.vault_name || 'General',
      storage_provider: f.storage_provider || (f.imagekit_url ? 'imagekit' : 'telegram'),
      uploaded_at: f.uploaded_at,
      cdn_url: f.imagekit_url || undefined,
      download_url: `${baseUrl}/api/v1/public/download/${f.id}`,
      preview_url: f.imagekit_url || `${baseUrl}/api/v1/public/download/${f.id}?inline=true`,
      stream_url: f.imagekit_url || `${baseUrl}/api/v1/public/download/${f.id}?inline=true`,
      thumbnail_url: f.imagekit_thumbnail_url || `${baseUrl}/api/v1/public/thumbnail/${f.id}`,
    }));

    return jsonWithCors({
      success: true,
      total: rawFiles.length,
      limit,
      offset,
      files: formattedFiles,
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal mengambil daftar file publik: ' + err.message },
      500
    );
  }
}
