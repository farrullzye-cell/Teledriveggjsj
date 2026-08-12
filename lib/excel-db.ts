import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { uploadAutoBackupToTelegram, downloadTelegramFileAsJson } from './telegram';

const DB_PATH = path.join(process.cwd(), 'database.json');
const DB_BAK_PATH = path.join(process.cwd(), 'database.json.bak');
const DB_TMP_PATH = path.join(process.cwd(), 'database.json.tmp');
const CONFIG_FILE_PATH = path.join(process.cwd(), 'config.json');
const DEFAULT_PIN = '159357';

export interface PermanentConfig {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_topic_id?: string;
  last_backup_message_id?: string;
  last_backup_file_id?: string;
}

const DEFAULT_PERMANENT_CONFIG: PermanentConfig = {
  telegram_bot_token: '8642354242:AAEoyACLWYhjWcqC4jsD0c1NXNMQNoftqDg',
  telegram_chat_id: '-1004477537736',
  telegram_topic_id: '10',
  last_backup_message_id: '',
  last_backup_file_id: '',
};

export function getPermanentConfig(): PermanentConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        return {
          telegram_bot_token: parsed.telegram_bot_token || DEFAULT_PERMANENT_CONFIG.telegram_bot_token,
          telegram_chat_id: parsed.telegram_chat_id || DEFAULT_PERMANENT_CONFIG.telegram_chat_id,
          telegram_topic_id: parsed.telegram_topic_id || DEFAULT_PERMANENT_CONFIG.telegram_topic_id,
          last_backup_message_id: parsed.last_backup_message_id || '',
          last_backup_file_id: parsed.last_backup_file_id || '',
        };
      }
    }
  } catch (err) {
    console.error('Failed reading config.json:', err);
  }
  return DEFAULT_PERMANENT_CONFIG;
}

export function savePermanentConfig(updates: Partial<PermanentConfig>): PermanentConfig {
  const current = getPermanentConfig();
  const updated = { ...current, ...updates };
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing config.json:', err);
  }
  return updated;
}

export interface VaultTopic {
  id: string;
  name: string;
  topic_id?: string; // Telegram message_thread_id
  icon?: string; // Folder | Film | FileText | ShieldLock | Database | Sparkles
  color?: string; // amber | sky | emerald | rose | purple
  description?: string;
  is_private?: boolean;
  created_at: string;
}

export interface FileRecord {
  id: string;
  name: string;
  type: string; // image | video | document | archive | other
  mime: string;
  size: number;
  telegram_file_id: string;
  telegram_message_id: string;
  telegram_chat_id: string;
  uploaded_at: string;
  vault_id?: string;
  vault_name?: string;
}

export interface ConfigData {
  website_name: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  admin_pin_hash: string;
  failed_pin_attempts: number;
  lockout_until: number;
  telegram_topic_id?: string;
  ad_monetization_enabled?: boolean;
  ad_popunder_rate?: number; // 20, 30, 50, 100
  ad_popunder_url?: string;
  ad_banner_top_html?: string;
  ad_player_overlay_html?: string;
  ad_native_html?: string;
}

export interface LogRecord {
  id: string;
  date: string;
  action: string;
  filename: string;
  status: string;
}

export interface DatabaseSchema {
  config: ConfigData;
  files: FileRecord[];
  logs: LogRecord[];
  vaults?: VaultTopic[];
}

