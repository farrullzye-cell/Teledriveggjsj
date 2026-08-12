// XVIDSHUB — Doodstream Style Public Client JavaScript

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

// Permanent Default Private API URL
const API_BASE_URL = 'https://teledriveggjsj.onrender.com';

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

document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('api-base-input');
  if (inputEl) inputEl.value = API_BASE_URL;

  loadSiteConfig();
  fetchPublicMedia();

  // Attach global popunder ad trigger to body clicks based on configured percentage probability
  document.body.addEventListener('click', (e) => {
    // Only intercept if monetization is enabled
    if (!siteConfig.monetization || !siteConfig.monetization.enabled) return;

    // Check popunder rate probability (0 to 100)
    const rate = Number(siteConfig.monetization.popunder_rate || 100);
    const randomChance = Math.floor(Math.random() * 100) + 1; // 1 - 100

    // Prevent loop if already handled
    if ((e.target && e.target.closest('#config-modal')) || (e.target && e.target.closest('input'))) {
      return;
    }

    if (randomChance <= rate) {
      // Trigger popunder ad
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

// Load Site Config & Monetization Settings from Private Backend Render API
async function loadSiteConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/public/config`);
    const data = await res.json();

    if (data.success) {
      siteConfig = data;

      // Update Ad rate badge
      const adRateText = document.getElementById('ad-rate-text');
      if (adRateText && data.monetization) {
        adRateText.innerText = `Ads: ${data.monetization.popunder_rate}% Pop`;
      }

      // Render Top Banner Ad
      const bannerAdContainer = document.getElementById('top-banner-ad-container');
      if (bannerAdContainer) {
        if (data.monetization.enabled && data.monetization.banner_top_html) {
          injectHTMLWithScripts(bannerAdContainer, `<div class="p-2 bg-[#0f1422] border border-amber-500/30 rounded-2xl text-center shadow-lg my-2 flex justify-center items-center overflow-hidden">${data.monetization.banner_top_html}</div>`);
        } else if (data.monetization.enabled) {
          bannerAdContainer.innerHTML = `
            <div class="p-3.5 bg-[#0f1422] border border-dashed border-amber-500/30 rounded-2xl text-center shadow-lg my-2 flex items-center justify-between text-xs text-amber-400 font-mono">
              <span class="flex items-center"><i class="fa-solid fa-rectangle-ad mr-2 text-base"></i><strong>XVIDSHUB Banner Ad Slot (4:1 Aspect Ratio)</strong></span>
              <span class="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">Sponsor Monetization</span>
            </div>
          `;
        } else {
          bannerAdContainer.innerHTML = '';
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

// Fetch Public Media Files
async function fetchPublicMedia() {
  const grid = document.getElementById('file-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full py-16 text-center text-slate-400 font-mono text-xs">
      <i class="fa-solid fa-circle-notch fa-spin text-rose-500 text-3xl mb-3"></i>
      <p class="font-bold text-slate-200">Memuat media XVIDSHUB dari Server Render...</p>
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
          <p class="text-slate-200 font-bold text-base">Belum ada media pada kategori topic ini.</p>
          <p class="text-xs text-slate-500 mt-1 font-mono">Unggah video atau file melalui dashboard privat Render RULLZYE CLOUD.</p>
        </div>
      `;
      const badge = document.getElementById('video-count-badge');
      if (badge) badge.innerText = '0 File';
      return;
    }

    allFiles = data.media;
    const badge = document.getElementById('video-count-badge');
    if (badge) badge.innerText = `${allFiles.length} File`;

    renderGrid(allFiles);
  } catch (err) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center bg-rose-950/20 border border-rose-800/40 rounded-3xl p-6 text-rose-300 text-xs">
        <i class="fa-solid fa-triangle-exclamation text-3xl mb-2 text-rose-400"></i>
        <p class="font-bold text-sm">Gagal terhubung ke API Server Privat (${API_BASE_URL})</p>
        <p class="text-xs text-rose-400/80 mt-1">Pastikan URL Server Render sudah benar pada ikon Pengaturan (⚙️).</p>
      </div>
    `;
  }
}

// Render Video Grid (Doodstream Style)
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

  grid.innerHTML = filtered.map(file => {
    const isImage = file.type === 'image';
    const isVideo = file.type === 'video';

    let thumbnailHtml = `
      <div class="w-full h-40 bg-black flex items-center justify-center text-slate-600 text-4xl">
        <i class="${getIconForType(file.type)}"></i>
      </div>
    `;

    if (isImage) {
      thumbnailHtml = `
        <div class="w-full h-40 bg-black overflow-hidden relative">
          <img src="${file.media_url}" alt="${file.title}" class="w-full h-full object-cover file-card-img" loading="lazy" />
        </div>
      `;
    } else if (isVideo) {
      thumbnailHtml = `
        <div class="w-full h-40 bg-black relative overflow-hidden flex items-center justify-center group-hover:scale-105 transition duration-300">
          <video src="${file.media_url}" class="w-full h-full object-cover" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
            <div class="w-12 h-12 rounded-full bg-rose-600/90 text-white flex items-center justify-center text-lg shadow-xl shadow-rose-600/50 group-hover:scale-110 transition">
              <i class="fa-solid fa-play ml-1"></i>
            </div>
          </div>
          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-slate-200">
            HD STREAM
          </span>
        </div>
      `;
    }

    return `
      <div onclick="openPlayerModal('${file.id}')" class="file-card group bg-[#0f1422] border border-slate-800/80 hover:border-rose-500/60 rounded-2xl overflow-hidden transition duration-300 shadow-xl cursor-pointer flex flex-col justify-between">
        <div>
          ${thumbnailHtml}
          <div class="p-4 space-y-2">
            <div class="flex items-center justify-between text-[10px] font-mono">
              <span class="px-2 py-0.5 rounded font-bold bg-slate-900 text-rose-400 uppercase border border-slate-800">${file.type}</span>
              <span class="text-slate-400">${file.size_formatted}</span>
            </div>
            <h4 class="text-xs font-bold text-slate-100 line-clamp-2 group-hover:text-rose-400 transition" title="${file.title}">${file.title}</h4>
            <p class="text-[10px] text-slate-500 font-mono truncate"><i class="fa-solid fa-folder text-rose-500/70 mr-1"></i>${file.vault.name}</p>
          </div>
        </div>
        <div class="p-4 pt-0 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-900 mt-2">
          <span class="text-slate-500"><i class="fa-solid fa-eye text-rose-500/80 mr-1"></i>HD Stream</span>
          <span class="text-rose-400 font-bold flex items-center"><i class="fa-solid fa-circle-play mr-1"></i>Tonton</span>
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

// Open Video Player Modal (Doodstream Style)
function openPlayerModal(fileId) {
  const file = allFiles.find(f => f.id === fileId);
  if (!file) return;

  currentPlayingFile = file;

  const modal = document.getElementById('player-modal');
  const videoPlayer = document.getElementById('main-video-player');
  const titleEl = document.getElementById('player-title');
  const categoryTag = document.getElementById('player-category-tag');
  const sizeTag = document.getElementById('player-size-tag');
  const overlayEl = document.getElementById('player-ad-overlay');
  const adSlotEl = document.getElementById('in-player-ad-slot');

  titleEl.innerText = file.title;
  categoryTag.innerText = file.vault.name;
  sizeTag.innerText = file.size_formatted;

  videoPlayer.src = file.media_url;

  // Show In-Player Ad overlay initially before play
  if (overlayEl) overlayEl.classList.remove('hidden');

  if (adSlotEl) {
    if (siteConfig.monetization && siteConfig.monetization.player_overlay_html) {
      adSlotEl.innerHTML = siteConfig.monetization.player_overlay_html;
    } else {
      adSlotEl.innerHTML = `
        <p class="font-bold text-amber-400 text-[11px] uppercase tracking-wider mb-1"><i class="fa-solid fa-rectangle-ad mr-1"></i>XVIDSHUB Sponsor Ad</p>
        <p class="text-[11px] text-slate-300">Klik tombol play di atas untuk memulai pemutaran streaming video.</p>
      `;
    }
  }

  modal.classList.remove('hidden');
}

// Handle Overlay Click
function handleVideoOverlayClick() {
  const overlayEl = document.getElementById('player-ad-overlay');
  const videoPlayer = document.getElementById('main-video-player');

  if (overlayEl) overlayEl.classList.add('hidden');
  if (videoPlayer) videoPlayer.play().catch(() => {});
}

function closePlayerModal() {
  const modal = document.getElementById('player-modal');
  const videoPlayer = document.getElementById('main-video-player');

  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.src = '';
  }
  if (modal) modal.classList.add('hidden');
}

