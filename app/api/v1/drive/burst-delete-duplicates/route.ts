import { NextRequest, NextResponse } from 'next/server';
import {
  burstDeleteDriveDuplicates,
  getValidDriveToken,
  GoogleDriveAuthError,
  BurstDeleteDriveDuplicatesOptions,
} from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleBurstDelete(req);
}

async function handleBurstDelete(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const authToken = await getValidDriveToken(token || body.token || undefined);
    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Sesi Google Drive belum terhubung atau token kadaluarsa. Silakan hubungkan akun Google.',
          },
        },
        { status: 401 }
      );
    }

    const options: BurstDeleteDriveDuplicatesOptions = {
      scope: (body.scope || 'all') as 'all' | 'folder' | 'vaults',
      folderId: body.folderId || 'root',
      keepStrategy: (body.keepStrategy || 'keep_oldest') as 'keep_oldest' | 'keep_newest',
      matchStrategy: (body.matchStrategy || 'md5_or_name_size') as
        | 'md5_or_name_size'
        | 'exact_name_size'
        | 'checksum_only'
        | 'normalized_name_size',
      targetFileIds: Array.isArray(body.targetFileIds) ? body.targetFileIds : undefined,
      concurrency: Number(body.concurrency || 6),
      maxFilesToScan: Number(body.maxFilesToScan || 5000),
    };

    const result = await burstDeleteDriveDuplicates(authToken, options);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof GoogleDriveAuthError || error.name === 'GoogleDriveAuthError' || error.statusCode === 401) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Sesi Google Drive telah kadaluarsa. Silakan hubungkan kembali akun Google Anda.',
          },
        },
        { status: 401 }
      );
    }

    console.error('[API-DRIVE-BURST-DELETE-DUPLICATES-ERROR]', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BURST_DELETE_DUPLICATES_FAILED',
          message: error?.message || 'Gagal menjalankan burst delete file duplikat di Google Drive.',
        },
      },
      { status: 500 }
    );
  }
}
