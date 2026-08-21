import { NextRequest, NextResponse } from 'next/server';
import { burstUploadDriveFiles } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/drive/burst-upload
 * Batch / Burst Ingestion of multiple files from Google Drive with duplicate detection & policies
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, duplicatePolicy = 'skip', token } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ITEMS',
            message: 'Parameter "items" harus berupa array daftar file Google Drive yang akan diunggah/diimpor.',
          },
        },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : token;

    const result = await burstUploadDriveFiles(items, {
      token: bearerToken || undefined,
      duplicatePolicy,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRequested: items.length,
        insertedCount: result.inserted.length,
        skippedCount: result.skippedDuplicates.length,
        inserted: result.inserted,
        skippedDuplicates: result.skippedDuplicates,
      },
      message: result.message,
    });
  } catch (error: any) {
    console.error('[API-BURST-UPLOAD-ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BURST_UPLOAD_FAILED',
          message: error.message || 'Gagal melakukan burst upload dari Google Drive.',
        },
      },
      { status: 500 }
    );
  }
}
