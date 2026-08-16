import { NextRequest, NextResponse } from 'next/server';
import { listImageKitFiles, getImageKitCredentials } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const creds = await getImageKitCredentials();
    const publicKey = body.publicKey || creds.publicKey;
    const privateKey = body.privateKey || creds.privateKey;
    const urlEndpoint = body.urlEndpoint || creds.urlEndpoint;

    if (!publicKey || !privateKey || !urlEndpoint) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ImageKit Public Key, Private Key, atau URL Endpoint belum lengkap.',
        },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const testRes = await listImageKitFiles(creds.defaultFolder || '/rullzye_cloud', 5);
    if (!testRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: testRes.error || 'Gagal tersambung ke ImageKit API.',
        },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Koneksi ImageKit.io CDN Berhasil!',
        folder: creds.defaultFolder,
        files_sample_count: testRes.files?.length || 0,
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Exception during ImageKit test' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
