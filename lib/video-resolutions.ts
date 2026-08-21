import { FileRecord } from './excel-db';

export type VideoResolutionKey = '1080p' | '720p' | '480p' | '360p' | '240p' | 'auto' | 'original';

export interface VideoResolutionOption {
  key: VideoResolutionKey;
  label: string;
  badge: string;
  width: number;
  height: number;
  quality: number;
  bitrate: string;
  isRecommended?: boolean;
  streamUrl: string;
  proxyStreamUrl: string;
  isDirectCdnTranscoded: boolean;
}

export interface VideoResolutionsPayload {
  videoId: string;
  videoName: string;
  currentResolution: string;
  isTelegramStorage: boolean;
  hasGdriveSource: boolean;
  resolutions: VideoResolutionOption[];
  defaultResolution: VideoResolutionKey;
}

export const RESOLUTION_PRESETS: Record<
  string,
  { label: string; badge: string; width: number; height: number; quality: number; bitrate: string }
> = {
  '1080p': {
    label: '1080p Full HD',
    badge: '1080p FHD',
    width: 1920,
    height: 1080,
    quality: 85,
    bitrate: '2500 kbps',
  },
  '720p': {
    label: '720p HD (Standar)',
    badge: '720p HD',
    width: 1280,
    height: 720,
    quality: 80,
    bitrate: '1200 kbps',
  },
  '480p': {
    label: '480p SD (Lancar & Stabil)',
    badge: '480p SD',
    width: 854,
    height: 480,
    quality: 75,
    bitrate: '650 kbps',
  },
  '360p': {
    label: '360p (Hemat Kuota)',
    badge: '360p ECO',
    width: 640,
    height: 360,
    quality: 70,
    bitrate: '400 kbps',
  },
  '240p': {
    label: '240p (Super Ringan / Jaringan Lambat)',
    badge: '240p MIN',
    width: 426,
    height: 240,
    quality: 60,
    bitrate: '250 kbps',
  },
};

/**
 * Generate stream URL for specific resolution variant powered 100% by Telegram Range Streamer
 */
export function getTransformedResolutionStreamUrl(
  file: FileRecord,
  resKey: string = 'auto',
  origin: string = ''
): string {
  const normKey = resKey.toLowerCase().trim();
  const preset = RESOLUTION_PRESETS[normKey];

  const baseProxy = `${origin}/api/v1/videos/stream/${file.id}`;
  if (!preset || normKey === 'auto' || normKey === 'original') {
    return baseProxy;
  }
  return `${baseProxy}?res=${normKey}`;
}

/**
 * Build all resolution profiles and options for a given file
 */
export function generateVideoResolutionProfiles(
  file: FileRecord,
  origin: string = ''
): VideoResolutionsPayload {
  const hasGdrive = Boolean(file.gdrive_file_id || file.gdrive_url);
  const isTelegram = Boolean(file.telegram_file_id);

  const resolutionKeys: VideoResolutionKey[] = ['1080p', '720p', '480p', '360p', '240p'];
  
  const options: VideoResolutionOption[] = [
    {
      key: 'auto',
      label: 'Otomatis (Adaptif)',
      badge: 'AUTO',
      width: 0,
      height: 0,
      quality: 0,
      bitrate: 'Auto Dynamic',
      isRecommended: true,
      streamUrl: `${origin}/api/v1/videos/stream/${file.id}`,
      proxyStreamUrl: `${origin}/api/v1/videos/stream/${file.id}?res=auto`,
      isDirectCdnTranscoded: false,
    },
    ...resolutionKeys.map((k) => {
      const preset = RESOLUTION_PRESETS[k];
      const streamUrl = `${origin}/api/v1/videos/stream/${file.id}?res=${k}`;

      return {
        key: k,
        label: preset.label,
        badge: preset.badge,
        width: preset.width,
        height: preset.height,
        quality: preset.quality,
        bitrate: preset.bitrate,
        isRecommended: k === '720p' || k === '480p',
        streamUrl,
        proxyStreamUrl: `${origin}/api/v1/videos/stream/${file.id}?res=${k}`,
        isDirectCdnTranscoded: false,
      };
    }),
  ];

  return {
    videoId: file.id,
    videoName: file.name,
    currentResolution: 'auto',
    isTelegramStorage: isTelegram,
    hasGdriveSource: hasGdrive,
    resolutions: options,
    defaultResolution: 'auto',
  };
}