export const DEFAULT_VAULTS: VaultTopic[] = [
  {
    id: 'vault_general',
    name: 'General Storage',
    topic_id: '',
    icon: 'Folder',
    color: 'amber',
    description: 'Bilik penyimpanan utama untuk berkas umum',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'vault_media',
    name: 'Photos & Video',
    topic_id: '',
    icon: 'Film',
    color: 'sky',
    description: 'Bilik media khusus galeri foto HD dan rekaman video',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'vault_docs',
    name: 'Documents & Archives',
    topic_id: '',
    icon: 'FileText',
    color: 'emerald',
    description: 'Bilik dokumen PDF, ebook, spreadsheet, dan file kompresi',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'vault_secret',
    name: 'Encrypted Vault',
    topic_id: '',
    icon: 'ShieldLock',
    color: 'rose',
    is_private: true,
    description: 'Bilik rahasia dengan akses perlindungan PIN',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

let dbQueue: Promise<void> = Promise.resolve();

function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const currentQueue = dbQueue;
  let resolveQueue!: () => void;
  dbQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve;
  });

  return currentQueue
    .then(() => fn())
    .finally(() => {
      resolveQueue!();
    });
}

function getDefaultDatabase(): DatabaseSchema {
  const permConfig = getPermanentConfig();
  const initialHash = bcrypt.hashSync(DEFAULT_PIN, 10);
  return {
    config: {
      website_name: 'RULLZYE CLOUD',
      telegram_bot_token: permConfig.telegram_bot_token,
      telegram_chat_id: permConfig.telegram_chat_id,
      admin_pin_hash: initialHash,
      failed_pin_attempts: 0,
      lockout_until: 0,
      telegram_topic_id: permConfig.telegram_topic_id,
    },
    files: [],
    logs: [
      {
        id: '1',
        date: new Date().toISOString().split('T')[0],
        action: 'INIT_DB',
        filename: 'database.json',
        status: 'SUCCESS',
      },
    ],
    vaults: DEFAULT_VAULTS,
  };
}

export async function triggerAutoBackup(db?: DatabaseSchema): Promise<void> {
  try {
    const permConfig = getPermanentConfig();
    const token = db?.config?.telegram_bot_token || permConfig.telegram_bot_token;
    const chatId = db?.config?.telegram_chat_id || permConfig.telegram_chat_id;
    const topicId = db?.config?.telegram_topic_id || permConfig.telegram_topic_id;

    if (!token || !chatId) return;

    if (!db) {
      db = await loadDatabase();
    }

    const rawJson = JSON.stringify(db, null, 2);
    const oldMsgId = permConfig.last_backup_message_id || '';

    const res = await uploadAutoBackupToTelegram(token, chatId, rawJson, topicId, oldMsgId);

    if (res.ok && res.message_id) {
      savePermanentConfig({
        last_backup_message_id: res.message_id,
        last_backup_file_id: res.file_id || '',
      });
      console.log(`[AUTO-BACKUP] Database successfully backed up to Telegram (Msg ID #${res.message_id}). Old backup #${oldMsgId} deleted.`);
    }
  } catch (err) {
    console.error('[AUTO-BACKUP] Error backing up database to Telegram:', err);
  }
}

