import { NextRequest } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return jsonWithCors(
        { success: false, message: 'File tidak ditemukan' },
        404
      );
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    return jsonWithCors({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        type: file.type,
        mime: file.mime,
        size: file.size,
        size_formatted: (file.size / 1024 > 1024
          ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
          : (file.size / 1024).toFixed(1) + ' KB'),
        vault_id: file.vault_id || 'vault_general',
        vault_name: file.vault_name || 'General',
        uploaded_at: file.uploaded_at,
        download_url: `${baseUrl}/api/v1/public/download/${file.id}`,
        preview_url: `${baseUrl}/api/v1/public/download/${file.id}?inline=true`,
      },
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal mendapatkan detail file: ' + err.message },
      500
    );
  }
}
