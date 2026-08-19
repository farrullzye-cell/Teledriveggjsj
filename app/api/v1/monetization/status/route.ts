import { NextRequest } from 'next/server';
import { getMonetizationConfig } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const config = await getMonetizationConfig();
    const activeSmartlinks = config.smartlinks.filter(s => s.active);
    const totalClicks = config.smartlinks.reduce((acc, s) => acc + (s.clicks || 0), 0);

    return jsonWithCors({
      success: true,
      status: {
        enabled: config.enabled,
        interval: config.interval,
        mode: config.mode,
        trigger: config.trigger,
        rotationStrategy: config.rotationStrategy,
        totalSmartlinks: config.smartlinks.length,
        activeSmartlinks: activeSmartlinks.length,
        totalClicksRecorded: totalClicks,
        cooldownSeconds: config.cooldownSeconds,
        antiAbuseEnabled: config.antiAbuseEnabled,
        lastUpdated: config.updatedAt || new Date().toISOString(),
      }
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'STATUS_ERROR', message: err.message } }, 500);
  }
}
