import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveConfig } from '@/lib/google-drive-server';
import { DEFAULT_DRIVE_CONFIG } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/drive/auth/url
 * Generate Google OAuth 2.0 Direct Login URL with offline access
 */
export async function GET(req: NextRequest) {
  try {
    const config = await getGoogleDriveConfig();
    const clientId = config.client_id || DEFAULT_DRIVE_CONFIG.client_id;

    // Determine redirect URI (prefer configured domain https://teledriveggjsjjj.onrender.com)
    const hostHeader = req.headers.get('host') || 'teledriveggjsjjj.onrender.com';
    const protocol = hostHeader.includes('localhost') ? 'http' : 'https';
    const detectedOrigin = `${protocol}://${hostHeader}`;
    const targetDomain = config.domain || 'https://teledriveggjsjjj.onrender.com';

    // Allow dynamic redirect if running on localhost or dev server
    const effectiveOrigin = hostHeader.includes('localhost') || hostHeader.includes('run.app') ? detectedOrigin : targetDomain;
    const redirectUri = `${effectiveOrigin}/api/v1/drive/auth/callback`;

    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: encodeURIComponent(JSON.stringify({ domain: targetDomain, origin: effectiveOrigin })),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({
      success: true,
      authUrl,
      clientId,
      redirectUri,
      domain: targetDomain,
    });
  } catch (error: any) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'OAUTH_URL_ERROR', message: error.message || 'Failed to generate OAuth URL' },
      },
      { status: 500 }
    );
  }
}
