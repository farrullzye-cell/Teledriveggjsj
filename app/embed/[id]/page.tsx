import React from 'react';
import { getFileById } from '@/lib/excel-db';

export const dynamic = 'force-dynamic';

export default async function EmbedPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = id ? await getFileById(id) : null;

  if (!file) {
    return (
      <html lang="en" style={{ margin: 0, padding: 0, width: '100%', height: '100%', backgroundColor: '#030712' }}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Video Not Found - RULLZYE Player</title>
        </head>
        <body style={{
          margin: 0,
          padding: '20px',
          width: '100%',
          height: '100%',
          backgroundColor: '#030712',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>✕</div>
            <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '15px', margin: 0 }}>404 Video Tidak Ditemukan</p>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
              Berkas video ID <code>{id}</code> tidak ditemukan atau telah dihapus.
            </p>
          </div>
        </body>
      </html>
    );
  }

  const streamProxyUrl = `/api/v1/videos/stream/${file.id}`;
  const directGdriveUrl = file.gdrive_url || (file.gdrive_file_id ? `https://drive.google.com/uc?export=download&id=${file.gdrive_file_id}` : '');
  const gdriveEmbedPreviewUrl = file.gdrive_file_id
    ? `https://drive.google.com/file/d/${file.gdrive_file_id}/preview`
    : '';
  const posterUrl = file.gdrive_thumbnail_url || `/api/thumbnail/${file.id}`;

  return (
    <html lang="id" style={{ margin: 0, padding: 0, width: '100%', height: '100%', backgroundColor: '#000000' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <title>{file.name} - RULLZYE Video Player</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
          .player-wrapper { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; background: #000; }
          video { width: 100%; height: 100%; object-fit: contain; background: #000; }
          iframe.fallback-frame { width: 100%; height: 100%; border: none; background: #000; position: absolute; inset: 0; z-index: 10; display: none; }
          .watermark { position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 800; color: #fff; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(8px); padding: 4px 10px; border-radius: 8px; pointer-events: none; z-index: 20; letter-spacing: 0.5px; }
          .quality-bar { position: absolute; top: 12px; left: 12px; z-index: 25; display: flex; align-items: center; gap: 6px; }
          .quality-select { background: rgba(15, 23, 42, 0.85); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); backdrop-filter: blur(8px); padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; outline: none; cursor: pointer; }
          .fallback-bar { position: absolute; bottom: 12px; left: 12px; z-index: 25; display: none; }
          .btn-fallback { background: rgba(14, 165, 233, 0.9); color: #fff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        ` }} />
      </head>
      <body>
        <div className="player-wrapper" id="player-container">
          <div className="quality-bar" id="quality-bar-ui">
            <select id="quality-selector" className="quality-select" title="Pilih Kualitas Video">
              <option value="auto">⚡ Kualitas: Auto</option>
              <option value="1080p">1080p FHD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p SD (Lancar)</option>
              <option value="360p">360p (Hemat Kuota)</option>
              <option value="240p">240p (Super Ringan)</option>
            </select>
          </div>

          <video
            id="main-video-player"
            poster={posterUrl}
            controls
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          >
            <source id="video-source-main" src={streamProxyUrl} type="video/mp4" />
            {directGdriveUrl && <source src={directGdriveUrl} type="video/mp4" />}
            Your browser does not support HTML5 video streaming.
          </video>

          {gdriveEmbedPreviewUrl && (
            <iframe
              id="gdrive-iframe-fallback"
              className="fallback-frame"
              src={gdriveEmbedPreviewUrl}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />
          )}

          <div className="watermark">RULLZYE CLOUD</div>

          <div className="fallback-bar" id="fallback-ui">
            <button
              className="btn-fallback"
              id="btn-switch-server"
              type="button"
            >
              🔄 Ganti Server Streaming
            </button>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            const vid = document.getElementById('main-video-player');
            const iframe = document.getElementById('gdrive-iframe-fallback');
            const fallbackUi = document.getElementById('fallback-ui');
            const btnSwitch = document.getElementById('btn-switch-server');
            const qualitySelect = document.getElementById('quality-selector');
            const baseStreamUrl = '/api/v1/videos/stream/${file.id}';
            let isIframeActive = false;
            let monetizationTriggered = false;

            // Handle Quality Selection Change
            if (qualitySelect && vid) {
              qualitySelect.addEventListener('change', function() {
                const res = this.value;
                const currentPos = vid.currentTime || 0;
                const wasPlaying = !vid.paused;
                
                vid.src = baseStreamUrl + (res === 'auto' ? '' : '?res=' + res);
                vid.load();
                
                const onLoaded = function() {
                  vid.currentTime = currentPos;
                  if (wasPlaying) {
                    vid.play().catch(function() {});
                  }
                  vid.removeEventListener('loadedmetadata', onLoaded);
                };
                vid.addEventListener('loadedmetadata', onLoaded);
              });
            }

            // Trigger monetization on play action
            if (vid) {
              vid.addEventListener('play', function() {
                if (!monetizationTriggered) {
                  monetizationTriggered = true;
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

              // Anti-error auto fallback to Iframe if video stream decoding fails or stalls
              let stallTimer = null;

              function startStallTimer() {
                if (stallTimer) clearTimeout(stallTimer);
                stallTimer = setTimeout(function() {
                  if (vid && (vid.paused || vid.readyState < 3)) {
                    console.warn('[EMBED-PLAYER] Buffering detected > 3.8s, activating anti-buffer iframe player');
                    if (iframe) {
                      vid.style.display = 'none';
                      iframe.style.display = 'block';
                      isIframeActive = true;
                      if (fallbackUi) fallbackUi.style.display = 'block';
                    }
                  }
                }, 3800);
              }

              function clearStallTimer() {
                if (stallTimer) {
                  clearTimeout(stallTimer);
                  stallTimer = null;
                }
              }

              vid.addEventListener('waiting', startStallTimer);
              vid.addEventListener('stalled', startStallTimer);
              vid.addEventListener('playing', clearStallTimer);
              vid.addEventListener('timeupdate', clearStallTimer);

              vid.addEventListener('error', function(e) {
                console.warn('[PLAYER-FALLBACK] HTML5 Video Error, activating Iframe failover:', e);
                clearStallTimer();
                if (iframe) {
                  vid.style.display = 'none';
                  iframe.style.display = 'block';
                  isIframeActive = true;
                  if (fallbackUi) fallbackUi.style.display = 'block';
                }
              });
            }

            if (btnSwitch && iframe && vid) {
              btnSwitch.addEventListener('click', function() {
                if (isIframeActive) {
                  iframe.style.display = 'none';
                  vid.style.display = 'block';
                  vid.load();
                  vid.play().catch(() => {});
                  isIframeActive = false;
                } else {
                  vid.style.display = 'none';
                  iframe.style.display = 'block';
                  isIframeActive = true;
                }
              });
            }
          })();
        ` }} />
      </body>
    </html>
  );
}
