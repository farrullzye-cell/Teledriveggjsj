import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleDriveConfig,
  saveDriveSession,
  getDriveAboutInfo,
  ensureDriveVaultFolders,
} from '@/lib/google-drive-server';
import { DEFAULT_DRIVE_CONFIG } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/drive/auth/callback
 * Handles OAuth callback from Google Identity, saves session permanently in Firestore
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const stateRaw = url.searchParams.get('state');

  const config = await getGoogleDriveConfig();
  const domain = config.domain || 'https://teledriveggjsjjj.onrender.com';

  if (error) {
    console.error('Google OAuth error from callback:', error);
    return NextResponse.redirect(new URL(`/?gdrive_error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?gdrive_error=missing_code', req.url));
  }

  try {
    const clientId = config.client_id || DEFAULT_DRIVE_CONFIG.client_id;
    const clientSecret = config.client_secret || process.env.GOOGLE_CLIENT_SECRET || '';

    // Reconstruct redirect_uri
    const hostHeader = req.headers.get('host') || 'teledriveggjsjjj.onrender.com';
    const protocol = hostHeader.includes('localhost') ? 'http' : 'https';
    const currentOrigin = `${protocol}://${hostHeader}`;
    const redirectUri = `${currentOrigin}/api/v1/drive/auth/callback`;

    // Exchange authorization code for tokens
    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    if (clientSecret) {
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Failed to exchange code for token:', errBody);
      return NextResponse.redirect(
        new URL(`/?gdrive_error=${encodeURIComponent('Token exchange failed')}`, req.url)
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Fetch user profile
    let userProfile = null;
    try {
      const about = await getDriveAboutInfo(accessToken);
      if (about && about.user) {
        userProfile = {
          displayName: about.user.displayName,
          email: about.user.emailAddress,
          photoURL: about.user.photoLink,
        };
      }
    } catch (e) {
      console.warn('Could not fetch user profile from Drive about:', e);
    }

    // Save permanently to Firestore & config.json
    await saveDriveSession({
      status: 'CONNECTED',
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
      expires_at: expiresAt,
      user: userProfile || undefined,
      domain,
      authorized_domains: [domain, currentOrigin, 'http://localhost:3000'],
      connected_at: new Date().toISOString(),
    });

    // Auto-ensure Vault folders exist in Google Drive
    try {
      await ensureDriveVaultFolders(accessToken);
    } catch (e) {
      console.warn('Could not auto-ensure vault folders after login:', e);
    }

    // Redirect to root with success notification
    return NextResponse.redirect(new URL('/?gdrive_auth=success', req.url));
  } catch (err: any) {
    console.error('Exception during OAuth callback handling:', err);
    return NextResponse.redirect(
      new URL(`/?gdrive_error=${encodeURIComponent(err.message || 'OAuth failure')}`, req.url)
    );
  }
}
