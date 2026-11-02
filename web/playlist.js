// Playlist: assembled by the listener, never generated.
//
// A playlist sequences pieces that already exist — MoodMic creations and album
// candidates. Selecting, ordering, naming, playing, and exporting touch no task
// and spend nothing. Two entries can lead here: importing existing pieces, or
// starting an album, whose finished tracks then join this playlist as they land.
//
// The album itself keeps its own page; this page never shows a plan, a
// candidate, or a generation control.

const COPY = {
  "zh-CN": {
    tabMoodMic: "MoodMic", tabAlbums: "专辑", tabCalendar: "心情日历（测试）", tabWorkflow: "工作流",
    tabPlaylist: "歌单", tabHelp: "帮助", tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    title: "歌单", libraryNote: "把已有的曲子排成一张歌单，或者从一张新专辑开始。",
    newPlaylist: "＋ 新建歌单", newPlaylistLabel: "新建歌单",
    emptyShelf: "还没有歌单。把喜欢的曲子收进来，或者开一张新专辑。",
    recentTitle: "最近更新", allTitle: "全部歌单",
    back: "← 返回歌单",
    itemsTitle: "曲目", itemsEmpty: "这张歌单还没有曲子。",
    addPieces: "加入曲子", createAlbum: "创建专辑",
    playAll: "播放全部", pause: "暂停", play: "播放", prevTrack: "上一首", nextTrack: "下一首",
    nowPlaying: "正在播放", exportPlaylist: "导出 MP3", exporting: "正在导出…",
    exportReady: "导出已就绪", exportSkipped: (titles) => `已跳过 ${titles} 首无法解析的曲子。`,
    exportError: "这次导出没有完成，请稍后重试。",
    rename: "改名", renameHint: "输入新名字后回车", saveName: "保存",
    editCover: "更换封面", removeCover: "移除封面",
    missing: "无法解析", missingNote: "这首曲子已不在原专辑里，条目保留在歌单中。",
    moveUp: "上移", moveDown: "下移", remove: "移除",
    drawerCreateTitle: "创建专辑",
    drawerCreateIntro: "写一句专辑想要的样子。生成完成后，这张专辑的曲子会自动进入这张歌单。",
    drawerImportTitle: "加入曲子",
    drawerImportIntro: "从已经做好的曲子里挑。这里不会生成任何音频。",
    nameLabel: "歌单名字", namePlaceholder: "例如：深夜专注",
    describeLabel: "专辑主题", describePlaceholder: "例如：适合深夜专注的一组器乐，延续参考里的温暖质感。",
    refsTitle: "参考（可选）", refsIntro: "MoodMic 里满意的对话可以交给专辑作者参考。",
    refsEmpty: "还没有可用的参考。",
    countLabel: "曲目数", minutesLabel: "目标总时长",
    start: "开始规划", creating: "正在创建…",
    add: "加入歌单", adding: "正在加入…",
    close: "关闭", refresh: "刷新",
    piecesEmpty: "还没有可加入的曲子。先在 MoodMic 或专辑里做出音乐。",
    selectedCount: (n) => `已选 ${n} 首`,
    needName: "先给歌单起个名字，或者留空自动命名。",
    needDescription: "先写一句专辑主题。",
    albumStarted: "专辑已经开始，进度可以在「专辑」页查看。",
    itemsCount: (n) => `${n} 首`, missingCount: (n) => `${n} 首无法解析`,
    originMoodMic: "MoodMic", originAlbum: "专辑", originSingle: "单曲",
    error: "这一步没有完成，请再试一次。",
  },
  en: {
    tabMoodMic: "MoodMic", tabAlbums: "Albums", tabCalendar: "Mood calendar (test)", tabWorkflow: "Workflow",
    tabPlaylist: "Playlists", tabHelp: "Help", tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    title: "Playlists", libraryNote: "Order pieces you already have, or start from a new album.",
    newPlaylist: "＋ New playlist", newPlaylistLabel: "New playlist",
    emptyShelf: "No playlists yet. Add pieces you like, or start a new album.",
    recentTitle: "Recently updated", allTitle: "All playlists",
    back: "← Back to playlists",
    itemsTitle: "Pieces", itemsEmpty: "This playlist has no pieces yet.",
    addPieces: "Add pieces", createAlbum: "Create album",
    playAll: "Play all", pause: "Pause", play: "Play", prevTrack: "Previous", nextTrack: "Next",
    nowPlaying: "Now playing", exportPlaylist: "Export MP3", exporting: "Exporting…",
    exportReady: "Export ready", exportSkipped: (titles) => `Skipped ${titles} piece(s) that no longer resolve.`,
    exportError: "The export did not finish. Try again.",
    rename: "Rename", renameHint: "Type a new name and press Enter", saveName: "Save",
    editCover: "Change cover", removeCover: "Remove cover",
    missing: "Missing", missingNote: "The piece is no longer in its album; the entry stays here.",
    moveUp: "Move up", moveDown: "Move down", remove: "Remove",
    drawerCreateTitle: "Create album",
    drawerCreateIntro: "Describe what the album should be. Its tracks join this playlist as they finish.",
    drawerImportTitle: "Add pieces",
    drawerImportIntro: "Pick from music that already exists. Nothing is generated here.",
    nameLabel: "Playlist name", namePlaceholder: "e.g. Late-night focus",
    describeLabel: "Album theme", describePlaceholder: "e.g. Instrumental music for late-night focus, keeping the references' warm tone.",
    refsTitle: "References (optional)", refsIntro: "MoodMic conversations can guide the album author.",
    refsEmpty: "No references available yet.",
    countLabel: "Tracks", minutesLabel: "Target length",
    start: "Start planning", creating: "Creating…",
    add: "Add to playlist", adding: "Adding…",
    close: "Close", refresh: "Refresh",
    piecesEmpty: "Nothing to add yet. Make some music in MoodMic or an album first.",
    selectedCount: (n) => `${n} selected`,
    needName: "Name the playlist, or leave it blank to name it later.",
    needDescription: "Write one line about the album theme.",
    albumStarted: "The album has started. Follow it on the Albums page.",
    itemsCount: (n) => `${n} track(s)`, missingCount: (n) => `${n} missing`,
    originMoodMic: "MoodMic", originAlbum: "Album", originSingle: "Single",
    error: "That step did not finish. Try again.",
  },
};

