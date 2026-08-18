import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operation, files } = body;

    if (!operation || !['copy', 'move', 'rename', 'delete'].includes(operation)) {
      return NextResponse.json({ success: false, error: { message: 'invalid operation' } }, { status: 400 });
    }

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ success: false, error: { message: 'files array is required' } }, { status: 400 });
    }

    const data = await teraboxClient.fileManager(operation, files);
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
