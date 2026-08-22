import { NextRequest, NextResponse } from 'next/server';
import { fetchDriveFiles, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';

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

    const { searchParams } = new URL(req.url);

    const folderId = searchParams.get('folderId') || 'root';
    const searchQuery = searchParams.get('q') || '';
    const mimeTypeFilter = (searchParams.get('filter') as 'video' | 'image' | 'folder' | 'all') || undefined;
    const pageToken = searchParams.get('pageToken') || undefined;
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const result = await fetchDriveFiles(authToken, {
      folderId,
      searchQuery,
      mimeTypeFilter,
      pageToken,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.files,
      nextPageToken: result.nextPageToken,
      count: result.files.length,
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
    console.error('Drive files error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_FILES_ERROR', message: error.message || 'Gagal memuat file Google Drive.' },
      },
      { status: 500 }
    );
  }
}
