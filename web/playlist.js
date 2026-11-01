// Playlist: a player-first library over the album workflow's output.
//
// The request model is the album workflow's — candidates, include/exclude and
// an MP3 export — but the planning input is a set of MoodMic conversations the
// user picked, each contributing its intent and the MusicSpec of its music.
//
// The page has two states and one overlay: a library of albums, one album, and
// a create drawer. Playback is not a page state: the album stage owns the single
// audio element and the page renders a persistent bar at the bottom, so playing
// keeps going while the library is open.
//
// Planning pauses for confirmation: the album author shows how it read the
// references and the theme, the user can keep talking to revise the plan, and
// only an explicit confirmation starts audio generation. The album stage
// itself (plan, progress, player, curation) lives in album-view.js so the
// MoodMic journey can show exactly the same thing.

import { createAlbumStage, albumPlanBadge, durationText } from "./album-view.js";
import { clearPlayback, readPlayback, writePlayback } from "./playback-session.js";
import { adoptAudio, playExclusive } from "./audio-focus.js";
import { mountPlayerBar } from "./player-bar.js";

const COPY = {
  "zh-CN": {
    tabMoodMic: "MoodMic", tabCalendar: "心情日历（测试）", tabWorkflow: "工作流",
    tabPlaylist: "播放列表", tabHelp: "帮助", tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    title: "播放列表",
    libraryNote: "选一张继续制作，或者新建一张。",
    recentTitle: "最近更新",
    allTitle: "全部歌单",
    intro: "把 MoodMic 里满意的对话与音乐当作参考，规划并生成一整个歌单。",
    newPlaylist: "＋ 新建歌单",
    newPlaylistLabel: "新建歌单",
    emptyShelf: "还没有歌单。新建一个，从 MoodMic 的音乐开始。",
    back: "← 返回",
    createTitle: "新建歌单",
    createIntro: "选几段 MoodMic 里满意的对话与音乐作为参考，再写下这个歌单想要的样子。",
    refsTitle: "参考",
    refsIntro: "选中的对话会连同它们的音乐方案一起交给专辑作者。",
    refsEmpty: "还没有可用的参考。先在 MoodMic 里生成一首音乐，再回到这里。",
    refresh: "刷新",
    describeLabel: "歌单主题",
    describePlaceholder: "例如：适合深夜专注的一组器乐，延续参考里的温暖质感。",
    countLabel: "曲目数",
    minutesLabel: "目标总时长",
    start: "开始规划",
    creating: "正在创建…",
    closeDrawer: "关闭",
    selectedCount: (n) => `已选 ${n} 段参考`,
    needDescription: "先写一句歌单主题。",
    albumMeta: (n, d) => `${n} 首 · ${d}`,
    tracksWord: (n) => `${n} 首候选`,
    includedWord: (n) => `已收录 ${n} 首`,
    playAll: "播放全部",
    editCover: "更换封面",
    removeCover: "移除封面",
    coverError: "封面更新失败，请换一张图片再试。",
    play: "播放",
    pause: "暂停",
    prevTrack: "上一首",
    nextTrack: "下一首",
    nowPlaying: "正在播放",
    queueTitle: "播放队列",
    queueEmpty: "还没有可播放的曲目。",
    listen: "试听",
    playbackError: "这段音频暂时无法播放。",
    shelfReviewHint: "进入确认 →",
    status: {
      queued: "排队中", composing: "正在构思", generating: "正在生成音频",
      review: "等待你确认构思", assembling: "正在拼接", processing: "正在处理",
      completed: "已完成", failed: "未完成",
    },
  },
  en: {
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar (test)", tabWorkflow: "Workflow",
    tabPlaylist: "Playlist", tabHelp: "Help", tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    title: "Playlist",
    libraryNote: "Pick one to keep working on, or start a new album.",
    recentTitle: "Recently updated",
    allTitle: "All playlists",
    intro: "Use the MoodMic conversations and music you liked as references, then plan and generate a whole album.",
    newPlaylist: "＋ New playlist",
    newPlaylistLabel: "New playlist",
    emptyShelf: "No playlists yet. Start one from your MoodMic music.",
    back: "← Back",
    createTitle: "New playlist",
    createIntro: "Pick the MoodMic conversations and music you want to build on, then describe the album you want.",
    refsTitle: "References",
    refsIntro: "Each selected conversation is handed to the album author together with its music spec.",
    refsEmpty: "No references yet. Generate some music in MoodMic first, then come back.",
    refresh: "Refresh",
    describeLabel: "Playlist theme",
    describePlaceholder: "e.g. a set of instrumental pieces for late-night focus, keeping the warmth of the references.",
    countLabel: "Tracks",
    minutesLabel: "Target duration",
    start: "Plan the album",
    creating: "Creating…",
    closeDrawer: "Close",
    selectedCount: (n) => `${n} reference${n === 1 ? "" : "s"} selected`,
    needDescription: "Write a theme for the playlist first.",
    albumMeta: (n, d) => `${n} track${n === 1 ? "" : "s"} · ${d}`,
    tracksWord: (n) => `${n} candidates`,
    includedWord: (n) => `${n} included`,
    playAll: "Play all",
    editCover: "Change cover",
    removeCover: "Remove cover",
    coverError: "The cover could not be updated. Try another image.",
    play: "Play",
    pause: "Pause",
    prevTrack: "Previous track",
    nextTrack: "Next track",
    nowPlaying: "Now playing",
    queueTitle: "Play queue",
    queueEmpty: "Nothing queued yet.",
    listen: "Listen",
    playbackError: "This track's audio cannot play right now.",
    shelfReviewHint: "Open to confirm →",
    status: {
      queued: "Queued", composing: "Thinking", generating: "Generating audio",
      review: "Waiting for your confirmation", assembling: "Assembling", processing: "Processing",
      completed: "Completed", failed: "Not finished",
    },
  },
};