async function loadDatabase(): Promise<DatabaseSchema> {
  const permConfig = getPermanentConfig();

  // 1. Try reading from Google Cloud Firestore
  try {
    const docRef = doc(firestoreDb, 'app_data', 'main');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as DatabaseSchema;
      if (parsed && parsed.config && Array.isArray(parsed.files)) {
        if (!parsed.config.telegram_bot_token) parsed.config.telegram_bot_token = permConfig.telegram_bot_token;
        if (!parsed.config.telegram_chat_id) parsed.config.telegram_chat_id = permConfig.telegram_chat_id;
        if (!parsed.config.telegram_topic_id) parsed.config.telegram_topic_id = permConfig.telegram_topic_id;
        if (!parsed.vaults || parsed.vaults.length === 0) {
          parsed.vaults = DEFAULT_VAULTS;
        }
        return parsed;
      }
    }
  } catch (fsErr) {
    console.warn('[FIRESTORE-LOAD-WARN] Failed reading from Firestore, falling back to local/Telegram:', fsErr);
  }

  // 2. Try reading DB_PATH
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && parsed.config && Array.isArray(parsed.files)) {
          if (!parsed.config.telegram_bot_token) parsed.config.telegram_bot_token = permConfig.telegram_bot_token;
          if (!parsed.config.telegram_chat_id) parsed.config.telegram_chat_id = permConfig.telegram_chat_id;
          if (!parsed.config.telegram_topic_id) parsed.config.telegram_topic_id = permConfig.telegram_topic_id;
          if (!parsed.vaults || parsed.vaults.length === 0) {
            parsed.vaults = DEFAULT_VAULTS;
          }

          if (parsed.files.length > 0) {
            // Sync to Firestore asynchronously
            setDoc(doc(firestoreDb, 'app_data', 'main'), parsed).catch((e) => console.warn('Sync to firestore error:', e));
            return parsed;
          }

          // If files list is empty, attempt Telegram cloud restore if backup file exists
          if (permConfig.last_backup_file_id) {
            console.log('[AUTO-RESTORE] Attempting database restore from Telegram backup file_id:', permConfig.last_backup_file_id);
            const restoreRes = await downloadTelegramFileAsJson(permConfig.telegram_bot_token, permConfig.last_backup_file_id);
            if (restoreRes.ok && restoreRes.data && Array.isArray(restoreRes.data.files)) {
              console.log(`[AUTO-RESTORE] Restored ${restoreRes.data.files.length} files from Telegram Cloud Backup!`);
              const restoredDb = restoreRes.data as DatabaseSchema;
              restoredDb.config.telegram_bot_token = permConfig.telegram_bot_token;
              restoredDb.config.telegram_chat_id = permConfig.telegram_chat_id;
              restoredDb.config.telegram_topic_id = permConfig.telegram_topic_id;
              setDoc(doc(firestoreDb, 'app_data', 'main'), restoredDb).catch((e) => console.warn('Sync to firestore error:', e));
              try { fs.writeFileSync(DB_PATH, JSON.stringify(restoredDb, null, 2), 'utf-8'); } catch {}
              return restoredDb;
            }
          }

          // Sync to Firestore
          setDoc(doc(firestoreDb, 'app_data', 'main'), parsed).catch((e) => console.warn('Sync to firestore error:', e));
          return parsed;
        }
      }
    } catch (err) {
      console.warn('database.json corrupt, attempting backup...', err);
    }
  }

  // 3. Try reading DB_BAK_PATH
  if (fs.existsSync(DB_BAK_PATH)) {
    try {
      const raw = fs.readFileSync(DB_BAK_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && parsed.config && Array.isArray(parsed.files)) {
          if (!parsed.config.telegram_bot_token) parsed.config.telegram_bot_token = permConfig.telegram_bot_token;
          if (!parsed.config.telegram_chat_id) parsed.config.telegram_chat_id = permConfig.telegram_chat_id;
          if (!parsed.config.telegram_topic_id) parsed.config.telegram_topic_id = permConfig.telegram_topic_id;
          if (!parsed.vaults || parsed.vaults.length === 0) {
            parsed.vaults = DEFAULT_VAULTS;
          }
          setDoc(doc(firestoreDb, 'app_data', 'main'), parsed).catch((e) => console.warn('Sync to firestore error:', e));
          try { fs.writeFileSync(DB_PATH, raw, 'utf-8'); } catch {}
          return parsed;
        }
      }
    } catch {}
  }

  // 4. Attempt Telegram cloud restore on fresh/missing database
  if (permConfig.last_backup_file_id) {
    try {
      console.log('[AUTO-RESTORE] Fresh boot - restoring database from Telegram backup file_id:', permConfig.last_backup_file_id);
      const restoreRes = await downloadTelegramFileAsJson(permConfig.telegram_bot_token, permConfig.last_backup_file_id);
      if (restoreRes.ok && restoreRes.data && Array.isArray(restoreRes.data.files)) {
        console.log(`[AUTO-RESTORE] Restored ${restoreRes.data.files.length} files from Telegram Cloud Backup!`);
        const restoredDb = restoreRes.data as DatabaseSchema;
        restoredDb.config.telegram_bot_token = permConfig.telegram_bot_token;
        restoredDb.config.telegram_chat_id = permConfig.telegram_chat_id;
        restoredDb.config.telegram_topic_id = permConfig.telegram_topic_id;
        setDoc(doc(firestoreDb, 'app_data', 'main'), restoredDb).catch((e) => console.warn('Sync to firestore error:', e));
        try { fs.writeFileSync(DB_PATH, JSON.stringify(restoredDb, null, 2), 'utf-8'); } catch {}
        return restoredDb;
      }
    } catch (e) {
      console.warn('Auto restore failed on fresh start:', e);
    }
  }

  // 5. Fresh Default Database
  const freshDb = getDefaultDatabase();
  await saveDatabase(freshDb);
  return freshDb;
}


