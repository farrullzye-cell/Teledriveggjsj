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
        popunder_rate: config.ad_popunder_rate ?? 100, // Percentage probability
        popunder_url: (!config.ad_popunder_url || config.ad_popunder_url.includes('google.com'))
          ? 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js'
          : config.ad_popunder_url,
        banner_top_html: config.ad_banner_top_html || `<div class="w-full max-w-[800px] aspect-[4/1] mx-auto overflow-hidden flex items-center justify-center bg-[#0f1422] border border-amber-500/30 rounded-2xl p-2 shadow-lg"><script async="async" data-cfasync="false" src="https://pl30817733.effectivecpmnetwork.com/4045af9e74f05790b727b7c208314777/invoke.js"></script><div id="container-4045af9e74f05790b727b7c208314777"></div></div>`,
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
