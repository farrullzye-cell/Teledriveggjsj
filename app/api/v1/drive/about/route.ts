import { NextRequest, NextResponse } from 'next/server';
import { getDriveAboutInfo, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

    const aboutInfo = await getDriveAboutInfo(authToken);

    return NextResponse.json({
      success: true,
      data: aboutInfo,
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
    console.error('Drive about error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_ABOUT_ERROR', message: error.message || 'Gagal mengambil informasi Google Drive.' },
      },
      { status: 500 }
    );
  }
}
