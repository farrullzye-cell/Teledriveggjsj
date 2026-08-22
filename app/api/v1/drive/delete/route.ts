import { NextRequest, NextResponse } from 'next/server';
import { deleteDriveFile, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';
import { addLog } from '@/lib/excel-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    const authToken = await getValidDriveToken(token || undefined);
    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Google Drive belum terhubung atau token kadaluarsa. Silakan hubungkan akun Google di panel.' },
        },
        { status: 401 }
      );
    }

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

    await deleteDriveFile(authToken, fileId);

    await addLog('GDRIVE_DELETE', fileName || fileId, 'SUCCESS');

    return NextResponse.json({
      success: true,
      message: `File/Folder "${fileName || fileId}" berhasil dihapus dari Google Drive.`,
    });
  } catch (error: any) {
    if (error instanceof GoogleDriveAuthError || error.name === 'GoogleDriveAuthError' || error.statusCode === 401) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: error.message || 'Sesi Google Drive telah kadaluarsa. Silakan hubungkan kembali akun Google Anda.' },
        },
        { status: 401 }
      );
    }
    console.error('Google Drive delete error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DELETE_FAILED', message: error.message || 'Gagal menghapus file dari Google Drive' },
      },
      { status: 500 }
    );
  }
}
