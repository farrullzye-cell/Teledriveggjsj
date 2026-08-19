import { NextRequest } from 'next/server';
import { processMonetizationClick } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const testSessionId = `test_sim_${body.testId || Date.now()}`;

    const result = await processMonetizationClick({
      visitorId: testSessionId,
      videoId: body.videoId || 'test_video_1',
      categoryId: body.categoryId || 'vault_media',
      triggerType: body.triggerType || 'video_click',
    });

    return jsonWithCors({
      success: true,
      simulation: {
        clickNumber: result.clickNumber,
        interval: result.interval,
        triggered: result.triggered,
        mode: result.mode,
        smartlinkUrl: result.smartlinkUrl,
        selectedSmartlinkName: result.selectedSmartlinkName,
        rotationStrategy: result.rotationStrategy,
      }
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'SIMULATION_ERROR', message: err.message } }, 500);
  }
}