const root = document.querySelector("#pl-main");
const drawerRoot = document.querySelector("#pl-drawer-root");
const langToggle = document.querySelector("#lang-toggle");

let language = "zh-CN";
const state = {
  view: "library",
  playlists: [],
  currentId: null,
  drawer: null,
  busy: false,
  message: "",
  pieces: [],
  references: [],
  selectedPieces: new Set(),
  selectedReferences: new Set(),
  name: "",
  description: "",
  count: 14,
  minutes: 35,
  playing: null,
  queue: [],
  queueIndex: -1,
};

function t(key, ...args) {
  const value = COPY[language]?.[key] ?? COPY.en[key] ?? key;
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

function current() {
  return state.playlists.find((entry) => entry.playlist.id === state.currentId);
}

function replacePlaylist(resolved) {
  const index = state.playlists.findIndex((entry) => entry.playlist.id === resolved.playlist.id);
  if (index >= 0) state.playlists[index] = resolved; else state.playlists.push(resolved);
}

// ---- covers --------------------------------------------------------------

const COVER_TONES = [
  ["#2f4858", "#86b0bd"], ["#3d2b3d", "#b98ea7"], ["#243b36", "#7fa88b"],
  ["#3a2f1b", "#c2a878"], ["#1f2b45", "#8fa3d0"],
];

function hashString(value) {
  let hash = 0;
  for (const character of String(value)) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return hash;
}

function coverFor(name, id) {
  const key = name || id;
  const [from, to] = COVER_TONES[hashString(key) % COVER_TONES.length];
  return {
    style: `--cover-from:${from};--cover-to:${to};--cover-angle:${105 + (hashString(`${key}:angle`) % 70)}deg`,
    glyph: Array.from(String(key).trim())[0]?.toUpperCase() ?? "A",
  };
}

function coverMarkup(playlist, extraClass = "") {
  const classes = `pl-cover${extraClass ? ` ${extraClass}` : ""}`;
  if (playlist.coverUpdatedAt) {
    const version = encodeURIComponent(playlist.coverUpdatedAt);
    return `<span class="${classes} is-art"><img src="/api/playlists/${encodeURIComponent(playlist.id)}/cover?v=${version}" alt="" loading="lazy" /></span>`;
  }
  const cover = coverFor(playlist.name, playlist.id);
  return `<span class="${classes}" style="${cover.style}" aria-hidden="true"><b>${esc(cover.glyph)}</b></span>`;
}

// ---- views ---------------------------------------------------------------

function durationText(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (!total) return "0:00";
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function viewLibrary() {
  const sorted = [...state.playlists].sort((left, right) =>
    String(right.playlist.updatedAt ?? "").localeCompare(String(left.playlist.updatedAt ?? "")));
  const recent = sorted.slice(0, 4);
  const rest = sorted.slice(4);
  const section = (title, items) => (items.length
    ? `<section class="lib-section"><h2>${esc(title)}</h2><div class="lib-grid">${items.map(libraryCard).join("")}</div></section>`
    : "");
  return `
    <header class="lib-head">
      <div class="lib-heading">
        <h1>${esc(t("title"))}</h1>
        <p class="lib-note">${esc(t("libraryNote"))}</p>
      </div>
      <button class="lib-new" type="button" data-action="new" aria-label="${esc(t("newPlaylistLabel"))}" title="${esc(t("newPlaylistLabel"))}">＋</button>
    </header>
    ${sorted.length
      ? `${section(t("recentTitle"), recent)}${section(t("allTitle"), rest)}`
      : `<p class="lib-empty">${esc(t("emptyShelf"))}</p>`}
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
  `;
}

function libraryCard(entry) {
  const playlist = entry.playlist;
  return `
    <button class="lib-card" type="button" data-open="${esc(playlist.id)}">
      <span class="lib-cover-wrap">${coverMarkup(playlist)}</span>
      <span class="lib-card-body">
        <strong>${esc(playlist.name)}</strong>
        <span class="lib-count num">${esc(t("itemsCount", entry.items.length))} · ${esc(durationText(entry.playableSeconds))}</span>
      </span>
    </button>`;
}

function itemRow(entry, index, total) {
  // A missing entry keeps only what still makes sense: it can be moved or
  // removed, but there is nothing to play.
  const controls = `
        ${entry.missing ? "" : `<button class="pl-btn pl-btn-quiet" type="button" data-play="${esc(entry.id)}">${esc(t("play"))}</button>`}
        <button class="pl-btn pl-btn-quiet" type="button" data-move="${esc(entry.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="${esc(t("moveUp"))}">↑</button>
        <button class="pl-btn pl-btn-quiet" type="button" data-move="${esc(entry.id)}" data-direction="1" ${index === total - 1 ? "disabled" : ""} aria-label="${esc(t("moveDown"))}">↓</button>
        <button class="pl-btn pl-btn-quiet" type="button" data-remove="${esc(entry.id)}">${esc(t("remove"))}</button>`;
  return `
    <li class="plt-item${entry.missing ? " is-missing" : ""}">
      <span class="plt-index num">${index + 1}</span>
      <span class="plt-body">
        <strong>${esc(entry.titleSnapshot)}</strong>
        <span class="plt-meta">
          ${entry.albumTitle ? `<span>${esc(entry.albumTitle)}</span>` : ""}
          ${entry.missing ? `<span class="plt-missing">${esc(t("missing"))}</span>` : `<span class="num">${esc(durationText(entry.durationSeconds))}</span>`}
        </span>
        ${entry.missing ? `<span class="plt-missing-note">${esc(t("missingNote"))}</span>` : ""}
      </span>
      <span class="plt-actions">${controls}</span>
    </li>`;
}

function viewPlaylist(entry) {
  const playlist = entry.playlist;
  return `
    <button class="pl-back" type="button" data-action="library">${esc(t("back"))}</button>
    <header class="album-head">
      <div class="album-cover-edit">
        ${coverMarkup(playlist, "pl-cover-xl")}
        <button class="cover-edit" type="button" data-action="edit-cover">${esc(t("editCover"))}</button>
        ${playlist.coverUpdatedAt ? `<button class="cover-edit is-remove" type="button" data-action="remove-cover">${esc(t("removeCover"))}</button>` : ""}
        <input class="cover-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
      </div>
      <div class="album-head-body">
        <h1>${esc(playlist.name)}</h1>
        <p>${esc(playlist.description || "")}</p>
        <div class="album-meta">
          <span class="lib-count num">${esc(t("itemsCount", entry.items.length))} · ${esc(durationText(entry.playableSeconds))}</span>
          ${entry.missingCount ? `<span class="lib-badge is-failed">${esc(t("missingCount", entry.missingCount))}</span>` : ""}
        </div>
        <div class="plt-actions">
          <button class="pl-btn pl-btn-primary" type="button" data-action="play-all" ${entry.playableCount ? "" : "disabled"}>▶ ${esc(t("playAll"))}</button>
          <button class="pl-btn" type="button" data-action="export" ${entry.playableCount ? "" : "disabled"}>${esc(t("exportPlaylist"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="rename">${esc(t("rename"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="add-pieces">${esc(t("addPieces"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="start-album">${esc(t("createAlbum"))}</button>
        </div>
      </div>
    </header>
    <section class="lib-section">
      <h2>${esc(t("itemsTitle"))}</h2>
      ${entry.items.length
        ? `<ul class="plt-list">${entry.items.map((item, index) => itemRow(item, index, entry.items.length)).join("")}</ul>`
        : `<p class="lib-empty">${esc(t("itemsEmpty"))}</p>`}
    </section>
    ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
    <audio id="plt-audio" preload="metadata"></audio>
  `;
}

function pieceRow(piece) {
  const selected = state.selectedPieces.has(`${piece.source.kind}:${piece.source.taskId}:${piece.source.trackId ?? ""}`);
  const origin = piece.origin === "moodmic" ? t("originMoodMic")
    : piece.origin === "album" ? t("originAlbum") : t("originSingle");
  return `
    <button class="pl-ref${selected ? " is-on" : ""}" type="button" role="checkbox" aria-checked="${selected ? "true" : "false"}"
      data-piece="${esc(piece.source.kind)}" data-piece-task="${esc(piece.source.taskId)}" data-piece-track="${esc(piece.source.trackId ?? "")}">
      <span class="pl-ref-top"><strong>${esc(piece.title)}</strong><span class="pl-ref-check" aria-hidden="true">✓</span></span>
      <p>${esc(origin)}${piece.albumTitle ? ` · ${esc(piece.albumTitle)}` : ""}</p>
    </button>`;
}

function referenceCard(reference) {
  const selected = state.selectedReferences.has(reference.chatId);
  return `
    <button class="pl-ref${selected ? " is-on" : ""}" type="button" role="checkbox" aria-checked="${selected ? "true" : "false"}"
      data-ref="${esc(reference.chatId)}">
      <span class="pl-ref-top"><strong>${esc(reference.title)}</strong><span class="pl-ref-check" aria-hidden="true">✓</span></span>
      <p>${esc((reference.prompt || "").slice(0, 140))}</p>
    </button>`;
}

function viewDrawer() {
  const creating = state.drawer === "create-album";
  return `
    <div class="drawer-scrim" data-action="close-drawer"></div>
    <aside class="pl-drawer" role="dialog" aria-modal="true" aria-label="${esc(creating ? t("drawerCreateTitle") : t("drawerImportTitle"))}">
      <header class="drawer-head">
        <div>
          <h2>${esc(creating ? t("drawerCreateTitle") : t("drawerImportTitle"))}</h2>
          <p>${esc(creating ? t("drawerCreateIntro") : t("drawerImportIntro"))}</p>
        </div>
        <button class="drawer-close" type="button" data-action="close-drawer" aria-label="${esc(t("close"))}">✕</button>
      </header>
      <div class="drawer-body">
        ${creating ? `
        <section class="drawer-section">
          <label class="drawer-field" for="plt-name">
            <span>${esc(t("nameLabel"))}</span>
            <input id="plt-name" type="text" maxlength="120" value="${esc(state.name)}" placeholder="${esc(t("namePlaceholder"))}" />
          </label>
        </section>
        <section class="drawer-section">
          <label class="drawer-field" for="plt-description">
            <span>${esc(t("describeLabel"))}</span>
            <textarea id="plt-description" maxlength="4000" placeholder="${esc(t("describePlaceholder"))}">${esc(state.description)}</textarea>
          </label>
        </section>
        <section class="drawer-section drawer-fields">
          <label class="drawer-field"><span>${esc(t("countLabel"))}</span>
            <select id="plt-count">${[12, 14, 16, 20, 24, 28].map((value) =>
              `<option value="${value}"${value === state.count ? " selected" : ""}>${value}</option>`).join("")}</select>
          </label>
          <label class="drawer-field"><span>${esc(t("minutesLabel"))}</span>
            <select id="plt-minutes">${[30, 35, 40, 65].map((value) =>
              `<option value="${value}"${value === state.minutes ? " selected" : ""}>${value} min</option>`).join("")}</select>
          </label>
        </section>
        <section class="drawer-section">
          <h3>${esc(t("refsTitle"))}<span class="drawer-count">${esc(t("selectedCount", state.selectedReferences.size))}</span></h3>
          <p class="drawer-note">${esc(t("refsIntro"))}</p>
          ${state.references.length
            ? `<div class="pl-refs">${state.references.map(referenceCard).join("")}</div>`
            : `<p class="pl-note">${esc(t("refsEmpty"))}</p>`}
          <button class="pl-btn pl-btn-quiet" type="button" data-action="refresh">${esc(t("refresh"))}</button>
        </section>`
        : `<section class="drawer-section">
          <p class="drawer-note">${esc(t("drawerImportIntro"))}</p>
          ${state.pieces.length
            ? `<div class="pl-refs">${state.pieces.map(pieceRow).join("")}</div>`
            : `<p class="pl-note">${esc(t("piecesEmpty"))}</p>`}
          <button class="pl-btn pl-btn-quiet" type="button" data-action="refresh">${esc(t("refresh"))}</button>
        </section>`}
      </div>
      <footer class="drawer-foot">
        <span class="drawer-count">${esc(creating ? t("selectedCount", state.selectedReferences.size) : t("selectedCount", state.selectedPieces.size))}</span>
        <button class="pl-btn pl-btn-primary" type="button" data-action="${creating ? "create-album" : "add-pieces"}" ${state.busy ? "disabled" : ""}>
          ${esc(state.busy ? (creating ? t("creating") : t("adding")) : (creating ? t("start") : t("add")))}
        </button>
      </footer>
    </aside>
  `;
}

function render() {
  applyI18n();
  const entry = current();
  root.innerHTML = state.view === "playlist" && entry ? viewPlaylist(entry) : viewLibrary();
  drawerRoot.innerHTML = state.drawer ? viewDrawer() : "";
  document.body.classList.toggle("has-drawer", Boolean(state.drawer));
  bindActions(root);
  bindActions(drawerRoot);
  bindFields();
  if (state.view === "playlist") attachAudio();
}

// ---- playback ------------------------------------------------------------

let audio = null;
let playable = [];

function attachAudio() {
  audio = root.querySelector("#plt-audio");
  if (!audio) return;
  audio.addEventListener("ended", () => stepTrack(1));
}

function attachAudioOnce() {
  if (audio) return;
  audio = root.querySelector("#plt-audio") ?? document.createElement("audio");
  audio.addEventListener("ended", () => stepTrack(1));
}

function playTrack(itemId) {
  const entry = current();
  if (!entry) return;
  const index = entry.items.findIndex((item) => item.id === itemId);
  if (index < 0) return;
  const item = entry.items[index];
  if (!item?.audioUrl) return;
  state.playing = itemId;
  state.queue = entry.items.filter((candidate) => !candidate.missing).map((candidate) => candidate.id);
  state.queueIndex = state.queue.indexOf(itemId);
  attachAudioOnce();
  audio.src = item.audioUrl;
  void audio.play().catch(() => { state.message = t("exportError"); });
  highlightPlaying();
}

function stepTrack(direction) {
  if (!state.queue.length) return;
  state.queueIndex = (state.queueIndex + direction + state.queue.length) % state.queue.length;
  playTrack(state.queue[state.queueIndex]);
}

function highlightPlaying() {
  for (const node of root.querySelectorAll("[data-play]")) {
    node.classList.toggle("is-playing", node.dataset.play === state.playing);
  }
}

// ---- actions -------------------------------------------------------------

function pieceKey(piece) {
  return `${piece.source.kind}:${piece.source.taskId}:${piece.source.trackId ?? ""}`;
}

async function moveItem(itemId, direction) {
  const entry = current();
  if (!entry) return;
  const ids = entry.items.map((item) => item.id);
  const from = ids.indexOf(itemId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/items`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds: ids }),
  });
  replacePlaylist(updated);
  render();
}

async function removeItem(itemId) {
  const entry = current();
  if (!entry) return;
  const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
  replacePlaylist(updated);
  render();
}

async function renameCurrent() {
  const entry = current();
  if (!entry) return;
  const name = window.prompt(t("renameHint"), entry.playlist.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmed }),
  });
  replacePlaylist(updated);
  render();
}

async function exportCurrent() {
  const entry = current();
  if (!entry) return;
  state.busy = true;
  state.message = t("exporting");
  render();
  try {
    const manifest = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/export`, { method: "POST" });
    state.message = manifest.skipped?.length
      ? `${t("exportReady")} · ${t("exportSkipped", manifest.skipped.length)}`
      : t("exportReady");
    const link = document.createElement("a");
    link.href = manifest.audioUrl;
    link.download = manifest.fileName || "playlist.mp3";
    document.body.append(link);
    link.click();
    link.remove();
  } catch {
    state.message = t("exportError");
  } finally {
    state.busy = false;
    render();
  }
}

async function uploadCover(file) {
  const entry = current();
  if (!entry || !file) return;
  const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/cover`, {
    method: "POST", headers: { "Content-Type": file.type }, body: file,
  });
  replacePlaylist(updated);
  render();
}

async function removeCover() {
  const entry = current();
  if (!entry) return;
  const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/cover`, { method: "DELETE" });
  replacePlaylist(updated);
  render();
}

