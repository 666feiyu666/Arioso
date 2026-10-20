// Playlist (test): plan and generate a whole album from MoodMic creations.
//
// The request model is the album workflow's — candidates, include/exclude and
// an MP3 export — but the planning input is a set of MoodMic conversations the
// user picked, each contributing its intent and the MusicSpec of its music.
//
// Planning pauses for confirmation: the album author shows how it read the
// references and the theme, the user can keep talking to revise the plan, and
// only an explicit confirmation starts audio generation. The album stage
// itself (plan, progress, player, curation) lives in album-view.js so the
// MoodMic journey can show exactly the same thing.

import { createAlbumStage, albumPlanBadge, durationText } from "./album-view.js";

const COPY = {
  "zh-CN": {
    tabMoodMic: "MoodMic", tabCalendar: "心情日历", tabWorkflow: "工作流",
    tabPlaylist: "播放列表（测试）", tabHelp: "帮助", tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    eyebrow: "PLAYLIST · TEST",
    title: "播放列表（测试）",
    intro: "把 MoodMic 里满意的对话与音乐当作参考，规划并生成一整个歌单。",
    newPlaylist: "＋ 新建歌单",
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
    selectedCount: (n) => `已选 ${n} 段参考`,
    needDescription: "先写一句歌单主题。",
    tracksWord: (n) => `${n} 首候选`,
    includedWord: (n) => `已收录 ${n} 首`,
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
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar", tabWorkflow: "Workflow",
    tabPlaylist: "Playlist (test)", tabHelp: "Help", tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    eyebrow: "PLAYLIST · TEST",
    title: "Playlist (test)",
    intro: "Use the MoodMic conversations and music you liked as references, then plan and generate a whole album.",
    newPlaylist: "＋ New playlist",
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
    selectedCount: (n) => `${n} reference${n === 1 ? "" : "s"} selected`,
    needDescription: "Write a theme for the playlist first.",
    tracksWord: (n) => `${n} candidates`,
    includedWord: (n) => `${n} included`,
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

const root = document.querySelector("#pl-main");
const langToggle = document.querySelector("#lang-toggle");

let language = "zh-CN";
let preview = null;
const state = {
  view: "shelf",
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

function currentTask() {
  return state.tasks.find((item) => item.id === state.currentId);
}

function replaceTask(task) {
  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
}

// The album stage reads and writes the album through these callbacks, so the
// page keeps owning its task list while the stage owns plan/curation behaviour.
const stage = createAlbumStage({
  language: () => language,
  api,
  getTask: currentTask,
  setTask: (task) => replaceTask(task),
  rerender: () => {
    if (state.view === "detail") render();
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

// ---------------------------------------------------------------------------

function render() {
  applyI18n();
  if (state.view === "create") root.innerHTML = viewCreate();
  else if (state.view === "detail") root.innerHTML = viewDetail();
  else root.innerHTML = viewShelf();
  bind();
}

function viewShelf() {
  const albums = state.tasks.filter((task) => task.workflowType === "05-playlist");
  return `
    <header class="pl-head">
      <div>
        <p class="pl-eyebrow">${esc(t("eyebrow"))}</p>
        <h1>${esc(t("title"))}</h1>
        <p>${esc(t("intro"))}</p>
      </div>
      <button class="pl-btn pl-btn-primary" type="button" data-action="new">${esc(t("newPlaylist"))}</button>
    </header>
    ${albums.length ? `<div class="pl-grid">${albums.map((task) => {
      const ready = (task.albumTracks ?? []).filter((track) => track.audioFile).length;
      const included = (task.albumTracks ?? []).filter((track) => track.admission === "included").length;
      const reviewing = task.status === "review";
      return `<button class="pl-card${reviewing ? " is-review" : ""}" type="button" data-open="${esc(task.id)}">
        <strong>${esc(task.albumPlan?.albumTitle || task.title || task.description)}</strong>
        <span class="pl-card-meta">${esc(t("tracksWord", ready || (task.albumTracks ?? []).length))} · ${esc(t("includedWord", included))}</span>
        <span class="pl-card-meta">${esc(durationText(taskDuration(task)))}</span>
        <span class="pl-card-state${reviewing ? " is-review" : ""}">${reviewing ? `<span class="pl-state-dot" aria-hidden="true"></span>` : ""}${esc(statusLabel(task))}${reviewing ? `<span class="pl-card-cta">${esc(t("shelfReviewHint"))}</span>` : ""}</span>
      </button>`;
    }).join("")}</div>` : `<p class="pl-empty">${esc(t("emptyShelf"))}</p>`}
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
  `;
}

function viewCreate() {
  const references = state.references;
  return `
    <button class="pl-back" type="button" data-action="shelf">${esc(t("back"))}</button>
    <header class="pl-head">
      <div>
        <h1>${esc(t("createTitle"))}</h1>
        <p>${esc(t("createIntro"))}</p>
      </div>
    </header>
    <div class="pl-form">
      <section class="pl-section">
        <h2>${esc(t("refsTitle"))}</h2>
        <p>${esc(t("refsIntro"))} ${esc(t("selectedCount", state.selected.size))}</p>
        ${references.length ? `<div class="pl-refs">${references.map((reference) => {
          const on = state.selected.has(reference.chatId);
          const spec = reference.musicSpec;
          const tags = [...new Set([...(spec?.genres ?? []), ...(spec?.moods ?? [])])].slice(0, 4);
          return `<div class="pl-ref${on ? " is-on" : ""}" role="button" tabindex="0"
            data-ref="${esc(reference.chatId)}" aria-pressed="${on ? "true" : "false"}">
            <span class="pl-ref-top">
              <strong>${esc(reference.title)}</strong>
              <span class="pl-ref-check" aria-hidden="true">✓</span>
            </span>
            <p>${esc((reference.prompt || "").slice(0, 140))}</p>
            ${tags.length ? `<span class="pl-tags">${tags.map((tag) => `<span class="pl-tag">${esc(tag)}</span>`).join("")}</span>` : ""}
            ${reference.audioUrl ? `<button class="pl-btn pl-btn-quiet" type="button" data-listen="${esc(reference.audioUrl)}" data-listen-id="ref:${esc(reference.chatId)}">${esc(t("listen"))}</button>` : ""}
          </div>`;
        }).join("")}</div>` : `<p class="pl-note">${esc(t("refsEmpty"))}</p>`}
      </section>

      <section class="pl-section">
        <div class="pl-field">
          <span>${esc(t("describeLabel"))}</span>
          <textarea id="pl-description" maxlength="4000" placeholder="${esc(t("describePlaceholder"))}">${esc(state.description)}</textarea>
        </div>
      </section>

      <section class="pl-section pl-fields">
        <label class="pl-field"><span>${esc(t("countLabel"))}</span>
          <select id="pl-count">${[12, 13, 14, 15, 24, 25, 26, 27, 28].map((value) =>
            `<option value="${value}"${value === state.count ? " selected" : ""}>${value}</option>`).join("")}</select>
        </label>
        <label class="pl-field"><span>${esc(t("minutesLabel"))}</span>
          <select id="pl-minutes">${[30, 35, 40, 65].map((value) =>
            `<option value="${value}"${value === state.minutes ? " selected" : ""}>${value} min</option>`).join("")}</select>
        </label>
        <button class="pl-btn pl-btn-quiet pl-refresh" type="button" data-action="refresh">${esc(t("refresh"))}</button>
      </section>

      <div>
        <button class="pl-btn pl-btn-primary" type="button" data-action="create" ${state.busy ? "disabled" : ""}>
          ${esc(state.busy ? t("creating") : t("start"))}
        </button>
      </div>
      ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
    </div>
  `;
}

function viewDetail() {
  const task = currentTask();
  if (!task) return `<p class="pl-empty">…</p>`;
  const plan = task.albumPlan;
  return `
    <button class="pl-back" type="button" data-action="shelf">${esc(t("back"))}</button>
    <header class="pl-detail-head">
      <div>
        <h1>${esc(plan?.albumTitle || task.title || task.description)}</h1>
        <p>${esc(plan?.albumMind || task.description)}</p>
      </div>
      ${plan ? albumPlanBadge(task, language) : ""}
    </header>
    ${stage.render()}
  `;
}

// ---------------------------------------------------------------------------

function bind() {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "new") { state.view = "create"; state.message = ""; loadReferences(); render(); }
      else if (action === "shelf") { stage.stop(); state.view = "shelf"; state.message = ""; render(); loadTasks(); }
      else if (action === "refresh") loadReferences(true);
      else if (action === "create") createPlaylist();
    });
  });

  root.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentId = button.dataset.open;
      state.view = "detail";
      state.message = "";
      stage.reset();
      render();
      const status = currentTask()?.status;
      if (status === "review") loadTask(button.dataset.open);
      else if (!["completed", "failed"].includes(status)) pollTask();
    });
  });

  const description = root.querySelector("#pl-description");
  if (description) description.addEventListener("input", () => { state.description = description.value; });
  const count = root.querySelector("#pl-count");
  if (count) count.addEventListener("change", () => { state.count = Number(count.value); });
  const minutes = root.querySelector("#pl-minutes");
  if (minutes) minutes.addEventListener("change", () => { state.minutes = Number(minutes.value); });

  root.querySelectorAll("[data-ref]").forEach((card) => {
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

  root.querySelectorAll("[data-listen]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePreview(button.dataset.listen, button.dataset.listenId);
    });
  });

  if (state.view === "detail") stage.bind(root);
}

// ---- reference preview ----

function togglePreview(url, id) {
  if (!preview) {
    preview = new Audio();
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
  preview.play().catch(() => { state.previewId = null; });
}

// ---- data ----

async function loadTasks() {
  try {
    const tasks = await api("/api/tasks");
    state.tasks = Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  }
  if (state.view === "shelf") render();
}

async function loadTask(id) {
  try {
    replaceTask(await api(`/api/tasks/${encodeURIComponent(id)}`));
    if (state.view === "detail" && state.currentId === id) render();
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
  if (state.view === "create") render();
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
    state.view = "detail";
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
      if (state.view === "detail" && state.currentId === id) render();
      if (["completed", "failed", "review"].includes(task.status)) return;
    } catch { /* transient; keep polling */ }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

// ---- boot ----

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
}

boot();
