import { NextRequest } from 'next/server';
import { getMonetizationConfig, saveMonetizationConfig } from '@/lib/monetization';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const config = await getMonetizationConfig();

    const linkIndex = config.smartlinks.findIndex(s => s.id === id);
    if (linkIndex === -1) {
      return jsonWithCors({ success: false, error: { code: 'NOT_FOUND', message: 'Smartlink tidak ditemukan.' } }, 404);
    }

    const current = config.smartlinks[linkIndex];
    const updated = {
      ...current,
      name: body.name !== undefined ? body.name.trim() : current.name,
      url: body.url !== undefined ? body.url.trim() : current.url,
      baseUrl: body.baseUrl !== undefined ? body.baseUrl : current.baseUrl,
      weight: body.weight !== undefined ? Number(body.weight) : current.weight,
      priority: body.priority !== undefined ? Number(body.priority) : current.priority,
      active: body.active !== undefined ? Boolean(body.active) : current.active,
      categoryTargets: Array.isArray(body.categoryTargets) ? body.categoryTargets : current.categoryTargets,
    };

    config.smartlinks[linkIndex] = updated;
    await saveMonetizationConfig({ smartlinks: config.smartlinks });

    return jsonWithCors({
      success: true,
      message: 'Smartlink berhasil diperbarui.',
      smartlink: updated,
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } }, 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const config = await getMonetizationConfig();

    const filtered = config.smartlinks.filter(s => s.id !== id);
    if (filtered.length === config.smartlinks.length) {
      return jsonWithCors({ success: false, error: { code: 'NOT_FOUND', message: 'Smartlink tidak ditemukan.' } }, 404);
    }

    await saveMonetizationConfig({ smartlinks: filtered });

    return jsonWithCors({
      success: true,
      message: 'Smartlink berhasil dihapus dari pool.',
    });
  } catch (err: any) {
    return jsonWithCors({ success: false, error: { code: 'DELETE_ERROR', message: err.message } }, 500);
  }
}
