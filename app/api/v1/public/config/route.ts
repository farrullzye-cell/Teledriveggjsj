import { NextRequest } from 'next/server';
import { getConfigMap, getVaults } from '@/lib/excel-db';
import { getMonetizationConfig } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const vaults = await getVaults();
    const monetization = await getMonetizationConfig();

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
        enabled: monetization.enabled,
        interval: monetization.interval,
        mode: monetization.mode,
        trigger: monetization.trigger,
        rotation_strategy: monetization.rotationStrategy,
        popunder_rate: monetization.popunderRate ?? 100,
        popunder_url: monetization.popunderUrl || monetization.defaultSmartlinkUrl,
        banner_top_html: monetization.bannerTopHtml,
        player_overlay_html: monetization.playerOverlayHtml,
        native_ad_html: monetization.nativeAdHtml,
      },
    });
  } catch (err: any) {
    return jsonWithCors(
      { success: false, message: 'Gagal memuat konfigurasi publik: ' + err.message },
      500
    );
  }
}

