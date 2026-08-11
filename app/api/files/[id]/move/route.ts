import { NextRequest, NextResponse } from 'next/server';
import { moveFileToVault, addLog } from '@/lib/excel-db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { vault_id } = body;

    if (!vault_id) {
      return NextResponse.json({ ok: false, message: 'Target vault_id wajib diisi' }, { status: 400 });
    }

    const updatedFile = await moveFileToVault(id, vault_id);
    if (!updatedFile) {
      return NextResponse.json({ ok: false, message: 'File tidak ditemukan' }, { status: 404 });
    }

    await addLog('FILE_MOVE_VAULT', updatedFile.name, 'SUCCESS');

    return NextResponse.json({
      ok: true,
      message: `File berhasil dipindahkan ke Vault "${updatedFile.vault_name}"`,
      file: updatedFile,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
