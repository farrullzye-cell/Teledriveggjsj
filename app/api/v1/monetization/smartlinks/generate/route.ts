import { NextRequest } from 'next/server';
import { generateSmartlinks, GenerateSmartlinkOptions } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.baseUrl || typeof body.baseUrl !== 'string' || !body.baseUrl.trim()) {
      return jsonWithCors({
        success: false,
        error: { code: 'INVALID_BASE_URL', message: 'Base Smartlink URL Adsterra wajib diisi.' }
      }, 400);
    }

    const options: GenerateSmartlinkOptions = {
      baseUrl: body.baseUrl.trim(),
      count: Number(body.count) || 5,
      namePrefix: body.namePrefix || 'Adsterra Smartlink',
      subIdPrefix: body.subIdPrefix || 'adst',
      placementTag: body.placementTag || 'stream_player',
      weight: Number(body.weight) || 50,
      priority: Number(body.priority) || 1,
      categoryTargets: Array.isArray(body.categoryTargets) ? body.categoryTargets : [],
    };

    const generated = await generateSmartlinks(options);

    return jsonWithCors({
      success: true,
      message: `Berhasil meng-generate ${generated.length} smartlink baru ke pool.`,
      generatedCount: generated.length,
      smartlinks: generated,
    });
  } catch (err: any) {
    return jsonWithCors({
      success: false,
      error: { code: 'GENERATION_ERROR', message: err.message }
    }, 500);
  }
}
