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
    pageTitle: "Arioso · 歌单",
    title: "歌单", libraryNote: "把已有的曲子排成一张歌单，或者从一张新专辑开始。",
    newPlaylist: "新建歌单", newPlaylistLabel: "新建歌单",
    emptyShelf: "还没有歌单。",
    emptyShelfHint: "把已经做好的曲子收进一张歌单，或者新建一张专辑，它的曲子会边生成边进来。",
    recentTitle: "最近更新", allTitle: "全部歌单",
    back: "← 返回歌单",
    openPlaylist: (name) => `打开「${name}」`,
    itemsTitle: "曲目", itemsEmpty: "这张歌单还没有曲子。",
    addPieces: "加入曲子", createAlbum: "创建专辑",
    playAll: "播放全部", pause: "暂停", play: "播放", prevTrack: "上一首", nextTrack: "下一首",
    nowPlaying: "正在播放", exportPlaylist: "导出 MP3", exporting: "正在导出…",
    exportReady: "导出已就绪，正在下载。",
    exportSkipped: (n) => `另有 ${n} 首无法解析，已跳过。`,
    exportError: "这次导出没有完成，请稍后重试。",
    rename: "改名", renameHint: "回车保存，Esc 取消", editDescription: "写一句这张歌单是什么",
    saveName: "保存", cancel: "取消",
    editCover: "更换封面", removeCover: "移除封面",
    coverError: "封面更新失败，请换一张图片再试。",
    missing: "无法解析", missingNote: "这首曲子已不在原专辑里，条目保留在歌单中。",
    moveUp: "上移", moveDown: "下移", remove: "移除", removeEntry: (title) => `移除「${title}」`,
    deletePlaylist: "删除这张歌单", deleteTitle: "删除歌单",
    deleteLead: (name) => `「${name}」会被删除。曲子本身不受影响，它们还在原来的专辑和对话里。`,
    deleteConfirm: "确认删除", deleting: "正在删除…", deleteDone: (name) => `已删除「${name}」。`,
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
    needPieces: "先选一首曲子。",
    needDescription: "先写一句专辑主题。",
    albumStarted: "专辑已经开始，进度可以在「专辑」页查看。",
    itemsCount: (n) => `${n} 首`, missingCount: (n) => `${n} 首无法解析`,
    originMoodMic: "MoodMic", originAlbum: "专辑", originSingle: "单曲",
    loading: "正在载入…",
    error: "这一步没有完成，请再试一次。",
    playbackError: "这段音频暂时无法播放。",
  },
  en: {
    tabMoodMic: "MoodMic", tabAlbums: "Albums", tabCalendar: "Mood calendar (test)", tabWorkflow: "Workflow",
    tabPlaylist: "Playlists", tabHelp: "Help", tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    pageTitle: "Arioso · Playlists",
    title: "Playlists", libraryNote: "Order pieces you already have, or start from a new album.",
    newPlaylist: "New playlist", newPlaylistLabel: "New playlist",
    emptyShelf: "No playlists yet.",
    emptyShelfHint: "Collect pieces you already made into a playlist, or start an album and its tracks join as they finish.",
    recentTitle: "Recently updated", allTitle: "All playlists",
    back: "← Back to playlists",
    openPlaylist: (name) => `Open ${name}`,
    itemsTitle: "Pieces", itemsEmpty: "This playlist has no pieces yet.",
    addPieces: "Add pieces", createAlbum: "Create album",
    playAll: "Play all", pause: "Pause", play: "Play", prevTrack: "Previous", nextTrack: "Next",
    nowPlaying: "Now playing", exportPlaylist: "Export MP3", exporting: "Exporting…",
    exportReady: "Export ready, downloading.",
    exportSkipped: (n) => `${n} piece(s) could not be resolved and were skipped.`,
    exportError: "The export did not finish. Try again.",
    rename: "Rename", renameHint: "Enter saves, Esc cancels", editDescription: "Say what this playlist is",
    saveName: "Save", cancel: "Cancel",
    editCover: "Change cover", removeCover: "Remove cover",
    coverError: "The cover was not updated. Try another image.",
    missing: "Missing", missingNote: "The piece is no longer in its album; the entry stays here.",
    moveUp: "Move up", moveDown: "Move down", remove: "Remove", removeEntry: (title) => `Remove ${title}`,
    deletePlaylist: "Delete this playlist", deleteTitle: "Delete playlist",
    deleteLead: (name) => `"${name}" will be deleted. The pieces themselves are untouched and stay in their albums and conversations.`,
    deleteConfirm: "Delete", deleting: "Deleting…", deleteDone: (name) => `Deleted "${name}".`,
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
    needPieces: "Pick at least one piece.",
    needDescription: "Write one line about the album theme.",
    albumStarted: "The album has started. Follow it on the Albums page.",
    itemsCount: (n) => `${n} track(s)`, missingCount: (n) => `${n} missing`,
    originMoodMic: "MoodMic", originAlbum: "Album", originSingle: "Single",
    loading: "Loading…",
    error: "That step did not finish. Try again.",
    playbackError: "That audio cannot be played right now.",
  },
};

