import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveConfig, saveGoogleDriveConfig } from '@/lib/google-drive-server';

export async function GET() {
  try {
    const config = await getGoogleDriveConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Error fetching Google Drive config:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONFIG_FETCH_ERROR', message: error.message || 'Failed to fetch Google Drive config' },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await saveGoogleDriveConfig(body);
    return NextResponse.json({
      success: true,
      config: updated,
      message: 'Konfigurasi Google Drive berhasil disimpan permanen di codebase & Firestore.',
    });
  } catch (error: any) {
    console.error('Error saving Google Drive config:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONFIG_SAVE_ERROR', message: error.message || 'Failed to save Google Drive config' },
      },
      { status: 500 }
    );
  }
}
