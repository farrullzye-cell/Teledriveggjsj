import { NextRequest, NextResponse } from 'next/server';
import { deleteFileRecord, getConfigMap, renameFileRecord } from '@/lib/excel-db';
import { deleteFromTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const newName = body.name || body.newName;

    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama file baru wajib diisi' },
        { status: 400 }
      );
    }

    const updated = await renameFileRecord(id, newName.trim());
    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Nama file berhasil diubah menjadi "${updated.name}"`,
      file: updated,
    });
  } catch (err: any) {
    console.error('Rename file route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mengubah nama file: ' + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deletedRecord = await deleteFileRecord(id);

    if (!deletedRecord) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan di database' },
        { status: 404 }
      );
    }

    // Try deleting message from Telegram storage chat as well
    const config = await getConfigMap();
    if (config.telegram_bot_token && deletedRecord.telegram_chat_id && deletedRecord.telegram_message_id) {
      await deleteFromTelegram(
        config.telegram_bot_token,
        deletedRecord.telegram_chat_id,
        deletedRecord.telegram_message_id
      );
    }

    return NextResponse.json({
      success: true,
      message: `File ${deletedRecord.name} berhasil dihapus`,
    });
  } catch (err: any) {
    console.error('Delete file route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus file: ' + err.message },
      { status: 500 }
    );
  }
}
