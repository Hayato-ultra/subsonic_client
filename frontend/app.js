"use strict";

const view = document.getElementById("view");
const audio = document.getElementById("audio");
const playerEl = document.getElementById("player");
const sidebar = document.getElementById("sidebar");

const btnToggle = document.getElementById("btn-toggle");
const btnNext = document.getElementById("btn-next");
const btnPrev = document.getElementById("btn-prev");
const btnVolume = document.getElementById("btn-volume");
const btnShuffle = document.getElementById("btn-shuffle");
const btnRepeat = document.getElementById("btn-repeat");
const btnLike = document.getElementById("btn-like");
const progressBar = document.querySelector(".progress-bar");
const progressFill = document.getElementById("progress-fill");
const volumeFill = document.getElementById("volume-fill");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const searchInput = document.getElementById("search-input");

const state = {
  queue: [],
  index: -1,
  volume: 1,
  shuffle: false,
  repeat: false,
  liked: new Set(),
  currentView: "home",
  currentPlaylistSongs: [],
  savedTime: 0,
};

const STORAGE_KEY = "subsonic_player_state";

function saveState() {
  const data = {
    queue: state.queue,
    index: state.index,
    currentTime: audio.currentTime || 0,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    liked: Array.from(state.liked),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save player state:", e);
  }
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (data.queue?.length) state.queue = data.queue;
    if (typeof data.index === "number") state.index = data.index;
    if (typeof data.currentTime === "number") state.savedTime = data.currentTime;
    if (typeof data.shuffle === "boolean") state.shuffle = data.shuffle;
    if (typeof data.repeat === "boolean") state.repeat = data.repeat;
    if (typeof data.volume === "number") state.volume = data.volume;
    if (Array.isArray(data.liked)) state.liked = new Set(data.liked);
  } catch (e) {
    console.warn("Failed to load player state:", e);
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

const DEFAULT_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23535353'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E";

function coverUrl(id) {
  return id ? `/api/cover?id=${encodeURIComponent(id)}` : DEFAULT_COVER;
}

async function api(path, params = {}, method = "GET") {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const url = qs ? `${path}?${qs}` : path;
  const opts = { method };
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch { /* not json */ }
  if (!res.ok) {
    const detail = (body && body.detail) || res.statusText || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return body;
}

function showError(err) {
  view.innerHTML = `<div class="error">${esc(err.message || err)}</div>`;
}

function showLoading() {
  view.innerHTML = `<div class="loading-state"><div class="loader"></div><span>Loading…</span></div>`;
}

function renderSidebarActive() {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const item = document.querySelector(`.nav-item[data-view="${state.currentView}"]`);
  if (item) item.classList.add("active");
}

// ---------- Modal ----------
function showModal(html) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  return overlay;
}

function closeModal(overlay) {
  overlay.remove();
}

// ---------- Import View ----------
async function renderImport() {
  state.currentView = "import";
  renderSidebarActive();

  // Load playlists for the select dropdown
  let playlistsHtml = '<option value="">-- Create new or select existing --</option>';
  try {
    const data = await api("/api/playlists");
    const playlists = (data.playlists && data.playlists.playlist) || [];
    playlists.forEach(pl => {
      playlistsHtml += `<option value="${esc(pl.id)}">${esc(pl.name || "Untitled")}</option>`;
    });
  } catch (e) {
    console.error("Failed to load playlists for import:", e);
  }
  playlistsHtml += '<option value="__create_new__">+ Create new playlist</option>';

  view.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">Import from Link</h2>
    </div>
    <div class="import-page">
      <div class="import-card">
        <div class="form-group">
          <label for="import-url">YouTube, Spotify, SoundCloud, Bandcamp URL</label>
          <input type="url" class="form-input" id="import-url" placeholder="https://youtube.com/watch?v=... or https://open.spotify.com/track/..." autocomplete="off">
        </div>
        <div class="form-group">
          <label for="import-playlist">Add to Playlist (optional)</label>
          <select class="form-input" id="import-playlist">
            ${playlistsHtml}
          </select>
        </div>
        <div class="form-group" id="import-new-playlist-group" style="display:none;">
          <label for="import-new-playlist-name">New Playlist Name</label>
          <input type="text" class="form-input" id="import-new-playlist-name" placeholder="My Playlist" maxlength="100">
        </div>
        <div id="import-status" class="import-status" style="display:none;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px">
          <button class="btn-pill" id="import-cancel">Cancel</button>
          <button class="btn-primary" id="import-submit">
            <span class="import-btn-text">Import</span>
            <span class="import-btn-loading" style="display:none;">
              <svg class="spinner" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>
              Importing...
            </span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind event listeners
  const importUrlInput = document.getElementById("import-url");
  const importPlaylistSelect = document.getElementById("import-playlist");
  const importNewPlaylistGroup = document.getElementById("import-new-playlist-group");
  const importNewPlaylistName = document.getElementById("import-new-playlist-name");
  const importStatus = document.getElementById("import-status");
  const importSubmitBtn = document.getElementById("import-submit");
  const importBtnText = document.querySelector(".import-btn-text");
  const importBtnLoading = document.querySelector(".import-btn-loading");
  const importCancelBtn = document.getElementById("import-cancel");

  function showImportStatus(message, isError = false, isLoading = false) {
    importStatus.style.display = "block";
    importStatus.style.color = isError ? "var(--accent-secondary)" : "var(--text)";
    if (isLoading) {
      importStatus.innerHTML = `<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" style="display:inline-block;margin-right:8px;vertical-align:middle"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round" style="animation:spin 1s linear infinite"/></svg>${message}`;
    } else {
      importStatus.textContent = message;
    }
  }

  function setImportLoading(loading) {
    importSubmitBtn.disabled = loading;
    importBtnText.style.display = loading ? "none" : "inline";
    importBtnLoading.style.display = loading ? "inline-flex" : "none";
    importUrlInput.disabled = loading;
    importPlaylistSelect.disabled = loading;
    importNewPlaylistName.disabled = loading;
  }

  importCancelBtn?.addEventListener("click", () => routeTo("home"));

  async function handleImportSubmit() {
    const url = importUrlInput.value.trim();
    if (!url) {
      showImportStatus("Please enter a URL", true);
      importUrlInput.focus();
      return;
    }

    let playlistId = importPlaylistSelect.value;
    let playlistName = null;

    if (playlistId === "__create_new__") {
      playlistName = importNewPlaylistName.value.trim();
      if (!playlistName) {
        showImportStatus("Please enter a playlist name", true);
        importNewPlaylistName.focus();
        return;
      }
      playlistId = null;
    } else if (!playlistId) {
      playlistId = null;
    }

    setImportLoading(true);
    showImportStatus("Downloading and adding to library...", false, true);

    try {
      const res = await api("/api/import/link", { url, playlist: playlistName || playlistId || "" }, "POST");
      if (res.status === "ok") {
        showImportStatus("✅ Import successful! Library scan triggered.", false, false);
        setTimeout(() => routeTo("home"), 1500);
      } else {
        showImportStatus(`❌ ${res.error || "Import failed"}`, true);
      }
    } catch (err) {
      showImportStatus(`❌ ${err.message || "Network error"}`, true);
    } finally {
      setImportLoading(false);
    }
  }

  importSubmitBtn?.addEventListener("click", handleImportSubmit);
  importUrlInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleImportSubmit();
  });
  importPlaylistSelect?.addEventListener("change", () => {
    if (importPlaylistSelect.value === "__create_new__") {
      importNewPlaylistGroup.style.display = "block";
      importNewPlaylistName.focus();
    } else {
      importNewPlaylistGroup.style.display = "none";
    }
  });
  importNewPlaylistName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleImportSubmit();
  });

  // Focus the URL input on load
  setTimeout(() => importUrlInput?.focus(), 100);
}

