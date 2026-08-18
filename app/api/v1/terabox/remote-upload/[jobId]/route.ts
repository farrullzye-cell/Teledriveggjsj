import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const docRef = doc(db, 'terabox_upload_jobs', jobId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: { message: 'Job not found' } }, { status: 404 });
    }

    const data = snap.data();
    return NextResponse.json({
      success: true,
      job: {
        id: snap.id,
        ...data,
        terabox: data.teraboxFsId ? { uploadId: data.teraboxFsId, path: data.teraboxPath } : undefined
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const docRef = doc(db, 'terabox_upload_jobs', jobId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: { message: 'Job not found' } }, { status: 404 });
    }

    const job = snap.data();
    if (['downloading', 'preparing', 'uploading', 'finalizing'].includes(job.status)) {
      return NextResponse.json({ success: false, error: { message: 'Cannot delete an active job. Cancel it first.' } }, { status: 400 });
    }

    await deleteDoc(docRef);

    return NextResponse.json({ success: true, message: 'Job deleted' });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