// Category Navigation Filter
function setCategoryFilter(categoryId) {
  currentCategory = categoryId;

  document.querySelectorAll('.category-chip').forEach(btn => {
    btn.classList.remove('active', 'bg-rose-600', 'text-white');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active', 'bg-rose-600', 'text-white');
    event.currentTarget.classList.remove('bg-slate-900', 'text-slate-300');
  }

  fetchPublicMedia();
}

function handleSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    currentSearch = input.value.trim();
    renderGrid(allFiles);
  }
}

// Navigation Tabs (Home vs API Docs)
function switchTab(tabName) {
  document.getElementById('tab-home').classList.add('hidden');
  document.getElementById('tab-docs').classList.add('hidden');

  document.getElementById('nav-home-btn').className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800';
  document.getElementById('nav-docs-btn').className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white hover:bg-slate-800';

  if (tabName === 'home') {
    document.getElementById('tab-home').classList.remove('hidden');
    document.getElementById('nav-home-btn').className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition bg-rose-600 text-white shadow-md';
  } else if (tabName === 'docs') {
    document.getElementById('tab-docs').classList.remove('hidden');
    document.getElementById('nav-docs-btn').className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition bg-rose-600 text-white shadow-md';
  }
}

// Copy Stream URL
function copyCurrentStreamUrl() {
  if (currentPlayingFile) {
    navigator.clipboard.writeText(currentPlayingFile.media_url);
    alert('Link Stream Video XVIDSHUB berhasil disalin!');
  }
}

// Test API Endpoint
async function testApiEndpoint(path) {
  const box = document.getElementById('api-result-box');
  if (!box) return;

  box.innerText = 'Memuat data dari API Render...';
  try {
    const res = await fetch(`${API_BASE_URL}${path}`);
    const data = await res.json();
    box.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    box.innerText = 'Error loading API: ' + err.message;
  }
}

// Config Modal Handlers (Disabled - API Base URL is hardcoded permanently)
function toggleConfigModal() {}
function saveApiBaseUrl() {}
