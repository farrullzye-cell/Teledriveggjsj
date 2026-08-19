import { NextRequest, NextResponse } from 'next/server';
import { getMonetizationConfig, saveMonetizationConfig } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const config = await getMonetizationConfig();
    
    // Return safe configuration
    return jsonWithCors({
      success: true,
      monetization: {
        enabled: config.enabled,
        interval: config.interval,
        mode: config.mode,
        trigger: config.trigger,
        cooldownSeconds: config.cooldownSeconds,
        rotationStrategy: config.rotationStrategy,
        activeSmartlinksCount: config.smartlinks.filter(s => s.active).length,
        defaultSmartlinkUrl: config.defaultSmartlinkUrl,
        bannerTopHtml: config.bannerTopHtml,
        playerOverlayHtml: config.playerOverlayHtml,
        nativeAdHtml: config.nativeAdHtml,
      }
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'CONFIG_FETCH_ERROR', message: err.message } }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await saveMonetizationConfig(body);

    return jsonWithCors({
      success: true,
      message: 'Konfigurasi monetisasi Adsterra berhasil disimpan.',
      monetization: updated,
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'CONFIG_SAVE_ERROR', message: err.message } }, 500);
  }
}
