import { NextRequest, NextResponse } from 'next/server';
import { addFileRecord, addLog, determineFileType } from '@/lib/excel-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      driveFileId,
      name,
      mimeType,
      size = 0,
      webViewLink,
      webContentLink,
      thumbnailLink,
      vaultId = 'vault_media',
    } = body;

    if (!driveFileId || !name) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'driveFileId dan name wajib disertakan.' },
        },
        { status: 400 }
      );
    }

    const type = determineFileType(name, mimeType);
    const directStreamingUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    const record = await addFileRecord({
      name,
      size: Number(size) || 0,
      type,
      mime: mimeType || (type === 'video' ? 'video/mp4' : 'application/octet-stream'),
      telegram_file_id: `gdrive_${driveFileId}`,
      source_url: directStreamingUrl,
      imagekit_url: directStreamingUrl,
      imagekit_file_id: driveFileId,
      imagekit_thumbnail_url: thumbnailLink || '',
      vault_id: vaultId,
    });

    await addLog('GDRIVE_IMPORT', name, 'SUCCESS');

    return NextResponse.json({
      success: true,
      file: record,
      message: `File "${name}" berhasil diimpor dari Google Drive ke RULLZYE CLOUD.`,
    });
  } catch (error: any) {
    console.error('Google Drive import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'IMPORT_FAILED', message: error.message || 'Gagal mengimpor file dari Google Drive' },
      },
      { status: 500 }
    );
  }
}
