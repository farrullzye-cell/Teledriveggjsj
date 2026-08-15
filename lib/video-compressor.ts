import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CompressOptions {
  preset?: 'ultra' | 'balanced' | 'light' | 'custom';
  targetResolution?: '480p' | '720p' | '1080p';
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  fps?: number;
  onProgress?: (progress: number, message: string) => void | Promise<void>;
}

export interface CompressResult {
  ok: boolean;
  outputPath?: string;
  outputBuffer?: Buffer;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  duration: number;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Get video duration and dimensions using ffprobe/ffmpeg
 */
export async function getVideoMetadata(inputPath: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffmpeg', ['-i', inputPath]);
    let output = '';

    ffprobe.stderr.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', () => {
      let duration = 0;
      let width = 1280;
      let height = 720;

      // Extract duration: "Duration: 00:01:23.45"
      const durMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (durMatch) {
        const hours = parseFloat(durMatch[1]);
        const mins = parseFloat(durMatch[2]);
        const secs = parseFloat(durMatch[3]);
        duration = hours * 3600 + mins * 60 + secs;
      }

      // Extract dimensions: "1920x1080"
      const dimMatch = output.match(/Stream #.*Video:.*,\s*(\d{2,5})x(\d{2,5})/);
      if (dimMatch) {
        width = parseInt(dimMatch[1], 10);
        height = parseInt(dimMatch[2], 10);
      }

      resolve({ duration: duration || 10, width, height });
    });

    ffprobe.on('error', () => {
      resolve({ duration: 10, width: 1280, height: 720 });
    });
  });
}

/**
 * Compresses a video file on the server using FFmpeg with live percentage progress tracking.
 */
export async function compressVideoFile(
  inputPath: string,
  outputPath: string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const {
    preset = 'balanced',
    onProgress,
  } = options;

  try {
    const stat = fs.statSync(inputPath);
    const originalSize = stat.size;

    // 1. Get video metadata (duration, width, height)
    if (onProgress) await onProgress(5, '🔍 Menganalisis metadata video...');
    const meta = await getVideoMetadata(inputPath);
    const totalDuration = meta.duration || 10;

    // 2. Determine target dimensions and bitrates
    let maxW = 1280;
    let videoBitrate = '650k';
    let maxrate = '850k';
    let bufsize = '1300k';
    let audioBitrate = '64k';
    let targetFps = 24;

    if (preset === 'ultra') {
      maxW = 854;
      videoBitrate = '350k';
      maxrate = '450k';
      bufsize = '800k';
      audioBitrate = '48k';
      targetFps = 24;
    } else if (preset === 'balanced') {
      maxW = 1280;
      videoBitrate = '650k';
      maxrate = '850k';
      bufsize = '1300k';
      audioBitrate = '64k';
      targetFps = 24;
    } else if (preset === 'light') {
      maxW = 1920;
      videoBitrate = '1100k';
      maxrate = '1400k';
      bufsize = '2000k';
      audioBitrate = '96k';
      targetFps = 30;
    }

    if (options.videoBitrateKbps) {
      videoBitrate = `${options.videoBitrateKbps}k`;
      maxrate = `${Math.round(options.videoBitrateKbps * 1.3)}k`;
      bufsize = `${Math.round(options.videoBitrateKbps * 2)}k`;
    }
    if (options.audioBitrateKbps) {
      audioBitrate = `${options.audioBitrateKbps}k`;
    }
    if (options.fps) {
      targetFps = options.fps;
    }

    // Scale filter without upscaling and keeping even dimensions
    const scaleFilter = `scale='min(${maxW},iw)':-2`;

    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-vf', scaleFilter,
      '-r', String(targetFps),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', videoBitrate,
      '-maxrate', maxrate,
      '-bufsize', bufsize,
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-ac', '2',
      '-ar', '44100',
      '-movflags', '+faststart',
      outputPath,
    ];

    if (onProgress) await onProgress(10, '🗜️ Memulai proses encoding video...');

    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let lastProgressReported = 10;
      let lastReportTime = 0;

      ffmpeg.stderr.on('data', async (data) => {
        const text = data.toString();
        // Parse time=00:01:23.45
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
        if (timeMatch && totalDuration > 0) {
          const hours = parseFloat(timeMatch[1]);
          const mins = parseFloat(timeMatch[2]);
          const secs = parseFloat(timeMatch[3]);
          const currentSecs = hours * 3600 + mins * 60 + secs;
          
          // Map 10% to 85% during ffmpeg encoding
          const rawPct = Math.min(100, Math.max(0, (currentSecs / totalDuration) * 100));
          const overallPct = Math.min(85, Math.max(10, Math.round(10 + rawPct * 0.75)));

          const now = Date.now();
          if (overallPct > lastProgressReported && (now - lastReportTime > 1200 || overallPct >= 84)) {
            lastProgressReported = overallPct;
            lastReportTime = now;
            if (onProgress) {
              try {
                await onProgress(overallPct, `🗜️ Mengompres video: ${overallPct}%`);
              } catch {}
            }
          }
        }
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const outStat = fs.statSync(outputPath);
          const compressedSize = outStat.size;
          const savedPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

          if (onProgress) await onProgress(85, '☁️ Encoding selesai, menyiapkan unggahan ke Cloud...');

          resolve({
            ok: true,
            outputPath,
            originalSize,
            compressedSize,
            savedPercent,
            duration: totalDuration,
            width: meta.width,
            height: meta.height,
          });
        } else {
          resolve({
            ok: false,
            originalSize,
            compressedSize: originalSize,
            savedPercent: 0,
            duration: totalDuration,
            error: `FFmpeg proses gagal dengan kode exit ${code}`,
          });
        }
      });

      ffmpeg.on('error', (err) => {
        resolve({
          ok: false,
          originalSize,
          compressedSize: originalSize,
          savedPercent: 0,
          duration: totalDuration,
          error: err.message || 'Gagal menjalankan FFmpeg',
        });
      });
    });
  } catch (err: any) {
    return {
      ok: false,
      originalSize: 0,
      compressedSize: 0,
      savedPercent: 0,
      duration: 0,
      error: err.message,
    };
  }
}
