import { NextRequest } from 'next/server';
import { incrementFileLike, incrementFileView } from '@/lib/excel-db';
import { handleCorsOptions, jsonWithCors } from '@/lib/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, action } = body;

    if (!id) {
      return jsonWithCors({ success: false, message: 'ID file required' }, 400);
    }

    if (action === 'view') {
      const updated = await incrementFileView(id);
      return jsonWithCors({ success: true, views: updated?.views || 1 });
    }

    const updated = await incrementFileLike(id);
    return jsonWithCors({ success: true, likes: updated?.likes || 1 });
  } catch (err: any) {
    return jsonWithCors({ success: false, message: err.message }, 500);
  }
}
