import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function GET(req: NextRequest) {
  try {
    const data = await teraboxClient.getQuota();
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
