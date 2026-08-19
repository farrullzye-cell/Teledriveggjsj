import { NextRequest, NextResponse } from 'next/server';
import {
  getStoredDriveSession,
  saveDriveSession,
  clearDriveSession,
  getDriveAboutInfo,
  getGoogleDriveConfig,
} from '@/lib/google-drive-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/drive/session
 * Return current permanent Firestore session status & user details
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getStoredDriveSession();
    const config = await getGoogleDriveConfig();
    const domain = config.domain || 'https://teledriveggjsjjj.onrender.com';

    if (!session || !session.access_token) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        status: 'DISCONNECTED',
        domain,
        session: null,
      });
    }

    const isExpired = session.expires_at ? Date.now() >= session.expires_at : false;

    // Try fetching fresh about info if token is active
    let about = null;
    try {
      about = await getDriveAboutInfo(session.access_token);
    } catch (e) {
      // Token might be expired
    }

    return NextResponse.json({
      success: true,
      authenticated: !isExpired,
      status: isExpired ? 'EXPIRED' : (session.status || 'CONNECTED'),
      domain: session.domain || domain,
      user: session.user || about?.user || null,
      expires_at: session.expires_at || null,
      has_refresh_token: !!session.refresh_token,
      connected_at: session.connected_at || null,
      last_refreshed_at: session.last_refreshed_at || null,
      storageQuota: about?.storageQuota || null,
    });
  } catch (error: any) {
    console.error('Error fetching Drive session:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SESSION_FETCH_ERROR', message: error.message || 'Failed to fetch session' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/drive/session
 * Permanently save/update Google Drive login session to Firestore
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      expires_at,
      user,
      domain = 'https://teledriveggjsjjj.onrender.com',
    } = body;

    if (!access_token) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PARAM', message: 'access_token wajib disertakan.' },
        },
        { status: 400 }
      );
    }

    const computedExpiresAt =
      expires_at || (expires_in ? Date.now() + parseInt(expires_in, 10) * 1000 : Date.now() + 3600 * 1000);

    // Fetch user profile from Google Drive if not fully supplied
    let userProfile = user;
    try {
      const about = await getDriveAboutInfo(access_token);
      if (about && about.user) {
        userProfile = {
          displayName: about.user.displayName,
          email: about.user.emailAddress,
          photoURL: about.user.photoLink,
          ...user,
        };
      }
    } catch (e) {
      // Use existing user profile
    }

    const savedSession = await saveDriveSession({
      status: 'CONNECTED',
      access_token,
      refresh_token: refresh_token || undefined,
      expires_at: computedExpiresAt,
      user: userProfile,
      domain: domain || 'https://teledriveggjsjjj.onrender.com',
      connected_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Sesi Google Drive berhasil disimpan permanen di Firestore.',
      domain: savedSession.domain,
      status: savedSession.status,
      user: savedSession.user,
      expires_at: savedSession.expires_at,
    });
  } catch (error: any) {
    console.error('Error saving Drive session:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SESSION_SAVE_ERROR', message: error.message || 'Failed to save session' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/drive/session
 * Disconnect Google Drive session from Firestore
 */
export async function DELETE() {
  try {
    await clearDriveSession();
    return NextResponse.json({
      success: true,
      message: 'Sesi Google Drive berhasil dihapus dari Firestore.',
    });
  } catch (error: any) {
    console.error('Error disconnecting Drive session:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SESSION_DISCONNECT_ERROR', message: error.message || 'Failed to disconnect session' },
      },
      { status: 500 }
    );
  }
}
