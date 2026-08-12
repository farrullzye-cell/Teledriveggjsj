import { NextRequest, NextResponse } from 'next/server';
import { updateFileStats, addLog } from '@/lib/excel-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { file_id, views, likes } = body;

    if (!file_id) {
      return NextResponse.json({ ok: false, message: 'file_id wajib disertakan' }, { status: 400 });
    }

    const updated = await updateFileStats(file_id, views, likes);

    if (updated) {
      await addLog('UPDATE_STATS', file_id, 'SUCCESS');
      return NextResponse.json({
        ok: true,
        message: 'Jumlah Views & Likes berhasil diperbarui!',
        file: updated,
      });
    } else {
      return NextResponse.json({ ok: false, message: 'File tidak ditemukan' }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'Gagal update stats' }, { status: 500 });
  }
}
