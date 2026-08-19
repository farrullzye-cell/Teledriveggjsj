import { NextRequest, NextResponse } from 'next/server';
import { getDriveAboutInfo } from '@/lib/google-drive-server';

export async function GET(req: NextRequest) {
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
    const aboutInfo = await getDriveAboutInfo(token);

    return NextResponse.json({
      success: true,
      data: aboutInfo,
    });
  } catch (error: any) {
    console.error('Drive about error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_ABOUT_ERROR', message: error.message || 'Gagal mengambil informasi Google Drive.' },
      },
      { status: 500 }
    );
  }
}
