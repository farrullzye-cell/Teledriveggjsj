// XVIDSHUB — High Speed Public Video & Media Portal Client JavaScript

// Helper to safely inject HTML and execute embedded script tags
function injectHTMLWithScripts(container, htmlContent) {
  if (!container) return;
  container.innerHTML = htmlContent;
  const scripts = Array.from(container.getElementsByTagName('script'));
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    if (oldScript.innerHTML) {
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
    }
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

// Backend API Base URL
const API_BASE_URL = window.location.origin.includes('localhost')
  ? ''
  : 'https://teledriveggjsj.onrender.com';

let currentCategory = 'ALL';
let currentSearch = '';
let allFiles = [];
let siteConfig = {
  title: 'XVIDSHUB',
  categories: [],
  monetization: {
    enabled: true,
    popunder_rate: 100,
    popunder_url: 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js',
    banner_top_html: '',
    player_overlay_html: '',
    native_ad_html: ''
  }
};

let currentPlayingFile = null;

// Track liked files locally
function getLikedFiles() {
  try {
    return JSON.parse(localStorage.getItem('xvidshub_liked_files') || '[]');
  } catch (e) {
    return [];
  }
}

function saveLikedFile(fileId) {
  const liked = getLikedFiles();
  if (!liked.includes(fileId)) {
    liked.push(fileId);
    localStorage.setItem('xvidshub_liked_files', JSON.stringify(liked));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSiteConfig();
  fetchPublicMedia();

  // Handle hash route e.g. #watch/file_123
  window.addEventListener('hashchange', handleHashRoute);
  setTimeout(handleHashRoute, 500);

  // Attach global popunder ad trigger to body clicks
  document.body.addEventListener('click', (e) => {
    if (!siteConfig.monetization || !siteConfig.monetization.enabled) return;

    const rate = Number(siteConfig.monetization.popunder_rate || 100);
    const randomChance = Math.floor(Math.random() * 100) + 1;

    if (e.target && (e.target.closest('input') || e.target.closest('button'))) {
      // Don't intercept input typing
    }

    if (randomChance <= rate) {
      let popUrl = siteConfig.monetization.popunder_url || 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js';
      if (popUrl.includes('google.com')) {
        popUrl = 'https://pl30817522.effectivecpmnetwork.com/d1/da/6d/d1da6dca3edd85a05e5e4ba7572c3d33.js';
      }

      if (popUrl && !window._popunderTriggeredThisSession) {
        window._popunderTriggeredThisSession = true;

        if (popUrl.endsWith('.js')) {
          if (!document.getElementById('adsterra-dyn-pop')) {
            const sc = document.createElement('script');
            sc.id = 'adsterra-dyn-pop';
            sc.src = popUrl;
            document.head.appendChild(sc);
          }
        } else {
          window.open(popUrl, '_blank');
        }

        setTimeout(() => {
          window._popunderTriggeredThisSession = false;
        }, 5000);
      }
    }
  });
});

// Load Site Config & Monetization Settings
async function loadSiteConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/public/config`);
    const data = await res.json();

    if (data.success) {
      siteConfig = data;

      // Render Top Banner Ad
      const bannerAdContainer = document.getElementById('top-banner-ad-container');
      if (bannerAdContainer) {
        if (data.monetization && data.monetization.enabled && data.monetization.banner_top_html) {
          injectHTMLWithScripts(bannerAdContainer, `<div class="p-2 bg-[#0f1422] border border-amber-500/30 rounded-2xl text-center shadow-lg my-2 flex justify-center items-center overflow-hidden">${data.monetization.banner_top_html}</div>`);
        } else if (data.monetization && data.monetization.enabled) {
          bannerAdContainer.innerHTML = `
            <div class="p-3 bg-[#0f1422] border border-dashed border-amber-500/30 rounded-2xl text-center shadow-lg my-2 flex items-center justify-between text-xs text-amber-400 font-mono">
              <span class="flex items-center"><i class="fa-solid fa-rectangle-ad mr-2 text-base"></i><strong>XVIDSHUB Sponsor Banner Ad</strong></span>
              <span class="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">Monetized</span>
            </div>
          `;
        }
      }

      // Render Native Ad Container (468x60 iframe ad)
      const nativeAdContainer = document.getElementById('native-ad-container');
      if (nativeAdContainer) {
        if (data.monetization && data.monetization.enabled && data.monetization.native_ad_html) {
          injectHTMLWithScripts(nativeAdContainer, data.monetization.native_ad_html);
        } else if (data.monetization && data.monetization.enabled) {
          injectHTMLWithScripts(nativeAdContainer, `<div class="flex justify-center items-center my-2 p-2 bg-[#0f1422] border border-amber-500/30 rounded-2xl shadow-lg"><script>atOptions = {'key' : 'f8eb57861126a6d63865b2645c52d941','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src="https://www.highperformanceformat.com/f8eb57861126a6d63865b2645c52d941/invoke.js"></script></div>`);
        }
      }

      // Render Dynamic Category Topics Chips
      renderCategoryChips(data.categories || []);
    }
  } catch (err) {
    console.warn('Failed loading site config:', err);
  }
}