// ---------- Views ----------
async function renderHome() {
  state.currentView = "home";
  renderSidebarActive();
  try {
    view.innerHTML = `
      <div class="hero">
        <div class="hero-content">
          <h1 class="hero-title">Your Library</h1>
          <p class="hero-subtitle">Discover and stream millions of songs and podcasts.</p>
          <div class="hero-actions">
            <button class="btn-primary" id="btn-shuffle-play">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/><path d="M15 15l6 6M15 9l6 6"/></svg> Shuffle Play All
            </button>
            <button class="btn-filled" id="btn-browse">Browse All</button>
          </div>
        </div>
      </div>
      <div class="section-header">
        <h2 class="section-title">Made For You</h2>
        <button class="btn-pill" id="btn-refresh">Refresh</button>
      </div>
      <div class="grid" id="made-for-you"></div>
      <div style="margin-top:40px">
        <div class="section-header">
          <h2 class="section-title">Recently Added</h2>
        </div>
        <div class="grid" id="recently-added"></div>
      </div>
    `;
  } catch(e) { console.error("renderHome:", e); return; }

  document.getElementById("btn-shuffle-play")?.addEventListener("click", async () => {
    try {
      const data = await api("/api/random", { size: 50 });
      console.log("Random API response:", data);
      const songs = (data.randomSongs && data.randomSongs.song) || (data.songs && data.songs.song) || (data.song) || [];
      console.log("Extracted songs:", songs);
      if (songs.length) { state.shuffle = true; btnShuffle.classList.add("shuffle-active"); playQueue(songs, 0); shuffleQueue(); }
      else alert("No songs returned from random API");
    } catch (err) { alert(err.message); }
  });
  document.getElementById("btn-browse")?.addEventListener("click", () => routeTo("search"));
  document.getElementById("btn-refresh")?.addEventListener("click", renderHome);

  try {
    const data = await api("/api/albums", { type: "newest", size: 6 });
    const albums = (data.albumList2 && data.albumList2.album) || [];
    const grid = document.getElementById("made-for-you");
    if (grid) grid.innerHTML = albums.length ? albums.slice(0, 6).map(albumCard).join("") : `<p class="muted">No albums found.</p>`;
  } catch (err) { console.error("home albums:", err); }

  try {
    const data = await api("/api/albums", { type: "recent", size: 6 });
    const albums = (data.albumList2 && data.albumList2.album) || [];
    const grid = document.getElementById("recently-added");
    if (grid) grid.innerHTML = albums.length ? albums.slice(0, 6).map(albumCard).join("") : `<p class="muted">No recently added albums.</p>`;
  } catch (err) { console.error("home recent albums:", err); }
}

