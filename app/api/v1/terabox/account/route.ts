import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function GET(req: NextRequest) {
  try {
    const data = await teraboxClient.getUserInfo();
    return NextResponse.json({
      success: true,
      data: {
        userId: data.userid,
        connected: true,
        // We only expose limited info to frontend
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
