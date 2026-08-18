import { NextRequest, NextResponse } from 'next/server';
import { teraboxClient } from '@/lib/terabox-client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fidlistStr = searchParams.get('fidlist');

    if (!fidlistStr) {
      return NextResponse.json({ success: false, error: { message: 'fidlist is required' } }, { status: 400 });
    }

    let fidlist = [];
    try {
      fidlist = JSON.parse(fidlistStr);
      if (!Array.isArray(fidlist)) throw new Error('fidlist must be an array');
    } catch (e) {
      return NextResponse.json({ success: false, error: { message: 'invalid fidlist JSON format' } }, { status: 400 });
    }

    const data = await teraboxClient.getDownloadLink(fidlist);
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