const root = document.querySelector("#pl-main");
const drawerRoot = document.querySelector("#pl-drawer-root");
const langToggle = document.querySelector("#lang-toggle");

const stampedLanguage = document.documentElement.dataset.ariLang;
let language = stampedLanguage === "en" || stampedLanguage === "zh-CN" ? stampedLanguage : "zh-CN";
const state = {
  view: "library",
  loading: true,
  playlists: [],
  currentId: null,
  drawer: null,
  drawerFocus: null,
  drawerLoading: false,
  drawerNeedsFocus: false,
  /** The action that opened the drawer, so focus can return to it. */
  drawerTrigger: null,
  busy: false,
  message: "",
  messageTone: "note",
  pieces: [],
  references: [],
  selectedPieces: new Set(),
  selectedReferences: new Set(),
  name: "",
  description: "",
  count: 14,
  minutes: 35,
  playingId: null,
  isPlaying: false,
  queue: [],
  queueIndex: -1,
  editingTitle: false,
  editingDescription: false,
  /** The playlist id awaiting a delete confirmation, or null. */
  confirmingDelete: null,
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
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  langToggle.textContent = language === "zh-CN" ? "EN" : "中文";
  document.title = t("pageTitle");
  // boot-lang.js holds the translated text back until this point.
  document.documentElement.removeAttribute("data-ari-lang-pending");
}

async function api(path, options) {
  const response = await fetch(path, options);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}

