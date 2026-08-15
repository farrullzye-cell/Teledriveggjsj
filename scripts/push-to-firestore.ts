/**
 * Script to push current environment, database, and config to Google Cloud Firestore
 * Usage: bun run scripts/push-to-firestore.ts
 */

import fs from 'fs';
import path from 'path';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db as firestoreDb, firebaseConfig } from '../lib/firebase';
import { getPermanentConfig, DEFAULT_VAULTS } from '../lib/excel-db';

async function pushToFirestore() {
  console.log('==================================================');
  console.log('🚀 PUSHING ENVIRONMENT & DATABASE TO FIRESTORE');
  console.log(`Firestore Project: ${firebaseConfig.projectId}`);
  console.log(`Firestore Database ID: ${firebaseConfig.firestoreDatabaseId}`);
  console.log('==================================================\n');

  const permConfig = getPermanentConfig();
  const dbPath = path.join(process.cwd(), 'database.json');

  let existingDb: any = {
    config: {},
    files: [],
    logs: [],
    vaults: DEFAULT_VAULTS,
  };

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      if (raw.trim()) {
        existingDb = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Warning reading database.json:', e);
    }
  }

  // Merge config with permConfig and environment
  existingDb.config = {
    website_name: existingDb.config?.website_name || permConfig.website_name || 'RULLZYE CLOUD',
    telegram_bot_token: existingDb.config?.telegram_bot_token || permConfig.telegram_bot_token,
    telegram_chat_id: existingDb.config?.telegram_chat_id || permConfig.telegram_chat_id,
    telegram_topic_id: existingDb.config?.telegram_topic_id || permConfig.telegram_topic_id || '10',
    admin_pin_hash: existingDb.config?.admin_pin_hash || '$2b$10$f55QYLGL/sbx2QVjFAt.eO6Kk0YgS4/34EwxCSgnFcJXInekKVQgK',
    failed_pin_attempts: 0,
    lockout_until: 0,
    ad_monetization_enabled: existingDb.config?.ad_monetization_enabled !== undefined ? existingDb.config.ad_monetization_enabled : true,
    ad_popunder_rate: existingDb.config?.ad_popunder_rate || 50,
    ad_popunder_url: existingDb.config?.ad_popunder_url || 'https://www.effectivecpmnetwork.com/sv8uijg31e?key=5918d8d0c31b1eba4b09e7d30f3179a9',
    ad_banner_top_html: existingDb.config?.ad_banner_top_html || '',
    ad_player_overlay_html: existingDb.config?.ad_player_overlay_html || '',
    ad_native_html: existingDb.config?.ad_native_html || '',
    imagekit_public_key: existingDb.config?.imagekit_public_key || permConfig.imagekit_public_key || 'public_ik_rullzye_9281a7b4c',
    imagekit_private_key: existingDb.config?.imagekit_private_key || permConfig.imagekit_private_key || 'private_ik_rullzye_84f932e1a6c0b',
    imagekit_url_endpoint: existingDb.config?.imagekit_url_endpoint || permConfig.imagekit_url_endpoint || 'https://ik.imagekit.io/rullzyecloud',
    imagekit_enabled: existingDb.config?.imagekit_enabled !== undefined ? existingDb.config.imagekit_enabled : true,
    imagekit_default_folder: existingDb.config?.imagekit_default_folder || permConfig.imagekit_default_folder || '/rullzye_cloud',
  };

  if (!Array.isArray(existingDb.files)) {
    existingDb.files = [];
  }
  if (!Array.isArray(existingDb.logs)) {
    existingDb.logs = [];
  }
  if (!Array.isArray(existingDb.vaults) || existingDb.vaults.length === 0) {
    existingDb.vaults = DEFAULT_VAULTS;
  }

  // Push to Firestore collection 'app_data' -> doc 'main'
  console.log(`Writing payload to Firestore (files: ${existingDb.files.length}, logs: ${existingDb.logs.length}, vaults: ${existingDb.vaults.length})...`);
  const docRef = doc(firestoreDb, 'app_data', 'main');
  await setDoc(docRef, existingDb);

  // Also push a dedicated 'config' document for instant access
  const configDocRef = doc(firestoreDb, 'app_data', 'config');
  await setDoc(configDocRef, existingDb.config);

  console.log('✅ Successfully pushed to Firestore!');

  // Verify by reading back
  console.log('Verifying read from Firestore...');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    console.log(`✅ Verified Firestore data! Files count: ${data.files?.length}, Config website: ${data.config?.website_name}`);
  } else {
    console.error('❌ Failed to verify document in Firestore');
  }

  console.log('\n==================================================');
  console.log('🎉 Firestore Synchronization Complete!');
  console.log('==================================================');
  process.exit(0);
}

pushToFirestore().catch((err) => {
  console.error('❌ Fatal error pushing to Firestore:', err);
  process.exit(1);
});
