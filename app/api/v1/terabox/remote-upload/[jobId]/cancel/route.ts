import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const docRef = doc(db, 'terabox_upload_jobs', jobId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: { message: 'Job not found' } }, { status: 404 });
    }

    const job = snap.data();
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return NextResponse.json({ success: false, error: { message: 'Job is not active' } }, { status: 400 });
    }

    await updateDoc(docRef, { status: 'cancelled', updatedAt: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'cancelled'
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
