import { NextRequest, NextResponse } from 'next/server';
import { getFiles, getConfigMap, addFileRecord, addLog, determineFileType, checkFileExists, getVaults } from '@/lib/excel-db';
import { uploadToTelegram, uploadPhotoToTelegram } from '@/lib/telegram';
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

    if (!config.telegram_bot_token || !config.telegram_chat_id) {
      return NextResponse.json(
        {
          success: false,
          message: 'Telegram Bot Token dan Storage Chat ID belum dikonfigurasi. Silakan atur terlebih dahulu di menu Setup.',
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const vaultId = (formData.get('vault_id') as string) || (formData.get('vaultId') as string) || 'vault_general';
    const vaults = await getVaults();
    const targetVault = vaults.find((v) => v.id === vaultId) || vaults[0];
    const topicIdToSend = targetVault?.topic_id || config.telegram_topic_id || undefined;

    const filesToUpload: File[] = [];

    // Support single 'file' or multiple 'files' fields
    const singleFile = formData.get('file') as File | null;
    if (singleFile && singleFile.size > 0) {
      filesToUpload.push(singleFile);
    }

    const multiFiles = formData.getAll('files') as File[];
    for (const f of multiFiles) {
      if (f && f.size > 0) {
        filesToUpload.push(f);
      }
    }

    if (filesToUpload.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada file yang diunggah' },
        { status: 400 }
      );
    }

    const customNameInput = ((formData.get('custom_name') as string) || (formData.get('customName') as string) || '').trim();

    // Fetch existing files in target vault for auto sequence calculations
    const vaultFiles = await getFiles('', 'ALL', targetVault.id);
    const vaultNameClean = targetVault.name.trim();

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
        errors.push(`File ${file.name} (${sizeMb} MB) melebihi batas maksimum 100 MB.`);
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

      // Determine final filename based on user input or vault sequence
      let filename = originalName;
      if (customNameInput) {
        if (filesToUpload.length > 1) {
          const cleanCustom = customNameInput.replace(/\.[a-zA-Z0-9]+$/, '');
          filename = `${cleanCustom} ${i + 1}${ext}`;
        } else {
          filename = customNameInput.match(/\.[a-zA-Z0-9]+$/) ? customNameInput : `${customNameInput}${ext}`;
        }
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

      // Upload buffer to Telegram Bot Topic
      const tgRes = await uploadToTelegram(
        config.telegram_bot_token,
        config.telegram_chat_id,
        buffer,
        filename,
        mime,
        topicIdToSend
      );

      if (!tgRes.ok || !tgRes.file_id) {
        errors.push(`Gagal upload ${filename} ke Telegram: ${tgRes.error || 'Unknown error'}`);
        await addLog('UPLOAD', filename, 'FAILED_TELEGRAM');
        continue;
      }

      // Handle thumbnail processing
      let thumbnailFileId: string | undefined = undefined;
      let thumbnailBase64: string | undefined = undefined;

      // 1. Check if user/client provided thumbnail blob or base64
      const thumbnailFile = formData.get(`thumbnail_${i}`) as File || formData.get('thumbnail') as File;
      const thumbnailBase64Input = (formData.get(`thumbnail_base64_${i}`) as string) || (formData.get('thumbnail_base64') as string);

      if (thumbnailFile && typeof thumbnailFile.arrayBuffer === 'function') {
        try {
          const thumbBytes = await thumbnailFile.arrayBuffer();
          const thumbBuffer = Buffer.from(thumbBytes);
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
        } catch (e) {
          console.warn('Failed uploading thumbnail file to Telegram:', e);
        }
      } else if (thumbnailBase64Input && thumbnailBase64Input.startsWith('data:image/')) {
        try {
          const base64Data = thumbnailBase64Input.replace(/^data:image\/\w+;base64,/, '');
          const thumbBuffer = Buffer.from(base64Data, 'base64');
          thumbnailBase64 = thumbnailBase64Input.length < 50000 ? thumbnailBase64Input : undefined;
          
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
        } catch (e) {
          console.warn('Failed uploading base64 thumbnail to Telegram:', e);
        }
      } else if (fileType === 'image') {
        // For images, the telegram file itself can serve as direct thumbnail
        thumbnailFileId = tgRes.file_id;
      }

      // Save metadata to Excel DB with vault_id and thumbnail info
      const record = await addFileRecord({
        name: filename,
        type: fileType,
        mime,
        size: file.size,
        telegram_file_id: tgRes.file_id,
        telegram_message_id: tgRes.message_id || '',
        telegram_chat_id: config.telegram_chat_id,
        vault_id: targetVault.id,
        vault_name: targetVault.name,
        thumbnail_file_id: thumbnailFileId,
        thumbnail_base64: thumbnailBase64,
      });

      uploadedRecords.push(record);
    }

    if (uploadedRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal mengunggah file. ' + (errors.join(' ')),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengunggah ${uploadedRecords.length} file.`,
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
