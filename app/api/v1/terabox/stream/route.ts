import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ success: false, error: { message: 'path is required' } }, { status: 400 });
    }

    const data = await teraboxClient.getStreamingInfo(path);
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
