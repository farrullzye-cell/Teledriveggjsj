import { NextResponse } from 'next/server';
import { generateImageKitAuthParams } from '@/lib/imagekit';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const authParams = await generateImageKitAuthParams();

    if ('error' in authParams) {
      return NextResponse.json(
        { success: false, message: authParams.error },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        token: authParams.token,
        expire: authParams.expire,
        signature: authParams.signature,
        publicKey: authParams.publicKey,
        urlEndpoint: authParams.urlEndpoint,
      },
      { headers: getCorsHeaders() }
    );
  } catch (err: any) {
    console.error('ImageKit auth error:', err);
    return NextResponse.json(
      { success: false, message: 'Gagal menghasilkan parameter autentikasi ImageKit: ' + err.message },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