// Render Topic Categories Chips
function renderCategoryChips(categories) {
  const container = document.getElementById('category-chips');
  if (!container) return;

  let html = `
    <button onclick="setCategoryFilter('ALL')" class="category-chip ${currentCategory === 'ALL' ? 'active bg-rose-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'} px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-md">
      🔥 Semua Media
    </button>
  `;

  categories.forEach((cat) => {
    const isSelected = currentCategory === cat.id;
    html += `
      <button onclick="setCategoryFilter('${cat.id}')" class="category-chip ${isSelected ? 'active bg-rose-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'} px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1">
        <i class="fa-solid fa-folder text-rose-500 text-[11px]"></i>
        <span>${cat.name}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

// Set Active Category Filter
function setCategoryFilter(catId) {
  currentCategory = catId;
  const chips = document.querySelectorAll('.category-chip');
  chips.forEach((chip) => {
    chip.classList.remove('active', 'bg-rose-600', 'text-white');
    chip.classList.add('bg-slate-900', 'text-slate-300');
  });

  fetchPublicMedia();
}

// Search Input Handler
function handleSearch() {
  const input = document.getElementById('search-input');
  currentSearch = input ? input.value.trim() : '';
  renderGrid(allFiles);
}

// Fetch Public Media Files
async function fetchPublicMedia() {
  const grid = document.getElementById('file-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full py-16 text-center text-slate-400 font-mono text-xs">
      <i class="fa-solid fa-circle-notch fa-spin text-rose-500 text-3xl mb-3"></i>
      <p class="font-bold text-slate-200">Memuat koleksi video menarik XVIDSHUB...</p>
    </div>
  `;

  try {
    const url = `${API_BASE_URL}/api/v1/public/media?category=${currentCategory}&vault_id=${currentCategory}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.media || data.media.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-[#0f1422] border border-slate-800/80 rounded-3xl p-8">
          <i class="fa-regular fa-folder-open text-slate-600 text-5xl mb-4"></i>
          <p class="text-slate-200 font-bold text-base">Belum ada video atau foto pada kategori ini.</p>
          <p class="text-xs text-slate-500 mt-1 font-mono">Silakan pilih kategori topik lain di bagian atas.</p>
        </div>
      `;
      const badge = document.getElementById('video-count-badge');
      if (badge) badge.innerText = '0 Video';
      return;
    }

    allFiles = data.media;
    const badge = document.getElementById('video-count-badge');
    if (badge) badge.innerText = `${allFiles.length} Video`;

    renderGrid(allFiles);
  } catch (err) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center bg-[#0f1422] border border-slate-800 rounded-3xl p-6 text-slate-300 text-xs">
        <i class="fa-solid fa-rotate-right text-3xl mb-2 text-rose-500"></i>
        <p class="font-bold text-sm">Gagal memuat media. Coba muat ulang halaman.</p>
      </div>
    `;
  }
}

// Render Video Grid with Thumbnails, Views, and Likes
function renderGrid(files) {
  const grid = document.getElementById('file-grid');
  if (!grid) return;

  let filtered = files;
  if (currentSearch) {
    filtered = files.filter(f => f.title.toLowerCase().includes(currentSearch.toLowerCase()));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 text-xs font-mono">
        Tidak ada video yang sesuai dengan pencarian "${currentSearch}".
      </div>
    `;
    return;
  }

  const likedList = getLikedFiles();

  grid.innerHTML = filtered.map(file => {
    const isImage = file.type === 'image';
    const isVideo = file.type === 'video';
    const isLiked = likedList.includes(file.id);

    let thumbnailHtml = `
      <div class="w-full h-44 bg-black flex items-center justify-center text-slate-600 text-4xl">
        <i class="${getIconForType(file.type)}"></i>
      </div>
    `;

    if (isImage) {
      thumbnailHtml = `
        <div class="w-full h-44 bg-slate-950 overflow-hidden relative">
          <img src="${file.media_url}" alt="${file.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
          <span class="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
            FOTO HD
          </span>
        </div>
      `;
    } else if (isVideo) {
      thumbnailHtml = `
        <div class="w-full h-44 bg-slate-950 relative overflow-hidden flex items-center justify-center">
          <video src="${file.media_url}#t=0.5" preload="metadata" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" muted></video>
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
            <div class="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center text-lg shadow-xl shadow-rose-600/50 group-hover:scale-110 transition border border-rose-400/40">
              <i class="fa-solid fa-play ml-1"></i>
            </div>
          </div>
          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-slate-200 border border-slate-700">
            HD STREAM
          </span>
        </div>
      `;
    }

    return `
      <div onclick="openWatchView('${file.id}')" class="file-card group bg-[#0f1422] border border-slate-800/80 hover:border-rose-500/60 rounded-2xl overflow-hidden transition duration-300 shadow-xl cursor-pointer flex flex-col justify-between">
        <div>
          ${thumbnailHtml}
          <div class="p-3.5 space-y-2">
            <div class="flex items-center justify-between text-[10px] font-mono">
              <span class="px-2 py-0.5 rounded font-bold bg-slate-900 text-rose-400 uppercase border border-slate-800">${file.type}</span>
              <span class="text-slate-400 font-bold">${file.size_formatted}</span>
            </div>
            <h4 class="text-xs font-bold text-slate-100 line-clamp-2 group-hover:text-rose-400 transition leading-snug" title="${file.title}">${file.title}</h4>
            <p class="text-[10px] text-slate-400 font-mono truncate"><i class="fa-solid fa-folder text-rose-500/70 mr-1"></i>${file.vault.name}</p>
          </div>
        </div>
        
        <!-- Views & Like Counter Footer Bar -->
        <div class="p-3 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-900/90 mt-1 bg-slate-950/40">
          <span class="text-amber-400/90 font-bold flex items-center">
            <i class="fa-solid fa-eye text-amber-400 mr-1"></i>${file.views || 0}
          </span>
          <button onclick="toggleLikeCard(event, '${file.id}')" class="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 transition">
            <i class="${isLiked ? 'fa-solid text-rose-500' : 'fa-regular'} fa-heart text-xs"></i>
            <span id="like-count-${file.id}" class="font-bold">${file.likes || 0}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getIconForType(type) {
  switch (type) {
    case 'image': return 'fa-regular fa-image text-rose-400';
    case 'video': return 'fa-solid fa-film text-pink-400';
    case 'document': return 'fa-regular fa-file-lines text-emerald-400';
    default: return 'fa-regular fa-file text-slate-400';
  }
}

// Handle Hash Route e.g. #watch/file_123
function handleHashRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#watch/')) {
    const fileId = hash.replace('#watch/', '');
    openWatchView(fileId, false);
  }
}

// Open Dedicated Full Streaming Watch Page
function openWatchView(fileId, updateHash = true) {
  const file = allFiles.find(f => f.id === fileId);
  if (!file) return;

  currentPlayingFile = file;
  if (updateHash) {
    window.location.hash = `watch/${fileId}`;
  }

  // Hide Home & Show Watch View
  const homeTab = document.getElementById('tab-home');
  const watchTab = document.getElementById('tab-watch');
  if (homeTab) homeTab.classList.add('hidden');
  if (watchTab) watchTab.classList.remove('hidden');

  // Populate Watch Page Elements
  const watchTitle = document.getElementById('watch-title');
  const watchCategory = document.getElementById('watch-category-badge');
  const watchSize = document.getElementById('watch-size-badge');
  const watchViews = document.getElementById('watch-views-count');
  const watchLikes = document.getElementById('watch-likes-count');
  const downloadLink = document.getElementById('watch-download-link');
  const videoPlayer = document.getElementById('watch-video-player');
  const adOverlay = document.getElementById('watch-player-ad-overlay');

  if (watchTitle) watchTitle.innerText = file.title;
  if (watchCategory) watchCategory.innerText = file.vault.name;
  if (watchSize) watchSize.innerText = file.size_formatted;
  
  // Increment view count on backend
  file.views = (file.views || 0) + 1;
  if (watchViews) watchViews.innerText = file.views;
  if (watchLikes) watchLikes.innerText = file.likes || 0;

  // Send View Increment API
  fetch(`${API_BASE_URL}/api/v1/public/media/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: file.id, action: 'view' })
  }).catch(() => {});

  if (downloadLink) downloadLink.href = file.download_url;

  // Video Source setup
  if (videoPlayer) {
    videoPlayer.src = file.media_url;
    videoPlayer.load();
  }

  // Reset Overlay
  if (adOverlay) adOverlay.classList.remove('hidden');

  // Populate In-Player Ad Slot
  const adSlotEl = document.getElementById('in-player-ad-slot');
  if (adSlotEl) {
    if (siteConfig.monetization && siteConfig.monetization.player_overlay_html) {
      injectHTMLWithScripts(adSlotEl, siteConfig.monetization.player_overlay_html);
    } else {
      injectHTMLWithScripts(adSlotEl, `<div class="flex justify-center items-center my-1"><script>atOptions = {'key' : 'f8eb57861126a6d63865b2645c52d941','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src="https://www.highperformanceformat.com/f8eb57861126a6d63865b2645c52d941/invoke.js"></script></div>`);
    }
  }

  // Update Like Button state
  updateWatchLikeButtonState(file.id);

  // Render Related Videos
  renderRelatedGrid(file.id);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show Home View
