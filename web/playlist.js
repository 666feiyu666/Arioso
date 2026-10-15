// Playlist (test): plan and generate a whole album from MoodMic creations.
//
// The request model is the album workflow's — candidates, include/exclude and
// an MP3 export — but the planning input is a set of MoodMic conversations the
// user picked, each contributing its intent and the MusicSpec of its music.

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
    pause: "暂停",
    include: "收录",
    exclude: "排除",
    retry: "重新生成",
    exportIncluded: "导出已收录 MP3",
    exportCandidates: "导出候选合集",
    timestamps: "下载时间戳",
    exporting: "正在合并…",
    exportUnavailable: "有曲目尚未完成，暂时无法导出。",
    planning: "正在规划整个歌单。",
    progress: (done, total) => `已完成 ${done}/${total} 首`,
    failedTitle: "这次没有完成",
    retryTask: "重试",
    unadmitted: "候选",
    included: "已收录",
    excluded: "已排除",
    status: {
      queued: "排队中", composing: "正在规划曲目", generating: "正在生成音频",
      review: "待确认", assembling: "正在拼接", processing: "正在处理",
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
    pause: "Pause",
    include: "Include",
    exclude: "Exclude",
    retry: "Regenerate",
    exportIncluded: "Export included MP3",
    exportCandidates: "Export candidate mix",
    timestamps: "Download timestamps",
    exporting: "Merging…",
    exportUnavailable: "Export is available once every track has finished generating.",
    planning: "Planning the whole album.",
    progress: (done, total) => `${done}/${total} ready`,
    failedTitle: "This run didn't finish",
    retryTask: "Retry",
    unadmitted: "Candidate",
    included: "Included",
    excluded: "Excluded",
    status: {
      queued: "Queued", composing: "Planning the tracks", generating: "Generating audio",
      review: "Awaiting confirmation", assembling: "Assembling", processing: "Processing",
      completed: "Completed", failed: "Not finished",
    },
  },
};

const root = document.querySelector("#pl-main");
const langToggle = document.querySelector("#lang-toggle");

let language = "zh-CN";
let audio = null;
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
  playingTrackId: null,
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

function durationText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function taskDuration(task) {
  return (task.albumTracks ?? []).reduce((total, track) => total + (track.audioFile ? track.durationSeconds || 0 : 0), 0);
}

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
      return `<button class="pl-card" type="button" data-open="${esc(task.id)}">
        <strong>${esc(task.albumPlan?.albumTitle || task.title || task.description)}</strong>
        <span class="pl-card-meta">${esc(t("tracksWord", ready || (task.albumTracks ?? []).length))} · ${esc(t("includedWord", included))}</span>
        <span class="pl-card-meta">${esc(durationText(taskDuration(task)))}</span>
        <span class="pl-card-state">${esc(statusLabel(task))}</span>
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
  const task = state.tasks.find((item) => item.id === state.currentId);
  if (!task) return `<p class="pl-empty">…</p>`;
  const tracks = [...(task.albumTracks ?? [])].sort((first, second) => first.order - second.order);
  const done = tracks.filter((track) => track.audioFile).length;
  const rate = tracks.length ? Math.round((done / tracks.length) * 100) : 0;
  const plan = task.albumPlan;
  const running = !["completed", "failed"].includes(task.status);
  return `
    <button class="pl-back" type="button" data-action="shelf">${esc(t("back"))}</button>
    <header class="pl-detail-head">
      <div>
        <h1>${esc(plan?.albumTitle || task.title || task.description)}</h1>
        <p>${esc(plan?.albumMind || task.description)}</p>
      </div>
    </header>

    ${task.status === "failed"
      ? `<div class="pl-note"><strong>${esc(t("failedTitle"))}</strong><p>${esc(task.error || "")}</p>
          <button class="pl-btn" type="button" data-action="retry-task">${esc(t("retryTask"))}</button></div>`
      : running
        ? `<div class="pl-progress"><span>${esc(task.status === "composing" ? t("planning") : statusLabel(task))}</span>
            <span class="pl-bar"><i style="width:${rate}%"></i></span><span>${esc(t("progress", done, tracks.length))}</span></div>`
        : ""}

    ${tracks.length ? `<div class="pl-toolbar">
        <button class="pl-btn" type="button" data-action="export" data-scope="included" ${done ? "" : "disabled"}>${esc(t("exportIncluded"))}</button>
        <button class="pl-btn" type="button" data-action="export" data-scope="candidate" ${done ? "" : "disabled"}>${esc(t("exportCandidates"))}</button>
        <button class="pl-btn pl-btn-quiet" type="button" data-action="timestamps" ${done ? "" : "disabled"}>${esc(t("timestamps"))}</button>
      </div>` : ""}

    ${tracks.length
      ? `<div class="pl-tracks">${tracks.map((track, index) => trackRow(task, track, index + 1)).join("")}</div>`
      : `<p class="pl-empty">${esc(t("planning"))}</p>`}
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
  `;
}

function trackRow(task, track, number) {
  const playing = state.playingTrackId === track.id;
  const stateWord = track.admission === "included" ? t("included")
    : track.admission === "excluded" ? t("excluded") : t("unadmitted");
  return `
    <div class="pl-track is-${esc(track.admission)}">
      <span class="pl-track-number">${String(number).padStart(2, "0")}</span>
      <button class="pl-play${playing ? " is-playing" : ""}" type="button"
        data-play="${esc(track.id)}" ${track.audioFile ? "" : "disabled"}
        aria-label="${esc(playing ? t("pause") : t("listen"))}">${playing ? "❚❚" : "▶"}</button>
      <div class="pl-track-body">
        <strong>${esc(track.title)}</strong>
        <span>${esc(statusLabel(track))} · ${esc(track.audioFile ? durationText(track.durationSeconds) : t("unadmitted"))} · ${esc(stateWord)}</span>
      </div>
      <div class="pl-track-actions">
        ${track.status === "failed"
          ? `<button class="pl-btn pl-btn-quiet" type="button" data-retry="${esc(track.id)}">${esc(t("retry"))}</button>`
          : `<button class="pl-btn pl-btn-quiet${track.admission === "included" ? " is-on" : ""}" type="button"
               data-admit="${esc(track.id)}" data-admission="included">${esc(t("include"))}</button>
             <button class="pl-btn pl-btn-quiet${track.admission === "excluded" ? " is-on" : ""}" type="button"
               data-admit="${esc(track.id)}" data-admission="excluded">${esc(t("exclude"))}</button>`}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------

