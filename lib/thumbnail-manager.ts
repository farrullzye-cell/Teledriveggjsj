import { FileRecord, getFileById, updateFileRecord, getConfigMap } from './excel-db';
import {
  generateImageKitThumbnailUrl,
  uploadThumbnailToImageKit,
  getImageKitCredentials,
} from './imagekit';
import { getTelegramFileStream } from './telegram';

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
  <text x="32" y="335" fill="${accentColor}" font-family="system-ui, -apple-system, monospace" font-size="10" font-weight="bold" letter-spacing="1">IMAGEKIT CDN • SMART THUMBNAIL ENGINE</text>
</svg>`;
}

/**
 * Resolve, render, and persist thumbnail to ImageKit.io CDN.
 * Returns either a direct ImageKit CDN URL or streaming binary buffer.
 */
export async function getOrRenderThumbnailUrl(file: FileRecord): Promise<{
  url?: string;
  buffer?: Buffer;
  contentType: string;
  isSvgFallback?: boolean;
}> {
  // 1. Direct ImageKit thumbnail if already recorded
  if (file.imagekit_thumbnail_url && file.imagekit_thumbnail_url.startsWith('http')) {
    return {
      url: file.imagekit_thumbnail_url,
      contentType: 'image/jpeg',
    };
  }

  // 2. If main file is on ImageKit, derive transformed thumbnail URL and save to DB
  if (file.imagekit_url && file.imagekit_url.startsWith('http')) {
    const derivedUrl = generateImageKitThumbnailUrl(file.imagekit_url, file.type);
    try {
      await updateFileRecord(file.id, {
        imagekit_thumbnail_url: derivedUrl,
      });
    } catch (e) {
      console.warn('Failed saving derived imagekit_thumbnail_url:', e);
    }
    return {
      url: derivedUrl,
      contentType: 'image/jpeg',
    };
  }

  const creds = await getImageKitCredentials();
  const config = await getConfigMap();
  const token = config.telegram_bot_token;

  // 3. If file has a base64 thumbnail string, upload it to ImageKit.io permanently
  if (file.thumbnail_base64 && file.thumbnail_base64.startsWith('data:image/')) {
    try {
      if (creds.privateKey && creds.publicKey) {
        const ikRes = await uploadThumbnailToImageKit({
          file: file.thumbnail_base64,
          fileName: `thumb_${file.id}`,
          tags: ['thumbnail_render', file.type, file.vault_name || 'vault'],
        });

        if (ikRes.ok && ikRes.url) {
          const thumbUrl = ikRes.thumbnailUrl || ikRes.url;
          await updateFileRecord(file.id, {
            imagekit_thumbnail_url: thumbUrl,
            imagekit_file_id: file.imagekit_file_id || ikRes.fileId,
          });
          return {
            url: thumbUrl,
            contentType: 'image/jpeg',
          };
        }
      }

      // Return buffer if ImageKit upload was not available
      const base64Data = file.thumbnail_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      return {
        buffer,
        contentType: 'image/jpeg',
      };
    } catch (err) {
      console.warn('Failed uploading base64 thumbnail to ImageKit:', err);
    }
  }

  // 4. If file has a Telegram thumbnail_file_id, fetch it and upload to ImageKit.io
  if (file.thumbnail_file_id && token) {
    try {
      const tgThumbRes = await getTelegramFileStream(token, file.thumbnail_file_id);
      if (tgThumbRes.ok && tgThumbRes.response) {
        const arrayBuf = await tgThumbRes.response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (creds.privateKey && creds.publicKey) {
          const ikRes = await uploadThumbnailToImageKit({
            file: buffer,
            fileName: `thumb_${file.id}`,
            tags: ['telegram_thumb_migrated', file.type],
          });

          if (ikRes.ok && ikRes.url) {
            const thumbUrl = ikRes.thumbnailUrl || ikRes.url;
            await updateFileRecord(file.id, {
              imagekit_thumbnail_url: thumbUrl,
            });
            return {
              url: thumbUrl,
              contentType: 'image/jpeg',
            };
          }
        }

        return {
          buffer,
          contentType: 'image/jpeg',
        };
      }
    } catch (e) {
      console.warn('Failed streaming / uploading Telegram thumbnail:', e);
    }
  }

  // 5. If file is an Image on Telegram, fetch original image and upload to ImageKit.io
  if (file.type === 'image' && token && file.telegram_file_id) {
    try {
      const tgRes = await getTelegramFileStream(token, file.telegram_file_id);
      if (tgRes.ok && tgRes.response) {
        const arrayBuf = await tgRes.response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (creds.privateKey && creds.publicKey) {
          const ikRes = await uploadThumbnailToImageKit({
            file: buffer,
            fileName: `thumb_${file.id}`,
            tags: ['image_thumb', file.name],
          });

          if (ikRes.ok && ikRes.url) {
            const thumbUrl = ikRes.thumbnailUrl || ikRes.url;
            await updateFileRecord(file.id, {
              imagekit_thumbnail_url: thumbUrl,
              imagekit_url: file.imagekit_url || ikRes.url,
            });
            return {
              url: thumbUrl,
              contentType: 'image/jpeg',
            };
          }
        }

        return {
          buffer,
          contentType: file.mime || 'image/jpeg',
        };
      }
    } catch (e) {
      console.warn('Failed fetching image for thumbnail from Telegram:', e);
    }
  }

  // 6. High resolution SVG Fallback Poster
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
