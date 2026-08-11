import { NextRequest, NextResponse } from 'next/server';
import { verifyPin } from '@/lib/excel-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, message: 'PIN tidak boleh kosong' },
        { status: 400 }
      );
    }

    const result = await verifyPin(pin);

    const response = NextResponse.json(result, {
      status: result.success ? 200 : result.locked ? 429 : 401,
    });

    if (result.success) {
      // Set admin session cookie valid for 24 hours
      response.cookies.set('rullzye_session', 'authenticated_admin', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
      });
    }

    return response;
  } catch (err: any) {
    console.error('Verify PIN error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
