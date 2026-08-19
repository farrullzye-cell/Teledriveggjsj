import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_ADMIN_EMAIL } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/admin-check
 * Returns the configured allowed admin email and auth policy
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    allowedAdminEmail: ALLOWED_ADMIN_EMAIL,
    authProvider: 'firebase_google_auth',
    policy: 'strict_whitelist_single_admin',
    message: `Hanya user dengan email ${ALLOWED_ADMIN_EMAIL} yang diizinkan mengakses panel ini.`,
  });
}