function say(message, tone = "note") {
  state.message = message;
  state.messageTone = tone;
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

function messageMarkup() {
  if (!state.message) return "";
  return `<p class="plt-message is-${esc(state.messageTone)}" role="status">${esc(state.message)}</p>`;
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
      : `<div class="plt-empty">
           <p class="plt-empty-title">${esc(t("emptyShelf"))}</p>
           <p class="plt-empty-hint">${esc(t("emptyShelfHint"))}</p>
           <div class="plt-empty-actions">
             <button class="pl-btn pl-btn-primary" type="button" data-action="new">${esc(t("newPlaylist"))}</button>
             <a class="pl-btn" href="/albums.html">${esc(t("createAlbum"))}</a>
           </div>
         </div>`}
    ${messageMarkup()}
  `;
}

function libraryCard(entry) {
  const playlist = entry.playlist;
  return `
    <article class="lib-card plt-card">
      <button class="plt-card-open" type="button" data-open="${esc(playlist.id)}" aria-label="${esc(t("openPlaylist", playlist.name))}">
        <span class="lib-cover-wrap">${coverMarkup(playlist)}</span>
        <span class="lib-card-body">
          <strong>${esc(playlist.name)}</strong>
          <span class="lib-count num">${esc(t("itemsCount", entry.items.length))} · ${esc(durationText(entry.playableSeconds))}</span>
        </span>
      </button>
      <button class="plt-card-delete" type="button" data-delete="${esc(playlist.id)}"
        aria-label="${esc(t("deletePlaylist"))}" title="${esc(t("deletePlaylist"))}">✕</button>
    </article>`;
}

function itemRow(entry, index, total) {
  const playing = state.playingId === entry.id;
  const isCurrent = playing && state.isPlaying;
  // A missing entry keeps only what still makes sense: it can be moved or
  // removed, but there is nothing to play.
  return `
    <li class="plt-item${entry.missing ? " is-missing" : ""}${playing ? " is-current" : ""}">
      <span class="plt-index num">${String(index + 1).padStart(2, "0")}</span>
      <span class="plt-body">
        <span class="plt-title">${esc(entry.titleSnapshot)}</span>
        <span class="plt-meta">
          ${entry.albumTitle ? `<span class="plt-source">${esc(entry.albumTitle)}</span>` : ""}
          ${entry.missing ? `<span class="plt-missing">${esc(t("missing"))}</span>` : ""}
        </span>
        ${entry.missing ? `<span class="plt-missing-note">${esc(t("missingNote"))}</span>` : ""}
      </span>
      <span class="plt-duration num">${entry.missing ? "—" : esc(durationText(entry.durationSeconds))}</span>
      <span class="plt-actions">
        ${entry.missing ? "" : `
          <button class="plt-icon-btn${isCurrent ? " is-playing" : ""}" type="button" data-play="${esc(entry.id)}"
            aria-label="${esc(isCurrent ? t("pause") : t("play"))}">${isCurrent ? "❚❚" : "▶"}</button>`}
        <button class="plt-icon-btn" type="button" data-move="${esc(entry.id)}" data-direction="-1"
          ${index === 0 ? "disabled" : ""} aria-label="${esc(t("moveUp"))}">↑</button>
        <button class="plt-icon-btn" type="button" data-move="${esc(entry.id)}" data-direction="1"
          ${index === total - 1 ? "disabled" : ""} aria-label="${esc(t("moveDown"))}">↓</button>
        <button class="plt-icon-btn is-danger" type="button" data-remove="${esc(entry.id)}"
          aria-label="${esc(t("removeEntry", entry.titleSnapshot))}">✕</button>
      </span>
    </li>`;
}

function titleBlock(entry) {
  if (state.editingTitle) {
    return `
      <div class="plt-inline-edit">
        <input id="plt-title-input" type="text" maxlength="120" value="${esc(entry.playlist.name)}"
          aria-label="${esc(t("nameLabel"))}" placeholder="${esc(t("namePlaceholder"))}" />
        <span class="plt-inline-hint">${esc(t("renameHint"))}</span>
      </div>`;
  }
  return `<h1 class="plt-title-heading">
      ${esc(entry.playlist.name)}
      <button class="plt-quiet-btn" type="button" data-action="rename">${esc(t("rename"))}</button>
    </h1>`;
}

function descriptionBlock(entry) {
  if (state.editingDescription) {
    return `
      <div class="plt-inline-edit">
        <input id="plt-description-input" type="text" maxlength="400" value="${esc(entry.playlist.description || "")}"
          aria-label="${esc(t("editDescription"))}" placeholder="${esc(t("editDescription"))}" />
        <span class="plt-inline-hint">${esc(t("renameHint"))}</span>
      </div>`;
  }
  return `<button class="plt-description${entry.playlist.description ? "" : " is-empty"}" type="button" data-action="edit-description">
      ${esc(entry.playlist.description || t("editDescription"))}
    </button>`;
}

function deleteBlock() {
  return `<button class="plt-danger-btn" type="button" data-action="delete">${esc(t("deletePlaylist"))}</button>`;
}

/**
 * Deleting asks once, in a small dialog, wherever it starts — the library card
 * or the playlist itself. The pieces are untouched, so the copy says so.
 */
function viewDeleteDialog() {
  const entry = state.playlists.find((candidate) => candidate.playlist.id === state.confirmingDelete);
  if (!entry) return "";
  return `
    <div class="plt-dialog-layer">
      <div class="plt-dialog-scrim" data-action="cancel-delete"></div>
      <div class="plt-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(t("deleteTitle"))}">
        <h2>${esc(t("deleteTitle"))}</h2>
        <p>${esc(t("deleteLead", entry.playlist.name))}</p>
        <div class="plt-dialog-actions">
          <button class="pl-btn pl-btn-quiet" type="button" data-action="cancel-delete">${esc(t("cancel"))}</button>
          <button class="pl-btn is-danger" type="button" data-action="confirm-delete" ${state.busy ? "disabled" : ""}>
            ${esc(state.busy ? t("deleting") : t("deleteConfirm"))}
          </button>
        </div>
      </div>
    </div>`;
}

function viewPlaylist(entry) {
  const playlist = entry.playlist;
  const playLabel = state.isPlaying && state.queue.length ? t("pause") : t("playAll");
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
        ${titleBlock(entry)}
        ${descriptionBlock(entry)}
        <div class="album-meta">
          <span class="lib-count num">${esc(t("itemsCount", entry.items.length))} · ${esc(durationText(entry.playableSeconds))}</span>
          ${entry.missingCount ? `<span class="lib-badge is-failed">${esc(t("missingCount", entry.missingCount))}</span>` : ""}
        </div>
        <div class="plt-toolbar">
          <button class="pl-btn pl-btn-primary" type="button" data-action="play-all" ${entry.playableCount ? "" : "disabled"}>${state.isPlaying ? "❚❚" : "▶"} ${esc(playLabel)}</button>
          <button class="pl-btn" type="button" data-action="export" ${entry.playableCount ? "" : "disabled"}>${esc(t("exportPlaylist"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="add-pieces">${esc(t("addPieces"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="start-album">${esc(t("createAlbum"))}</button>
        </div>
      </div>
    </header>
    <section class="lib-section">
      <h2>${esc(t("itemsTitle"))}</h2>
      ${entry.items.length
        ? `<ul class="plt-list">${entry.items.map((item, index) => itemRow(item, index, entry.items.length)).join("")}</ul>`
        : `<div class="plt-empty">
             <p class="plt-empty-title">${esc(t("itemsEmpty"))}</p>
             <div class="plt-empty-actions">
               <button class="pl-btn pl-btn-primary" type="button" data-action="add-pieces">${esc(t("addPieces"))}</button>
             </div>
           </div>`}
    </section>
    ${messageMarkup()}
    <footer class="plt-footer">${deleteBlock()}</footer>
  `;
}

