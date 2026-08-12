import { NextRequest } from 'next/server';
import { getConfigMap, getVaults } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const vaults = await getVaults();

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const categories = vaults.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description || '',
      icon: v.icon || 'Folder',
      color: v.color || 'cyan',
    }));

    return jsonWithCors({
      success: true,
      site: {
        title: 'XVIDSHUB',
        tagline: 'High Speed Video Streaming & Media Portal',
        server_url: baseUrl,
      },
      categories,
      monetization: {
        enabled: config.ad_monetization_enabled ?? true,
        popunder_rate: config.ad_popunder_rate ?? 30, // Percentage probability 20%, 30%, 50%, 100%
        popunder_url: config.ad_popunder_url || 'https://www.google.com',
        banner_top_html: config.ad_banner_top_html || '',
        player_overlay_html: config.ad_player_overlay_html || '',
        native_ad_html: config.ad_native_html || '',
      },
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal memuat konfigurasi publik: ' + err.message },
      500
    );
  }
}
