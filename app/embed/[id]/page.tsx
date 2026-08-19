import React from 'react';
import { getFileById } from '@/lib/excel-db';

export const dynamic = 'force-dynamic';

export default async function EmbedPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await getFileById(id);

  if (!file) {
    return (
      <div style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#030712',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontSize: '14px',
        textAlign: 'center'
      }}>
        <div>
          <p style={{ color: '#ef4444', fontWeight: 'bold' }}>[404] Video Not Found</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>The requested media ID does not exist or was removed.</p>
        </div>
      </div>
    );
  }

  const mediaUrl = file.imagekit_url || `/api/files/${file.id}/download`;
  const posterUrl = file.imagekit_thumbnail_url || `/api/thumbnail/${file.id}`;

  return (
    <html lang="en" style={{ margin: 0, padding: 0, width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>{file.name} - RULLZYE Player Embed</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { width: 100%; height: 100%; overflow: hidden; background: #000; }
          .player-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
          video { width: 100%; height: 100%; object-fit: contain; }
          .brand-watermark { position: absolute; top: 12px; right: 12px; font-family: sans-serif; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 6px; pointer-events: none; }
        ` }} />
      </head>
      <body>
        <div className="player-container">
          <video
            src={mediaUrl}
            poster={posterUrl}
            controls
            playsInline
            preload="metadata"
            id="video-element"
          >
            Your browser does not support HTML5 video streaming.
          </video>
          <div className="brand-watermark">RULLZYE STREAM</div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          const vid = document.getElementById('video-element');
          if (vid) {
            let triggered = false;
            vid.addEventListener('play', () => {
              if (!triggered) {
                triggered = true;
                fetch('/api/v1/monetization/click', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ videoId: '${file.id}', triggerType: 'play_button' })
                }).then(r => r.json()).then(d => {
                  if (d.success && d.data && d.data.triggered && d.data.smartlinkUrl) {
                    window.open(d.data.smartlinkUrl, '_blank');
                  }
                }).catch(() => {});
              }
            });
          }
        ` }} />
      </body>
    </html>
  );
}