function pieceRow(piece) {
  const key = pieceKey(piece);
  const selected = state.selectedPieces.has(key);
  const origin = piece.origin === "moodmic" ? t("originMoodMic")
    : piece.origin === "album" ? t("originAlbum") : t("originSingle");
  return `
    <button class="pl-ref${selected ? " is-on" : ""}" type="button" role="checkbox" aria-checked="${selected ? "true" : "false"}"
      data-piece="${esc(key)}">
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

function pieceListMarkup(references) {
  if (state.drawerLoading) return `<p class="pl-note">${esc(t("loading"))}</p>`;
  if (references) {
    return state.references.length
      ? `<div class="pl-refs">${state.references.map(referenceCard).join("")}</div>`
      : `<p class="pl-note">${esc(t("refsEmpty"))}</p>`;
  }
  return state.pieces.length
    ? `<div class="pl-refs">${state.pieces.map(pieceRow).join("")}</div>`
    : `<p class="pl-note">${esc(t("piecesEmpty"))}</p>`;
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
          <h3>${esc(t("refsTitle"))}<span class="drawer-count" data-drawer-count>${esc(t("selectedCount", state.selectedReferences.size))}</span></h3>
          <p class="drawer-note">${esc(t("refsIntro"))}</p>
          <div data-drawer-list>${pieceListMarkup(true)}</div>
        </section>`
        : `<section class="drawer-section">
          <p class="drawer-note">${esc(t("drawerImportIntro"))}</p>
          <div data-drawer-list>${pieceListMarkup(false)}</div>
        </section>`}
      </div>
      <footer class="drawer-foot">
        <button class="pl-btn pl-btn-quiet" type="button" data-action="refresh">${esc(t("refresh"))}</button>
        <span class="drawer-count" data-drawer-count>${esc(t("selectedCount", creating ? state.selectedReferences.size : state.selectedPieces.size))}</span>
        <button class="pl-btn pl-btn-primary" type="button" data-action="submit-drawer" ${state.busy ? "disabled" : ""}>
          ${esc(state.busy ? (creating ? t("creating") : t("adding")) : (creating ? t("start") : t("add")))}
        </button>
      </footer>
    </aside>
  `;
}

function render() {
  applyI18n();
  const entry = current();
  const showingPlaylist = state.view === "playlist" && Boolean(entry);
  root.innerHTML = showingPlaylist ? viewPlaylist(entry) : viewLibrary();
  drawerRoot.innerHTML = state.drawer ? viewDrawer() : viewDeleteDialog();
  document.body.classList.toggle("has-drawer", Boolean(state.drawer || state.confirmingDelete));
  if (state.drawer && state.drawerNeedsFocus) {
    state.drawerNeedsFocus = false;
    focusDrawer();
  }
  if (state.editingTitle) focusInput("#plt-title-input", true);
  else if (state.editingDescription) focusInput("#plt-description-input", true);
}

function focusInput(selector, select) {
  const input = document.querySelector(selector);
  if (!input) return;
  input.focus();
  if (select) input.select();
}

function focusDrawer() {
  const first = drawerRoot.querySelector("#plt-name, .pl-ref, .drawer-close");
  first?.focus();
}

// ---- playback ------------------------------------------------------------

// One audio element for the page. It is created once and never re-created, so
// re-rendering the list cannot stack `ended` handlers on top of each other.
let audio = null;

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.addEventListener("ended", () => stepTrack(1));
  audio.addEventListener("pause", () => { state.isPlaying = false; syncPlaybackUi(); });
  audio.addEventListener("play", () => { state.isPlaying = true; syncPlaybackUi(); });
  audio.addEventListener("error", () => say(t("playbackError"), "error"));
  return audio;
}

function queueFor(entry) {
  return entry.items.filter((item) => !item.missing).map((item) => item.id);
}

function playTrack(itemId) {
  const entry = current();
  if (!entry) return;
  const item = entry.items.find((candidate) => candidate.id === itemId);
  if (!item?.audioUrl) return;
  state.queue = queueFor(entry);
  state.queueIndex = state.queue.indexOf(itemId);
  state.playingId = itemId;
  const element = ensureAudio();
  element.src = item.audioUrl;
  void element.play().catch(() => {
    state.isPlaying = false;
    say(t("playbackError"), "error");
    render();
  });
  render();
}

function togglePlayback() {
  const entry = current();
  if (!entry) return;
  const element = ensureAudio();
  if (state.isPlaying && element.src) {
    element.pause();
    return;
  }
  if (state.playingId && element.src) {
    void element.play().catch(() => say(t("playbackError"), "error"));
    return;
  }
  const first = entry.items.find((item) => !item.missing && item.audioUrl);
  if (first) playTrack(first.id);
}

function stepTrack(direction) {
  if (!state.queue.length) return;
  const next = (state.queueIndex + direction + state.queue.length) % state.queue.length;
  const entry = current();
  if (!entry) return;
  const alive = queueFor(entry);
  const targetId = state.queue[next];
  if (!alive.includes(targetId)) {
    state.queue = alive;
    state.queueIndex = 0;
    if (alive[0]) playTrack(alive[0]);
    return;
  }
  playTrack(targetId);
}

function syncPlaybackUi() {
  // The play button in the header and the per-row buttons both answer this.
  const entry = current();
  if (!entry) return;
  const rowButtons = root.querySelectorAll("[data-play]");
  for (const button of rowButtons) {
    const isCurrent = button.dataset.play === state.playingId && state.isPlaying;
    button.classList.toggle("is-playing", isCurrent);
    button.textContent = button.dataset.play === state.playingId && state.isPlaying ? "❚❚" : "▶";
    button.setAttribute("aria-label", isCurrent ? t("pause") : t("play"));
  }
  for (const item of root.querySelectorAll(".plt-item")) item.classList.remove("is-current");
  const currentRow = state.playingId
    ? root.querySelector(`.plt-item [data-play="${CSS.escape(state.playingId)}"]`)?.closest(".plt-item")
    : null;
  currentRow?.classList.add("is-current");
  const playAll = root.querySelector('[data-action="play-all"]');
  if (playAll) playAll.textContent = state.isPlaying ? `❚❚ ${t("pause")}` : `▶ ${t("playAll")}`;
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
  try {
    replacePlaylist(await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/items`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: ids }),
    }));
    state.queue = queueFor(current() ?? entry);
    render();
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
    render();
  }
}