async function createAlbumFromDrawer() {
  const description = state.description.trim();
  if (!description) { state.message = t("needDescription"); render(); return; }
  state.busy = true;
  render();
  try {
    const created = await api("/api/albums", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        candidateCount: state.count,
        targetTotalMinutes: state.minutes,
        referenceChatIds: [...state.selectedReferences],
        asPlaylist: true,
        ...(state.name.trim() ? { playlistName: state.name.trim() } : {}),
      }),
    });
    if (created.playlist) replacePlaylist(created.playlist);
    state.drawer = null;
    state.busy = false;
    state.name = "";
    state.description = "";
    state.selectedReferences = new Set();
    state.view = "library";
    state.message = t("albumStarted");
    await loadPlaylists();
    render();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : t("error");
    render();
  }
}

async function addPiecesFromDrawer() {
  if (!state.selectedPieces.size) return;
  state.busy = true;
  render();
  try {
    const items = state.pieces
      .filter((piece) => state.selectedPieces.has(pieceKey(piece)))
      .map((piece) => ({ source: piece.source, titleSnapshot: piece.title, ...(piece.durationSeconds === undefined ? {} : { durationSeconds: piece.durationSeconds }) }));
    const entry = current();
    const updated = entry
      ? await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      : await api("/api/playlists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(state.name.trim() ? { name: state.name.trim() } : {}), items }),
      });
    replacePlaylist(updated);
    state.drawer = null;
    state.busy = false;
    state.selectedPieces = new Set();
    state.message = "";
    state.currentId = updated.playlist.id;
    state.view = "playlist";
    render();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : t("error");
    render();
  }
}

