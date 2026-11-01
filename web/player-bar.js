// The playback bar every page shares.
//
// One component, two owners. On the playlist page the album stage owns the
// <audio> element and pushes snapshots in; on every other page this module owns
// the element and rebuilds it from the recorded state. Either way the page shows
// the same bar, the same queue panel, and the same "one click to continue".
//
// The page supplies a controller:
//   subscribe(listener)  ->  called with each playback snapshot
//   toggle() next() prev()
//   play(trackId)
//   queue()              ->  [{ id, title, durationSeconds, current }]

import { clearPlayback, readPlayback, trackAudioUrl, writePlayback } from "./playback-session.js";

const COPY = {
  "zh-CN": {
    play: "播放", pause: "暂停", nowPlaying: "正在播放", queue: "播放队列",
    queueEmpty: "还没有可播放的曲目。", close: "关闭",
    previous: "上一首", next: "下一首", stop: "关闭播放",
  },
  en: {
    play: "Play", pause: "Pause", nowPlaying: "Now playing", queue: "Play queue",
    queueEmpty: "Nothing queued yet.", close: "Close",
    previous: "Previous track", next: "Next track", stop: "Stop playback",
  },
};

function defaultLanguage() {
  return document.documentElement.lang === "en" ? "en" : "zh-CN";
}

