// A mini player that survives page changes.
//
// Every Arioso page is its own document, so the playlist page's album stage
// cannot keep its <audio> element alive across a link click. This module takes
// over on the other pages: it reads the recorded playback state, recreates the
// element at the recorded position, and paints a compact bar at the bottom.
// The playlist page keeps its own full bar and writes the same record, so
// playback continues in both directions.

import { clearPlayback, readPlayback, trackAudioUrl, writePlayback } from "./playback-session.js";

const COPY = {
  "zh-CN": { play: "播放", pause: "暂停", stop: "关闭播放", nowPlaying: "正在播放" },
  en: { play: "Play", pause: "Pause", stop: "Stop playback", nowPlaying: "Now playing" },
};

const language = document.documentElement.lang === "en" ? "en" : "zh-CN";
const t = (key) => (COPY[language] ?? COPY["zh-CN"])[key] ?? key;

function clockText(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The playlist page owns playback there; including the bar would duplicate it.
const handledByPage = document.body.classList.contains("pl-page");
const restored = handledByPage ? null : readPlayback();
// A page change pauses rather than continues: the bar comes back paused at the
// recorded position, and the user decides when audio resumes.
if (restored) startMiniPlayer({ ...restored, playing: false });

function startMiniPlayer(initial) {
  let state = { ...initial };
  let audio = null;
  let lastWrite = 0;

  const bar = document.createElement("div");
  bar.className = "pb";
  bar.id = "arioso-mini-player";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", t("nowPlaying"));
  bar.innerHTML = `
    <button class="pb-toggle" type="button" aria-label="${t("play")}">▶</button>
    <div class="pb-meta">
      <strong>${escapeText(state.trackTitle)}</strong>
      <small>${escapeText(state.albumTitle)}</small>
    </div>
    <input class="pb-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="${t("nowPlaying")}" />
    <span class="pb-time num"><span data-now>0:00</span> / <span data-total>0:00</span></span>
    <button class="pb-stop" type="button" aria-label="${t("stop")}">✕</button>
  `;
  document.body.appendChild(bar);
  document.body.classList.add("has-mini-player");

  const toggle = bar.querySelector(".pb-toggle");
  const seek = bar.querySelector(".pb-seek");
  const now = bar.querySelector("[data-now]");
  const total = bar.querySelector("[data-total]");

  function paint() {
    toggle.textContent = state.playing ? "⏸" : "▶";
    toggle.setAttribute("aria-label", state.playing ? t("pause") : t("play"));
    const max = state.duration > 0 ? state.duration : 0;
    if (seek && Number(seek.max) !== max) seek.max = String(max);
    if (seek && document.activeElement !== seek) seek.value = String(Math.min(state.position, max));
    if (now) now.textContent = clockText(state.position);
    if (total) total.textContent = clockText(state.duration);
  }

  function persist(force = false) {
    const stamp = Date.now();
    if (!force && stamp - lastWrite < 800) return;
    lastWrite = stamp;
    writePlayback({
      taskId: state.taskId,
      trackId: state.trackId,
      trackTitle: state.trackTitle,
      albumTitle: state.albumTitle,
      position: state.position,
      duration: state.duration,
      playing: state.playing,
    });
  }

  function element() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "metadata";
    audio.src = trackAudioUrl(state.taskId, state.trackId);
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) state.duration = audio.duration;
      if (state.position > 0 && Math.abs(audio.currentTime - state.position) > 1) {
        audio.currentTime = Math.min(state.position, audio.duration || state.position);
      }
      paint();
    });
    audio.addEventListener("timeupdate", () => {
      state.position = audio.currentTime;
      paint();
      persist();
    });
    audio.addEventListener("play", () => {
      state.playing = true;
      paint();
      persist(true);
    });
    audio.addEventListener("pause", () => {
      state.playing = false;
      paint();
      persist(true);
    });
    audio.addEventListener("ended", () => stop());
    audio.addEventListener("error", () => stop());
    return audio;
  }

  function start() {
    const el = element();
    el.play().catch(() => {
      // Browsers may still refuse without a fresh gesture: leave the bar paused.
      state.playing = false;
      paint();
    });
  }

  function stop() {
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    state.playing = false;
    clearPlayback();
    bar.remove();
    document.body.classList.remove("has-mini-player");
    audio = null;
  }

  toggle.addEventListener("click", () => {
    if (state.playing) element().pause();
    else start();
  });

  seek.addEventListener("input", () => {
    const el = element();
    const target = Number(seek.value);
    el.currentTime = Math.max(0, target);
    state.position = el.currentTime;
    paint();
  });

  bar.querySelector(".pb-stop").addEventListener("click", () => stop());

  // A reload or a link click must not lose the last second of position.
  window.addEventListener("pagehide", () => persist(true));

  // Load the track so the bar shows its real duration and sits at the recorded
  // position, but stay paused until the user asks to continue.
  element();
  paint();
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