function bindFields() {
  const name = root.ownerDocument.querySelector("#plt-name");
  if (name) name.addEventListener("input", () => { state.name = name.value; });
  const description = root.ownerDocument.querySelector("#plt-description");
  if (description) description.addEventListener("input", () => { state.description = description.value; });
  const count = root.ownerDocument.querySelector("#plt-count");
  if (count) count.addEventListener("change", () => { state.count = Number(count.value); });
  const minutes = root.ownerDocument.querySelector("#plt-minutes");
  if (minutes) minutes.addEventListener("change", () => { state.minutes = Number(minutes.value); });
  const file = root.ownerDocument.querySelector(".cover-file");
  if (file) file.addEventListener("change", () => { void uploadCover(file.files?.[0]); });
}

function bindActions(container) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action],[data-open],[data-play],[data-move],[data-remove],[data-piece],[data-ref]") : null;
    if (!target) return;
    const action = target.dataset.action;
    if (action === "new") { state.drawer = "import-pieces"; state.message = ""; void loadPieces().then(render); render(); return; }
    if (action === "start-album") { state.drawer = "create-album"; state.message = ""; void loadReferences().then(render); render(); return; }
    if (action === "add-pieces") { state.drawer = "import-pieces"; void loadPieces().then(render); render(); return; }
    if (action === "close-drawer") { state.drawer = null; render(); return; }
    if (action === "library") { state.view = "library"; state.currentId = null; state.message = ""; render(); return; }
    if (action === "refresh") { void loadPieces().then(render); return; }
    if (action === "play-all") { const entry = current(); if (entry?.items.length) playTrack(entry.items.find((item) => !item.missing)?.id); return; }
    if (action === "export") { void exportCurrent(); return; }
    if (action === "rename") { void renameCurrent(); return; }
    if (action === "edit-cover") { container.querySelector(".cover-file")?.click(); return; }
    if (action === "remove-cover") { void removeCover(); return; }
    if (action === "create-album") { void createAlbumFromDrawer(); return; }
    if (action === "add-pieces") { void addPiecesFromDrawer(); return; }
    if (target.dataset.open) {
      state.currentId = target.dataset.open;
      state.view = "playlist";
      state.message = "";
      render();
      return;
    }
    if (target.dataset.play) { playTrack(target.dataset.play); return; }
    if (target.dataset.move) { void moveItem(target.dataset.move, Number(target.dataset.direction)); return; }
    if (target.dataset.remove) { void removeItem(target.dataset.remove); return; }
    if (target.dataset.piece) {
      const key = `${target.dataset.piece}:${target.dataset.pieceTask}:${target.dataset.pieceTrack ?? ""}`;
      if (state.selectedPieces.has(key)) state.selectedPieces.delete(key); else state.selectedPieces.add(key);
      render();
      return;
    }
    if (target.dataset.ref) {
      const chatId = target.dataset.ref;
      if (state.selectedReferences.has(chatId)) state.selectedReferences.delete(chatId);
      else state.selectedReferences.add(chatId);
      render();
    }
  });
}

// ---- loading -------------------------------------------------------------

async function loadPlaylists() {
  state.playlists = await api("/api/playlists");
}

async function loadPieces() {
  const body = await api("/api/pieces");
  state.pieces = body.pieces ?? [];
}

async function loadReferences() {
  const body = await api("/api/playlists/references");
  state.references = body.references ?? [];
}

async function loadLanguage() {
  try {
    const settings = await api("/api/settings");
    if (settings?.language) language = settings.language;
  } catch {
    /* Keep the default language when settings are unavailable. */
  }
}

async function boot() {
  await loadLanguage();
  langToggle.addEventListener("click", async () => {
    language = language === "zh-CN" ? "en" : "zh-CN";
    try {
      await api("/api/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
    } catch {
      /* The page keeps its own language even if the preference is not saved. */
    }
    render();
  });
  try {
    await loadPlaylists();
  } catch (error) {
    state.message = error instanceof Error ? error.message : t("error");
  }
  render();
}

void boot();
