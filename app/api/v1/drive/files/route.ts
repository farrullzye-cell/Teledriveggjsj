import { NextRequest, NextResponse } from 'next/server';
import { fetchDriveFiles } from '@/lib/google-drive-server';

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
    const { searchParams } = new URL(req.url);

    const folderId = searchParams.get('folderId') || 'root';
    const searchQuery = searchParams.get('q') || '';
    const mimeTypeFilter = (searchParams.get('filter') as 'video' | 'image' | 'folder' | 'all') || undefined;
    const pageToken = searchParams.get('pageToken') || undefined;
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const result = await fetchDriveFiles(token, {
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
    console.error('Drive files error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DRIVE_FILES_ERROR', message: error.message || 'Gagal memuat file Google Drive.' },
      },
      { status: 500 }
    );
  }
}