function clockText(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function initialOf(value) {
  return Array.from(String(value ?? "").trim())[0]?.toUpperCase() ?? "A";
}

/**
 * Mounts the bar and its queue panel on the current page.
 * Returns `{ destroy }` so a page can unmount it if it ever needs to.
 */
export function mountPlayerBar(controller, options = {}) {
  const t = options.t ?? ((key) => (COPY[defaultLanguage()] ?? COPY["zh-CN"])[key] ?? key);
  const coverFor = options.coverFor ?? ((snapshot) => ({
    style: snapshot.coverStyle ?? "",
    glyph: snapshot.coverGlyph || initialOf(snapshot.albumTitle),
    imageUrl: snapshot.coverImageUrl ?? "",
  }));

  const bar = document.createElement("div");
  bar.className = "pbar";
  bar.id = "arioso-player";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", t("nowPlaying"));
  bar.hidden = true;
  document.body.appendChild(bar);

  const queueRoot = document.createElement("div");
  queueRoot.className = "pbar-queue-root";
  document.body.appendChild(queueRoot);

  let snapshot = null;
  let builtKey = "";
  let queueOpen = false;

  function apply() {
    if (!snapshot?.trackId) {
      bar.hidden = true;
      bar.innerHTML = "";
      builtKey = "";
      document.body.classList.remove("has-pbar");
      closeQueue();
      return;
    }
    bar.hidden = false;
    document.body.classList.add("has-pbar");
    const cover = coverFor(snapshot);
    // The cover URL is part of the key: replacing the album art rebuilds the bar.
    const key = `${snapshot.taskId ?? ""}:${snapshot.trackId}:${cover.imageUrl}`;
    if (key !== builtKey) {
      builtKey = key;
      renderStructure(cover);
      bindBar();
      if (queueOpen) renderQueue();
    }
    patch();
  }

  function renderStructure(cover = coverFor(snapshot)) {
    const subtitle = snapshot.albumTitle || snapshot.taskTitle || "";
    const coverMarkup = cover.imageUrl
      ? `<span class="pl-cover pl-cover-xs is-art" aria-hidden="true"><img src="${escapeText(cover.imageUrl)}" alt="" /></span>`
      : `<span class="pl-cover pl-cover-xs" style="${cover.style}" aria-hidden="true"><b>${escapeText(cover.glyph)}</b></span>`;
    bar.innerHTML = `
      <button class="pbar-left" type="button" data-bar="queue" aria-label="${escapeText(t("queue"))}" aria-expanded="false">
        ${coverMarkup}
        <span class="pbar-now">
          <strong>${escapeText(snapshot.trackTitle)}</strong>
          <small>${escapeText(subtitle)}</small>
        </span>
      </button>
      <div class="pbar-transport">
        <button type="button" data-bar="prev" aria-label="${escapeText(t("previous"))}">⏮</button>
        <button type="button" class="pbar-toggle" data-bar="toggle" aria-label="${escapeText(t("play"))}">▶</button>
        <button type="button" data-bar="next" aria-label="${escapeText(t("next"))}">⏭</button>
      </div>
      <span class="pbar-time num"><span data-bar-now>0:00</span><span class="pbar-sep">/</span><span data-bar-total>0:00</span></span>
    `;
  }

  function patch() {
    const now = bar.querySelector("[data-bar-now]");
    if (now) now.textContent = clockText(snapshot.currentTime);
    const total = bar.querySelector("[data-bar-total]");
    if (total) total.textContent = clockText(snapshot.duration);
    const toggle = bar.querySelector('[data-bar="toggle"]');
    if (toggle) {
      toggle.textContent = snapshot.playing ? "⏸" : "▶";
      toggle.setAttribute("aria-label", snapshot.playing ? t("pause") : t("play"));
    }
  }

  function bindBar() {
    bar.querySelectorAll("[data-bar]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.bar;
        if (action === "toggle") controller.toggle();
        else if (action === "prev") controller.prev();
        else if (action === "next") controller.next();
        else if (action === "queue") toggleQueue();
      });
    });
  }

  function toggleQueue() {
    queueOpen = !queueOpen;
    const left = bar.querySelector(".pbar-left");
    if (left) left.setAttribute("aria-expanded", queueOpen ? "true" : "false");
    renderQueue();
  }

  function closeQueue() {
    if (!queueOpen) return;
    queueOpen = false;
    const left = bar.querySelector(".pbar-left");
    if (left) left.setAttribute("aria-expanded", "false");
    queueRoot.innerHTML = "";
  }

  function renderQueue() {
    if (!queueOpen || !snapshot?.trackId) {
      queueRoot.innerHTML = "";
      return;
    }
    const tracks = controller.queue();
    queueRoot.innerHTML = `
      <div class="pbar-queue" role="dialog" aria-label="${escapeText(t("queue"))}">
        <header class="pbar-queue-head">
          <h2>${escapeText(t("queue"))}</h2>
          <button class="pbar-queue-close" type="button" data-queue-action="close" aria-label="${escapeText(t("close"))}">✕</button>
        </header>
        ${tracks.length
          ? `<ul class="pbar-queue-list">${tracks.map((track) => `
              <li>
                <button class="pbar-queue-item${track.current ? " is-current" : ""}" type="button"
                  data-queue-track="${escapeText(track.id)}" aria-current="${track.current ? "true" : "false"}">
                  <span class="pbar-queue-num num">${String(track.order).padStart(2, "0")}</span>
                  <span class="pbar-queue-name">${escapeText(track.title)}</span>
                  <span class="pbar-queue-dur num">${clockText(track.durationSeconds)}</span>
                </button>
              </li>`).join("")}</ul>`
          : `<p class="pbar-queue-empty">${escapeText(t("queueEmpty"))}</p>`}
      </div>`;
    queueRoot.querySelectorAll("[data-queue-action]").forEach((button) => {
      button.addEventListener("click", () => closeQueue());
    });
    queueRoot.querySelectorAll("[data-queue-track]").forEach((button) => {
      button.addEventListener("click", () => {
        controller.play(button.dataset.queueTrack);
        closeQueue();
      });
    });
  }

  controller.subscribe((next) => {
    snapshot = next;
    apply();
  });

  // Clicking anywhere but the bar or the panel closes the queue.
  document.addEventListener("click", (event) => {
    if (!queueOpen) return;
    if (event.target.closest(".pbar-queue") || event.target.closest(".pbar-left")) return;
    closeQueue();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && queueOpen) closeQueue();
  });

  return {
    destroy() {
      bar.remove();
      queueRoot.remove();
      document.body.classList.remove("has-pbar");
    },
  };
}

/**
 * On pages without an album stage, this module owns the audio element: it
 * restores the recorded track paused, and drives it from the same bar.
 */
