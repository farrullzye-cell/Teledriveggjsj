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
      storage_provider: f.gdrive_file_id ? 'gdrive' : (f.storage_provider || 'telegram'),
      uploaded_at: f.uploaded_at,
      cdn_url: f.gdrive_url || (f.gdrive_file_id ? `https://drive.google.com/uc?export=download&id=${f.gdrive_file_id}` : `${baseUrl}/api/v1/videos/stream/${f.id}`),
      download_url: `${baseUrl}/api/files/${f.id}/download`,
      preview_url: `${baseUrl}/api/v1/videos/stream/${f.id}`,
      stream_url: `${baseUrl}/api/v1/videos/stream/${f.id}`,
      watch_url: `${baseUrl}/watch/${f.id}`,
      embed_url: `${baseUrl}/embed/${f.id}`,
      thumbnail_url: f.gdrive_thumbnail_url || `${baseUrl}/api/thumbnail/${f.id}`,
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