function showHomeView() {
  window.location.hash = '';

  const homeTab = document.getElementById('tab-home');
  const watchTab = document.getElementById('tab-watch');
  if (homeTab) homeTab.classList.remove('hidden');
  if (watchTab) watchTab.classList.add('hidden');

  // Pause video player
  const videoPlayer = document.getElementById('watch-video-player');
  if (videoPlayer) {
    videoPlayer.pause();
  }
}

// Render Related Videos Grid
function renderRelatedGrid(currentFileId) {
  const container = document.getElementById('related-grid');
  if (!container) return;

  const relatedFiles = allFiles.filter(f => f.id !== currentFileId).slice(0, 8);
  const likedList = getLikedFiles();

  container.innerHTML = relatedFiles.map(file => {
    const isImage = file.type === 'image';
    const isVideo = file.type === 'video';
    const isLiked = likedList.includes(file.id);

    return `
      <div onclick="openWatchView('${file.id}')" class="file-card group bg-[#0f1422] border border-slate-800 hover:border-rose-500/60 rounded-2xl overflow-hidden transition cursor-pointer flex flex-col justify-between">
        <div>
          <div class="w-full h-36 bg-black relative overflow-hidden">
            ${isVideo 
              ? `<video src="${file.media_url}#t=0.5" preload="metadata" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" muted></video>` 
              : `<img src="${file.media_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />`}
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fa-solid fa-circle-play text-2xl text-rose-500"></i>
            </div>
          </div>
          <div class="p-3 space-y-1">
            <h5 class="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-rose-400 transition">${file.title}</h5>
            <p class="text-[10px] text-slate-400 font-mono">${file.size_formatted}</p>
          </div>
        </div>
        <div class="p-2.5 pt-0 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-900 mt-1">
          <span class="text-amber-400"><i class="fa-solid fa-eye mr-1"></i>${file.views || 0}</span>
          <span class="text-rose-400"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart mr-1"></i>${file.likes || 0}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle Like on Grid Card
async function toggleLikeCard(e, fileId) {
  if (e) e.stopPropagation();

  const file = allFiles.find(f => f.id === fileId);
  if (!file) return;

  file.likes = (file.likes || 0) + 1;
  saveLikedFile(fileId);

  // Update UI count
  const el = document.getElementById(`like-count-${fileId}`);
  if (el) el.innerText = file.likes;

  // Re-render grid item button
  const button = e ? e.currentTarget : null;
  if (button) {
    button.classList.add('bg-rose-500/20', 'text-rose-400');
    const icon = button.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-heart text-xs text-rose-500 animate-bounce';
  }

  // Send Like API
  fetch(`${API_BASE_URL}/api/v1/public/media/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: fileId, action: 'like' })
  }).catch(() => {});
}

// Like current media on Watch Page
async function likeCurrentWatchMedia() {
  if (!currentPlayingFile) return;

  const fileId = currentPlayingFile.id;
  currentPlayingFile.likes = (currentPlayingFile.likes || 0) + 1;
  saveLikedFile(fileId);

  const watchLikes = document.getElementById('watch-likes-count');
  if (watchLikes) watchLikes.innerText = currentPlayingFile.likes;

  updateWatchLikeButtonState(fileId);

  // Send Like API
  fetch(`${API_BASE_URL}/api/v1/public/media/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: fileId, action: 'like' })
  }).catch(() => {});
}

