import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db as firestoreDb, firebaseConfig } from '@/lib/firebase';
import { getFiles, getConfigMap, getLogs, getVaults, getPermanentConfig, DEFAULT_VAULTS } from '@/lib/excel-db';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const permConfig = getPermanentConfig();
    const files = await getFiles('', 'ALL', 'ALL');
    const logs = await getLogs();
    const vaults = await getVaults();

    const payload = {
      config: {
        website_name: config.website_name || permConfig.website_name || 'RULLZYE CLOUD',
        telegram_bot_token: config.telegram_bot_token || permConfig.telegram_bot_token,
        telegram_chat_id: config.telegram_chat_id || permConfig.telegram_chat_id,
        telegram_topic_id: config.telegram_topic_id || permConfig.telegram_topic_id || '10',
        imagekit_public_key: config.imagekit_public_key || permConfig.imagekit_public_key,
        imagekit_private_key: config.imagekit_private_key || permConfig.imagekit_private_key,
        imagekit_url_endpoint: config.imagekit_url_endpoint || permConfig.imagekit_url_endpoint,
        imagekit_enabled: config.imagekit_enabled !== undefined ? config.imagekit_enabled : true,
        imagekit_default_folder: config.imagekit_default_folder || permConfig.imagekit_default_folder || '/rullzye_cloud',
        ad_monetization_enabled: config.ad_monetization_enabled !== undefined ? config.ad_monetization_enabled : true,
        ad_popunder_rate: config.ad_popunder_rate || 50,
        ad_popunder_url: config.ad_popunder_url || '',
        ad_banner_top_html: config.ad_banner_top_html || '',
        ad_player_overlay_html: config.ad_player_overlay_html || '',
        ad_native_html: config.ad_native_html || '',
      },
      files: files || [],
      logs: logs || [],
      vaults: (vaults && vaults.length > 0) ? vaults : DEFAULT_VAULTS,
      last_synced_at: new Date().toISOString(),
    };

    const docRef = doc(firestoreDb, 'app_data', 'main');
    await setDoc(docRef, payload);

    const configDocRef = doc(firestoreDb, 'app_data', 'config');
    await setDoc(configDocRef, payload.config);

    return NextResponse.json(
      {
        success: true,
        message: 'Database & konfigurasi berhasil disinkronkan ke Firestore!',
        stats: {
          files_count: payload.files.length,
          vaults_count: payload.vaults.length,
          logs_count: payload.logs.length,
          firestore_db: firebaseConfig.firestoreDatabaseId,
        },
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('Firestore sync error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal sinkronisasi ke Firestore: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
