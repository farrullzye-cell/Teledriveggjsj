/**
 * CLI Script: Migrate Legacy Telegram Files to ImageKit.io CDN
 * Usage:
 *   bun run scripts/migrate-to-imagekit.ts [--dry-run] [--limit=20]
 */

import { getFiles, getConfigMap, updateFileRecord, getPermanentConfig } from '../lib/excel-db';
import { getTelegramFileStream } from '../lib/telegram';
import { uploadToImageKit, getImageKitCredentials } from '../lib/imagekit';
import { resolveRemoteSourceUrl } from '../lib/remote-source';

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
    (f) => (!f.imagekit_url || !f.imagekit_file_id) && Boolean(f.telegram_file_id || f.source_url || f.terabox_url || f.remote_url)
  );

  console.log(`📊 Ditemukan ${legacyFiles.length} file legacy di Telegram.`);

  const batch = legacyFiles.slice(0, limit);

  if (isDryRun) {
    console.log('\n[DRY RUN] Daftar file yang akan dimigrasikan:');
    batch.forEach((f, idx) => {
      const sourceLabel = f.telegram_file_id ? `TG: ${f.telegram_file_id.substring(0, 15)}...` : (f.terabox_url || f.source_url || f.remote_url || 'REMOTE');
      console.log(`  ${idx + 1}. [${f.id}] ${f.name} (${(f.size / 1024).toFixed(1)} KB) - ${sourceLabel}`);
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
      if (!file.telegram_file_id && !(file.source_url || file.terabox_url || file.remote_url)) {
        console.log('❌ File tidak memiliki source Telegram atau URL remote yang valid.');
        failCount++;
        continue;
      }

      if (file.telegram_file_id) {
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
        continue;
      }

      const remoteUrl = file.terabox_url || file.source_url || file.remote_url || '';
      if (!remoteUrl) {
        console.log('❌ URL remote tidak valid.');
        failCount++;
        continue;
      }

      const resolvedRemoteUrl = await resolveRemoteSourceUrl(remoteUrl);
      if (!resolvedRemoteUrl) {
        console.log('❌ Gagal mengekstrak URL download resmi Terabox.');
        failCount++;
        continue;
      }

      const response = await fetch(resolvedRemoteUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          Accept: 'application/octet-stream,*/*;q=0.8',
        },
      });
      if (!response.ok) {
        console.log(`❌ Gagal mengunduh URL remote: ${response.status}`);
        failCount++;
        continue;
      }

      const remoteBuffer = Buffer.from(await response.arrayBuffer());

      const ikRes = await uploadToImageKit({
        file: remoteBuffer,
        fileName: file.name,
        folder: `/rullzye_cloud/${(file.vault_name || 'General').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        tags: ['cli_migrated', 'remote_source', file.type],
        useUniqueFileName: true,
      });

      if (!ikRes.ok || !ikRes.url) {
        console.log(`❌ Gagal upload remote ke ImageKit: ${ikRes.error}`);
        failCount++;
        continue;
      }

      await updateFileRecord(file.id, {
        imagekit_file_id: ikRes.fileId,
        imagekit_url: ikRes.url,
        imagekit_thumbnail_url: ikRes.thumbnailUrl || ikRes.url,
        imagekit_path: ikRes.filePath,
        storage_provider: 'both',
        source_url: remoteUrl,
        terabox_url: remoteUrl,
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