async function removeItem(itemId) {
  const entry = current();
  if (!entry) return;
  try {
    const updated = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    replacePlaylist(updated);
    state.queue = queueFor(current() ?? entry);
    if (state.playingId === itemId) {
      ensureAudio().pause();
      state.playingId = null;
    }
    render();
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
    render();
  }
}

async function renamePlaylist(name) {
  const entry = current();
  if (!entry) return;
  const trimmed = name.trim();
  state.editingTitle = false;
  if (!trimmed || trimmed === entry.playlist.name) { render(); return; }
  try {
    replacePlaylist(await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    }));
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  }
  render();
}

async function saveDescription(description) {
  const entry = current();
  if (!entry) return;
  state.editingDescription = false;
  const trimmed = description.trim();
  if (trimmed === (entry.playlist.description || "")) { render(); return; }
  try {
    replacePlaylist(await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: entry.playlist.name, description: trimmed }),
    }));
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  }
  render();
}

async function deletePlaylist(playlistId) {
  const entry = state.playlists.find((candidate) => candidate.playlist.id === playlistId);
  const name = entry?.playlist.name ?? "";
  state.busy = true;
  render();
  try {
    await api(`/api/playlists/${encodeURIComponent(playlistId)}`, { method: "DELETE" });
    state.playlists = state.playlists.filter((candidate) => candidate.playlist.id !== playlistId);
    if (state.currentId === playlistId) {
      state.currentId = null;
      state.view = "library";
    }
    say(t("deleteDone", name), "note");
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  } finally {
    state.busy = false;
    state.confirmingDelete = null;
    render();
  }
}

