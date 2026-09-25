"use strict";

const view = document.getElementById("view");
const audio = document.getElementById("audio");
const playerEl = document.getElementById("player");

const btnToggle = document.getElementById("btn-toggle");
const btnNext = document.getElementById("btn-next");
const btnVolume = document.getElementById("btn-volume");
const progressBar = document.querySelector(".progress-bar");
const progressFill = document.getElementById("progress-fill");
const volumeFill = document.getElementById("volume-fill");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");

const state = {
  queue: [],
  index: -1,
  volume: 1,
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function coverUrl(id) {
  return id ? `/api/cover?id=${encodeURIComponent(id)}` : "";
}

async function api(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const res = await fetch(qs ? `${path}?${qs}` : path);
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
  view.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>`;
}

function albumCard(album) {
  const title = album.title || album.name || "Unknown album";
  const artist = album.artist || "";
  return `
    <a class="card card-link" href="#/album/${encodeURIComponent(album.id)}" style="display:block;opacity:1;visibility:visible;">
      <img class="card-image" src="${coverUrl(album.coverArt)}" alt="" loading="lazy">
      <div class="card-body">
        <div class="card-title">${esc(title)}</div>
        <div class="card-subtitle">${esc(artist)}</div>
      </div>
    </a>`;
}

// ---------- Player ----------
function currentSong() {
  return state.queue[state.index] || null;
}

function playQueue(songs, startIndex = 0) {
  if (!songs || !songs.length) return;
  state.queue = songs.slice();
  state.index = Math.min(Math.max(0, startIndex), songs.length - 1);
  loadCurrent(true);
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
  if (autoplay) audio.play().catch(() => {});
}

function nextTrack() {
  if (state.index < state.queue.length - 1) {
    state.index += 1;
    loadCurrent(true);
  } else {
    audio.pause();
    btnToggle.classList.remove("playing");
  }
}

function prevTrack() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (state.index > 0) {
    state.index -= 1;
    loadCurrent(true);
  } else {
    audio.currentTime = 0;
  }
}

// ---------- Player Events ----------
btnToggle.addEventListener("click", () => {
  if (!currentSong()) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});

btnNext.addEventListener("click", nextTrack);

audio.addEventListener("play", () => btnToggle.classList.add("playing"));
audio.addEventListener("pause", () => btnToggle.classList.remove("playing"));
audio.addEventListener("ended", nextTrack);
audio.addEventListener("loadedmetadata", () => {
  if (Number.isFinite(audio.duration)) timeTotal.textContent = fmtDuration(audio.duration);
});
audio.addEventListener("timeupdate", () => {
  timeCurrent.textContent = fmtDuration(audio.currentTime);
  if (audio.duration > 0) {
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${pct}%`;
  }
});

// Progress bar seek
let seeking = false;
progressBar.addEventListener("mousedown", (e) => {
  seeking = true;
  seekTo(e);
});
window.addEventListener("mousemove", (e) => { if (seeking) seekTo(e); });
window.addEventListener("mouseup", () => { seeking = false; });

function seekTo(e) {
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  if (audio.duration > 0) {
    audio.currentTime = (pct / 100) * audio.duration;
    progressFill.style.width = `${pct}%`;
  }
}

// Volume
function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v));
  audio.volume = state.volume;
  volumeFill.style.width = `${state.volume * 100}%`;
  const high = btnVolume.querySelector(".volume-high");
  const mute = btnVolume.querySelector(".volume-mute");
  high.hidden = state.volume > 0;
  mute.hidden = state.volume === 0;
}

btnVolume.addEventListener("click", () => {
  setVolume(state.volume > 0 ? 0 : 1);
});

let volSeeking = false;
const volumeSlider = document.querySelector(".volume-slider");
volumeSlider.addEventListener("mousedown", (e) => { volSeeking = true; seekVol(e); });
window.addEventListener("mousemove", (e) => { if (volSeeking) seekVol(e); });
window.addEventListener("mouseup", () => { volSeeking = false; });

function seekVol(e) {
  const rect = volumeSlider.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  setVolume(pct / 100);
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); btnToggle.click(); }
  if (e.code === "ArrowRight") nextTrack();
  if (e.code === "ArrowLeft") prevTrack();
  if (e.code === "ArrowUp") setVolume(state.volume + 0.1);
  if (e.code === "ArrowDown") setVolume(state.volume - 0.1);
});

// ---------- View Renderers ----------
async function renderHome() {
  try {
    view.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Home</h2>
        <button class="btn-primary" id="btn-random">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><path d="M4 20L21 3"/><polyline points="21 16 21 21 16 21"/></svg>
          Shuffle Play
        </button>
      </div>
      <div class="grid" id="albums"><p class="muted">Loading…</p></div>`;
  } catch(e) { console.error("view.innerHTML error:", e); return; }

  document.getElementById("btn-random").addEventListener("click", async () => {
    try {
      const data = await api("/api/random", { size: 50 });
      const songs = (data.randomSongs && data.randomSongs.song) || [];
      if (!songs.length) throw new Error("No songs returned");
      playQueue(songs, 0);
    } catch (err) { alert(err.message); }
  });

  try {
    const data = await api("/api/albums", { type: "newest", size: 24 });
    const list = (data.albumList2 && data.albumList2.album) || [];
    const grid = document.getElementById("albums");
    grid.innerHTML = list.length
      ? list.map(albumCard).join("")
      : `<p class="muted">No albums found.</p>`;
  } catch (err) {
    console.error("renderHome error:", err);
    try { showError(err); } catch(e2) {}
  }
}

// ---------- Router ----------
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const params = new URLSearchParams(queryPart || "");
  return { path, params };
}

async function route() {
  const { params } = parseHash();
  if (location.hash === "#/album" || location.hash === "#/album/") {
    view.innerHTML = `<p class="muted">Select an album from the home page.</p>`;
    return;
  }
  const albumId = location.hash.match(/#\/album\/(.+)/)?.[1];
  if (albumId) {
    showLoading();
    try {
      const data = await api("/api/album", { id: albumId });
      const album = data.album || {};
      const songs = album.song || [];
      view.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">${esc(album.title || album.name || "Album")}</h2>
        </div>
        <div class="toolbar" style="margin-bottom:20px">
          <button class="btn-primary" id="btn-play-all" ${songs.length ? "" : "disabled"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play
          </button>
        </div>
        <div class="grid">${songs.map(s => {
          return `<div class="card card-link" data-song-id="${esc(s.id)}">
            <div class="card-body">
              <div class="card-title">${esc(s.title)}</div>
              <div class="card-subtitle">${esc(s.artist || s.album || "")}</div>
            </div>
          </div>`;
        }).join("")}</div>`;
      const playAll = document.getElementById("btn-play-all");
      if (playAll) playAll.addEventListener("click", () => playQueue(songs, 0));
      const cards = document.querySelectorAll("[data-song-id]");
      cards.forEach((card, i) => {
        card.addEventListener("click", () => playQueue(songs, i));
      });
    } catch (err) { showError(err); }
    return;
  }
  if (!location.hash || location.hash === "#/" || location.hash === "") {
    return await renderHome();
  }
  view.innerHTML = `<p class="muted">Page not found. <a href="#/">Go home</a>.</p>`;
}

window.onerror = function(msg, src, line, col, err) { console.error("GLOBAL ERROR:", msg, src, line, col, err); return true; };
window.addEventListener("hashchange", route);
route().catch(function(e) { console.error("ROUTE ERROR:", e); });

setVolume(1);
window.subsonic = { state, playQueue, api, audio };