function albumCard(album) {
  const title = album.title || album.name || "Unknown album";
  const artist = album.artist || "";
  return `
    <a class="card card-link" href="#/album/${encodeURIComponent(album.id)}" style="display:block;">
      <div class="card-image-wrapper">
        <img class="card-image" src="${coverUrl(album.coverArt)}" alt="${esc(title)}" loading="lazy">
        <div class="card-play-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(title)}</div>
        <div class="card-subtitle">${esc(artist)}</div>
      </div>
    </a>`;
}

function playlistCard(pl) {
  return `
    <a class="playlist-card card-link" href="#/playlist/${encodeURIComponent(pl.id)}" style="display:block;">
      <div class="card-image-wrapper" style="aspect-ratio:1">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#1f1f1f,#2a2a2a);border-radius:var(--radius);display:flex;align-items:center;justify-content:center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--accent)"><path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/></svg>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(pl.name || pl.title || "Playlist")}</div>
        <div class="card-subtitle">${pl.trackCount || 0} songs</div>
      </div>
    </a>`;
}



async function renderSearch(query) {
  state.currentView = "search";
  renderSidebarActive();
  const q = query || searchInput.value.trim();
  if (!q) {
    view.innerHTML = `
      <div class="hero">
        <div class="hero-content">
          <h1 class="hero-title">Search</h1>
          <p class="hero-subtitle">Find artists, songs, podcasts, and more.</p>
        </div>
      </div>
      <div class="search-info-bar">
        <div class="icon-wrapper"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
        <div class="info-text"><div class="info-title">Start exploring</div><div class="info-sub">Type above to search for music, artists, or podcasts</div></div>
      </div>`;
    return;
  }
  view.innerHTML = `<div class="search-results"><div class="loading-state"><div class="loader"></div><span>Searching for "${esc(q)}"…</span></div></div>`;
  try {
    const data = await api("/api/search", { q, limit: 20 });
    const results = data.searchResult || {};
    const tracks = results.track || [];
    const artists = results.artist || [];
    const albums = results.album || [];
    const playlists = results.playlist || [];

    let html = `<div class="section-header"><h2 class="section-title">${esc(q)}</h2></div>`;
    if (artists && artists.length) {
      html += `<div class="search-category"><h3 class="search-category-title">Artists</h3><div class="grid">${artists.map(a => `<a class="card card-link" href="#/artist/${encodeURIComponent(a.id)}"><div class="card-image-wrapper" style="aspect-ratio:1;border-radius:var(--radius)"><img class="card-image" src="${coverUrl(a.coverArt)}" alt="${esc(a.name)}" loading="lazy"><div class="card-play-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div><div class="card-body"><div class="card-title">${esc(a.name)}</div><div class="card-subtitle">Artist</div></div></a>`).join("")}</div></div>`;
    }
    if (albums && albums.length) {
      html += `<div class="search-category"><h3 class="search-category-title">Albums</h3><div class="grid">${albums.map(a => albumCard(a)).join("")}</div></div>`;
    }
    if (playlists && playlists.length) {
      html += `<div class="search-category"><h3 class="search-category-title">Playlists</h3><div class="grid">${playlists.map(pl => playlistCard(pl)).join("")}</div></div>`;
    }
    if (tracks && tracks.length) {
      html += `<div class="search-category"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h3 class="search-category-title">Songs</h3><button class="btn-pill-3" id="btn-shuffle-tracks"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/><path d="M15 15l6 6M15 9l6 6"/></svg> Shuffle All</button></div><div class="song-list">${tracks.map((s, i) => songRow(s, i)).join("")}</div></div>`;
    }
    if (!artists.length && !albums.length && !playlists.length && !tracks.length) {
      html += `<div class="empty-state"><p>No results found for "${esc(q)}"</p></div>`;
    }
    view.innerHTML = html;

    document.querySelectorAll("[data-play-song]").forEach(el => {
      el.addEventListener("click", (e) => { e.stopPropagation(); playQueue(state.currentPlaylistSongs || tracks || [], parseInt(el.dataset.playSong)); });
    });
    document.getElementById("btn-shuffle-tracks")?.addEventListener("click", () => { state.shuffle = true; btnShuffle.classList.add("shuffle-active"); shuffleQueue(); });
  } catch (err) { showError(err); }
}

