import { NextRequest, NextResponse } from 'next/server';
import { burstScanAndSyncDriveVaults, ensureDriveVaultFolders, GoogleDriveAuthError } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

/**
 * GET / POST /api/v1/drive/burst-sync
 * Multi-threaded Auto Burst Sync & Duplicate Detection for Google Drive Vaults
 */
export async function GET(req: NextRequest) {
  return handleBurstSync(req);
}

export async function POST(req: NextRequest) {
  return handleBurstSync(req);
}

async function handleBurstSync(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    let duplicatePolicy: 'skip' | 'overwrite' | 'rename' = 'skip';
    let folderId: string | undefined = undefined;
    let initVaults = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.token) token = body.token;
        if (body.duplicatePolicy) duplicatePolicy = body.duplicatePolicy;
        if (body.folderId) folderId = body.folderId;
        if (body.initVaults) initVaults = !!body.initVaults;
      } catch {}
    } else {
      const { searchParams } = new URL(req.url);
      if (searchParams.get('token')) token = searchParams.get('token')!;
      if (searchParams.get('duplicatePolicy')) {
        duplicatePolicy = searchParams.get('duplicatePolicy') as any;
      }
      if (searchParams.get('folderId')) folderId = searchParams.get('folderId')!;
      if (searchParams.get('init_vaults') === 'true') initVaults = true;
    }

    if (initVaults) {
      try {
        await ensureDriveVaultFolders(token || undefined);
      } catch (err: any) {
        console.warn('initVaults error:', err?.message);
      }
    }

    const result = await burstScanAndSyncDriveVaults({
      token: token || undefined,
      duplicatePolicy,
      folderId,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        totalScanned: result.totalScanned,
        newCount: result.newCount,
        duplicatesCount: result.duplicatesCount,
        vaultsScanned: result.vaultsScanned,
        importedFiles: result.importedFiles,
      },
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
    console.error('[API-BURST-SYNC-ERROR]', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BURST_SYNC_FAILED',
          message: error.message || 'Gagal menjalankan Auto Burst Sync Google Drive.',
        },
      },
      { status: 500 }
    );
  }
}
