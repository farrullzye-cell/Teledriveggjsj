import { NextRequest } from 'next/server';
import { getFiles, getVaults } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'ALL'; // ALL | PHOTOS | VIDEOS | DOCUMENTS
    const vaultId = searchParams.get('vault_id') || 'ALL';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let typeFilter = 'ALL';
    if (category.toUpperCase() === 'PHOTOS' || category.toUpperCase() === 'IMAGES') {
      typeFilter = 'PHOTOS';
    } else if (category.toUpperCase() === 'VIDEOS') {
      typeFilter = 'VIDEOS';
    } else if (category.toUpperCase() === 'FILES' || category.toUpperCase() === 'DOCUMENTS') {
      typeFilter = 'FILES';
    }

    const rawFiles = await getFiles('', typeFilter, vaultId);
    const vaults = await getVaults();

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const mediaList = rawFiles.slice(0, limit).map((f) => {
      const isImage = f.type === 'image';
      const isVideo = f.type === 'video';

      return {
        id: f.id,
        title: f.name,
        type: f.type,
        mime: f.mime,
        size_bytes: f.size,
        size_formatted: (f.size / (1024 * 1024) > 1
          ? (f.size / (1024 * 1024)).toFixed(2) + ' MB'
          : (f.size / 1024).toFixed(1) + ' KB'),
        vault: {
          id: f.vault_id || 'vault_general',
          name: f.vault_name || 'General Storage',
        },
        media_url: `${baseUrl}/api/v1/public/download/${f.id}?inline=true`,
        download_url: `${baseUrl}/api/v1/public/download/${f.id}`,
        thumbnail_url: isImage || isVideo ? `${baseUrl}/api/v1/public/download/${f.id}?inline=true` : null,
        views: f.views !== undefined ? f.views : Math.floor((parseInt(f.id.replace(/\D/g, '').slice(-3) || '142', 10) % 800) + 120),
        likes: f.likes !== undefined ? f.likes : Math.floor((parseInt(f.id.replace(/\D/g, '').slice(-2) || '25', 10) % 150) + 15),
        created_at: f.uploaded_at,
      };
    });

    return jsonWithCors({
      success: true,
      count: mediaList.length,
      categories: ['ALL', 'PHOTOS', 'VIDEOS', 'DOCUMENTS'],
      vaults: vaults.map(v => ({ id: v.id, name: v.name, description: v.description })),
      media: mediaList,
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal mengambil media publik: ' + err.message },
      500
    );
  }
}
