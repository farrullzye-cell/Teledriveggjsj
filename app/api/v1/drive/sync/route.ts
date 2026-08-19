import { NextRequest, NextResponse } from 'next/server';
import { scanAndSyncDriveVaults, ensureDriveVaultFolders } from '@/lib/google-drive-server';
import { getDriveAccessToken } from '@/lib/google-drive';

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
    let token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    if (!token) {
      token = getDriveAccessToken() || '';
    }

    const { searchParams } = new URL(req.url);
    const initVaults = searchParams.get('init_vaults') === 'true' || searchParams.get('initVaults') === 'true';

    if (initVaults && token) {
      try {
        await ensureDriveVaultFolders(token);
      } catch (err: any) {
        console.warn('ensureDriveVaultFolders notice:', err?.message || err);
      }
    }

    const result = await scanAndSyncDriveVaults(token || undefined);

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
    console.error('Drive Sync Error:', error);
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
