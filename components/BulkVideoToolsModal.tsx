'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Video,
  Minimize2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  FileVideo,
  Sliders,
  Sparkles,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  Zap,
  Folder,
  ArrowRight,
  Clock,
  HardDrive,
  X,
  Check,
  Film,
  Activity,
  Layers,
  ArrowUpRight,
  Camera,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Music,
  Mic
} from 'lucide-react';

export interface VaultOption {
  id: string;
  name: string;
  topic_id?: string;
  is_private?: boolean;
}

export interface VideoQueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  compressedFile?: File;
  compressedSize?: number;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: { width: number; height: number };
  
  // Compression state
  compressStatus: 'idle' | 'compressing' | 'done' | 'error' | 'skipped';
  compressProgress: number; // 0 - 100
  compressError?: string;

  // Upload state
  uploadStatus: 'idle' | 'queued' | 'uploading' | 'done' | 'error';
  uploadProgress: number; // 0 - 100
  uploadedBytes: number;
  totalBytes: number;
  uploadSpeed: string;
  uploadEta: string;
  uploadError?: string;
}

interface BulkVideoToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaults: VaultOption[];
  defaultVaultId?: string;
  onUploadSuccess: () => void;
  initialFiles?: File[];
}

export type CompressionPreset = 'ultra' | 'balanced' | 'light' | 'custom';

