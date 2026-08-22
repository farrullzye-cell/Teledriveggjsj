import { NextRequest, NextResponse } from 'next/server';
import { scanDriveDuplicates, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleScan(req);
}

export async function POST(req: NextRequest) {
  return handleScan(req);
}

async function handleScan(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {}
    }

    const { searchParams } = new URL(req.url);
    const scope = (body.scope || searchParams.get('scope') || 'all') as 'all' | 'folder' | 'vaults';
    const folderId = body.folderId || searchParams.get('folderId') || 'root';
    const keepStrategy = (body.keepStrategy || searchParams.get('keepStrategy') || 'keep_oldest') as 'keep_oldest' | 'keep_newest';
    const matchStrategy = (body.matchStrategy || searchParams.get('matchStrategy') || 'md5_or_name_size') as
      | 'md5_or_name_size'
      | 'exact_name_size'
      | 'checksum_only'
      | 'normalized_name_size';
    const maxFilesToScan = Number(body.maxFilesToScan || searchParams.get('maxFilesToScan') || 5000);

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

    const result = await scanDriveDuplicates(authToken, {
      scope,
      folderId,
      keepStrategy,
      matchStrategy,
      maxFilesToScan,
    });

    return NextResponse.json({
      success: true,
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

    console.error('[API-DRIVE-SCAN-DUPLICATES-ERROR]', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SCAN_DUPLICATES_FAILED',
          message: error?.message || 'Gagal memindai file duplikat di Google Drive.',
        },
      },
      { status: 500 }
    );
  }
}
