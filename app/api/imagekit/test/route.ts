import { NextRequest, NextResponse } from 'next/server';
import { testImageKitConnection } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    let publicKey: string | undefined;
    let privateKey: string | undefined;
    let urlEndpoint: string | undefined;

    try {
      const body = await req.json();
      if (body.publicKey && !body.publicKey.startsWith('••••')) publicKey = body.publicKey;
      if (body.privateKey && !body.privateKey.startsWith('••••')) privateKey = body.privateKey;
      if (body.urlEndpoint && !body.urlEndpoint.startsWith('••••')) urlEndpoint = body.urlEndpoint;
    } catch {}

    const result = await testImageKitConnection(publicKey, privateKey, urlEndpoint);
    return NextResponse.json(result, { headers: getCorsHeaders() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: 'Gagal menguji koneksi ImageKit: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
