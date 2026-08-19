import { NextRequest } from 'next/server';
import { getMonetizationConfig, saveMonetizationConfig, SmartlinkRecord } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const config = await getMonetizationConfig();
    return jsonWithCors({
      success: true,
      smartlinks: config.smartlinks,
      rotationStrategy: config.rotationStrategy,
      total: config.smartlinks.length,
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'FETCH_ERROR', message: err.message } }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.url || !body.name) {
      return jsonWithCors({ success: false, error: { code: 'INVALID_INPUT', message: 'Nama dan URL Smartlink wajib diisi.' } }, 400);
    }

    const config = await getMonetizationConfig();
    const newLink: SmartlinkRecord = {
      id: `slink_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: body.name.trim(),
      url: body.url.trim(),
      baseUrl: body.baseUrl || body.url.trim(),
      subIds: body.subIds || {},
      weight: Number(body.weight) || 50,
      priority: Number(body.priority) || 1,
      clicks: 0,
      active: body.active !== undefined ? Boolean(body.active) : true,
      categoryTargets: Array.isArray(body.categoryTargets) ? body.categoryTargets : [],
      createdAt: new Date().toISOString(),
    };

    const updatedLinks = [newLink, ...config.smartlinks];
    await saveMonetizationConfig({ smartlinks: updatedLinks });

    return jsonWithCors({
      success: true,
      message: 'Smartlink baru berhasil ditambahkan ke pool.',
      smartlink: newLink,
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'CREATE_ERROR', message: err.message } }, 500);
  }
}
