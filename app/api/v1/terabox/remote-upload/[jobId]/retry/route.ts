import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { processTeraboxJob } from '@/lib/terabox-ingestion';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const docRef = doc(db, 'terabox_upload_jobs', jobId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: { message: 'Job not found' } }, { status: 404 });
    }

    const job = snap.data();
    if (!['failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ success: false, error: { message: 'Only failed or cancelled jobs can be retried' } }, { status: 400 });
    }

    await updateDoc(docRef, { 
      status: 'queued', 
      updatedAt: new Date().toISOString(),
      retryCount: (job.retryCount || 0) + 1,
      errorMessage: null,
      errorCode: null,
      progress: 0,
      bytesProcessed: 0,
      speed: 0
    });

    // Fire & forget
    processTeraboxJob(jobId).catch(console.error);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