function updateWatchLikeButtonState(fileId) {
  const liked = getLikedFiles().includes(fileId);
  const btn = document.getElementById('watch-like-btn');
  const text = document.getElementById('watch-like-text');

  if (btn && text) {
    if (liked) {
      btn.className = 'px-5 py-2.5 bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-lg shadow-rose-600/30';
      text.innerText = 'Telah Disukai ❤️';
    } else {
      btn.className = 'px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-lg shadow-rose-600/20';
      text.innerText = 'Suka Video';
    }
  }
}

// Handle In-Player Overlay Click (Play Video & Trigger Smartlink 2)
function handleVideoOverlayClick() {
  const overlayEl = document.getElementById('watch-player-ad-overlay');
  const videoPlayer = document.getElementById('watch-video-player');

  // Trigger Smartlink 2 in new tab on video click
  try {
    window.open('https://www.effectivecpmnetwork.com/apqh1q3j1a?key=05b64a44564477a6a678a1e3a1438908', '_blank');
  } catch (e) {
    console.log('Smartlink 2 triggered');
  }

  if (overlayEl) overlayEl.classList.add('hidden');
  if (videoPlayer) videoPlayer.play().catch(() => {});
}

// Copy Stream URL
function copyCurrentStreamUrl() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link video XVIDSHUB telah disalin ke clipboard!');
  }).catch(() => {
    alert('Link stream: ' + url);
  });
}
