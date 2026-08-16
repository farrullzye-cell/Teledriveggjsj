import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, addFileRecord, addLog, determineFileType, checkFileExists, getVaults } from '@/lib/excel-db';
import { uploadToTelegram, uploadPhotoToTelegram } from '@/lib/telegram';
import { uploadToImageKit, uploadThumbnailToImageKit, generateImageKitThumbnailUrl, getImageKitCredentials, uploadRemoteUrlToImageKit } from '@/lib/imagekit';
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
    const imagekitCreds = await getImageKitCredentials();

    const hasImageKit = Boolean(imagekitCreds.publicKey && imagekitCreds.privateKey && imagekitCreds.urlEndpoint);
    const hasTelegram = Boolean(config.telegram_bot_token && config.telegram_chat_id);

    if (!hasImageKit && !hasTelegram) {
      return NextResponse.json(
        {
          success: false,
          message: 'Layanan Storage belum dikonfigurasi. Silakan atur ImageKit.io (Primary Media Storage) atau Telegram Bot di menu Setup.',
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

    const filesToUpload: File[] = [];

    if (remoteUrl) {
      const cleanRemoteUrl = remoteUrl.trim();
      
      // Validate remote URL format
      if (!cleanRemoteUrl.startsWith('http://') && !cleanRemoteUrl.startsWith('https://')) {
        return NextResponse.json({
          success: false,
          message: 'URL harus dimulai dengan http:// atau https://',
        }, { status: 400 });
      }

      try {
        new URL(cleanRemoteUrl); // Validate URL format
      } catch {
        return NextResponse.json({
          success: false,
          message: 'Format URL tidak valid',
        }, { status: 400 });
      }

      const isTerabox = /terabox\.(com|net)|teraboxapp\.com|tba\.link/i.test(cleanRemoteUrl);
      const targetName = ((formData.get('custom_name') as string) || (formData.get('customName') as string) || '').trim() || cleanRemoteUrl.split('/').pop() || 'remote_file';
      
      console.log(`[API-FILES] Starting remote upload: ${isTerabox ? 'Terabox' : 'Direct'} - ${targetName}`);
      
      const remoteUpload = await uploadRemoteUrlToImageKit({
        remoteUrl: cleanRemoteUrl,
        fileName: targetName,
        folder: `${imagekitCreds.defaultFolder}/${targetVault.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        tags: ['remote_source', isTerabox ? 'terabox' : 'direct_link', 'web_upload'],
        useUniqueFileName: true,
      });

      if (remoteUpload.ok && remoteUpload.url) {
        const finalName = targetName.includes('.') ? targetName : `${targetName}${cleanRemoteUrl.includes('.pdf') ? '.pdf' : cleanRemoteUrl.includes('.mp4') || cleanRemoteUrl.includes('.webm') || cleanRemoteUrl.includes('.mkv') ? '.mp4' : ''}`;
        const record = await addFileRecord({
          name: finalName,
          type: determineFileType(finalName, remoteUpload.mime || 'application/octet-stream'),
          mime: remoteUpload.mime || 'application/octet-stream',
          size: Number(remoteUpload.size || 0),
          telegram_file_id: '',
          telegram_message_id: '',
          telegram_chat_id: config.telegram_chat_id || '',
          imagekit_file_id: remoteUpload.fileId,
          imagekit_url: remoteUpload.url,
          imagekit_thumbnail_url: remoteUpload.thumbnailUrl || remoteUpload.url,
          imagekit_path: remoteUpload.filePath || '',
          storage_provider: 'imagekit',
          vault_id: targetVault.id,
          vault_name: targetVault.name,
          source_url: cleanRemoteUrl,
          terabox_url: isTerabox ? cleanRemoteUrl : '',
        } as any);

        await addLog('REMOTE_SOURCE_UPLOAD', finalName, 'SUCCESS');
        console.log(`[API-FILES] Remote upload completed: ${finalName}`);
        
        return NextResponse.json({
          success: true,
          message: `${isTerabox ? 'Terabox' : 'Remote'} video berhasil diunggah ke ImageKit.io`,
          file: record,
          url: remoteUpload.url,
          provider: 'imagekit',
          size: remoteUpload.size,
        });
      }

      console.error(`[API-FILES] Remote upload failed: ${remoteUpload.error}`);
      await addLog('REMOTE_SOURCE_UPLOAD', targetName, 'FAILED');
      return NextResponse.json({
        success: false,
        message: remoteUpload.error || 'Remote source upload gagal. Periksa URL dan coba lagi.',
        error_detail: remoteUpload.error,
      }, { status: 400 });
    }

    // Support single 'file' or multiple 'files' fields
    const singleFile = formData.get('file') as File | null;
    if (singleFile && singleFile.size > 0) {
      filesToUpload.push(singleFile);
    }

    const multiFiles = formData.getAll('files') as File[];
    for (const f of multiFiles) {
      if (f && f.size > 0) {
        // Prevent duplicate entry if singleFile is already the same object
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

    // Calculate max sequence number matching "VaultName N"
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

      // Extract file extension
      const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? `.${extMatch[1]}` : '';

      // Determine final filename based on user input, keep original name flag, or vault sequence
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
        // Auto-name according to Vault Name sequence (e.g. RULLZYE 1, RULLZYE 2)
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

      let imagekitFileId = '';
      let imagekitUrl = '';
      let imagekitThumbnailUrl = '';
      let imagekitPath = '';
      let telegramFileId = '';
      let telegramMessageId = '';
      let storageProvider: 'imagekit' | 'telegram' | 'both' = 'imagekit';

      // 1. PRIMARY: Upload to ImageKit if configured
      if (hasImageKit) {
        const ikRes = await uploadToImageKit({
          file: buffer,
          fileName: filename,
          folder: `${imagekitCreds.defaultFolder}/${targetVault.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          tags: ['web_upload', fileType, targetVault.name],
          useUniqueFileName: true,
        });

        if (ikRes.ok && ikRes.url) {
          imagekitFileId = ikRes.fileId || '';
          imagekitUrl = ikRes.url;
          imagekitThumbnailUrl = ikRes.thumbnailUrl || ikRes.url;
          imagekitPath = ikRes.filePath || '';
          storageProvider = 'imagekit';
          await addLog('IMAGEKIT_UPLOAD', filename, 'SUCCESS');
        } else {
          console.warn('ImageKit primary upload failed:', ikRes.error);
          errors.push(`ImageKit upload failed (${filename}): ${ikRes.error}`);
        }
      }

      // 2. FALLBACK ONLY: Send to Telegram storage topic ONLY if ImageKit failed or unavailable
      if (!imagekitUrl && hasTelegram) {
        try {
          if (file.size <= 52428800) {
            // Under 50MB official Bot API limit
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
              storageProvider = 'telegram';
              await addLog('TELEGRAM_FALLBACK_UPLOAD', filename, 'SUCCESS');
            } else {
              console.warn('Telegram fallback upload failed:', tgRes.error);
            }
          }
        } catch (tgErr: any) {
          console.warn('Telegram fallback send failed:', tgErr.message);
        }
      }

      // Ensure at least one storage succeeded
      if (!imagekitUrl && !telegramFileId) {
        errors.push(`Gagal mengunggah ${filename}: Penyimpanan ImageKit tidak merespon. Telegram fallback juga gagal.`);
        await addLog('UPLOAD', filename, 'FAILED_ALL_PROVIDERS');
        continue;
      }

      // Handle thumbnail processing
      let thumbnailFileId: string | undefined = undefined;
      let thumbnailBase64: string | undefined = undefined;

      const thumbnailFile = (formData.get(`thumbnail_${i}`) as File) || (formData.get('thumbnail') as File);
      const thumbnailBase64Input =
        (formData.get(`thumbnail_base64_${i}`) as string) || (formData.get('thumbnail_base64') as string);

      if (thumbnailFile && typeof thumbnailFile.arrayBuffer === 'function') {
        try {
          const thumbBytes = await thumbnailFile.arrayBuffer();
          const thumbBuffer = Buffer.from(thumbBytes);

          // 1. PRIMARY: Upload thumbnail image directly to ImageKit.io
          if (hasImageKit) {
            const ikThumbRes = await uploadThumbnailToImageKit({
              file: thumbBuffer,
              fileName: `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`,
              folder: `${imagekitCreds.defaultFolder}/thumbnails`,
              tags: ['custom_thumbnail', fileType, targetVault.name],
            });
            if (ikThumbRes.ok && ikThumbRes.url) {
              imagekitThumbnailUrl = ikThumbRes.thumbnailUrl || ikThumbRes.url;
            }
          }

          // 2. FALLBACK: Telegram thumbnail only if ImageKit thumbnail failed
          if (!imagekitThumbnailUrl && hasTelegram) {
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

        // Upload base64 thumbnail directly to ImageKit.io
        if (hasImageKit) {
          try {
            const ikThumbRes = await uploadThumbnailToImageKit({
              file: thumbnailBase64Input,
              fileName: `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`,
              folder: `${imagekitCreds.defaultFolder}/thumbnails`,
              tags: ['base64_thumbnail', fileType, targetVault.name],
            });
            if (ikThumbRes.ok && ikThumbRes.url) {
              imagekitThumbnailUrl = ikThumbRes.thumbnailUrl || ikThumbRes.url;
            }
          } catch (err) {
            console.warn('Failed uploading base64 thumbnail to ImageKit:', err);
          }
        }
      }

      // If no custom thumbnail was provided, derive high-quality ImageKit thumbnail URL
      if (!imagekitThumbnailUrl && imagekitUrl) {
        imagekitThumbnailUrl = generateImageKitThumbnailUrl(imagekitUrl, fileType);
      } else if (fileType === 'image' && telegramFileId) {
        thumbnailFileId = telegramFileId;
      }

      // Save metadata to Firestore / Excel DB
      const record = await addFileRecord({
        name: filename,
        type: fileType,
        mime,
        size: file.size,
        telegram_file_id: telegramFileId,
        telegram_message_id: telegramMessageId,
        telegram_chat_id: config.telegram_chat_id || '',
        vault_id: targetVault.id,
        vault_name: targetVault.name,
        thumbnail_file_id: thumbnailFileId,
        thumbnail_base64: thumbnailBase64,
        imagekit_file_id: imagekitFileId || undefined,
        imagekit_url: imagekitUrl || undefined,
        imagekit_thumbnail_url: imagekitThumbnailUrl || undefined,
        imagekit_path: imagekitPath || undefined,
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
      message: `Berhasil mengunggah ${uploadedRecords.length} file ke ImageKit Cloud.`,
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

