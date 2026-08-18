import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { teraboxClient } from './terabox-client';
import { pipeline } from 'stream/promises';

const CHUNK_SIZE = parseInt(process.env.TERABOX_CHUNK_SIZE || '20971520', 10); // Default 20MB
const MAX_REMOTE_FILE_SIZE = parseInt(process.env.MAX_REMOTE_FILE_SIZE || '2147483648', 10); // 2GB

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function processTeraboxJob(jobId: string) {
  const jobRef = doc(db, 'terabox_upload_jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) return;

  const job = jobSnap.data() as any;
  if (job.status === 'cancelled') return;

  const tempDir = path.join('/tmp', 'terabox_jobs');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempFilePath = path.join(tempDir, `${jobId}.tmp`);

  const updateStatus = async (status: string, extra: any = {}) => {
    await updateDoc(jobRef, { status, updatedAt: new Date().toISOString(), ...extra });
  };

  try {
    await updateStatus('downloading', { startedAt: new Date().toISOString() });

    // 1. Download File
    if (!isSafeUrl(job.sourceUrl)) {
      throw new Error('Unsafe or invalid Source URL');
    }

    const response = await fetch(job.sourceUrl);
    if (!response.ok) throw new Error(`Failed to fetch source: ${response.statusText}`);

    const contentLength = response.headers.get('content-length');
    let totalBytes = contentLength ? parseInt(contentLength, 10) : null;
    
    if (totalBytes && totalBytes > MAX_REMOTE_FILE_SIZE) {
      throw new Error(`File too large. Max allowed: ${MAX_REMOTE_FILE_SIZE} bytes`);
    }

    // Stream download and calculate MD5
    await updateDoc(jobRef, { totalBytes });
    
    if (!response.body) throw new Error('No response body');

    // Convert fetch body to node stream
    const fileStream = fs.createWriteStream(tempFilePath);
    let downloadedBytes = 0;
    
    // Instead of using node streams directly with fetch response (which is a web stream),
    // we use a custom reader loop to track progress
    const reader = response.body.getReader();
    let startTime = Date.now();
    let lastUpdate = startTime;

    while (true) {
      // Check cancellation periodically
      const currentJobSnap = await getDoc(jobRef);
      if (currentJobSnap.exists() && currentJobSnap.data()?.status === 'cancelled') {
        fileStream.close();
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;
      
      fileStream.write(Buffer.from(value));
      downloadedBytes += value.length;

      const now = Date.now();
      if (now - lastUpdate > 2000) { // Update progress every 2s
        const speed = Math.floor((downloadedBytes / (now - startTime)) * 1000);
        const progress = totalBytes ? Math.floor((downloadedBytes / totalBytes) * 100) : null;
        let etaSeconds = null;
        if (totalBytes && speed > 0) {
          etaSeconds = Math.floor((totalBytes - downloadedBytes) / speed);
        }
        await updateDoc(jobRef, { bytesProcessed: downloadedBytes, speed, progress, etaSeconds });
        lastUpdate = now;
      }
    }
    fileStream.end();

    if (!totalBytes) {
      totalBytes = downloadedBytes;
      await updateDoc(jobRef, { totalBytes });
    }

    await updateStatus('preparing');

    // 2. Hash Chunks
    const blockList: string[] = [];
    const fd = fs.openSync(tempFilePath, 'r');
    const buffer = Buffer.alloc(CHUNK_SIZE);
    let bytesRead = 0;

    let chunkSizes: number[] = [];
    while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) !== 0) {
      const chunkData = buffer.subarray(0, bytesRead);
      const hash = crypto.createHash('md5').update(chunkData).digest('hex');
      blockList.push(hash);
      chunkSizes.push(bytesRead);
    }
    fs.closeSync(fd);

    await updateStatus('uploading');

    // 3. Precreate
    const targetPath = job.directory.endsWith('/') ? `${job.directory}${job.filename}` : `${job.directory}/${job.filename}`;
    const precreateRes = await teraboxClient.precreate(targetPath, totalBytes, 0, blockList);

    if (precreateRes.errno !== 0 && precreateRes.errno !== 31066) { // 31066 = file already exists maybe? Check docs.
      throw new Error(`Precreate Error: ${JSON.stringify(precreateRes)}`);
    }

    const uploadid = precreateRes.uploadid;
    let uploadedBytes = 0;

    // 4. Upload Chunks
    const fdUpload = fs.openSync(tempFilePath, 'r');
    for (let i = 0; i < blockList.length; i++) {
      // Check cancellation
      const currentJobSnap = await getDoc(jobRef);
      if (currentJobSnap.exists() && currentJobSnap.data()?.status === 'cancelled') {
        fs.closeSync(fdUpload);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return;
      }

      const sizeToRead = chunkSizes[i];
      const chunkBuf = Buffer.alloc(sizeToRead);
      fs.readSync(fdUpload, chunkBuf, 0, sizeToRead, null);
      
      await teraboxClient.uploadPart(targetPath, uploadid, i, chunkBuf);
      
      uploadedBytes += sizeToRead;
      
      const speed = Math.floor((uploadedBytes / (Date.now() - startTime)) * 1000);
      const progress = Math.floor((uploadedBytes / totalBytes) * 100);
      let etaSeconds = speed > 0 ? Math.floor((totalBytes - uploadedBytes) / speed) : null;
      await updateDoc(jobRef, { bytesProcessed: uploadedBytes, speed, progress, etaSeconds });
    }
    fs.closeSync(fdUpload);

    await updateStatus('finalizing');

    // 5. Create
    const createRes = await teraboxClient.create(targetPath, totalBytes, 0, blockList, uploadid);
    if (createRes.errno !== 0) {
      throw new Error(`Create Error: ${JSON.stringify(createRes)}`);
    }

    // Success! Update Firestore with final info
    let videoId = undefined;
    if (job.autoRegisterVideo) {
      const videoRef = await addDoc(collection(db, 'videos'), {
        title: job.filename,
        slug: job.filename.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: job.category,
        source: 'terabox',
        teraboxFsId: createRes.fs_id || null,
        teraboxPath: targetPath,
        teraboxMd5: blockList.length === 1 ? blockList[0] : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 0
      });
      videoId = videoRef.id;
    }

    await updateStatus('completed', {
      progress: 100,
      completedAt: new Date().toISOString(),
      teraboxFsId: createRes.fs_id || null,
      teraboxPath: targetPath,
      videoId
    });

  } catch (error: any) {
    await updateStatus('failed', {
      errorCode: error.code || 'UNKNOWN_ERROR',
      errorMessage: error.message
    });
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}