async function saveDatabase(db: DatabaseSchema): Promise<void> {
  try {
    // 1. Save to Google Cloud Firestore (Primary 24/7 Cloud Store)
    await setDoc(doc(firestoreDb, 'app_data', 'main'), db);

    // 2. Try local disk backup if filesystem is writable
    try {
      const raw = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_TMP_PATH, raw, 'utf-8');
      fs.copyFileSync(DB_TMP_PATH, DB_PATH);
      fs.copyFileSync(DB_TMP_PATH, DB_BAK_PATH);
      if (fs.existsSync(DB_TMP_PATH)) {
        try {
          fs.unlinkSync(DB_TMP_PATH);
        } catch {}
      }
    } catch (fsErr) {
      console.warn('[DISK-SAVE-NOTICE] Could not write to local disk (Read-Only / Serverless env). Firestore handles 100% persistence:', fsErr);
    }

    // 3. Otomatis lakukan auto-backup ke Telegram setiap data berubah & hapus backup lama
    triggerAutoBackup(db).catch((e) => console.error('Auto backup trigger error:', e));
  } catch (err) {
    console.error('Failed to save database to Firestore/Storage:', err);
    throw err;
  }
}

export async function getConfigMap(): Promise<ConfigData> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    return {
      website_name: db.config.website_name || 'RULLZYE CLOUD',
      telegram_bot_token: db.config.telegram_bot_token || '',
      telegram_chat_id: db.config.telegram_chat_id || '',
      admin_pin_hash: db.config.admin_pin_hash || bcrypt.hashSync(DEFAULT_PIN, 10),
      failed_pin_attempts: Number(db.config.failed_pin_attempts || 0),
      lockout_until: Number(db.config.lockout_until || 0),
      telegram_topic_id: db.config.telegram_topic_id || '',
      ad_monetization_enabled: db.config.ad_monetization_enabled !== undefined ? Boolean(db.config.ad_monetization_enabled) : true,
      ad_popunder_rate: db.config.ad_popunder_rate !== undefined ? Number(db.config.ad_popunder_rate) : 100,
      ad_popunder_url: (!db.config.ad_popunder_url || db.config.ad_popunder_url.includes('google.com')) 
        ? 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js' 
        : db.config.ad_popunder_url,
      ad_banner_top_html: db.config.ad_banner_top_html || `<div class="w-full max-w-[800px] aspect-[4/1] mx-auto overflow-hidden flex items-center justify-center bg-[#0f1422] border border-amber-500/30 rounded-2xl p-2 shadow-lg"><script async="async" data-cfasync="false" src="https://pl30817733.effectivecpmnetwork.com/4045af9e74f05790b727b7c208314777/invoke.js"></script><div id="container-4045af9e74f05790b727b7c208314777"></div></div>`,
      ad_player_overlay_html: db.config.ad_player_overlay_html || '',
      ad_native_html: db.config.ad_native_html || '',
    };
  });
}