/** Cover tones: the same four mood signals the rest of the app uses. */
const COVER_TONES = [
  ["#e87575", "#8f3a58"],
  ["#e9bd46", "#9a6c22"],
  ["#779dd6", "#33517f"],
  ["#83b59a", "#3a6b56"],
];

const root = document.querySelector("#pl-main");
const drawerRoot = document.querySelector("#pl-drawer-root");
const langToggle = document.querySelector("#lang-toggle");

let language = "zh-CN";
let preview = null;
const state = {
  view: "library",
  drawer: false,
  tasks: [],
  references: [],
  selected: new Set(),
  referencesLoaded: false,
  description: "",
  count: 14,
  minutes: 35,
  currentId: null,
  previewId: null,
  pollTimer: null,
  busy: false,
  message: "",
  player: null,
};

function t(key, ...args) {
  const value = (COPY[language] ?? COPY["zh-CN"])[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function applyI18n() {
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  langToggle.textContent = language === "zh-CN" ? "EN" : "中文";
}

async function api(path, options) {
  const response = await fetch(path, options);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}

function statusLabel(task) {
  return t("status")[task.status] ?? task.status;
}

function taskDuration(task) {
  return (task.albumTracks ?? []).reduce((total, track) => total + (track.audioFile ? track.durationSeconds || 0 : 0), 0);
}

function albumTitle(task) {
  return task.albumPlan?.albumTitle || task.title || task.description || "";
}

function currentTask() {
  return state.tasks.find((item) => item.id === state.currentId);
}

function replaceTask(task) {
  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
}

// ---- covers --------------------------------------------------------------

function hashString(value) {
  let hash = 0;
  for (const character of String(value)) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return hash;
}

/**
 * A deterministic cover for an album: the same title always paints the same
 * two mood tones, so the library reads as a shelf even before a cover image
 * exists. The first glyph keeps the cards recognisable at a glance.
 */
function coverFor(task) {
  const key = albumTitle(task) || task.id;
  const [from, to] = COVER_TONES[hashString(key) % COVER_TONES.length];
  const angle = 105 + (hashString(`${key}:angle`) % 70);
  return {
    style: `--cover-from:${from};--cover-to:${to};--cover-angle:${angle}deg`,
    glyph: Array.from(String(key).trim())[0]?.toUpperCase() ?? "A",
  };
}

function coverMarkup(task, extraClass = "") {
  const classes = `pl-cover${extraClass ? ` ${extraClass}` : ""}`;
  if (task.coverUpdatedAt) {
    // The version keeps a replaced image from being served out of the cache.
    const version = encodeURIComponent(task.coverUpdatedAt);
    return `<span class="${classes} is-art"><img src="/api/tasks/${encodeURIComponent(task.id)}/cover?v=${version}" alt="" loading="lazy" /></span>`;
  }
  const cover = coverFor(task);
  return `<span class="${classes}" style="${cover.style}" aria-hidden="true"><b>${esc(cover.glyph)}</b></span>`;
}

// The album stage reads and writes the album through these callbacks, so the
// page keeps owning its task list while the stage owns plan/curation behaviour.
/** Listeners the shared player bar registers; the stage notifies them. */
const playerListeners = [];
const stage = createAlbumStage({
  language: () => language,
  api,
  getTask: currentTask,
  setTask: (task) => replaceTask(task),
  rerender: () => {
    if (state.view === "album") render();
  },
  onPlayerChange: (snapshot) => {
    state.player = snapshot ?? null;
    for (const listener of playerListeners) listener(snapshot);
    persistPlayback(snapshot);
  },
  approve: async (task) => {
    const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/plan/approve`, { method: "POST" });
    replaceTask(updated);
  },
  revise: async (task, message) => {
    const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/plan/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    replaceTask(updated);
  },
  onRunning: () => pollTask(),
});

// The shared bar drives the stage's single audio element, so every page shows
// the same controls, queue panel, and position.
mountPlayerBar({
  subscribe(listener) {
    playerListeners.push(listener);
    listener(stage.snapshot());
  },
  toggle: () => stage.controls.togglePlay(),
  next: () => stage.controls.stepTrack(1),
  prev: () => stage.controls.stepTrack(-1),
  play: (trackId) => stage.controls.playTrack(trackId),
  queue: () => stage.queueTracks(),
}, {
  // The shared bar asks for its own keys; map them to this page's copy.
  t: (key) => {
    const keys = {
      queue: "queueTitle",
      previous: "prevTrack",
      next: "nextTrack",
      close: "closeDrawer",
      play: "play",
      pause: "pause",
      nowPlaying: "nowPlaying",
      queueEmpty: "queueEmpty",
    };
    return t(keys[key] ?? key);
  },
  coverFor: (snapshot) => {
    const task = state.tasks.find((item) => item.id === snapshot.taskId);
    if (!task) return { style: "", glyph: Array.from(String(snapshot.albumTitle ?? "A"))[0] ?? "A", imageUrl: "" };
    if (task.coverUpdatedAt) {
      const version = encodeURIComponent(task.coverUpdatedAt);
      return {
        style: "",
        glyph: "",
        imageUrl: `/api/tasks/${encodeURIComponent(task.id)}/cover?v=${version}`,
      };
    }
    return coverFor(task);
  },
});

// ---- views ---------------------------------------------------------------

function viewLibrary() {
  const albums = state.tasks
    .filter((task) => task.workflowType === "05-playlist")
    .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));
  const recent = albums.slice(0, 4);
  const rest = albums.slice(4);
  const section = (title, items) => (items.length
    ? `<section class="lib-section">
        <h2>${esc(title)}</h2>
        <div class="lib-grid">${items.map(libraryCard).join("")}</div>
      </section>`
    : "");
  return `
    <header class="lib-head">
      <div class="lib-heading">
        <h1>${esc(t("title"))}</h1>
        <p class="lib-note">${esc(t("libraryNote"))}</p>
      </div>
      <button class="lib-new" type="button" data-action="new" aria-label="${esc(t("newPlaylistLabel"))}" title="${esc(t("newPlaylistLabel"))}">＋</button>
    </header>
    ${albums.length
      ? `${section(t("recentTitle"), recent)}${section(t("allTitle"), rest)}`
      : `<p class="lib-empty">${esc(t("emptyShelf"))}</p>`}
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
  `;
}

function libraryCard(task) {
  const tracks = task.albumTracks ?? [];
  const ready = tracks.filter((track) => track.audioFile).length;
  const tone = task.status === "review" ? "is-review"
    : task.status === "failed" ? "is-failed"
      : task.status === "completed" ? "is-done" : "is-busy";
  const count = ready || tracks.length;
  return `
    <button class="lib-card" type="button" data-open="${esc(task.id)}">
      <span class="lib-cover-wrap">
        ${coverMarkup(task)}
        <span class="lib-state ${tone}" role="img" aria-label="${esc(statusLabel(task))}" title="${esc(statusLabel(task))}"></span>
      </span>
      <span class="lib-card-body">
        <strong>${esc(albumTitle(task))}</strong>
        ${count ? `<span class="lib-count num">${esc(t("albumMeta", count, durationText(taskDuration(task))))}</span>` : ""}
      </span>
    </button>`;
}

function viewAlbum() {
  const task = currentTask();
  if (!task) return `<p class="lib-empty">…</p>`;
  const tracks = task.albumTracks ?? [];
  return `
    <button class="pl-back" type="button" data-action="library">${esc(t("back"))}</button>
    <header class="album-head">
      <div class="album-cover-edit">
        ${coverMarkup(task, "pl-cover-xl")}
        <button class="cover-edit" type="button" data-action="edit-cover">${esc(t("editCover"))}</button>
        ${task.coverUpdatedAt ? `<button class="cover-edit is-remove" type="button" data-action="remove-cover">${esc(t("removeCover"))}</button>` : ""}
        <input class="cover-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
      </div>
      <div class="album-head-body">
        <h1>${esc(albumTitle(task))}</h1>
        <p>${esc(task.albumPlan?.albumMind || task.description)}</p>
        <div class="album-meta">
          ${albumPlanBadge(task, language)}
          <span class="lib-count num">${esc(t("albumMeta", tracks.length, durationText(taskDuration(task))))}</span>
        </div>
      </div>
    </header>
    <div id="album-stage">${stage.render()}</div>
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
  `;
}

function viewDrawer() {
  const references = state.references;
  return `
    <div class="drawer-scrim" data-action="close-drawer"></div>
    <aside class="pl-drawer" role="dialog" aria-modal="true" aria-label="${esc(t("createTitle"))}">
      <header class="drawer-head">
        <div>
          <h2>${esc(t("createTitle"))}</h2>
          <p>${esc(t("createIntro"))}</p>
        </div>
        <button class="drawer-close" type="button" data-action="close-drawer" aria-label="${esc(t("closeDrawer"))}">✕</button>
      </header>
      <div class="drawer-body">
        <section class="drawer-section">
          <h3>${esc(t("refsTitle"))}<span class="drawer-count">${esc(t("selectedCount", state.selected.size))}</span></h3>
          <p class="drawer-note">${esc(t("refsIntro"))}</p>
          ${references.length ? `<div class="pl-refs">${references.map(referenceCard).join("")}</div>`
            : `<p class="pl-note">${esc(t("refsEmpty"))}</p>`}
        </section>
        <section class="drawer-section">
          <label class="drawer-field" for="pl-description">
            <span>${esc(t("describeLabel"))}</span>
            <textarea id="pl-description" maxlength="4000" placeholder="${esc(t("describePlaceholder"))}">${esc(state.description)}</textarea>
          </label>
        </section>
        <section class="drawer-section drawer-fields">
          <label class="drawer-field"><span>${esc(t("countLabel"))}</span>
            <select id="pl-count">${[12, 13, 14, 15, 24, 25, 26, 27, 28].map((value) =>
              `<option value="${value}"${value === state.count ? " selected" : ""}>${value}</option>`).join("")}</select>
          </label>
          <label class="drawer-field"><span>${esc(t("minutesLabel"))}</span>
            <select id="pl-minutes">${[30, 35, 40, 65].map((value) =>
              `<option value="${value}"${value === state.minutes ? " selected" : ""}>${value} min</option>`).join("")}</select>
          </label>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="refresh">${esc(t("refresh"))}</button>
        </section>
      </div>
      <footer class="drawer-foot">
        <span class="drawer-count">${esc(t("selectedCount", state.selected.size))}</span>
        <button class="pl-btn pl-btn-primary" type="button" data-action="create" ${state.busy ? "disabled" : ""}>
          ${esc(state.busy ? t("creating") : t("start"))}
        </button>
      </footer>
    </aside>
  `;
}

function referenceCard(reference) {
  const on = state.selected.has(reference.chatId);
  const spec = reference.musicSpec;
  const tags = [...new Set([...(spec?.genres ?? []), ...(spec?.moods ?? [])])].slice(0, 4);
  return `
    <div class="pl-ref${on ? " is-on" : ""}" role="button" tabindex="0"
      data-ref="${esc(reference.chatId)}" aria-pressed="${on ? "true" : "false"}">
      <span class="pl-ref-top">
        <strong>${esc(reference.title)}</strong>
        <span class="pl-ref-check" aria-hidden="true">✓</span>
      </span>
      <p>${esc((reference.prompt || "").slice(0, 140))}</p>
      ${tags.length ? `<span class="pl-tags">${tags.map((tag) => `<span class="pl-tag">${esc(tag)}</span>`).join("")}</span>` : ""}
      ${reference.audioUrl ? `<button class="pl-btn pl-btn-quiet" type="button" data-listen="${esc(reference.audioUrl)}" data-listen-id="ref:${esc(reference.chatId)}">${esc(t("listen"))}</button>` : ""}
    </div>`;
}

function render() {
  applyI18n();
  root.innerHTML = state.view === "album" ? viewAlbum() : viewLibrary();
  drawerRoot.innerHTML = state.drawer ? viewDrawer() : "";
  document.body.classList.toggle("has-drawer", state.drawer);
  bindActions(root);
  bindActions(drawerRoot);
  bindDrawerFields();
  if (state.view === "album") stage.bind(root);
}

// ---- player bar ----------------------------------------------------------

let lastPersistedAt = 0;
let lastPersistedPlaying = null;

/**
 * Keeps the cross-page record current, so a link click on another page resumes
 * this track instead of silencing it. Throttled: timeupdate fires four times a
 * second and sessionStorage writes are synchronous.
 */
function persistPlayback(snapshot, force = false) {
  if (!snapshot?.trackId || !snapshot.taskId) {
    clearPlayback();
    lastPersistedPlaying = null;
    return;
  }
  const stamp = Date.now();
  if (!force && snapshot.playing === lastPersistedPlaying && stamp - lastPersistedAt < 800) return;
  lastPersistedAt = stamp;
  lastPersistedPlaying = snapshot.playing;
  writePlayback({
    taskId: snapshot.taskId,
    trackId: snapshot.trackId,
    trackTitle: snapshot.trackTitle,
    albumTitle: snapshot.taskTitle,
    position: snapshot.currentTime,
    duration: snapshot.duration,
    playing: snapshot.playing,
    // The cover travels too, so another page paints the same album art.
    ...(() => {
      const task = currentTask();
      if (!task) return {};
      if (task.coverUpdatedAt) {
        const version = encodeURIComponent(task.coverUpdatedAt);
        return { coverImageUrl: `/api/tasks/${encodeURIComponent(task.id)}/cover?v=${version}` };
      }
      const cover = coverFor(task);
      return { coverStyle: cover.style, coverGlyph: cover.glyph };
    })(),
    // The queue travels with the record so another page can show and drive it.
    queue: stage.queueTracks().map((track) => ({
      id: track.id,
      title: track.title,
      durationSeconds: track.durationSeconds,
    })),
  });
}

/** Restores the track another page was playing, paused at its position. */
function restorePlayback() {
  const saved = readPlayback();
  if (!saved) return;
  if (!state.tasks.some((item) => item.id === saved.taskId)) return;
  state.currentId = saved.taskId;
  // Restored paused: the user decides when audio continues. The stage notifies
  // the bar itself once the track is loaded.
  stage.controls.resume(saved.trackId, saved.position, false);
}

const COVER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Scales the picked image to a square cover and keeps its own format. */
async function coverBlob(file) {
  const type = COVER_TYPES.has(file.type) ? file.type : "image/png";
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => (
    type === "image/png" ? canvas.toBlob(resolve, type) : canvas.toBlob(resolve, type, 0.9)
  ));
  if (!blob) throw new Error("The image could not be converted.");
  return blob;
}

/** Pushes the current playback snapshot again, e.g. after the cover changed. */
function refreshPlayer() {
  const snapshot = stage.snapshot();
  for (const listener of playerListeners) listener(snapshot);
}

async function uploadCover(file) {
  const id = state.currentId;
  if (!id) return;
  try {
    const blob = await coverBlob(file);
    const updated = await api(`/api/tasks/${encodeURIComponent(id)}/cover`, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/png" },
      body: blob,
    });
    replaceTask(updated);
    state.message = "";
  } catch (error) {
    const reason = error instanceof Error && error.message ? ` (${error.message})` : "";
    state.message = `${t("coverError")}${reason}`;
  }
  refreshPlayer();
  render();
}

async function removeCover() {
  const id = state.currentId;
  if (!id) return;
  try {
    replaceTask(await api(`/api/tasks/${encodeURIComponent(id)}/cover`, { method: "DELETE" }));
    state.message = "";
  } catch {
    state.message = t("coverError");
  }
  refreshPlayer();
  render();
}

// ---- binding -------------------------------------------------------------

function bindActions(container) {
  if (!container) return;
  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "new") {
        state.drawer = true;
        state.message = "";
        loadReferences();
        render();
        drawerRoot.querySelector("#pl-description")?.focus();
      } else if (action === "close-drawer") {
        state.drawer = false;
        render();
      } else if (action === "library") {
        state.view = "library";
        state.message = "";
        render();
        loadTasks();
      } else if (action === "refresh") {
        loadReferences(true);
      } else if (action === "create") {
        createPlaylist();
      } else if (action === "play-all") {
        // Play the curated set when there is one, otherwise the candidates.
        const tracks = currentTask()?.albumTracks ?? [];
        const included = tracks.filter((track) => track.audioFile && track.admission === "included").length;
        stage.controls.playScope(included ? "included" : "candidate");
      } else if (action === "edit-cover") {
        container.querySelector(".cover-file")?.click();
      } else if (action === "remove-cover") {
        removeCover();
      }
    });
  });

  const coverInput = container.querySelector(".cover-file");
  if (coverInput) {
    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      coverInput.value = "";
      if (file) uploadCover(file);
    });
  }

  container.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const opening = button.dataset.open;
      // Reopening the album that is already playing must not cut the audio.
      if (opening !== state.player?.taskId) stage.reset();
      state.currentId = opening;
      state.view = "album";
      state.message = "";
      render();
      const status = currentTask()?.status;
      if (status === "review") loadTask(opening);
      else if (!["completed", "failed"].includes(status)) pollTask();
    });
  });
}

function bindDrawerFields() {
  const description = drawerRoot.querySelector("#pl-description");
  if (description) description.addEventListener("input", () => { state.description = description.value; });
  const count = drawerRoot.querySelector("#pl-count");
  if (count) count.addEventListener("change", () => { state.count = Number(count.value); });
  const minutes = drawerRoot.querySelector("#pl-minutes");
  if (minutes) minutes.addEventListener("change", () => { state.minutes = Number(minutes.value); });

  drawerRoot.querySelectorAll("[data-ref]").forEach((card) => {
    const toggle = () => {
      const id = card.dataset.ref;
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      render();
    };
    card.addEventListener("click", (event) => { if (!event.target.closest("[data-listen]")) toggle(); });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
    });
  });

  drawerRoot.querySelectorAll("[data-listen]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePreview(button.dataset.listen, button.dataset.listenId);
    });
  });
}

// ---- reference preview ---------------------------------------------------

function togglePreview(url, id) {
  if (!preview) {
    preview = adoptAudio(new Audio());
    preview.preload = "metadata";
    preview.addEventListener("error", () => {
      state.previewId = null;
      state.message = t("playbackError");
      render();
    });
    preview.addEventListener("ended", () => { state.previewId = null; render(); });
  }
  if (state.previewId === id && !preview.paused) {
    preview.pause();
    state.previewId = null;
    return;
  }
  preview.src = url;
  preview.currentTime = 0;
  state.previewId = id;
  playExclusive(preview).catch(() => { state.previewId = null; });
}

// ---- data ----------------------------------------------------------------

async function loadTasks() {
  try {
    const tasks = await api("/api/tasks");
    state.tasks = Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  }
  if (state.view === "library") render();
}

async function loadTask(id) {
  try {
    replaceTask(await api(`/api/tasks/${encodeURIComponent(id)}`));
    if (state.view === "album" && state.currentId === id) render();
  } catch { /* keep the last known state */ }
}

async function loadReferences(force = false) {
  if (state.referencesLoaded && !force) return;
  try {
    const data = await api("/api/playlists/references");
    state.references = Array.isArray(data.references) ? data.references : [];
    state.referencesLoaded = true;
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  }
  if (state.drawer) render();
}

async function createPlaylist() {
  if (state.busy) return;
  const description = state.description.trim();
  if (!description) { state.message = t("needDescription"); render(); return; }
  state.busy = true;
  state.message = "";
  render();
  try {
    const task = await api("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        candidateCount: state.count,
        targetTotalMinutes: state.minutes,
        referenceChatIds: [...state.selected],
      }),
    });
    state.busy = false;
    state.tasks = [task, ...state.tasks];
    state.currentId = task.id;
    state.view = "album";
    state.drawer = false;
    stage.reset();
    render();
    pollTask();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

function pollTask() {
  clearTimeout(state.pollTimer);
  const id = state.currentId;
  if (!id) return;
  const tick = async () => {
    try {
      const task = await api(`/api/tasks/${encodeURIComponent(id)}`);
      replaceTask(task);
      if (state.view === "album" && state.currentId === id) render();
      if (["completed", "failed", "review"].includes(task.status)) return;
    } catch { /* transient; keep polling */ }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

// ---- boot ----------------------------------------------------------------

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.drawer) {
    state.drawer = false;
    render();
  }
});

langToggle.addEventListener("click", () => {
  language = language === "zh-CN" ? "en" : "zh-CN";
  fetch("/api/settings", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language }),
  }).catch(() => {});
  render();
});

async function boot() {
  try {
    const settings = await api("/api/settings");
    if (settings.language === "en" || settings.language === "zh-CN") language = settings.language;
  } catch { /* default language */ }
  await loadTasks();
  render();
  restorePlayback();
}

// A navigation must not lose the last seconds of position.
window.addEventListener("pagehide", () => {
  if (state.player) persistPlayback(state.player, true);
});

boot();
