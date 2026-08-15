/**
 * CLI Script: Migrate Legacy Telegram Files to ImageKit.io CDN
 * Usage:
 *   bun run scripts/migrate-to-imagekit.ts [--dry-run] [--limit=20]
 */

import { getFiles, getConfigMap, updateFileRecord, getPermanentConfig } from '../lib/excel-db';
import { getTelegramFileStream } from '../lib/telegram';
import { uploadToImageKit, getImageKitCredentials } from '../lib/imagekit';

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

  console.log('========================================');
  console.log('🚀 ImageKit.io Storage Migration Utility');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulasi)' : 'LIVE MIGRATION'}`);
  console.log(`Limit: ${limit} file(s)`);
  console.log('========================================\n');

  const config = await getConfigMap();
  const permConfig = getPermanentConfig();
  const token = config.telegram_bot_token || permConfig.telegram_bot_token;

  if (!token) {
    console.error('❌ Error: Telegram Bot Token belum dikonfigurasi.');
    process.exit(1);
  }

  const allFiles = await getFiles('', 'ALL', 'ALL');
  const legacyFiles = allFiles.filter(
    (f) => (!f.imagekit_url || !f.imagekit_file_id) && Boolean(f.telegram_file_id)
  );

  console.log(`📊 Ditemukan ${legacyFiles.length} file legacy di Telegram.`);

  const batch = legacyFiles.slice(0, limit);

  if (isDryRun) {
    console.log('\n[DRY RUN] Daftar file yang akan dimigrasikan:');
    batch.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.id}] ${f.name} (${(f.size / 1024).toFixed(1)} KB) - TG: ${f.telegram_file_id.substring(0, 15)}...`);
    });
    console.log('\nSelesai simulasi. Jalankan tanpa --dry-run untuk memulai transfer.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < batch.length; i++) {
    const file = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] Memindahkan "${file.name}" ... `);

    try {
      const streamRes = await getTelegramFileStream(token, file.telegram_file_id);
      if (!streamRes.ok || !streamRes.response) {
        console.log(`❌ Gagal unduh dari Telegram: ${streamRes.error}`);
        failCount++;
        continue;
      }

      const arrBuf = await streamRes.response.arrayBuffer();
      const buffer = Buffer.from(arrBuf);

      const ikRes = await uploadToImageKit({
        file: buffer,
        fileName: file.name,
        folder: `/rullzye_cloud/${(file.vault_name || 'General').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        tags: ['cli_migrated', file.type],
        useUniqueFileName: true,
      });

      if (!ikRes.ok || !ikRes.url) {
        console.log(`❌ Gagal upload ke ImageKit: ${ikRes.error}`);
        failCount++;
        continue;
      }

      // Update record
      await updateFileRecord(file.id, {
        imagekit_file_id: ikRes.fileId,
        imagekit_url: ikRes.url,
        imagekit_thumbnail_url: ikRes.thumbnailUrl || ikRes.url,
        imagekit_path: ikRes.filePath,
        storage_provider: 'both',
      });

      console.log(`✅ OK (${ikRes.url})`);
      successCount++;
    } catch (err: any) {
      console.log(`❌ Exception: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Migrasi Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
  console.log('========================================');
}

run().catch((e) => {
  console.error('Fatal Migration Error:', e);
  process.exit(1);
});
