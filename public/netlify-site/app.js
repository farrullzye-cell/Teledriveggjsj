// RULLZYE CLOUD — Netlify Public Client JavaScript

// Get current origin or saved custom Render API URL
let API_BASE_URL = localStorage.getItem('rullzye_api_base_url') || window.location.origin;

let currentCategory = 'ALL';
let currentSearch = '';
let allFiles = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('api-base-input').value = API_BASE_URL;
  checkServerHealth();
  fetchPublicMedia();

  const exportBtn = document.getElementById('direct-export-link');
  if (exportBtn) {
    exportBtn.href = `${API_BASE_URL}/api/v1/public/project-export`;
  }
});

// Check status of Private Backend Server on Render
async function checkServerHealth() {
  const statusEl = document.getElementById('connection-status');
  const statusText = document.getElementById('status-text');

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/public/status`);
    const data = await res.json();

    if (data.success) {
      statusEl.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      statusText.innerText = `Terhubung ke Render (${data.service})`;
    } else {
      throw new Error(data.message || 'Server error');
    }
  } catch (err) {
    statusEl.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30';
    statusText.innerText = 'Server Backend Render Offline / Menggunakan Local Host';
  }
}

// Fetch Public Files and Media
async function fetchPublicMedia() {
  const grid = document.getElementById('file-grid');
  grid.innerHTML = `
    <div class="col-span-full py-12 text-center text-slate-400 font-mono text-sm">
      <i class="fa-solid fa-spinner fa-spin text-cyan-400 text-2xl mb-2"></i>
      <p>Memuat media dari Server Privat Render...</p>
    </div>
  `;

  try {
    const url = `${API_BASE_URL}/api/v1/public/media?category=${currentCategory}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.media || data.media.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <i class="fa-regular fa-folder-open text-slate-600 text-4xl mb-3"></i>
          <p class="text-slate-300 font-semibold text-sm">Belum ada media publik ditemukan.</p>
          <p class="text-xs text-slate-500 mt-1">Unggah file melalui dashboard RULLZYE CLOUD di server Render.</p>
        </div>
      `;
      return;
    }

    allFiles = data.media;
    renderGrid(allFiles);
  } catch (err) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center bg-rose-950/20 border border-rose-800/40 rounded-2xl p-6 text-rose-300 text-sm">
        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2 text-rose-400"></i>
        <p class="font-bold">Gagal terhubung ke API Server Privat (${API_BASE_URL})</p>
        <p class="text-xs text-rose-400/80 mt-1">Pastikan URL Server Render sudah benar atau periksa koneksi CORS.</p>
      </div>
    `;
  }
}