export async function saveConfig(updates: {
  website_name?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  new_pin?: string;
  telegram_topic_id?: string;
  ad_monetization_enabled?: boolean;
  ad_popunder_rate?: number;
  ad_popunder_url?: string;
  ad_banner_top_html?: string;
  ad_player_overlay_html?: string;
  ad_native_html?: string;
}): Promise<ConfigData> {
  return withDbLock(async () => {
    const db = await loadDatabase();

    const permUpdates: Partial<PermanentConfig> = {};

    if (updates.website_name !== undefined && updates.website_name.trim() !== '') {
      db.config.website_name = updates.website_name.trim();
    }

    if (updates.telegram_bot_token !== undefined) {
      if (!updates.telegram_bot_token.startsWith('••••')) {
        db.config.telegram_bot_token = updates.telegram_bot_token.trim();
        permUpdates.telegram_bot_token = updates.telegram_bot_token.trim();
      }
    }

    if (updates.telegram_chat_id !== undefined) {
      db.config.telegram_chat_id = updates.telegram_chat_id.trim();
      permUpdates.telegram_chat_id = updates.telegram_chat_id.trim();
    }

    if (updates.telegram_topic_id !== undefined) {
      db.config.telegram_topic_id = updates.telegram_topic_id.trim();
      permUpdates.telegram_topic_id = updates.telegram_topic_id.trim();
    }

    if (updates.ad_monetization_enabled !== undefined) {
      db.config.ad_monetization_enabled = Boolean(updates.ad_monetization_enabled);
    }

    if (updates.ad_popunder_rate !== undefined) {
      db.config.ad_popunder_rate = Number(updates.ad_popunder_rate);
    }

    if (updates.ad_popunder_url !== undefined) {
      db.config.ad_popunder_url = updates.ad_popunder_url.trim();
    }

    if (updates.ad_banner_top_html !== undefined) {
      db.config.ad_banner_top_html = updates.ad_banner_top_html;
    }

    if (updates.ad_player_overlay_html !== undefined) {
      db.config.ad_player_overlay_html = updates.ad_player_overlay_html;
    }

    if (updates.ad_native_html !== undefined) {
      db.config.ad_native_html = updates.ad_native_html;
    }

    if (Object.keys(permUpdates).length > 0) {
      savePermanentConfig(permUpdates);
    }

    if (updates.new_pin && updates.new_pin.trim().length >= 4) {
      db.config.admin_pin_hash = bcrypt.hashSync(updates.new_pin.trim(), 10);
    }

    db.logs.push({
      id: String(db.logs.length + 1),
      date: new Date().toISOString().split('T')[0],
      action: 'CONFIG_SAVE',
      filename: 'CONFIG',
      status: 'SUCCESS',
    });

    await saveDatabase(db);
    return db.config;
  });
}


export async function verifyPin(pin: string): Promise<{
  success: boolean;
  message: string;
  locked?: boolean;
  remainingMinutes?: number;
}> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    const lockoutUntil = Number(db.config.lockout_until || 0);
    const failedAttempts = Number(db.config.failed_pin_attempts || 0);
    const adminPinHash = db.config.admin_pin_hash || bcrypt.hashSync(DEFAULT_PIN, 10);

    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
      return {
        success: false,
        locked: true,
        remainingMinutes,
        message: `Terlalu banyak percobaan gagal. Akses terkunci selama ${remainingMinutes} menit lagi.`,
      };
    }

    const isValid = bcrypt.compareSync(pin, adminPinHash);

    if (isValid) {
      db.config.failed_pin_attempts = 0;
      db.config.lockout_until = 0;
      await saveDatabase(db);
      return { success: true, message: 'PIN Berhasil' };
    } else {
      const newAttempts = failedAttempts + 1;
      let locked = false;
      let newLockoutUntil = 0;

      if (newAttempts >= 5) {
        locked = true;
        newLockoutUntil = now + 15 * 60 * 1000; // 15 mins
      }

      db.config.failed_pin_attempts = newAttempts;
      db.config.lockout_until = newLockoutUntil;
      await saveDatabase(db);

      if (locked) {
        return {
          success: false,
          locked: true,
          remainingMinutes: 15,
          message: 'PIN salah 5 kali berturut-turut. Akses dikunci sementara selama 15 menit.',
        };
      }

      return {
        success: false,
        message: `PIN salah! Sisa percobaan: ${5 - newAttempts}`,
      };
    }
  });
}

