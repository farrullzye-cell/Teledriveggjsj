import { NextRequest, NextResponse } from 'next/server';
import { updateVault, deleteVault, addLog } from '@/lib/excel-db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await updateVault(id, body);
    if (!updated) {
      return NextResponse.json({ ok: false, message: 'Vault tidak ditemukan' }, { status: 404 });
    }

    await addLog('VAULT_UPDATE', updated.name, 'SUCCESS');

    return NextResponse.json({
      ok: true,
      message: 'Vault Topic berhasil diperbarui!',
      vault: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (id === 'vault_general') {
      return NextResponse.json({ ok: false, message: 'General Vault bawaan tidak dapat dihapus' }, { status: 400 });
    }

    const success = await deleteVault(id);
    if (!success) {
      return NextResponse.json({ ok: false, message: 'Vault tidak ditemukan' }, { status: 404 });
    }

    await addLog('VAULT_DELETE', id, 'SUCCESS');

    return NextResponse.json({
      ok: true,
      message: 'Vault berhasil dihapus. Semua berkas telah dipindahkan ke General Storage.',
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
