import { NextRequest, NextResponse } from 'next/server';
import { scanAndSyncDriveVaults, ensureDriveVaultFolders, getValidDriveToken, GoogleDriveAuthError } from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    const authToken = await getValidDriveToken(token || undefined);
    if (!authToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Google Drive belum terhubung atau token kadaluarsa. Silakan hubungkan akun Google di panel.',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const initVaults = searchParams.get('init_vaults') === 'true' || searchParams.get('initVaults') === 'true';

    if (initVaults) {
      try {
        await ensureDriveVaultFolders(authToken);
      } catch (err: any) {
        console.warn('ensureDriveVaultFolders notice:', err?.message || err);
      }
    }

    const result = await scanAndSyncDriveVaults(authToken);

    return NextResponse.json({
      success: result.success,
      data: {
        newCount: result.newCount,
        totalScanned: result.totalScanned,
        vaultsScanned: result.vaultsScanned,
        newFiles: result.newFiles,
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
    console.error('Drive Sync Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: error.message || 'Gagal menyinkronkan berkas dari Google Drive Vault',
        },
      },
      { status: 500 }
    );
  }
}
