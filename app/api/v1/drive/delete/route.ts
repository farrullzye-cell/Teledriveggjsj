import { NextRequest, NextResponse } from 'next/server';
import { deleteDriveFile } from '@/lib/google-drive-server';
import { addLog } from '@/lib/excel-db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token otentikasi Google Drive diperlukan.' },
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const body = await req.json();
    const { fileId, fileName } = body;

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_ID', message: 'fileId diperlukan.' },
        },
        { status: 400 }
      );
    }

    await deleteDriveFile(token, fileId);

    await addLog('GDRIVE_DELETE', fileName || fileId, 'SUCCESS');

    return NextResponse.json({
      success: true,
      message: `File/Folder "${fileName || fileId}" berhasil dihapus dari Google Drive.`,
    });
  } catch (error: any) {
    console.error('Google Drive delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DELETE_FAILED', message: error.message || 'Gagal menghapus file dari Google Drive' },
      },
      { status: 500 }
    );
  }
}