async function exportCurrent() {
  const entry = current();
  if (!entry) return;
  state.busy = true;
  say(t("exporting"));
  render();
  try {
    const manifest = await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/export`, { method: "POST" });
    say(manifest.skipped?.length
      ? `${t("exportReady")} ${t("exportSkipped", manifest.skipped.length)}`
      : t("exportReady"));
    const link = document.createElement("a");
    link.href = manifest.audioUrl;
    link.download = manifest.fileName || "playlist.mp3";
    document.body.append(link);
    link.click();
    link.remove();
  } catch {
    say(t("exportError"), "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function uploadCover(file) {
  const entry = current();
  if (!entry || !file) return;
  try {
    replacePlaylist(await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/cover`, {
      method: "POST", headers: { "Content-Type": file.type }, body: file,
    }));
  } catch {
    say(t("coverError"), "error");
  }
  render();
}

async function removeCover() {
  const entry = current();
  if (!entry) return;
  try {
    replacePlaylist(await api(`/api/playlists/${encodeURIComponent(entry.playlist.id)}/cover`, { method: "DELETE" }));
  } catch {
    say(t("coverError"), "error");
  }
  render();
}

async function submitDrawer() {
  if (state.busy) return;
  if (state.drawer === "create-album") { await createAlbumFromDrawer(); return; }
  await addPiecesFromDrawer();
}

