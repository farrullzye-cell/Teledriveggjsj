import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, addFileRecord, addLog, determineFileType, checkFileExists, getVaults, updateVault } from '@/lib/excel-db';
import { uploadToTelegram, uploadPhotoToTelegram } from '@/lib/telegram';
import { uploadFileBufferToDrive, getGoogleDriveConfig, ensureDriveVaultFolders, makeDriveFilePublic } from '@/lib/google-drive-server';
import { getDriveAccessToken } from '@/lib/google-drive';
import { pollUpdatesOnce, startBackgroundPoller } from '@/lib/bot-poller';

export const dynamic = 'force-dynamic';

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100MB default

export async function GET(req: NextRequest) {
  try {
    // Start background polling loop every 2s and check updates immediately
    startBackgroundPoller(2000);
    pollUpdatesOnce().catch(() => {});

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'ALL';
    const vaultId = searchParams.get('vault_id') || searchParams.get('vaultId') || 'ALL';

    const files = await getFiles(search, type, vaultId);
    return NextResponse.json({ success: true, files });
  } catch (err: any) {
    console.error('Get files error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil daftar file: ' + err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = await getConfigMap();
    const driveConfig = await getGoogleDriveConfig();
    const authHeader = req.headers.get('Authorization');
    let driveToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
    if (!driveToken) {
      driveToken = getDriveAccessToken() || '';
    }

    const hasDrive = Boolean(driveToken);
    const hasTelegram = Boolean(config.telegram_bot_token && config.telegram_chat_id);

    if (!hasDrive && !hasTelegram) {
      return NextResponse.json(
        {
          success: false,
          message: 'Layanan Storage belum dikonfigurasi. Hubungkan Google Drive (Penyimpanan Utama Vault) atau atur Telegram Bot.',
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const remoteUrl = (formData.get('remote_url') as string) || (formData.get('source_url') as string) || (formData.get('terabox_url') as string) || '';
    const vaultId = (formData.get('vault_id') as string) || (formData.get('vaultId') as string) || 'vault_general';
    const vaults = await getVaults();
    const targetVault = vaults.find((v) => v.id === vaultId) || vaults[0] || {
      id: 'vault_general',
      name: 'General Storage',
      description: 'Default Storage',
      topic_id: config.telegram_topic_id || '',
    };
    const topicIdToSend = targetVault?.topic_id || config.telegram_topic_id || undefined;
    const targetDriveFolderId = targetVault?.gdrive_folder_id || driveConfig.folder_id || 'root';

    const filesToUpload: File[] = [];

    // Support remote URL download & upload to Google Drive Vault
    if (remoteUrl) {
      const cleanRemoteUrl = remoteUrl.trim();
      
      if (!cleanRemoteUrl.startsWith('http://') && !cleanRemoteUrl.startsWith('https://')) {
        return NextResponse.json({
          success: false,
          message: 'URL harus dimulai dengan http:// atau https://',
        }, { status: 400 });
      }

      try {
        new URL(cleanRemoteUrl);
      } catch {
        return NextResponse.json({
          success: false,
          message: 'Format URL tidak valid',
        }, { status: 400 });
      }

      const isTerabox = /terabox\.(com|net)|teraboxapp\.com|tba\.link/i.test(cleanRemoteUrl);
      const targetName = ((formData.get('custom_name') as string) || (formData.get('customName') as string) || '').trim() || cleanRemoteUrl.split('/').pop() || 'remote_file';
      
      console.log(`[API-FILES] Downloading remote url to Drive Vault: ${cleanRemoteUrl}`);
      
      try {
        const fetchRes = await fetch(cleanRemoteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        if (!fetchRes.ok) {
          throw new Error(`Gagal mengunduh berkas dari sumber URL (${fetchRes.status})`);
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = fetchRes.headers.get('content-type') || 'application/octet-stream';
        const fileType = determineFileType(targetName, mime);

        let gdriveFileId = '';
        let gdriveUrl = '';
        let gdriveWebLink = '';

        if (hasDrive) {
          const driveItem = await uploadFileBufferToDrive(driveToken, {
            buffer,
            name: targetName,
            mimeType: mime,
            parentFolderId: targetDriveFolderId,
          });
          gdriveFileId = driveItem.id;
          gdriveUrl = `https://drive.google.com/uc?export=download&id=${driveItem.id}`;
          gdriveWebLink = driveItem.webViewLink || `https://drive.google.com/file/d/${driveItem.id}/view`;
        }

        const record = await addFileRecord({
          name: targetName,
          type: fileType,
          mime,
          size: buffer.byteLength,
          gdrive_file_id: gdriveFileId,
          gdrive_url: gdriveUrl || cleanRemoteUrl,
          gdrive_web_link: gdriveWebLink,
          gdrive_folder_id: targetDriveFolderId,
          telegram_file_id: gdriveFileId ? `gdrive_${gdriveFileId}` : '',
          telegram_chat_id: config.telegram_chat_id || '',
          storage_provider: 'gdrive',
          vault_id: targetVault.id,
          vault_name: targetVault.name,
          source_url: cleanRemoteUrl,
          terabox_url: isTerabox ? cleanRemoteUrl : '',
        } as any);

        await addLog('REMOTE_GDRIVE_UPLOAD', targetName, 'SUCCESS');

        return NextResponse.json({
          success: true,
          message: `Berkas URL berhasil diunggah ke Google Drive Vault [${targetVault.name}]`,
          file: record,
          provider: 'gdrive',
        });
      } catch (remErr: any) {
        console.error('Remote upload to Drive failed:', remErr);
        return NextResponse.json({
          success: false,
          message: 'Gagal mengunggah remote URL ke Google Drive: ' + remErr.message,
        }, { status: 400 });
      }
    }

    // Support single 'file' or multiple 'files' fields
    const singleFile = formData.get('file') as File | null;
    if (singleFile && singleFile.size > 0) {
      filesToUpload.push(singleFile);
    }

    const multiFiles = formData.getAll('files') as File[];
    for (const f of multiFiles) {
      if (f && f.size > 0) {
        if (!filesToUpload.some((existingF) => existingF.name === f.name && existingF.size === f.size)) {
          filesToUpload.push(f);
        }
      }
    }

    if (filesToUpload.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada file yang diunggah' },
        { status: 400 }
      );
    }

    const customNameInput = ((formData.get('custom_name') as string) || (formData.get('customName') as string) || '').trim();
    const keepOriginalName = formData.get('keep_original_name') === 'true' || formData.get('keepOriginalName') === 'true';

    // Fetch existing files in target vault for auto sequence calculations
    const vaultFiles = await getFiles('', 'ALL', targetVault.id);
    const vaultNameClean = (targetVault?.name || 'Storage').trim();

    let maxSeqNumber = 0;
    const vaultRegex = new RegExp(`^${vaultNameClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s+(\\d+)`, 'i');
    for (const vf of vaultFiles) {
      const match = vf.name.match(vaultRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeqNumber) {
          maxSeqNumber = num;
        }
      }
    }
    let currentSeq = maxSeqNumber > 0 ? maxSeqNumber : vaultFiles.length;

    const uploadedRecords = [];
    const errors = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];

      if (file.size > MAX_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        errors.push(`File ${file.name} (${sizeMb} MB) melebihi batas upload ${MAX_SIZE / (1024 * 1024)} MB.`);
        await addLog('UPLOAD', file.name, 'FAILED_SIZE_EXCEEDED');
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const originalName = file.name || 'file_' + Date.now();
      const mime = file.type || 'application/octet-stream';

      const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? `.${extMatch[1]}` : '';

      let filename = originalName;
      if (customNameInput) {
        if (filesToUpload.length > 1) {
          const cleanCustom = customNameInput.replace(/\.[a-zA-Z0-9]+$/, '');
          filename = `${cleanCustom} ${i + 1}${ext}`;
        } else {
          filename = customNameInput.match(/\.[a-zA-Z0-9]+$/) ? customNameInput : `${customNameInput}${ext}`;
        }
      } else if (keepOriginalName) {
        filename = originalName;
      } else {
        currentSeq++;
        filename = `${vaultNameClean} ${currentSeq}${ext}`;
      }

      const fileType = determineFileType(filename, mime);

      // Check for duplicate file
      const existing = await checkFileExists(filename, file.size);
      if (existing) {
        uploadedRecords.push(existing);
        errors.push(`File ${filename} sudah ada di storage (duplikat diabaikan).`);
        await addLog('UPLOAD', filename, 'SKIPPED_DUPLICATE');
        continue;
      }

      let gdriveFileId = '';
      let gdriveUrl = '';
      let gdriveWebLink = '';
      let gdriveThumbnailUrl = '';
      let telegramFileId = '';
      let telegramMessageId = '';
      let storageProvider: 'gdrive' | 'telegram' | 'both' = 'gdrive';

      // 1. PRIMARY: Upload directly to Google Drive Vault folder
      if (hasDrive) {
        try {
          const driveItem = await uploadFileBufferToDrive(driveToken, {
            buffer,
            name: filename,
            mimeType: mime,
            parentFolderId: targetDriveFolderId,
          });

          if (driveItem && driveItem.id) {
            gdriveFileId = driveItem.id;
            gdriveUrl = `https://drive.google.com/uc?export=download&id=${driveItem.id}`;
            gdriveWebLink = driveItem.webViewLink || `https://drive.google.com/file/d/${driveItem.id}/view`;
            gdriveThumbnailUrl = driveItem.thumbnailLink || '';
            storageProvider = 'gdrive';
            await addLog('GDRIVE_UPLOAD', filename, 'SUCCESS');
          }
        } catch (driveErr: any) {
          console.warn('Google Drive primary upload notice:', driveErr.message);
          errors.push(`Google Drive upload notice (${filename}): ${driveErr.message}`);
        }
      }

      // 2. BACKUP / FALLBACK: Send to Telegram storage topic
      if (hasTelegram && (!gdriveFileId || config.gdrive_auto_backup)) {
        try {
          if (file.size <= 52428800) {
            const tgRes = await uploadToTelegram(
              config.telegram_bot_token,
              config.telegram_chat_id,
              buffer,
              filename,
              mime,
              topicIdToSend
            );

            if (tgRes.ok && tgRes.file_id) {
              telegramFileId = tgRes.file_id;
              telegramMessageId = tgRes.message_id || '';
              if (gdriveFileId) {
                storageProvider = 'both';
              } else {
                storageProvider = 'telegram';
              }
              await addLog('TELEGRAM_BACKUP_UPLOAD', filename, 'SUCCESS');
            }
          }
        } catch (tgErr: any) {
          console.warn('Telegram backup send failed:', tgErr.message);
        }
      }

      if (!gdriveFileId && !telegramFileId) {
        errors.push(`Gagal mengunggah ${filename}: Google Drive dan Telegram tidak dapat dijangkau.`);
        await addLog('UPLOAD', filename, 'FAILED_ALL_PROVIDERS');
        continue;
      }

      // Handle thumbnail
      let thumbnailFileId: string | undefined = undefined;
      let thumbnailBase64: string | undefined = undefined;

      const thumbnailFile = (formData.get(`thumbnail_${i}`) as File) || (formData.get('thumbnail') as File);
      const thumbnailBase64Input =
        (formData.get(`thumbnail_base64_${i}`) as string) || (formData.get('thumbnail_base64') as string);

      if (thumbnailFile && typeof thumbnailFile.arrayBuffer === 'function') {
        try {
          const thumbBytes = await thumbnailFile.arrayBuffer();
          const thumbBuffer = Buffer.from(thumbBytes);

          if (hasDrive) {
            const thumbDrive = await uploadFileBufferToDrive(driveToken, {
              buffer: thumbBuffer,
              name: `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`,
              mimeType: 'image/jpeg',
              parentFolderId: targetDriveFolderId,
            });
            if (thumbDrive && thumbDrive.thumbnailLink) {
              gdriveThumbnailUrl = thumbDrive.thumbnailLink;
            }
          }

          if (hasTelegram) {
            const thumbTgRes = await uploadPhotoToTelegram(
              config.telegram_bot_token,
              config.telegram_chat_id,
              thumbBuffer,
              `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`,
              topicIdToSend
            );
            if (thumbTgRes.ok && thumbTgRes.file_id) {
              thumbnailFileId = thumbTgRes.file_id;
            }
          }
        } catch (e) {
          console.warn('Failed uploading thumbnail file:', e);
        }
      } else if (thumbnailBase64Input && thumbnailBase64Input.startsWith('data:image/')) {
        thumbnailBase64 = thumbnailBase64Input.length < 50000 ? thumbnailBase64Input : undefined;
      }

      if (fileType === 'image' && telegramFileId && !thumbnailFileId) {
        thumbnailFileId = telegramFileId;
      }

      // Save metadata to Firestore
      const record = await addFileRecord({
        name: filename,
        type: fileType,
        mime,
        size: file.size,
        gdrive_file_id: gdriveFileId || undefined,
        gdrive_url: gdriveUrl || undefined,
        gdrive_web_link: gdriveWebLink || undefined,
        gdrive_thumbnail_url: gdriveThumbnailUrl || undefined,
        gdrive_folder_id: targetDriveFolderId,
        telegram_file_id: telegramFileId || (gdriveFileId ? `gdrive_${gdriveFileId}` : ''),
        telegram_message_id: telegramMessageId,
        telegram_chat_id: config.telegram_chat_id || '',
        vault_id: targetVault.id,
        vault_name: targetVault.name,
        thumbnail_file_id: thumbnailFileId,
        thumbnail_base64: thumbnailBase64,
        source_url: gdriveUrl || undefined,
        storage_provider: storageProvider,
      });

      uploadedRecords.push(record);
      await addLog('UPLOAD_SUCCESS', filename, `STORED_${storageProvider.toUpperCase()}`);
    }

    if (uploadedRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal mengunggah file. ' + errors.join(' '),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengunggah ${uploadedRecords.length} file ke Google Drive Vault [${targetVault.name}].`,
      files: uploadedRecords,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat upload: ' + err.message },
      { status: 500 }
    );
  }
}