function songRow(song, index) {
  const isLiked = state.liked.has(song.id);
  return `
    <div class="song-row" data-play-song="${index}">
      <span class="song-number">${index + 1}</span>
      <img class="song-art" src="${coverUrl(song.coverArt || song.albumCoverArt)}" alt="" loading="lazy">
      <div class="song-info">
        <div class="song-title">${esc(song.title)}</div>
        <div class="song-artist-name">${esc(song.artist || song.album || "")}</div>
      </div>
      <span class="song-duration">${fmtDuration(song.duration)}</span>
      <button class="icon-btn song-actions add-to-playlist-btn" data-song='${JSON.stringify(song).replace(/'/g, "&#39;")}' aria-label="Add to playlist" title="Add to Playlist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      </button>
      <button class="icon-btn song-actions ${isLiked ? 'btn-like-active' : ''}" data-like-song="${esc(song.id)}" aria-label="Like">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'var(--accent-secondary)' : 'currentColor'}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
    </div>`;
}

async function renderLibrary() {
  state.currentView = "library";
  renderSidebarActive();
  try {
    const data = await api("/api/playlists");
    const playlists = (data.playlists && data.playlists.playlist) || [];
    view.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Your Library</h2>
        <button class="btn-filled" id="btn-create-playlist">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Create Playlist
        </button>
      </div>
      <div class="grid">${playlists.length ? playlists.map(pl => playlistCard(pl)).join("") : `<p class="muted">Your library is empty. <a href="#/search">Discover music</a></p>`}</div>
    `;
    document.getElementById("btn-create-playlist")?.addEventListener("click", showCreatePlaylistModal);
  } catch (err) { showError(err); }
}

async function showCreatePlaylistModal() {
  const overlay = showModal(`
    <div class="modal-header">
      <h2 class="modal-title">Create Playlist</h2>
      <button class="icon-btn modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="playlist-name">Playlist Name</label>
        <input type="text" class="form-input" id="playlist-name" placeholder="My Playlist" maxlength="100" autofocus>
      </div>
      <button class="btn-primary" id="btn-create-submit" style="width:100%;justify-content:center">Create</button>
    </div>
  `);

  document.getElementById("modal-close-btn")?.addEventListener("click", () => closeModal(overlay));
  document.getElementById("btn-create-submit")?.addEventListener("click", async () => {
    const name = document.getElementById("playlist-name")?.value.trim();
    if (!name) return;
    try {
      await api("/api/playlist/create", { name }, "POST");
      closeModal(overlay);
      renderLibrary();
    } catch (err) { alert(err.message); }
  });
  document.getElementById("playlist-name")?.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-create-submit")?.click(); });
}

async function renderPlaylist(playlistId) {
  state.currentView = "playlist";
  renderSidebarActive();
  showLoading();
  try {
    const data = await api(`/api/playlist/${playlistId}`);
    const playlist = data.playlist || {};
    const songs = playlist.songs || [];
    state.currentPlaylistSongs = songs;
    view.innerHTML = `
      <div class="section-header">
        <button class="btn-pill" id="btn-back">&larr; Back</button>
        <h2 class="section-title">${esc(playlist.name || "Playlist")}</h2>
        <div>
          <button class="btn-pill-3" id="btn-rename-playlist"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
          <button class="btn-pill-3" id="btn-delete-playlist"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
      <div style="margin-bottom:24px;display:flex;gap:24px;align-items:center">
        <div style="width:200px;height:200px;border-radius:var(--radius);background:linear-gradient(135deg,#1f1f1f,#2a2a2a);border:1px solid var(--border);display:flex;align-items:center;justify-content:center">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="var(--accent)"><path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/></svg>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-secondary);font-weight:700;margin-bottom:4px">PLAYLIST</div>
          <h2 style="font-size:48px;font-weight:700;color:var(--text-bright);margin:4px 0">${esc(playlist.name || "Playlist")}</h2>
          <div style="color:var(--text-muted)">${songs.length} songs</div>
        </div>
      </div>
      <button class="btn-primary" id="btn-play-playlist" style="margin-bottom:16px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play
      </button>
      <button class="btn-pill-3" id="btn-shuffle-playlist" style="margin-bottom:24px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/><path d="M15 15l6 6M15 9l6 6"/></svg> Shuffle Play
      </button>
      <div class="song-list" id="playlist-songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>
    `;
    document.getElementById("btn-back")?.addEventListener("click", () => routeTo("library"));
    document.getElementById("btn-play-playlist")?.addEventListener("click", () => { state.shuffle = false; btnShuffle.classList.remove("shuffle-active"); playQueue(songs, 0); });
    document.getElementById("btn-shuffle-playlist")?.addEventListener("click", () => { state.shuffle = true; btnShuffle.classList.add("shuffle-active"); shuffleQueue(); });

    document.querySelectorAll("[data-play-song]").forEach(el => {
      el.addEventListener("click", (e) => { e.stopPropagation(); playQueue(songs, parseInt(el.dataset.playSong)); });
    });

    document.querySelectorAll(".add-to-playlist-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const song = JSON.parse(btn.dataset.song);
        showAddToPlaylistModal(song);
      });
    });

    document.getElementById("btn-rename-playlist")?.addEventListener("click", () => showRenamePlaylistModal(playlistId, playlist.name));
    document.getElementById("btn-delete-playlist")?.addEventListener("click", async () => {
      if (confirm("Delete this playlist?")) {
        try { await api(`/api/playlist/${playlistId}`, {}, "DELETE"); routeTo("library"); } catch (err) { alert(err.message); }
      }
    });
  } catch (err) { showError(err); }
}

function showAddToPlaylistModal(song) {
  const overlay = showModal(`
    <div class="modal-header">
      <h2 class="modal-title">Add to Playlist</h2>
      <button class="icon-btn modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="add-playlist-select">Select Playlist</label>
        <select class="form-input" id="add-playlist-select">
          <option value="">-- Choose a playlist --</option>
        </select>
      </div>
      <button class="btn-primary" id="btn-add-submit" style="width:100%;justify-content:center">Add Song</button>
      <div style="margin-top:12px;text-align:center">
        <button class="btn-pill-4" id="btn-create-new-playlist">+ Create new playlist</button>
      </div>
    </div>
  `);

  loadPlaylistsIntoSelect(document.getElementById("add-playlist-select"));

  document.getElementById("modal-close-btn")?.addEventListener("click", () => closeModal(overlay));
  document.getElementById("btn-add-submit")?.addEventListener("click", async () => {
    const select = document.getElementById("add-playlist-select");
    const pid = select?.value;
    if (!pid) return;
    try {
      await api("/api/playlist/save", { playlistId: pid, name: song.title, songIdToAdd: song.id }, "POST");
      closeModal(overlay);
      routeTo(`playlist/${pid}`);
    } catch (err) { alert(err.message); }
  });
  document.getElementById("btn-create-new-playlist")?.addEventListener("click", async () => {
    const name = prompt("New playlist name:");
    if (!name) return;
    try {
      const data = await api("/api/playlist/create", { name }, "POST");
      const newPlaylist = data.playlist;
      if (newPlaylist?.id) {
        const select = document.getElementById("add-playlist-select");
        loadPlaylistsIntoSelect(select);
        setTimeout(() => {
          select.value = newPlaylist.id;
        }, 0);
      } else {
        loadPlaylistsIntoSelect(document.getElementById("add-playlist-select"));
      }
    } catch (err) { alert(err.message); }
  });
}

function showRenamePlaylistModal(pid, currentName) {
  const overlay = showModal(`
    <div class="modal-header">
      <h2 class="modal-title">Rename Playlist</h2>
      <button class="icon-btn modal-close" id="modal-close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="rename-input">Playlist Name</label>
        <input type="text" class="form-input" id="rename-input" value="${esc(currentName)}" maxlength="100" autofocus>
      </div>
      <button class="btn-primary" id="btn-rename-submit" style="width:100%;justify-content:center">Save</button>
    </div>
  `);
  document.getElementById("modal-close-btn")?.addEventListener("click", () => closeModal(overlay));
  document.getElementById("btn-rename-submit")?.addEventListener("click", async () => {
    const name = document.getElementById("rename-input")?.value.trim();
    if (!name) return;
    try { await api("/api/playlist/save", { playlistId: pid, name }, "POST"); closeModal(overlay); renderLibrary(); } catch (err) { alert(err.message); }
  });
  document.getElementById("rename-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("btn-rename-submit")?.click(); });
}

function loadPlaylistsIntoSelect(select) {
  if (!select) return;
  select.innerHTML = '<option value="">-- Choose a playlist --</option>';
  api("/api/playlists").then(data => {
    const playlists = (data.playlists && data.playlists.playlist) || [];
    playlists.forEach(pl => {
      const opt = document.createElement("option");
      opt.value = pl.id;
      opt.textContent = pl.name || "Untitled";
      select.appendChild(opt);
    });
  }).catch(() => {});
}

async function renderAlbum(albumId) {
  state.currentView = "album";
  renderSidebarActive();
  showLoading();
  try {
    const data = await api("/api/album", { id: albumId });
    const album = data.album || {};
    const songs = album.song || [];
    view.innerHTML = `
      <div class="section-header">
        <button class="btn-pill" id="btn-back">&larr; Back</button>
        <h2 class="section-title">${esc(album.title || album.name || "Album")}</h2>
        <div></div>
      </div>
      <div style="margin-bottom:24px;display:flex;gap:24px;align-items:center">
        ${album.coverArt ? `<img src="${coverUrl(album.coverArt)}" style="width:220px;height:220px;border-radius:var(--radius);border:1px solid var(--border)" alt="">` : '<div style="width:220px;height:220px;border-radius:var(--radius);background:var(--bg-card);border:1px solid var(--border)"></div>'}
        <div>
          <div style="font-size:12px;color:var(--text-secondary);font-weight:700;margin-bottom:4px">ALBUM</div>
          <h2 style="font-size:48px;font-weight:700;color:var(--text-bright);margin:4px 0">${esc(album.title || album.name || "Album")}</h2>
          <div style="color:var(--text-muted)">${esc(album.artist || album.album)} · ${songs.length} songs</div>
        </div>
      </div>
      <button class="btn-primary" id="btn-play-album" style="margin-bottom:16px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play
      </button>
      <div class="song-list" id="album-songs">${songs.map((s, i) => songRow(s, i)).join("")}</div>
    `;
    document.getElementById("btn-back")?.addEventListener("click", () => routeTo("home"));
    document.getElementById("btn-play-album")?.addEventListener("click", () => { state.shuffle = false; btnShuffle.classList.remove("shuffle-active"); playQueue(songs, 0); });
    document.querySelectorAll("[data-play-song]").forEach(el => {
      el.addEventListener("click", (e) => { e.stopPropagation(); playQueue(songs, parseInt(el.dataset.playSong)); });
    });
    document.querySelectorAll(".add-to-playlist-btn").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); const song = JSON.parse(btn.dataset.song); showAddToPlaylistModal(song); });
    });
  } catch (err) { showError(err); }
}

// ---------- Player ----------
function currentSong() { return state.queue[state.index] || null; }

function playQueue(songs, startIndex = 0) {
  if (!songs || !songs.length) return;
  state.queue = songs.slice();
  state.index = Math.min(Math.max(0, startIndex), songs.length - 1);
  loadCurrent(true);
  saveState();
}

function loadCurrent(autoplay) {
  const song = currentSong();
  if (!song) return;
  audio.src = `/api/stream?id=${encodeURIComponent(song.id)}`;
  playerEl.hidden = false;
  document.getElementById("player-title").textContent = song.title || "Unknown title";
  document.getElementById("player-artist").textContent = song.artist || song.album || "";
  document.getElementById("player-cover").src = coverUrl(song.coverArt || song.albumCoverArt);
  timeTotal.textContent = fmtDuration(song.duration);
  timeCurrent.textContent = "0:00";
  progressFill.style.width = "0%";
  btnToggle.classList.remove("playing");
  if (state.savedTime && !autoplay) {
    audio.addEventListener("loadedmetadata", () => {
      audio.currentTime = Math.min(state.savedTime, audio.duration || 0);
      state.savedTime = 0;
    }, { once: true });
  }
  if (autoplay) audio.play().catch(() => {});
  saveState();
}

function nextTrack() {
  if (state.queue.length === 0) { audio.pause(); btnToggle.classList.remove("playing"); return; }
  if (state.shuffle) { state.index = Math.floor(Math.random() * state.queue.length); }
  else if (state.index < state.queue.length - 1) { state.index += 1; }
  else { audio.pause(); btnToggle.classList.remove("playing"); return; }
  loadCurrent(true);
  saveState();
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (state.index > 0) { state.index -= 1; loadCurrent(true); saveState(); }
  else { audio.currentTime = 0; }
}

function shuffleQueue() {
  if (state.queue.length === 0) return;
  const shuffled = [...state.queue];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  state.queue = shuffled;
  state.index = 0;
  loadCurrent(true);
  saveState();
}

// ---------- Player Events ----------
let saveThrottle = 0;
btnToggle.addEventListener("click", () => {
  if (!currentSong()) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
  saveState();
});
btnNext.addEventListener("click", () => { nextTrack(); saveState(); });
btnPrev.addEventListener("click", () => { prevTrack(); saveState(); });
audio.addEventListener("play", () => { btnToggle.classList.add("playing"); saveState(); });
audio.addEventListener("pause", () => { btnToggle.classList.remove("playing"); saveState(); });
audio.addEventListener("ended", () => { if (state.repeat) { audio.currentTime = 0; audio.play().catch(()=>{}); } else nextTrack(); });
audio.addEventListener("loadedmetadata", () => { if (Number.isFinite(audio.duration)) timeTotal.textContent = fmtDuration(audio.duration); });
audio.addEventListener("timeupdate", () => {
  timeCurrent.textContent = fmtDuration(audio.currentTime);
  if (audio.duration > 0) { const pct = (audio.currentTime / audio.duration) * 100; progressFill.style.width = `${pct}%`; }
  const now = Date.now();
  if (now - saveThrottle > 5000) { saveThrottle = now; saveState(); }
});

let seeking = false;
progressBar.addEventListener("mousedown", (e) => { seeking = true; seekTo(e); });
window.addEventListener("mousemove", (e) => { if (seeking) seekTo(e); });
window.addEventListener("mouseup", () => { seeking = false; });
function seekTo(e) {
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  if (audio.duration > 0) { audio.currentTime = (pct / 100) * audio.duration; progressFill.style.width = `${pct}%`; saveState(); }
}

function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v));
  audio.volume = state.volume;
  volumeFill.style.width = `${state.volume * 100}%`;
  const high = btnVolume.querySelector(".volume-high");
  const mute = btnVolume.querySelector(".volume-mute");
  if (high) high.hidden = state.volume > 0;
  if (mute) mute.hidden = state.volume === 0;
  saveState();
}
btnVolume.addEventListener("click", () => { setVolume(state.volume > 0 ? 0 : 1); });
let volSeeking = false;
const volumeSlider = document.querySelector(".volume-slider");
volumeSlider.addEventListener("mousedown", (e) => { volSeeking = true; seekVol(e); });
window.addEventListener("mousemove", (e) => { if (volSeeking) seekVol(e); });
window.addEventListener("mouseup", () => { volSeeking = false; saveState(); });
function seekVol(e) {
  const rect = volumeSlider.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  setVolume(pct / 100);
}

btnShuffle.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  btnShuffle.classList.toggle("shuffle-active", state.shuffle);
  if (state.shuffle && state.queue.length > 0) shuffleQueue();
  saveState();
});
btnRepeat.addEventListener("click", () => {
  state.repeat = !state.repeat;
  btnRepeat.classList.toggle("repeat-active", state.repeat);
  saveState();
});
btnLike.addEventListener("click", () => {
  const song = currentSong();
  if (song) {
    if (state.liked.has(song.id)) { state.liked.delete(song.id); btnLike.classList.remove("btn-like-active"); }
    else { state.liked.add(song.id); btnLike.classList.add("btn-like-active"); }
    saveState();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); btnToggle.click(); }
  if (e.code === "ArrowRight") { nextTrack(); saveState(); }
  if (e.code === "ArrowLeft") { prevTrack(); saveState(); }
  if (e.code === "ArrowUp") { setVolume(state.volume + 0.1); }
  if (e.code === "ArrowDown") { setVolume(state.volume - 0.1); }
});

// ---------- Router ----------
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const params = new URLSearchParams(queryPart || "");
  return { path, params };
}
function routeTo(view) { location.hash = `/${view === "home" ? "" : view}`; }

async function route() {
  const { params } = parseHash();
  if (!location.hash || location.hash === "#/" || location.hash === "") { return await renderHome(); }
  const hash = location.hash;
  const playlistMatch = hash.match(/#\/playlist\/(.+)/);
  const albumMatch = hash.match(/#\/album\/(.+)/);
  const searchMatch = hash.match(/^#\/search/);
  const libraryMatch = hash.match(/^#\/library/);
  const importMatch = hash.match(/^#\/import/);

  if (searchMatch) return await renderSearch(params.get("q") || "");
  if (libraryMatch) return await renderLibrary();
  if (importMatch) return await renderImport();
  if (playlistMatch) return await renderPlaylist(playlistMatch[1]);
  if (albumMatch) return await renderAlbum(albumMatch[1]);
  view.innerHTML = `<p class="muted">Page not found. <a href="#/">Go home</a>.</p>`;
}

window.onerror = function(msg, src, line, col, err) { console.error("GLOBAL ERROR:", msg, src, line, col, err); return true; };
window.addEventListener("hashchange", route);

let searchTimeout;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { if (searchInput.value.trim().length >= 2) routeTo("search"); }, 400);
});
searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); routeTo("search"); } });

loadState();
setVolume(state.volume);
btnShuffle.classList.toggle("shuffle-active", state.shuffle);
btnRepeat.classList.toggle("repeat-active", state.repeat);
btnLike.classList.toggle("btn-like-active", state.liked.size > 0);

window.subsonic = { state, playQueue, api, audio, routeTo, search: renderSearch, shuffleQueue, nextTrack };
route().catch(function(e) { console.error("ROUTE ERROR:", e); });