// Render Grid Cards
function renderGrid(files) {
  const grid = document.getElementById('file-grid');
  let filtered = files;

  if (currentSearch) {
    filtered = files.filter(f => f.title.toLowerCase().includes(currentSearch.toLowerCase()));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 text-sm">
        Tidak ada file yang cocok dengan pencarian "${currentSearch}".
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(file => {
    const isImage = file.type === 'image';
    const isVideo = file.type === 'video';

    let previewElement = `
      <div class="w-full h-40 bg-slate-950 flex items-center justify-center text-slate-600 text-3xl">
        <i class="${getIconForType(file.type)}"></i>
      </div>
    `;

    if (isImage) {
      previewElement = `
        <div class="w-full h-40 bg-slate-950 overflow-hidden relative">
          <img src="${file.media_url}" alt="${file.title}" class="w-full h-full object-cover file-card-img" loading="lazy" />
        </div>
      `;
    } else if (isVideo) {
      previewElement = `
        <div class="w-full h-40 bg-slate-950 relative overflow-hidden flex items-center justify-center">
          <video src="${file.media_url}" class="w-full h-full object-cover" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-2xl">
            <i class="fa-solid fa-circle-play"></i>
          </div>
        </div>
      `;
    }

    return `
      <div class="file-card bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden transition shadow-xl flex flex-col justify-between">
        <div>
          ${previewElement}
          <div class="p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-cyan-400 uppercase">${file.type}</span>
              <span class="text-[11px] font-mono text-slate-400">${file.size_formatted}</span>
            </div>
            <h4 class="text-sm font-bold text-slate-100 truncate" title="${file.title}">${file.title}</h4>
            <p class="text-[11px] text-slate-500 font-mono">Vault: ${file.vault.name}</p>
          </div>
        </div>
        <div class="p-4 pt-0 flex items-center gap-2">
          <a href="${file.download_url}" target="_blank" download class="flex-1 py-2 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-xl transition text-center flex items-center justify-center space-x-1">
            <i class="fa-solid fa-download"></i>
            <span>Unduh File</span>
          </a>
          <a href="${file.media_url}" target="_blank" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition" title="Buka / Preview Media">
            <i class="fa-solid fa-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function getIconForType(type) {
  switch (type) {
    case 'image': return 'fa-regular fa-image text-cyan-400';
    case 'video': return 'fa-solid fa-film text-blue-400';
    case 'document': return 'fa-regular fa-file-lines text-emerald-400';
    case 'archive': return 'fa-solid fa-file-zipper text-amber-400';
    default: return 'fa-regular fa-file text-slate-400';
  }
}

// Navigation Tabs
function switchTab(tabName) {
  document.getElementById('tab-gallery').classList.add('hidden');
  document.getElementById('tab-docs').classList.add('hidden');
  document.getElementById('tab-project').classList.add('hidden');

  document.getElementById('nav-gallery-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition text-slate-300 hover:text-white hover:bg-slate-800';
  document.getElementById('nav-docs-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition text-slate-300 hover:text-white hover:bg-slate-800';
  document.getElementById('nav-download-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition text-slate-300 hover:text-white hover:bg-slate-800';

  if (tabName === 'gallery') {
    document.getElementById('tab-gallery').classList.remove('hidden');
    document.getElementById('nav-gallery-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition bg-cyan-500 text-slate-950 shadow-md';
  } else if (tabName === 'docs') {
    document.getElementById('tab-docs').classList.remove('hidden');
    document.getElementById('nav-docs-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition bg-cyan-500 text-slate-950 shadow-md';
  } else if (tabName === 'project') {
    document.getElementById('tab-project').classList.remove('hidden');
    document.getElementById('nav-download-btn').className = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition bg-cyan-500 text-slate-950 shadow-md';
  }
}

// Category Filter
function setCategoryFilter(category) {
  currentCategory = category;
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-cyan-500', 'text-slate-950');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });

  event.currentTarget.classList.add('active', 'bg-cyan-500', 'text-slate-950');
  event.currentTarget.classList.remove('bg-slate-800', 'text-slate-300');

  fetchPublicMedia();
}

function handleSearch() {
  currentSearch = document.getElementById('search-input').value;
  renderGrid(allFiles);
}

// API Tester
async function testApiEndpoint(path) {
  const box = document.getElementById('api-result-box');
  const label = document.getElementById('api-test-endpoint');

  label.innerText = `${API_BASE_URL}${path}`;
  box.innerText = 'Mengirimkan request ke server...';

  try {
    const res = await fetch(`${API_BASE_URL}${path}`);
    const data = await res.json();
    box.innerText = JSON.stringify(data, null, 2);
  } catch (err) {
    box.innerText = `Error: Gagal memuat API dari ${API_BASE_URL}${path}.\n${err.message}`;
  }
}

// Download Project ZIP
function downloadProjectZip() {
  window.open(`${API_BASE_URL}/api/v1/public/project-export`, '_blank');
}

// Config Modal Handlers
function toggleConfigModal() {
  const modal = document.getElementById('config-modal');
  modal.classList.toggle('hidden');
}

function saveApiBaseUrl() {
  const input = document.getElementById('api-base-input').value.trim();
  if (input) {
    API_BASE_URL = input.replace(/\/$/, '');
    localStorage.setItem('rullzye_api_base_url', API_BASE_URL);
    checkServerHealth();
    fetchPublicMedia();
    toggleConfigModal();
  }
}
