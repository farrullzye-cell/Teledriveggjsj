import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { processTeraboxJob } from '@/lib/terabox-ingestion';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceUrl, filename, directory, category, autoRegisterVideo, autoExtractMetadata } = body;

    if (!sourceUrl) {
      return NextResponse.json({ success: false, error: { message: 'sourceUrl is required' } }, { status: 400 });
    }

    const defaultDir = directory || '/From: Other Applications/rullzyecloud/';
    const defaultFilename = filename || sourceUrl.split('/').pop()?.split('?')[0] || `video_${Date.now()}.mp4`;

    // Save job to firestore
    const jobsCollection = collection(db, 'terabox_upload_jobs');
    const newJob = {
      sourceUrl,
      sourceUrlHash: crypto.createHash('md5').update(sourceUrl).digest('hex'),
      filename: defaultFilename,
      directory: defaultDir,
      category: category || 'General',
      status: 'queued',
      progress: 0,
      bytesProcessed: 0,
      totalBytes: null,
      speed: 0,
      etaSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
      autoRegisterVideo: !!autoRegisterVideo,
      autoExtractMetadata: !!autoExtractMetadata
    };

    const docRef = await addDoc(jobsCollection, newJob);

    // Fire & forget the background worker
    processTeraboxJob(docRef.id).catch(console.error);

    return NextResponse.json({
      success: true,
      job: {
        id: docRef.id,
        ...newJob
      }
    });

  } catch (error: any) {
    console.error('Remote upload API Error:', error);
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitNum = parseInt(searchParams.get('limit') || '20', 10);

    const jobsCollection = collection(db, 'terabox_upload_jobs');
    
    // In a real prod environment we'd use pagination cursors, but this is simple fetch
    const q = query(jobsCollection, orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    
    let jobs = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));

    if (statusParam && statusParam !== 'all') {
      jobs = jobs.filter(j => j.status === statusParam);
    }

    // Manual slice pagination for simplicity
    const startIdx = (page - 1) * limitNum;
    const paginated = jobs.slice(startIdx, startIdx + limitNum);

    return NextResponse.json({
      success: true,
      data: paginated,
      total: jobs.length,
      page,
      limit: limitNum
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
