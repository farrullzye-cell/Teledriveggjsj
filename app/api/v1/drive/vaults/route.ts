import { NextRequest, NextResponse } from 'next/server';
import { getVaults } from '@/lib/excel-db';
import { ensureDriveVaultFolders, getGoogleDriveConfig } from '@/lib/google-drive-server';
import { getDriveAccessToken } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const vaults = await getVaults();
    const config = await getGoogleDriveConfig();

    return NextResponse.json({
      success: true,
      rootFolderId: config.folder_id || 'root',
      rootFolderName: config.folder_name || 'RULLZYE CLOUD',
      vaults: vaults.map((v) => ({
        id: v.id,
        name: v.name,
        gdrive_folder_id: v.gdrive_folder_id || null,
        gdrive_folder_name: v.gdrive_folder_name || v.name,
        gdrive_file_count: v.gdrive_file_count || 0,
        gdrive_last_synced: v.gdrive_last_synced || null,
        icon: v.icon || 'Folder',
        color: v.color || 'amber',
        is_private: !!v.is_private,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'VAULTS_FETCH_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

    if (!token) {
      token = getDriveAccessToken() || '';
    }

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Token otentikasi Google Drive diperlukan untuk membuat folder Vault di Google Drive.' },
        },
        { status: 401 }
      );
    }

    const config = await getGoogleDriveConfig();
    const result = await ensureDriveVaultFolders(token, config.folder_id || 'root');

    return NextResponse.json({
      success: true,
      rootFolderId: result.rootFolderId,
      vaults: result.vaults,
      message: 'Semua folder Vault berhasil disiapkan dan ditautkan ke Google Drive!',
    });
  } catch (err: any) {
    console.error('Create Drive Vaults Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'VAULTS_SETUP_FAILED', message: err.message } },
      { status: 500 }
    );
  }
}