async function createAlbumFromDrawer() {
  const description = state.description.trim();
  if (!description) { say(t("needDescription"), "error"); render(); return; }
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
    closeDrawer();
    state.name = "";
    state.description = "";
    state.selectedReferences = new Set();
    state.view = "library";
    say(t("albumStarted"));
    await loadPlaylists();
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function addPiecesFromDrawer() {
  if (!state.selectedPieces.size) { say(t("needPieces"), "error"); render(); return; }
  state.busy = true;
  render();
  try {
    const items = state.pieces
      .filter((piece) => state.selectedPieces.has(pieceKey(piece)))
      .map((piece) => ({
        source: piece.source,
        titleSnapshot: piece.title,
        ...(piece.durationSeconds === undefined ? {} : { durationSeconds: piece.durationSeconds }),
      }));
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
    closeDrawer();
    state.selectedPieces = new Set();
    state.currentId = updated.playlist.id;
    state.view = "playlist";
    say("");
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  } finally {
    state.busy = false;
    render();
  }
}

// ---- drawer --------------------------------------------------------------

async function openDrawer(kind, trigger) {
  state.drawer = kind;
  state.drawerTrigger = trigger ?? null;
  state.drawerLoading = true;
  state.drawerNeedsFocus = true;
  state.message = "";
  state.drawerFocus = document.activeElement;
  document.body.classList.add("has-drawer");
  render();
  try {
    if (kind === "create-album") await loadReferences();
    else await loadPieces();
  } catch (error) {
    say(error instanceof Error ? error.message : t("error"), "error");
  } finally {
    state.drawerLoading = false;
    // Replace only the list so the dialog keeps its focus and its input values.
    refreshDrawerList();
  }
}

function refreshDrawerList() {
  const holder = drawerRoot.querySelector("[data-drawer-list]");
  if (!holder) { render(); return; }
  holder.innerHTML = pieceListMarkup(state.drawer === "create-album");
  updateDrawerCounts();
}

function updateDrawerCounts() {
  const creating = state.drawer === "create-album";
  const count = t("selectedCount", creating ? state.selectedReferences.size : state.selectedPieces.size);
  for (const node of drawerRoot.querySelectorAll("[data-drawer-count]")) node.textContent = count;
}

function closeDrawer() {
  if (!state.drawer) return;
  state.drawer = null;
  state.drawerLoading = false;
  document.body.classList.remove("has-drawer");
  const trigger = state.drawerTrigger;
  state.drawerTrigger = null;
  state.drawerFocus = null;
  render();
  // The trigger element was re-rendered, so find it again by its action.
  if (trigger) root.querySelector(`[data-action="${trigger}"]`)?.focus();
}

// ---- events --------------------------------------------------------------

// One delegated listener per container, registered once at boot. Rendering
// replaces the markup, never the listener, so a click can only fire once.
function handleClick(event) {
  const target = event.target instanceof Element
    ? event.target.closest("[data-action],[data-open],[data-delete],[data-play],[data-move],[data-remove],[data-piece],[data-ref]")
    : null;
  if (!target) return;
  const action = target.dataset.action;

  if (action === "new") { void openDrawer("import-pieces", "new"); return; }
  if (action === "start-album") { void openDrawer("create-album", "start-album"); return; }
  if (action === "add-pieces") { void openDrawer("import-pieces", "add-pieces"); return; }
  if (action === "close-drawer") { closeDrawer(); return; }
  if (action === "submit-drawer") { void submitDrawer(); return; }
  if (action === "refresh") {
    state.drawerLoading = true;
    refreshDrawerList();
    const loading = state.drawer === "create-album" ? loadReferences() : loadPieces();
    void loading
      .catch((error) => say(error instanceof Error ? error.message : t("error"), "error"))
      .finally(() => { state.drawerLoading = false; refreshDrawerList(); });
    return;
  }
  if (action === "library") {
    state.view = "library";
    state.currentId = null;
    state.editingTitle = false;
    state.editingDescription = false;
    state.confirmingDelete = null;
    say("");
    render();
    return;
  }
  if (action === "play-all") { togglePlayback(); return; }
  if (action === "export") { void exportCurrent(); return; }
  if (action === "rename") { state.editingTitle = true; render(); return; }
  if (action === "edit-description") { state.editingDescription = true; render(); return; }
  if (action === "edit-cover") { root.querySelector(".cover-file")?.click(); return; }
  if (action === "remove-cover") { void removeCover(); return; }
  if (action === "delete") { state.confirmingDelete = state.currentId; render(); return; }
  if (action === "cancel-delete") { state.confirmingDelete = null; render(); return; }
  if (action === "confirm-delete") {
    if (state.confirmingDelete) void deletePlaylist(state.confirmingDelete);
    return;
  }
  if (target.dataset.open) {
    state.currentId = target.dataset.open;
    state.view = "playlist";
    state.editingTitle = false;
    state.editingDescription = false;
    state.confirmingDelete = null;
    say("");
    render();
    return;
  }
  if (target.dataset.delete) { state.confirmingDelete = target.dataset.delete; render(); return; }
  if (target.dataset.play) {
    if (target.dataset.play === state.playingId) { togglePlayback(); return; }
    playTrack(target.dataset.play);
    return;
  }
  if (target.dataset.move) { void moveItem(target.dataset.move, Number(target.dataset.direction)); return; }
  if (target.dataset.remove) { void removeItem(target.dataset.remove); return; }
  if (target.dataset.piece) {
    if (state.selectedPieces.has(target.dataset.piece)) state.selectedPieces.delete(target.dataset.piece);
    else state.selectedPieces.add(target.dataset.piece);
    syncSelection(target);
    return;
  }
  if (target.dataset.ref) {
    const chatId = target.dataset.ref;
    if (state.selectedReferences.has(chatId)) state.selectedReferences.delete(chatId);
    else state.selectedReferences.add(chatId);
    syncSelection(target);
  }
}

/** Flips one row's selected state without rebuilding the dialog around it. */
function syncSelection(button) {
  const key = button.dataset.piece;
  const chatId = button.dataset.ref;
  const on = key ? state.selectedPieces.has(key) : state.selectedReferences.has(chatId);
  button.classList.toggle("is-on", on);
  button.setAttribute("aria-checked", on ? "true" : "false");
  updateDrawerCounts();
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "plt-name") state.name = target.value;
  else if (target.id === "plt-description") state.description = target.value;
  else if (target.id === "plt-count") state.count = Number(target.value);
  else if (target.id === "plt-minutes") state.minutes = Number(target.value);
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    if (state.editingTitle) { state.editingTitle = false; render(); return; }
    if (state.editingDescription) { state.editingDescription = false; render(); return; }
    if (state.confirmingDelete) { state.confirmingDelete = null; render(); return; }
    if (state.drawer) { closeDrawer(); return; }
  }
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (event.key === "Enter" && target.id === "plt-title-input") {
    event.preventDefault();
    void renamePlaylist(target.value);
  } else if (event.key === "Enter" && target.id === "plt-description-input") {
    event.preventDefault();
    void saveDescription(target.value);
  }
}

function handleChange(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.matches(".cover-file")) {
    void uploadCover(target.files?.[0]);
  }
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
  if (stampedLanguage) return;
  try {
    const settings = await api("/api/settings");
    if (settings?.language) language = settings.language;
  } catch {
    /* Keep the default language when settings are unavailable. */
  }
}

async function boot() {
  await loadLanguage();
  // Apply the static copy before the first fetch; render() applies it again.
  applyI18n();
  root.addEventListener("click", handleClick);
  drawerRoot.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleKeydown);
  langToggle.addEventListener("click", async () => {
    language = language === "zh-CN" ? "en" : "zh-CN";
    try {
      await api("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
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
    say(error instanceof Error ? error.message : t("error"), "error");
  }
  state.loading = false;
  render();
}

void boot();
