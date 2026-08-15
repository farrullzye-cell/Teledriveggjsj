import { NextRequest, NextResponse } from 'next/server';
import { deleteFileRecord, getConfigMap, renameFileRecord, getFileById, addLog } from '@/lib/excel-db';
import { deleteFromTelegram } from '@/lib/telegram';
import { deleteFromImageKit, updateImageKitFileDetails } from '@/lib/imagekit';

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

    // If file has ImageKit file ID, update tags or metadata
    if (updated.imagekit_file_id) {
      await updateImageKitFileDetails(updated.imagekit_file_id, {
        tags: ['renamed', updated.type, updated.vault_name || 'vault'],
      }).catch((e) => console.warn('Failed updating ImageKit tags on rename:', e));
    }

    await addLog('FILE_RENAME', `${updated.name} (ID: ${id})`, 'SUCCESS');

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
    const existingFile = await getFileById(id);

    if (!existingFile) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan di database' },
        { status: 404 }
      );
    }

    // 1. Delete from ImageKit if exists
    if (existingFile.imagekit_file_id) {
      const ikDeleteRes = await deleteFromImageKit(existingFile.imagekit_file_id);
      if (ikDeleteRes.ok) {
        await addLog('IMAGEKIT_DELETE', existingFile.name, 'SUCCESS');
      } else {
        console.warn('ImageKit delete warning:', ikDeleteRes.error);
        await addLog('IMAGEKIT_DELETE', existingFile.name, `WARNING_${ikDeleteRes.error}`);
      }
    }

    // 2. Delete message from Telegram storage chat as well if exists
    const config = await getConfigMap();
    if (config.telegram_bot_token && existingFile.telegram_chat_id && existingFile.telegram_message_id) {
      await deleteFromTelegram(
        config.telegram_bot_token,
        existingFile.telegram_chat_id,
        existingFile.telegram_message_id
      ).catch(() => {});
    }

    // 3. Delete metadata from Firestore / DB
    const deletedRecord = await deleteFileRecord(id);

    if (!deletedRecord) {
      return NextResponse.json(
        { success: false, message: 'Gagal menghapus metadata file' },
        { status: 500 }
      );
    }

    await addLog('FILE_DELETE', deletedRecord.name, 'SUCCESS');

    return NextResponse.json({
      success: true,
      message: `File ${deletedRecord.name} berhasil dihapus dari ImageKit CDN dan Database`,
    });
  } catch (err: any) {
    console.error('Delete file route error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus file: ' + err.message },
      { status: 500 }
    );
  }
}

