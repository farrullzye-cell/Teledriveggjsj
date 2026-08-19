import { NextRequest, NextResponse } from 'next/server';
import { createDriveFolder } from '@/lib/google-drive-server';

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

    const created = await createDriveFolder(token, folderName.trim(), parentFolderId);

    return NextResponse.json({
      success: true,
      data: created,
      message: `Folder "${folderName}" berhasil dibuat di Google Drive.`,
    });
  } catch (error: any) {
    console.error('Drive create folder error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_FOLDER_ERROR', message: error.message || 'Gagal membuat folder di Google Drive.' },
      },
      { status: 500 }
    );
  }
}
