import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const path = searchParams.get('path') || '/';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const num = parseInt(searchParams.get('num') || '20', 10);

    const data = await teraboxClient.listFiles(path, page, num);
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