export default function BulkVideoToolsModal({
  isOpen,
  onClose,
  vaults,
  defaultVaultId,
  onUploadSuccess,
  initialFiles,
}: BulkVideoToolsModalProps) {
  const [activeTab, setActiveTab] = useState<'compress' | 'upload'>('compress');
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [selectedVault, setSelectedVault] = useState<string>(defaultVaultId || (vaults[0]?.id || 'vault_general'));
  const [customNamePrefix, setCustomNamePrefix] = useState<string>('');
  
  // Compression Settings
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [speedMode, setSpeedMode] = useState<'standard' | 'fast' | 'turbo'>('standard');
  const [targetResolution, setTargetResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [videoBitrateMbps, setVideoBitrateMbps] = useState<number>(0.6); // Default 600 kbps
  const [targetReductionPercent, setTargetReductionPercent] = useState<number>(55); // 55% smaller
  const [fps, setFps] = useState<number>(24);
  const [isCompressingAll, setIsCompressingAll] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [thumbnailToast, setThumbnailToast] = useState<string | null>(null);

  // Preset configuration change
  const handlePresetChange = (p: CompressionPreset) => {
    setPreset(p);
    if (p === 'ultra') {
      setTargetResolution('480p');
      setVideoBitrateMbps(0.35); // 350 kbps
      setTargetReductionPercent(75);
      setFps(24);
      setSpeedMode('fast');
    } else if (p === 'balanced') {
      setTargetResolution('720p');
      setVideoBitrateMbps(0.65); // 650 kbps
      setTargetReductionPercent(55);
      setFps(24);
      setSpeedMode('standard');
    } else if (p === 'light') {
      setTargetResolution('720p');
      setVideoBitrateMbps(1.1); // 1.1 Mbps
      setTargetReductionPercent(35);
      setFps(30);
      setSpeedMode('standard');
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<{ [key: string]: XMLHttpRequest }>({});
  const activeCompressionRef = useRef<boolean>(false);

  // Sync default vault without fallback
  useEffect(() => {
    if (defaultVaultId) {
      setSelectedVault(defaultVaultId);
    } else if (vaults.length > 0 && !selectedVault) {
      setSelectedVault(vaults[0].id);
    }
  }, [defaultVaultId, vaults, selectedVault]);

  // Capture crisp thumbnail at specified second (Default: 5.0 seconds)
  const captureThumbnailAtSecond = (file: File, targetSecond = 5.0): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      let isDone = false;
      const cleanup = () => {
        if (!isDone) {
          isDone = true;
          URL.revokeObjectURL(url);
        }
      };

      video.onloadedmetadata = () => {
        const dur = video.duration || 10;
        // Seek directly to 5.0s if video is at least 5.5s, otherwise seek safely
        const seekTarget = dur >= 5.5 ? targetSecond : (dur > 2.0 ? Math.min(dur * 0.7, targetSecond) : Math.min(0.5, dur));
        video.currentTime = seekTarget;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 640;
          let w = video.videoWidth || 640;
          let h = video.videoHeight || 360;

          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const thumb = canvas.toDataURL('image/jpeg', 0.88);
            cleanup();
            resolve(thumb);
            return;
          }
        } catch (e) {
          console.warn('Thumbnail generation error:', e);
        }
        cleanup();
        resolve('');
      };

      video.onerror = () => {
        cleanup();
        resolve('');
      };

      setTimeout(() => {
        cleanup();
        resolve('');
      }, 4500);
    });
  };

  // Extract thumbnail and resolution (Default 5th second)
  const extractVideoMetadata = (file: File): Promise<{ thumbnail: string; duration: number; resolution: { width: number; height: number } }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let isDone = false;
      const cleanup = () => {
        if (!isDone) {
          isDone = true;
          URL.revokeObjectURL(url);
        }
      };

      video.onloadedmetadata = () => {
        const dur = video.duration || 10;
        const seekTarget = dur >= 5.5 ? 5.0 : (dur > 2.0 ? Math.min(dur * 0.7, 5.0) : Math.min(0.5, dur));
        video.currentTime = seekTarget;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 640;
          let w = video.videoWidth || 640;
          let h = video.videoHeight || 360;
          const origW = w;
          const origH = h;

          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const thumb = canvas.toDataURL('image/jpeg', 0.88);
            cleanup();
            resolve({
              thumbnail: thumb,
              duration: video.duration || 0,
              resolution: { width: origW, height: origH }
            });
            return;
          }
        } catch (e) {
          // fallback
        }
        cleanup();
        resolve({ thumbnail: '', duration: 0, resolution: { width: 1280, height: 720 } });
      };

      video.onerror = () => {
        cleanup();
        resolve({ thumbnail: '', duration: 0, resolution: { width: 1280, height: 720 } });
      };

      setTimeout(() => {
        cleanup();
        resolve({ thumbnail: '', duration: 0, resolution: { width: 1280, height: 720 } });
      }, 4500);
    });
  };

  // Generate 5th-second thumbnails for all queued videos
  const handleGenerateAllThumbnails = async (targetSec = 5.0) => {
    if (queue.length === 0) return;
    setIsGeneratingThumbnails(true);
    let updatedCount = 0;

    const newQueue = [...queue];
    for (let i = 0; i < newQueue.length; i++) {
      const item = newQueue[i];
      try {
        const thumb = await captureThumbnailAtSecond(item.file, targetSec);
        if (thumb) {
          newQueue[i] = { ...item, thumbnailUrl: thumb };
          updatedCount++;
        }
      } catch (e) {
        console.warn('Error generating thumbnail for', item.name, e);
      }
    }

    setQueue(newQueue);
    setIsGeneratingThumbnails(false);
    setThumbnailToast(`📸 Berhasil me-render thumbnail detik ke-${targetSec} untuk ${updatedCount} file video!`);
    setTimeout(() => setThumbnailToast(null), 3500);
  };

  // Generate 5th-second thumbnail for single video item
  const handleGenerateSingleThumbnail = async (itemId: string, targetSec = 5.0) => {
    const item = queue.find(q => q.id === itemId);
    if (!item) return;

    try {
      const thumb = await captureThumbnailAtSecond(item.file, targetSec);
      if (thumb) {
        setQueue(prev => prev.map(q => q.id === itemId ? { ...q, thumbnailUrl: thumb } : q));
        setThumbnailToast(`📸 Thumbnail detik ke-${targetSec} berhasil diperbarui untuk ${item.name}!`);
        setTimeout(() => setThumbnailToast(null), 3000);
      }
    } catch (e) {
      console.warn('Failed generating single thumbnail', e);
    }
  };

  // Handle Vault selection change - direct binding without fallback
  const handleVaultChange = (newVaultId: string) => {
    setSelectedVault(newVaultId);
    // If any item has no thumbnail, auto generate at 5th second
    if (queue.some(q => !q.thumbnailUrl)) {
      handleGenerateAllThumbnails(5.0);
    }
  };

  // Add files to queue
  const addFilesToQueue = useCallback(async (files: File[] | FileList) => {
    const newItems: VideoQueueItem[] = [];
    const filesArray = Array.from(files).filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|mkv|webm|avi|flv|m4v|3gp)$/i));

    for (const file of filesArray) {
      const id = 'vid_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      
      // Generate quick client thumbnail & duration
      let thumbUrl = '';
      let dur = 0;
      let res = { width: 1280, height: 720 };
      
      try {
        const metadata = await extractVideoMetadata(file);
        thumbUrl = metadata.thumbnail;
        dur = metadata.duration;
        res = metadata.resolution;
      } catch (e) {
        console.warn('Metadata extraction failed for', file.name, e);
      }

      newItems.push({
        id,
        file,
        name: file.name,
        originalSize: file.size,
        thumbnailUrl: thumbUrl,
        duration: dur,
        resolution: res,
        compressStatus: 'idle',
        compressProgress: 0,
        uploadStatus: 'idle',
        uploadProgress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        uploadSpeed: '0 KB/s',
        uploadEta: '--',
      });
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  }, []);

  // Handle initialFiles passed from parent
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      addFilesToQueue(initialFiles);
    }
  }, [initialFiles, addFilesToQueue]);

  // Single video compression implementation preserving FULL AUDIO and outputting MP4
  const compressSingleVideo = async (item: VideoQueueItem): Promise<File | null> => {
    return new Promise(async (resolve, reject) => {
      let audioCtx: AudioContext | null = null;
      let animFrameId: number | null = null;
      const fileUrl = URL.createObjectURL(item.file);

      const cleanupResources = () => {
        if (animFrameId !== null) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
        URL.revokeObjectURL(fileUrl);
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
      };

      try {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, compressStatus: 'compressing', compressProgress: 5 } : q));

        const video = document.createElement('video');
        video.src = fileUrl;
        // MUST keep muted=false and volume=1.0 so browser decodes audio track for Web Audio API
        video.muted = false;
        video.volume = 1.0;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        await new Promise((res, rej) => {
          video.onloadedmetadata = () => res(true);
          video.onerror = (e) => rej(e);
        });

        // Determine target dimensions without UPSCALING original video
        const origW = video.videoWidth || 1280;
        const origH = video.videoHeight || 720;
        let maxW = 1280;
        let maxH = 720;

        if (targetResolution === '480p') {
          maxW = 854;
          maxH = 480;
        } else if (targetResolution === '1080p') {
          maxW = 1920;
          maxH = 1080;
        }

        // Cap dimensions to original video resolution to prevent huge upscaled files
        let targetW = Math.min(origW, maxW);
        let targetH = Math.min(origH, maxH);

        const aspect = origW / origH;
        if (aspect >= 1) {
          targetH = Math.round(targetW / aspect);
        } else {
          targetW = Math.round(targetH * aspect);
        }
        // Ensure even numbers for video encoder compatibility
        targetW = targetW % 2 === 0 ? targetW : targetW - 1;
        targetH = targetH % 2 === 0 ? targetH : targetH - 1;

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          throw new Error('Canvas 2D context tidak didukung');
        }

        // 1. Capture visual video stream from canvas
        const canvasStream = canvas.captureStream(fps);

        // 2. Capture and route AUDIO without speaker playback (silent in room, captured in recorder)
        let audioTracks: MediaStreamTrack[] = [];
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            const sourceNode = audioCtx.createMediaElementSource(video);
            const audioDestination = audioCtx.createMediaStreamDestination();
            sourceNode.connect(audioDestination);
            // DO NOT connect sourceNode to audioCtx.destination so user doesn't hear background noise!
            audioTracks = audioDestination.stream.getAudioTracks();
          }
        } catch (audioErr) {
          console.warn('Audio capture routed without WebAudio or video has no audio track:', audioErr);
        }

        // Combine video + audio streams
        const combinedTracks: MediaStreamTrack[] = [
          ...canvasStream.getVideoTracks(),
          ...audioTracks
        ];
        const combinedStream = new MediaStream(combinedTracks);

        // 3. Pick best supported MP4 / WebM mimeType
        const preferredMimes = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4;codecs=h264,aac',
          'video/mp4;codecs=avc1',
          'video/mp4;codecs=h264',
          'video/mp4',
          'video/webm;codecs=h264,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];

        let selectedMimeType = 'video/mp4';
        for (const m of preferredMimes) {
          if (MediaRecorder.isTypeSupported(m)) {
            selectedMimeType = m;
            break;
          }
        }

        // 4. Adaptive Bitrate Calculation based on original file size and duration
        const dur = video.duration || item.duration || 10;
        const origSizeBytes = item.file.size;
        const origBitrateBps = dur > 0 ? Math.round((origSizeBytes * 8) / dur) : 1200000;

        let targetVideoBps: number;
        let audioBps = 64000; // 64 kbps clean audio

        if (preset === 'ultra') {
          // Target ~70-75% reduction: 25-30% of original bitrate
          targetVideoBps = Math.min(Math.round(origBitrateBps * 0.28), 380000);
          targetVideoBps = Math.max(targetVideoBps, 150000);
          audioBps = 48000;
        } else if (preset === 'balanced') {
          // Target ~50-55% reduction: 45-50% of original bitrate
          targetVideoBps = Math.min(Math.round(origBitrateBps * 0.48), 680000);
          targetVideoBps = Math.max(targetVideoBps, 220000);
          audioBps = 64000;
        } else if (preset === 'light') {
          // Target ~30-35% reduction: 65-70% of original bitrate
          targetVideoBps = Math.min(Math.round(origBitrateBps * 0.68), 1100000);
          targetVideoBps = Math.max(targetVideoBps, 320000);
          audioBps = 96000;
        } else {
          // Custom
          const manualBps = Math.round(videoBitrateMbps * 1000 * 1000);
          // Never exceed 85% of original bitrate to guarantee size reduction
          targetVideoBps = Math.min(manualBps, Math.round(origBitrateBps * 0.85));
          targetVideoBps = Math.max(targetVideoBps, 150000);
          audioBps = 64000;
        }

        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: targetVideoBps,
          audioBitsPerSecond: audioBps,
        };
        if (MediaRecorder.isTypeSupported(selectedMimeType)) {
          recorderOptions.mimeType = selectedMimeType;
        }

        const recorder = new MediaRecorder(combinedStream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          cleanupResources();
          const mime = selectedMimeType.includes('mp4') ? 'video/mp4' : (selectedMimeType.split(';')[0] || 'video/mp4');
          let blob = new Blob(chunks, { type: mime });
          const baseName = item.name.replace(/\.[^/.]+$/, '');
          
          // Output file always with .mp4 extension for universal MP4 video compatibility
          const compressedFileName = `${baseName}_compressed.mp4`;
          const compressedFile = new File([blob], compressedFileName, { type: 'video/mp4' });

          setQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              return {
                ...q,
                compressedFile,
                compressedSize: compressedFile.size,
                totalBytes: compressedFile.size,
                compressStatus: 'done',
                compressProgress: 100,
              };
            }
            return q;
          }));

          resolve(compressedFile);
        };

        recorder.onerror = (e) => {
          cleanupResources();
          reject(e);
        };

        recorder.start(250);
        // Playback rate: 1.0x (perfect sound sync), 1.25x (fast), 1.5x (turbo)
        const rate = speedMode === 'turbo' ? 1.5 : (speedMode === 'fast' ? 1.25 : 1.0);
        video.playbackRate = rate;
        await video.play();

        const renderLoop = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, targetW, targetH);
          
          if (video.duration && video.duration > 0) {
            const pct = Math.min(98, Math.round((video.currentTime / video.duration) * 100));
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, compressProgress: pct } : q));
          }
          
          animFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();

        video.onended = () => {
          if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
          }
          setTimeout(() => {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          }, 350);
        };
      } catch (err: any) {
        cleanupResources();
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, compressStatus: 'error', compressError: err.message || 'Gagal kompresi' } : q));
        resolve(null);
      }
    });
  };

  // Run bulk compression sequentially
  const handleCompressAll = async () => {
    setIsCompressingAll(true);
    activeCompressionRef.current = true;

    for (let i = 0; i < queue.length; i++) {
      if (!activeCompressionRef.current) break;
      const item = queue[i];
      if (item.compressStatus !== 'done') {
        await compressSingleVideo(item);
      }
    }

    setIsCompressingAll(false);
    activeCompressionRef.current = false;
  };

  // Upload single file with real-time XMLHttpRequest progress
  const uploadSingleVideo = (item: VideoQueueItem): Promise<boolean> => {
    return new Promise((resolve) => {
      // Use compressed file if available, otherwise original
      const fileToUpload = item.compressedFile || item.file;
      const fileName = item.compressedFile ? item.compressedFile.name : item.name;
      
      const formData = new FormData();
      // Ensure file name and explicit filename parameter are attached
      formData.append('file', fileToUpload, fileName);
      formData.append('files', fileToUpload, fileName);
      formData.append('vault_id', selectedVault || 'vault_general');
      formData.append('keep_original_name', 'true');
      
      if (customNamePrefix.trim()) {
        formData.append('custom_name', `${customNamePrefix.trim()}`);
      }

      if (item.thumbnailUrl && item.thumbnailUrl.startsWith('data:image/')) {
        formData.append('thumbnail_base64_0', item.thumbnailUrl);
        formData.append('thumbnail_base64', item.thumbnailUrl);
      }

      const xhr = new XMLHttpRequest();
      abortControllersRef.current[item.id] = xhr;

      let lastTime = Date.now();
      let lastLoaded = 0;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const loadedDiff = e.loaded - lastLoaded;
          
          let speedStr = '0 KB/s';
          let etaStr = '--';

          if (timeDiff > 0.4) {
            const speedBps = loadedDiff / timeDiff;
            if (speedBps > 1048576) {
              speedStr = `${(speedBps / 1048576).toFixed(1)} MB/s`;
            } else {
              speedStr = `${(speedBps / 1024).toFixed(0)} KB/s`;
            }

            const remainingBytes = e.total - e.loaded;
            if (speedBps > 0) {
              const secondsLeft = Math.ceil(remainingBytes / speedBps);
              etaStr = secondsLeft > 60 ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s` : `${secondsLeft}s`;
            }

            lastTime = now;
            lastLoaded = e.loaded;
          }

          const progressPercent = Math.min(99, Math.round((e.loaded / e.total) * 100));

          setQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              return {
                ...q,
                uploadStatus: 'uploading',
                uploadProgress: progressPercent,
                uploadedBytes: e.loaded,
                totalBytes: e.total,
                uploadSpeed: speedStr,
                uploadEta: etaStr,
              };
            }
            return q;
          }));
        }
      });

      xhr.addEventListener('load', () => {
        let errorMsg = `HTTP ${xhr.status}`;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success) {
              setQueue(prev => prev.map(q => q.id === item.id ? {
                ...q,
                uploadStatus: 'done',
                uploadProgress: 100,
                uploadedBytes: q.totalBytes,
                uploadSpeed: 'Selesai',
                uploadEta: '0s',
                uploadError: undefined,
              } : q));
              resolve(true);
              return;
            } else {
              errorMsg = res.message || (res.errors ? res.errors.join(', ') : 'Gagal upload');
            }
          } catch (e) {
            errorMsg = 'Format respons server tidak valid';
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.message) errorMsg = res.message;
          } catch (e) {}
        }

        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          uploadStatus: 'error',
          uploadError: errorMsg,
        } : q));
        resolve(false);
      });

      xhr.addEventListener('error', () => {
        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          uploadStatus: 'error',
          uploadError: 'Koneksi jaringan terputus',
        } : q));
        resolve(false);
      });

      xhr.addEventListener('abort', () => {
        setQueue(prev => prev.map(q => q.id === item.id ? {
          ...q,
          uploadStatus: 'idle',
          uploadProgress: 0,
        } : q));
        resolve(false);
      });

      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });
  };

  // Run bulk upload
  const handleUploadAll = async () => {
    if (queue.length === 0) return;
    setIsUploadingAll(true);
    setActiveTab('upload');

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.uploadStatus !== 'done') {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, uploadStatus: 'queued' } : q));
        await uploadSingleVideo(item);
      }
    }

    setIsUploadingAll(false);
    onUploadSuccess();
  };

  // Retry single video upload
  const handleRetrySingle = async (item: VideoQueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, uploadStatus: 'queued', uploadError: undefined } : q));
    const ok = await uploadSingleVideo(item);
    if (ok) {
      onUploadSuccess();
    }
  };

  // Retry all failed uploads
  const handleRetryFailed = async () => {
    const failedItems = queue.filter(q => q.uploadStatus === 'error');
    if (failedItems.length === 0) return;

    setIsUploadingAll(true);
    for (const item of failedItems) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, uploadStatus: 'queued', uploadError: undefined } : q));
      await uploadSingleVideo(item);
    }
    setIsUploadingAll(false);
    onUploadSuccess();
  };

  // Remove single item from queue
  const removeItem = (id: string) => {
    if (abortControllersRef.current[id]) {
      abortControllersRef.current[id].abort();
      delete abortControllersRef.current[id];
    }
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  // Clear all
  const clearQueue = () => {
    Object.values(abortControllersRef.current).forEach(xhr => xhr.abort());
    abortControllersRef.current = {};
    activeCompressionRef.current = false;
    setQueue([]);
  };

  // Download compressed file
  const downloadCompressed = (item: VideoQueueItem) => {
    if (!item.compressedFile) return;
    const url = URL.createObjectURL(item.compressedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.compressedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Size helper
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Overall batch statistics
  const totalOriginalBytes = queue.reduce((acc, curr) => acc + curr.originalSize, 0);
  const totalCurrentBytes = queue.reduce((acc, curr) => acc + (curr.compressedSize || curr.originalSize), 0);
  const totalUploadedBytes = queue.reduce((acc, curr) => acc + curr.uploadedBytes, 0);
  const totalBatchTargetBytes = totalCurrentBytes || 1;
  const overallUploadPercent = Math.min(100, Math.round((totalUploadedBytes / totalBatchTargetBytes) * 100));
  
  const compressedCount = queue.filter(q => q.compressStatus === 'done').length;
  const uploadedCount = queue.filter(q => q.uploadStatus === 'done').length;
  const savingsBytes = totalOriginalBytes - totalCurrentBytes;
  const savingsPercent = totalOriginalBytes > 0 ? Math.round((savingsBytes / totalOriginalBytes) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-[#090e17] border border-cyan-800/60 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-[#0d1626] border-b border-cyan-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>BULK VIDEO STUDIO PRO</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-700/60">
                    COMPRESS &amp; UPLOAD ENGINE
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Kompres video massal hingga 80% hemat bandwidth + Upload bertahap dengan progress bar real-time.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WORKSPACE TAB SWITCHER & CONTROLS */}
        <div className="px-5 py-3 bg-[#0a1120] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-[#050912] border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('compress')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'compress'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minimize2 className="w-4 h-4" />
              <span>1. Bulk Compressor ({compressedCount}/{queue.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === 'upload'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>2. Bulk Uploader ({uploadedCount}/{queue.length})</span>
            </button>
          </div>

          {/* Quick Global Action Buttons */}
          <div className="flex items-center gap-2">
            <input
              ref={addMoreInputRef}
              type="file"
              multiple
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  addFilesToQueue(e.target.files);
                }
              }}
            />
            
            <button
              type="button"
              onClick={() => addMoreInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Tambah Video</span>
            </button>

            {queue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kosongkan Antrean</span>
              </button>
            )}
          </div>
        </div>

        {/* BODY CONTENT SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* NOTIFICATION TOAST */}
          {thumbnailToast && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/50 text-cyan-200 text-xs font-semibold flex items-center justify-between shadow-lg shadow-cyan-500/10 animate-fade-in">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{thumbnailToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setThumbnailToast(null)}
                className="text-cyan-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* EMPTY QUEUE DROPZONE */}
          {queue.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-800/60 hover:border-cyan-500 bg-[#060b14] hover:bg-[#091222] rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition flex flex-col items-center justify-center gap-4 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToQueue(e.target.files);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition duration-300 shadow-xl shadow-cyan-500/10">
                <Video className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-white">
                  Pilih atau Drag &amp; Drop Video Massal Disini
                </h3>
                <p className="text-xs text-slate-400">
                  Dukung MP4, MOV, MKV, WebM, AVI. Anda dapat mengompresi beberapa video sekaligus dalam satu klik sebelum mengunggah ke Cloud Storage.
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300">
                  Multi-file select
                </span>
                <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300">
                  Client-side 100% Aman
                </span>
                <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300">
                  Auto Thumbnail
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* STATS OVERVIEW BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0d1524] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Video:</span>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-white">{queue.length} File</span>
                    <Film className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0d1524] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Ukuran Awal:</span>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-slate-300">{formatBytes(totalOriginalBytes)}</span>
                    <HardDrive className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0d1524] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 block">Ukuran Akhir / Hemat:</span>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-emerald-400">
                      {formatBytes(totalCurrentBytes)} {savingsPercent > 0 && `(-${savingsPercent}%)`}
                    </span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0d1524] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-cyan-400 block">Status Terunggah:</span>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-cyan-400">{uploadedCount} / {queue.length}</span>
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>
              </div>

              {/* TAB 1: COMPRESSION PRESETS & TOOLS */}
              {activeTab === 'compress' && (
                <div className="space-y-4">
                  {/* PRESET CONFIGURATION CARD */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1424] border border-cyan-900/50 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-cyan-400" />
                          <span>Pengaturan Profil Kompresi Bulk</span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          Pilih preset untuk menyeimbangkan kualitas visual dan penghematan ukuran file.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateAllThumbnails(5.0)}
                          disabled={isGeneratingThumbnails || queue.length === 0}
                          className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
                          title="Generate thumbnail pada detik ke-5 untuk semua video"
                        >
                          <Camera className="w-4 h-4 text-cyan-400" />
                          <span>{isGeneratingThumbnails ? 'Me-render...' : '📸 Thumbnail (Detik 5)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCompressAll}
                          disabled={isCompressingAll || queue.every(q => q.compressStatus === 'done')}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>{isCompressingAll ? 'Mengompres...' : '⚡ Kompres Semua (Cepat)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('upload')}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition"
                        >
                          <span>Lanjut ke Upload</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* SPEED MODE & AUDIO PRESERVATION CONTROLS */}
                    <div className="p-3.5 bg-[#070c17] rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Audio Stereo Aktif</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
                          <Film className="w-3.5 h-3.5" />
                          <span>Output: MP4 Video</span>
                        </div>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">• Suara asli & frame video dipertahankan tanpa menjadi GIF</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSpeedMode('standard')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            speedMode === 'standard'
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-cyan-400'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                          title="Kecepatan 1.0x: Audio dan video 100% sinkron sempurna dan jernih"
                        >
                          <span>🎯 Standar (1.0x Suara Jernih)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeedMode('fast')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            speedMode === 'fast'
                              ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-md shadow-cyan-500/20'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                          title="Kecepatan 1.25x: Kompresi lebih cepat dengan audio tetap jernih"
                        >
                          <span>🚀 Cepat (1.25x)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeedMode('turbo')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            speedMode === 'turbo'
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                          title="Kecepatan 1.5x: Akselerasi tinggi dengan audio terjaga"
                        >
                          <span>⚡ Turbo (1.5x)</span>
                        </button>
                      </div>
                    </div>

                    {/* PRESETS BUTTONS */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePresetChange('ultra')}
                        className={`p-3 rounded-xl border text-left transition ${
                          preset === 'ultra'
                            ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-cyan-400">Ultra Hemat</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900 text-cyan-300">~75% Lebih Ringan</span>
                        </div>
                        <p className="text-[11px] text-slate-300">480p • ~350 kbps</p>
                        <p className="text-[10px] text-slate-500 mt-1">Ukuran paling mungil, hemat kuota maksimal</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePresetChange('balanced')}
                        className={`p-3 rounded-xl border text-left transition ${
                          preset === 'balanced'
                            ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-emerald-400">Balanced (Disarankan)</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">~55% Lebih Ringan</span>
                        </div>
                        <p className="text-[11px] text-slate-300">720p HD • ~650 kbps</p>
                        <p className="text-[10px] text-slate-500 mt-1">Jernih, audio renyah, streaming sangat lancar</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePresetChange('light')}
                        className={`p-3 rounded-xl border text-left transition ${
                          preset === 'light'
                            ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-amber-400">High Quality</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900 text-amber-300">~35% Lebih Ringan</span>
                        </div>
                        <p className="text-[11px] text-slate-300">720p/1080p • ~1.1 Mbps</p>
                        <p className="text-[10px] text-slate-500 mt-1">Pertahankan ketajaman visual tingkat tinggi</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreset('custom')}
                        className={`p-3 rounded-xl border text-left transition ${
                          preset === 'custom'
                            ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-violet-400">Kustom Manual</span>
                          <Sliders className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        <p className="text-[11px] text-slate-300">{targetResolution} • {videoBitrateMbps} Mbps</p>
                        <p className="text-[10px] text-slate-500 mt-1">Atur bitrate dan resolusi spesifik</p>
                      </button>
                    </div>

                    {/* CUSTOM SLIDERS (IF CUSTOM) */}
                    {preset === 'custom' && (
                      <div className="p-4 bg-[#070c17] rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">Resolusi Target:</label>
                          <select
                            value={targetResolution}
                            onChange={(e: any) => setTargetResolution(e.target.value)}
                            className="w-full bg-[#0a1120] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="480p">480p SD (854 x 480 - Ringan)</option>
                            <option value="720p">720p HD (1280 x 720 - Standar)</option>
                            <option value="1080p">1080p FHD (1920 x 1080)</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                            <span>Batas Bitrate Video:</span>
                            <span className="text-cyan-400 font-mono">{(videoBitrateMbps * 1000).toFixed(0)} kbps</span>
                          </div>
                          <input
                            type="range"
                            min="0.15"
                            max="2.5"
                            step="0.05"
                            value={videoBitrateMbps}
                            onChange={(e) => setVideoBitrateMbps(parseFloat(e.target.value))}
                            className="w-full accent-cyan-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                            <span>Frame Rate (FPS):</span>
                            <span className="text-cyan-400 font-mono">{fps} FPS</span>
                          </div>
                          <select
                            value={fps}
                            onChange={(e) => setFps(parseInt(e.target.value, 10))}
                            className="w-full bg-[#0a1120] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value={24}>24 FPS (Efisien)</option>
                            <option value={30}>30 FPS (Standar)</option>
                            <option value={60}>60 FPS (Mulus)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QUEUE LIST WITH INDIVIDUAL COMPRESSION PROGRESS */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                        Daftar Antrean Video ({queue.length}):
                      </h4>
                    </div>

                    <div className="space-y-2.5">
                      {queue.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-[#0b1322] border border-slate-800/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-cyan-900/80"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Video Thumbnail Preview */}
                            <div className="w-20 h-14 bg-black rounded-lg border border-slate-800 overflow-hidden relative shrink-0 flex items-center justify-center group/thumb">
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                              ) : (
                                <Video className="w-5 h-5 text-slate-600" />
                              )}
                              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[8px] font-mono text-slate-300">
                                {item.duration ? `${Math.floor(item.duration / 60)}:${Math.floor(item.duration % 60).toString().padStart(2, '0')}` : '00:05'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleGenerateSingleThumbnail(item.id, 5.0)}
                                className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-cyan-300 text-[9px] font-bold transition gap-0.5"
                                title="Ambil thumbnail detik ke-5"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Detik 5</span>
                              </button>
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate max-w-[220px] sm:max-w-[320px]">
                                  {item.name}
                                </span>
                                {item.compressStatus === 'done' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                    Terkonversi
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                                <span>Awal: <b className="text-slate-300">{formatBytes(item.originalSize)}</b></span>
                                {item.compressedSize && (
                                  <>
                                    <span>➔</span>
                                    <span className="text-emerald-400 font-bold">
                                      {formatBytes(item.compressedSize)} (-{Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100)}%)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress & Item Actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            {item.compressStatus === 'compressing' && (
                              <div className="w-36 space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-cyan-400 font-bold">
                                  <span>Mengompres...</span>
                                  <span>{item.compressProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-cyan-800/40">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                    style={{ width: `${item.compressProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {item.compressStatus === 'idle' && (
                              <button
                                type="button"
                                onClick={() => compressSingleVideo(item)}
                                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition"
                              >
                                <Minimize2 className="w-3.5 h-3.5" />
                                <span>Kompres</span>
                              </button>
                            )}

                            {item.compressStatus === 'done' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => downloadCompressed(item)}
                                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700"
                                  title="Download hasil kompresi"
                                >
                                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                                </button>
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                  <Check className="w-4 h-4" />
                                  <span>Siap</span>
                                </span>
                              </div>
                            )}

                            {item.compressStatus === 'error' && (
                              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                <span>Gagal</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                              title="Hapus dari antrean"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BULK UPLOADER WITH REAL-TIME PROGRESS BARS */}
              {activeTab === 'upload' && (
                <div className="space-y-5">
                  {/* UPLOAD DESTINATION & CONFIGURATION */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#0c1424] border border-cyan-900/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5">
                          Target Vault Topic Storage:
                        </label>
                        <select
                          value={selectedVault}
                          onChange={(e) => handleVaultChange(e.target.value)}
                          className="w-full bg-[#070c17] border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                        >
                          {vaults.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.topic_id ? `(Topic #${v.topic_id})` : ''} {v.is_private ? '🔒 Private' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                          Kustom Awalan Nama (Opsional):
                        </label>
                        <input
                          type="text"
                          value={customNamePrefix}
                          onChange={(e) => setCustomNamePrefix(e.target.value)}
                          placeholder="Kosongkan untuk penamaan otomatis dari nama vault"
                          className="w-full bg-[#070c17] border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* OVERALL BATCH PROGRESS BAR */}
                    <div className="p-4 rounded-xl bg-[#050912] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-white flex items-center gap-2">
                          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                          <span>Total Batch Upload Progress:</span>
                        </span>
                        <span className="text-cyan-400 font-bold">
                          {formatBytes(totalUploadedBytes)} / {formatBytes(totalBatchTargetBytes)} ({overallUploadPercent}%)
                        </span>
                      </div>

                      <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/50"
                          style={{ width: `${overallUploadPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                        <span>Selesai: {uploadedCount} dari {queue.length} file video</span>
                        <span>{isUploadingAll ? 'Sedang Mentransmisikan ke Cloud...' : 'Siap Unggah'}</span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('compress')}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Kembali ke Compressor</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {queue.some(q => q.uploadStatus === 'error') && (
                          <button
                            type="button"
                            onClick={handleRetryFailed}
                            disabled={isUploadingAll}
                            className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Coba Ulang yang Gagal</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleUploadAll}
                          disabled={isUploadingAll || queue.length === 0 || queue.every(q => q.uploadStatus === 'done')}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>{isUploadingAll ? 'Sedang Mengunggah...' : `Mulai Upload ${queue.length} Video`}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* REAL-TIME INDIVIDUAL PROGRESS LIST */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Status Upload Per Video:
                    </h4>

                    <div className="space-y-3">
                      {queue.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 bg-[#0b1322] border border-slate-800 rounded-xl space-y-3 hover:border-cyan-900/80 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-10 bg-black rounded-lg border border-slate-800 overflow-hidden relative shrink-0">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Video className="w-4 h-4 text-slate-600 m-auto" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white truncate block">
                                  {item.compressedFile ? item.compressedFile.name : item.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  Ukuran: <b className="text-slate-300">{formatBytes(item.compressedSize || item.originalSize)}</b>
                                  {item.compressedFile && <span className="text-emerald-400 ml-1.5">(Telah Dikompres)</span>}
                                </span>
                                {item.uploadError && item.uploadStatus === 'error' && (
                                  <span className="text-[11px] text-rose-400 font-mono block mt-0.5 truncate" title={item.uploadError}>
                                    Penyebab: {item.uploadError}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Badges */}
                            <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                              {item.uploadStatus === 'idle' && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 text-[11px]">
                                  Menunggu
                                </span>
                              )}
                              {item.uploadStatus === 'queued' && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] animate-pulse">
                                  Dalam Antrean...
                                </span>
                              )}
                              {item.uploadStatus === 'uploading' && (
                                <div className="text-right">
                                  <span className="text-cyan-400 font-bold">{item.uploadProgress}%</span>
                                  <span className="text-[10px] text-slate-500 block">{item.uploadSpeed} • ETA: {item.uploadEta}</span>
                                </div>
                              )}
                              {item.uploadStatus === 'done' && (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Terunggah 100%</span>
                                </span>
                              )}
                              {item.uploadStatus === 'error' && (
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-bold">
                                    Gagal Upload
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRetrySingle(item)}
                                    disabled={isUploadingAll}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-[11px] flex items-center gap-1 transition"
                                    title="Coba upload ulang file ini"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Coba Lagi</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Individual Progress Bar */}
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full transition-all duration-200 ${
                                item.uploadStatus === 'done'
                                  ? 'bg-emerald-500'
                                  : item.uploadStatus === 'error'
                                  ? 'bg-rose-500'
                                  : 'bg-cyan-500'
                              }`}
                              style={{ width: `${item.uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-[#0a1120] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>RULLZYE CLOUD • High Performance Client Transcoding &amp; Upload Engine</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition border border-slate-800"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
