import { NextRequest } from 'next/server';
import { processMonetizationClick } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Anonymously identify visitor from IP / User-Agent or passed visitor ID
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('remote-addr') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown_browser';
    const clientVisitorId = body.visitorId || `${ip}_${userAgent.substring(0, 30)}`;

    const result = await processMonetizationClick({
      visitorId: clientVisitorId,
      videoId: body.videoId,
      categoryId: body.categoryId,
      triggerType: body.triggerType || 'video_click',
      videoMonetizationOverride: body.videoMonetizationOverride,
      videoSmartlinkOverride: body.videoSmartlinkOverride,
    });

    return jsonWithCors({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return jsonWithCors({
      success: false,
      error: { code: 'CLICK_PROCESSING_ERROR', message: err.message }
    }, 500);
  }
}