export async function getFiles(search = '', type = 'ALL', vaultId = 'ALL'): Promise<FileRecord[]> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    let filtered = [...db.files];
    const targetType = type.toLowerCase();

    if (vaultId && vaultId !== 'ALL') {
      filtered = filtered.filter((f) => (f.vault_id || 'vault_general') === vaultId);
    }

    if (targetType === 'photos' || targetType === 'image' || targetType === 'images') {
      filtered = filtered.filter((f) => f.type === 'image');
    } else if (targetType === 'videos' || targetType === 'video') {
      filtered = filtered.filter((f) => f.type === 'video');
    } else if (targetType === 'files' || targetType === 'document' || targetType === 'documents') {
      filtered = filtered.filter((f) => f.type !== 'image' && f.type !== 'video');
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((f) => f.name.toLowerCase().includes(q));
    }

    return filtered.sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1));
  });
}

export async function getFileById(fileId: string): Promise<FileRecord | null> {
  const files = await getFiles();
  return files.find((f) => f.id === fileId) || null;
}

export async function checkFileExists(name: string, size: number): Promise<FileRecord | null> {
  const files = await getFiles();
  const nameLower = name.trim().toLowerCase();
  return files.find((f) => f.name.toLowerCase() === nameLower && f.size === size) || null;
}

export async function addFileRecord(
  fileData: Omit<FileRecord, 'id' | 'uploaded_at'>
): Promise<FileRecord & { isDuplicate?: boolean }> {
  return withDbLock(async () => {
    const db = await loadDatabase();

    // Check duplicate by telegram_file_id or exact name + size
    const existing = db.files.find(
      (f) =>
        (f.telegram_file_id && f.telegram_file_id === fileData.telegram_file_id) ||
        (f.name.toLowerCase() === fileData.name.toLowerCase() && f.size === fileData.size)
    );

    if (existing) {
      return { ...existing, isDuplicate: true };
    }

    const id = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const uploaded_at = new Date().toISOString();

    const vault_id = fileData.vault_id || 'vault_general';
    const vaultsList = db.vaults || DEFAULT_VAULTS;
    const targetVault = vaultsList.find((v) => v.id === vault_id) || vaultsList[0];

    const record: FileRecord = {
      id,
      ...fileData,
      uploaded_at,
      vault_id: targetVault.id,
      vault_name: targetVault.name,
    };

    db.files.push(record);
    await saveDatabase(db);
    return record;
  });
}

export async function restoreDatabaseFromJson(restoredData: Partial<DatabaseSchema>): Promise<{
  success: boolean;
  restoredFilesCount: number;
  message: string;
}> {
  return withDbLock(async () => {
    const currentDb = await loadDatabase();
    let restoredCount = 0;

    if (Array.isArray(restoredData.files) && restoredData.files.length > 0) {
      // Merge unique files
      const existingMap = new Map(currentDb.files.map((f) => [f.id, f]));
      for (const file of restoredData.files) {
        if (file && file.name && file.telegram_file_id) {
          const isDuplicate = currentDb.files.some(
            (f) => f.telegram_file_id === file.telegram_file_id || (f.name === file.name && f.size === file.size)
          );
          if (!isDuplicate) {
            currentDb.files.push(file);
            restoredCount++;
          }
        }
      }
    }

    if (restoredData.config) {
      if (restoredData.config.website_name && !currentDb.config.website_name) {
        currentDb.config.website_name = restoredData.config.website_name;
      }
      if (restoredData.config.telegram_bot_token && !currentDb.config.telegram_bot_token) {
        currentDb.config.telegram_bot_token = restoredData.config.telegram_bot_token;
      }
      if (restoredData.config.telegram_chat_id && !currentDb.config.telegram_chat_id) {
        currentDb.config.telegram_chat_id = restoredData.config.telegram_chat_id;
      }
    }

    await saveDatabase(currentDb);
    return {
      success: true,
      restoredFilesCount: restoredCount,
      message: `Berhasil memulihkan ${restoredCount} file baru dari Telegram Cloud Backup!`,
    };
  });
}