export function mountRecordedPlayback() {
  const saved = readPlayback();
  if (!saved) return null;

  let state = {
    ...saved,
    playing: false,
    queue: Array.isArray(saved.queue) ? saved.queue : [],
  };
  let audio = null;
  let lastWrite = 0;
  let listeners = [];
  let resumeAt = saved.position;

  function snapshot() {
    const track = state.queue.find((item) => item.id === state.trackId);
    return {
      taskId: state.taskId,
      trackId: state.trackId,
      trackTitle: track?.title ?? state.trackTitle,
      albumTitle: state.albumTitle,
      playing: state.playing,
      currentTime: state.currentTime ?? 0,
      duration: track?.durationSeconds ?? state.duration ?? 0,
      coverStyle: state.coverStyle ?? "",
      coverGlyph: state.coverGlyph ?? "",
      coverImageUrl: state.coverImageUrl ?? "",
    };
  }

  function publish() {
    for (const listener of listeners) listener(snapshot());
  }

  function persist(force = false) {
    const stamp = Date.now();
    if (!force && stamp - lastWrite < 800) return;
    lastWrite = stamp;
    writePlayback({
      taskId: state.taskId,
      trackId: state.trackId,
      trackTitle: snapshot().trackTitle,
      albumTitle: state.albumTitle,
      position: state.currentTime ?? 0,
      duration: snapshot().duration,
      playing: state.playing,
      coverStyle: state.coverStyle ?? "",
      coverGlyph: state.coverGlyph ?? "",
      coverImageUrl: state.coverImageUrl ?? "",
      queue: state.queue,
    });
  }

  function element() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "metadata";
    audio.src = trackAudioUrl(state.taskId, state.trackId);
    audio.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration > 0) state.duration = duration;
      if (resumeAt > 0) {
        audio.currentTime = Math.min(resumeAt, duration || resumeAt);
        resumeAt = 0;
        state.currentTime = audio.currentTime;
      }
      publish();
    });
    audio.addEventListener("timeupdate", () => {
      state.currentTime = audio.currentTime;
      publish();
      persist();
    });
    audio.addEventListener("play", () => {
      state.playing = true;
      publish();
      persist(true);
    });
    audio.addEventListener("pause", () => {
      state.playing = false;
      publish();
      persist(true);
    });
    audio.addEventListener("ended", () => next());
    audio.addEventListener("error", () => {
      state.playing = false;
      publish();
    });
    return audio;
  }

  function playTrack(trackId, autoplay = true) {
    const track = state.queue.find((item) => item.id === trackId);
    if (!track) return;
    state.trackId = track.id;
    state.currentTime = 0;
    resumeAt = 0;
    if (audio) {
      audio.src = trackAudioUrl(state.taskId, track.id);
      audio.currentTime = 0;
      if (autoplay) audio.play().catch(() => { state.playing = false; publish(); });
    } else if (autoplay) {
      element().play().catch(() => { state.playing = false; publish(); });
    }
    publish();
    persist(true);
  }

  function step(direction) {
    if (!state.queue.length) return;
    const index = state.queue.findIndex((item) => item.id === state.trackId);
    const target = state.queue[index + direction];
    if (target) playTrack(target.id, state.playing);
  }

  function next() { step(1); }
  function prev() { step(-1); }

  function toggle() {
    const el = element();
    if (state.playing) el.pause();
    else el.play().catch(() => { state.playing = false; publish(); });
  }

  const controller = {
    subscribe(listener) {
      listeners.push(listener);
      listener(snapshot());
      return () => { listeners = listeners.filter((item) => item !== listener); };
    },
    toggle,
    next,
    prev,
    play: (trackId) => playTrack(trackId, true),
    queue() {
      const current = state.trackId;
      return state.queue.map((track, index) => ({
        id: track.id,
        order: index + 1,
        title: track.title,
        durationSeconds: track.durationSeconds ?? 0,
        current: track.id === current,
      }));
    },
  };

  // Load metadata so the bar shows the real duration and sits at the position,
  // but stay paused until the user asks to continue.
  element();
  window.addEventListener("pagehide", () => persist(true));

  return mountPlayerBar(controller);
}

// Pages other than the playlist get the bar automatically.
if (!document.body.classList.contains("pl-page")) mountRecordedPlayback();
