import { NextRequest, NextResponse } from 'next/server';
import { createDriveFolder, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';

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
    const { folderName, parentFolderId = 'root' } = body;

    if (!folderName || !folderName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_NAME', message: 'Nama folder tidak boleh kosong.' },
        },
        { status: 400 }
      );
    }

    const created = await createDriveFolder(authToken, folderName.trim(), parentFolderId);

    return NextResponse.json({
      success: true,
      data: created,
      message: `Folder "${folderName}" berhasil dibuat di Google Drive.`,
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
    console.error('Drive create folder error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_FOLDER_ERROR', message: error.message || 'Gagal membuat folder di Google Drive.' },
      },
      { status: 500 }
    );
  }
}