export async function deleteFileRecord(fileId: string): Promise<FileRecord | null> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    const index = db.files.findIndex((f) => f.id === fileId);

    if (index !== -1) {
      const removed = db.files.splice(index, 1)[0];
      await saveDatabase(db);
      return removed;
    }

    return null;
  });
}

export async function addLog(action: string, filename: string, status: string) {
  return withDbLock(async () => {
    try {
      const db = await loadDatabase();
      db.logs.push({
        id: String(db.logs.length + 1),
        date: new Date().toISOString().split('T')[0],
        action,
        filename,
        status,
      });
      await saveDatabase(db);
    } catch (err) {
      console.error('Error adding log to db:', err);
    }
  });
}

export function determineFileType(filename: string, mime: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeLower = mime.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimeLower.startsWith('image/')) {
    return 'image';
  }
  if (['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v'].includes(ext) || mimeLower.startsWith('video/')) {
    return 'video';
  }
  if (['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) || mimeLower.includes('pdf') || mimeLower.includes('document')) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeLower.includes('zip') || mimeLower.includes('compressed')) {
    return 'archive';
  }
  return 'other';
}

export async function getVaults(): Promise<VaultTopic[]> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    if (!db.vaults || db.vaults.length === 0) {
      db.vaults = DEFAULT_VAULTS;
      await saveDatabase(db);
    }
    return db.vaults;
  });
}

export async function addVault(vaultData: {
  name: string;
  topic_id?: string;
  icon?: string;
  color?: string;
  description?: string;
  is_private?: boolean;
}): Promise<VaultTopic> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    if (!db.vaults) db.vaults = [...DEFAULT_VAULTS];

    const id = 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newVault: VaultTopic = {
      id,
      name: vaultData.name,
      topic_id: vaultData.topic_id || '',
      icon: vaultData.icon || 'Folder',
      color: vaultData.color || 'amber',
      description: vaultData.description || '',
      is_private: !!vaultData.is_private,
      created_at: new Date().toISOString(),
    };

    db.vaults.push(newVault);
    await saveDatabase(db);
    return newVault;
  });
}

export async function updateVault(vaultId: string, updates: Partial<VaultTopic>): Promise<VaultTopic | null> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    if (!db.vaults) db.vaults = [...DEFAULT_VAULTS];

    const idx = db.vaults.findIndex((v) => v.id === vaultId);
    if (idx !== -1) {
      db.vaults[idx] = { ...db.vaults[idx], ...updates };
      await saveDatabase(db);
      return db.vaults[idx];
    }
    return null;
  });
}

export async function deleteVault(vaultId: string): Promise<boolean> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    if (!db.vaults) return false;

    const idx = db.vaults.findIndex((v) => v.id === vaultId);
    if (idx !== -1) {
      db.vaults.splice(idx, 1);
      for (const file of db.files) {
        if (file.vault_id === vaultId) {
          file.vault_id = 'vault_general';
          file.vault_name = 'General Storage';
        }
      }
      await saveDatabase(db);
      return true;
    }
    return false;
  });
}

export async function moveFileToVault(fileId: string, vaultId: string): Promise<FileRecord | null> {
  return withDbLock(async () => {
    const db = await loadDatabase();
    if (!db.vaults) db.vaults = [...DEFAULT_VAULTS];

    const vault = db.vaults.find((v) => v.id === vaultId) || db.vaults[0];
    const fileIndex = db.files.findIndex((f) => f.id === fileId);

    if (fileIndex !== -1) {
      db.files[fileIndex].vault_id = vault.id;
      db.files[fileIndex].vault_name = vault.name;
      await saveDatabase(db);
      return db.files[fileIndex];
    }
    return null;
  });
}