function bind() {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "new") { state.view = "create"; state.message = ""; loadReferences(); render(); }
      else if (action === "shelf") { state.view = "shelf"; state.message = ""; render(); loadTasks(); }
      else if (action === "refresh") loadReferences(true);
      else if (action === "create") createPlaylist();
      else if (action === "export") exportAlbum(button.dataset.scope, button);
      else if (action === "timestamps") exportTimestamps(button);
      else if (action === "retry-task") retryTask(button);
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

  root.querySelectorAll("[data-play]").forEach((button) => {
    button.addEventListener("click", () => playTrack(button.dataset.play));
  });
  root.querySelectorAll("[data-listen]").forEach((button) => {
    button.addEventListener("click", (event) => { event.stopPropagation(); togglePreview(button.dataset.listen, button.dataset.listenId); });
  });
  root.querySelectorAll("[data-admit]").forEach((button) => {
    button.addEventListener("click", () => setAdmission(button.dataset.admit, button.dataset.admission, button));
  });
  root.querySelectorAll("[data-retry]").forEach((button) => {
    button.addEventListener("click", () => retryTrack(button.dataset.retry, button));
  });
}

// ---- playback ----

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.addEventListener("ended", () => setPlaying(null));
  audio.addEventListener("error", () => setPlaying(null));
  return audio;
}

function setPlaying(trackId) {
  state.playingTrackId = trackId;
  if (state.view === "detail") render();
}

function playTrack(trackId) {
  const task = state.tasks.find((item) => item.id === state.currentId);
  const track = task?.albumTracks?.find((item) => item.id === trackId);
  if (!track?.audioFile) return;
  const player = ensureAudio();
  if (state.playingTrackId === trackId) { player.pause(); setPlaying(null); return; }
  player.src = `/api/tasks/${encodeURIComponent(task.id)}/album/tracks/${encodeURIComponent(trackId)}/audio`;
  player.currentTime = 0;
  state.playingTrackId = trackId;
  render();
  player.play().catch(() => setPlaying(null));
}

function togglePreview(url, id) {
  const player = ensureAudio();
  if (state.playingTrackId === id) { player.pause(); state.playingTrackId = null; return; }
  player.src = url;
  player.currentTime = 0;
  state.playingTrackId = id;
  player.play().catch(() => { state.playingTrackId = null; });
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
      const index = state.tasks.findIndex((item) => item.id === id);
      if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
      if (state.view === "detail" && state.currentId === id) render();
      if (task.status === "completed" || task.status === "failed") return;
    } catch { /* transient; keep polling */ }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

async function albumUpdate(taskId, route, method, payload) {
  const updated = await api(`/api/tasks/${encodeURIComponent(taskId)}/album/${route}`, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const index = state.tasks.findIndex((item) => item.id === updated.id);
  if (index >= 0) state.tasks[index] = updated;
  render();
  return updated;
}

async function setAdmission(trackId, admission, button) {
  button.disabled = true;
  try {
    await albumUpdate(state.currentId, `tracks/${encodeURIComponent(trackId)}`, "PATCH", { admission });
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function retryTrack(trackId, button) {
  button.disabled = true;
  try {
    await albumUpdate(state.currentId, `tracks/${encodeURIComponent(trackId)}/retry`, "POST", {});
    pollTask();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function retryTask(button) {
  button.disabled = true;
  try {
    const task = await api(`/api/tasks/${encodeURIComponent(state.currentId)}/retry`, { method: "POST" });
    const index = state.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    render();
    pollTask();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

function downloadFile(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function exportAlbum(scope, button) {
  const task = state.tasks.find((item) => item.id === state.currentId);
  if (!task) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = t("exporting");
  try {
    const manifest = await api(`/api/tasks/${encodeURIComponent(task.id)}/album/export`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, format: "manifest" }),
    });
    downloadFile(manifest.audioUrl, manifest.fileName);
  } catch (error) {
    state.message = error instanceof Error ? error.message : t("exportUnavailable");
    render();
  } finally {
    if (button.isConnected) { button.disabled = false; button.textContent = original; }
  }
}

async function exportTimestamps(button) {
  const task = state.tasks.find((item) => item.id === state.currentId);
  if (!task) return;
  button.disabled = true;
  try {
    const manifest = await api(`/api/tasks/${encodeURIComponent(task.id)}/album/export`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "included", format: "manifest" }),
    });
    downloadFile(manifest.timestampsUrl, (manifest.fileName || "playlist").replace(/\.mp3$/i, " - Timestamps.txt"));
  } catch (error) {
    state.message = error instanceof Error ? error.message : t("exportUnavailable");
    render();
  } finally {
    if (button.isConnected) button.disabled = false;
  }
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
