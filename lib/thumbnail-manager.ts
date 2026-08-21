import { FileRecord, updateFileRecord, getConfigMap } from './excel-db';
import { getTelegramFileStream, uploadPhotoToTelegram } from './telegram';

export function generateSvgThumbnail(title: string, type: string, sizeFormatted: string): string {
  const safeTitle = (title || 'Media File')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const isVideo = type === 'video';
  const isImage = type === 'image';
  const badgeLabel = isVideo ? 'HD VIDEO' : isImage ? 'HD IMAGE' : type.toUpperCase();
  const accentColor = isVideo ? '#f43f5e' : isImage ? '#38bdf8' : '#10b981';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#080c16"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="#fb7185"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="640" height="360" fill="url(#bg)"/>
  
  <!-- Grid lines pattern -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="90" x2="640" y2="90" />
    <line x1="0" y1="180" x2="640" y2="180" />
    <line x1="0" y1="270" x2="640" y2="270" />
    <line x1="160" y1="0" x2="160" y2="360" />
    <line x1="320" y1="0" x2="320" y2="360" />
    <line x1="480" y1="0" x2="480" y2="360" />
  </g>
  
  <!-- Center Play / Media Icon -->
  <g transform="translate(320, 160)">
    <circle r="42" fill="url(#accent)" filter="url(#glow)"/>
    ${isVideo ? '<polygon points="-8,-16 18,0 -8,16" fill="#ffffff"/>' : '<rect x="-14" y="-14" width="28" height="28" rx="4" fill="#ffffff"/>'}
  </g>
  
  <!-- Top Badges -->
  <g transform="translate(24, 28)">
    <rect width="96" height="24" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="48" y="16" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" letter-spacing="1">${badgeLabel}</text>
  </g>
  
  <g transform="translate(520, 28)">
    <rect width="96" height="24" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="48" y="16" fill="#94a3b8" font-family="system-ui, -apple-system, monospace" font-size="11" font-weight="bold" text-anchor="middle">${sizeFormatted}</text>
  </g>
  
  <!-- Bottom Info Container -->
  <rect x="0" y="270" width="640" height="90" fill="#000000" opacity="0.65"/>
  
  <!-- Title -->
  <text x="32" y="310" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold">${safeTitle.length > 52 ? safeTitle.slice(0, 49) + '...' : safeTitle}</text>
  <text x="32" y="335" fill="${accentColor}" font-family="system-ui, -apple-system, monospace" font-size="10" font-weight="bold" letter-spacing="1">TELEGRAM CLOUD • FAST STREAMING ENGINE</text>
</svg>`;
}

/**
 * Resolve, render, and stream thumbnail 100% via Telegram Storage & CDN Proxy.
 */
export async function getOrRenderThumbnailUrl(file: FileRecord): Promise<{
  url?: string;
  buffer?: Buffer;
  contentType: string;
  isSvgFallback?: boolean;
}> {
  const config = await getConfigMap();
  const token = config.telegram_bot_token;
  const chatId = config.telegram_chat_id;
  const topicId = config.telegram_topic_id;

  // 1. If file has a Telegram thumbnail_file_id, stream directly from Telegram Bot API
  if (file.thumbnail_file_id && token) {
    try {
      const tgThumbRes = await getTelegramFileStream(token, file.thumbnail_file_id);
      if (tgThumbRes.ok && tgThumbRes.response) {
        const arrayBuf = await tgThumbRes.response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        return {
          buffer,
          contentType: 'image/jpeg',
        };
      }
    } catch (e) {
      console.warn('Failed streaming Telegram thumbnail:', e);
    }
  }

  // 2. If file has a base64 thumbnail string, return buffer and persist to Telegram photo
  if (file.thumbnail_base64 && file.thumbnail_base64.startsWith('data:image/')) {
    try {
      const base64Data = file.thumbnail_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Asynchronously upload photo to Telegram channel for permanent thumbnail storage if not already stored
      if (token && chatId && !file.thumbnail_file_id) {
        uploadPhotoToTelegram(token, chatId, buffer, `thumb_${file.id}.jpg`, topicId)
          .then(async (tgUpload) => {
            if (tgUpload.ok && tgUpload.file_id) {
              await updateFileRecord(file.id, {
                thumbnail_file_id: tgUpload.file_id,
              });
            }
          })
          .catch((err) => console.warn('Async Telegram thumbnail upload error:', err));
      }

      return {
        buffer,
        contentType: 'image/jpeg',
      };
    } catch (err) {
      console.warn('Failed processing base64 thumbnail:', err);
    }
  }

  // 3. If file is from Google Drive, fetch and stream
  const gdriveId = file.gdrive_file_id || (file.telegram_file_id?.startsWith('gdrive_') ? file.telegram_file_id.replace('gdrive_', '') : null);
  if (gdriveId) {
    try {
      const gdriveThumbUrls = [
        file.gdrive_thumbnail_url,
        `https://lh3.googleusercontent.com/d/${gdriveId}=w800`,
        `https://drive.google.com/thumbnail?id=${gdriveId}&sz=w800`,
      ].filter(Boolean) as string[];

      for (const tUrl of gdriveThumbUrls) {
        try {
          const gRes = await fetch(tUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          if (gRes.ok) {
            const arr = await gRes.arrayBuffer();
            if (arr.byteLength > 500) {
              return {
                buffer: Buffer.from(arr),
                contentType: gRes.headers.get('content-type') || 'image/jpeg',
              };
            }
          }
        } catch {
          // try next url
        }
      }
    } catch (gErr) {
      console.warn('[GDRIVE-THUMBNAIL-WARN] Error fetching Google Drive thumbnail:', gErr);
    }
  }

  // 4. If file is an Image on Telegram, stream original image directly from Telegram
  if (file.type === 'image' && token && file.telegram_file_id) {
    try {
      const tgRes = await getTelegramFileStream(token, file.telegram_file_id);
      if (tgRes.ok && tgRes.response) {
        const arrayBuf = await tgRes.response.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuf),
          contentType: file.mime || 'image/jpeg',
        };
      }
    } catch (e) {
      console.warn('Failed fetching image for thumbnail from Telegram:', e);
    }
  }

  // 5. High resolution SVG Fallback Poster
  const sizeFormatted = file.size > 1048576
    ? `${(file.size / 1048576).toFixed(1)} MB`
    : `${(file.size / 1024).toFixed(0)} KB`;
  const svg = generateSvgThumbnail(file.name, file.type, sizeFormatted);

  return {
    buffer: Buffer.from(svg, 'utf-8'),
    contentType: 'image/svg+xml',
    isSvgFallback: true,
  };
}
