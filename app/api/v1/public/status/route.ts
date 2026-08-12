import { NextRequest } from 'next/server';
import { getFiles, getVaults, getConfigMap } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const files = await getFiles();
    const vaults = await getVaults();
    const config = await getConfigMap();

    const totalFiles = files.length;
    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const mediaCount = files.filter(f => f.type === 'image' || f.type === 'video').length;

    return jsonWithCors({
      success: true,
      service: config.website_name || 'RULLZYE CLOUD',
      status: 'ONLINE',
      mode: 'PRIVATE_BACKEND_WITH_PUBLIC_API',
      version: 'v1.0.0',
      timestamp: new Date().toISOString(),
      storage: {
        total_files: totalFiles,
        total_media: mediaCount,
        total_size_bytes: totalSize,
        total_size_formatted: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
        total_vaults: vaults.length,
      },
      cors_enabled: true,
      telegram_storage_connected: !!(config.telegram_bot_token && config.telegram_chat_id),
      public_endpoints: {
        status: '/api/v1/public/status',
        files: '/api/v1/public/files',
        media: '/api/v1/public/media',
        download: '/api/v1/public/download/{id}',
        project_export: '/api/v1/public/project-export',
        docs: '/api/v1/public/docs',
      },
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal mengambil status backend: ' + err.message },
      500
    );
  }
}
