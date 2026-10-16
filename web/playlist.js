// Playlist (test): plan and generate a whole album from MoodMic creations.
//
// The request model is the album workflow's — candidates, include/exclude and
// an MP3 export — but the planning input is a set of MoodMic conversations the
// user picked, each contributing its intent and the MusicSpec of its music.
//
// Planning pauses for confirmation: the album author shows how it read the
// references and the theme, the user can keep talking to revise the plan, and
// only an explicit confirmation starts audio generation.

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
    failedTitle: "这次没有完成",
    retryTask: "重试",
    unadmitted: "候选",
    included: "已收录",
    excluded: "已排除",
    status: {
      queued: "排队中", composing: "正在构思", generating: "正在生成音频",
      review: "等待你确认构思", assembling: "正在拼接", processing: "正在处理",
      completed: "已完成", failed: "未完成",
    },
    // progress
    phase: {
      plan: "通读参考，构思歌单", compose: "撰写每首曲目方案", generate: "生成音频",
      assemble: "拼接导出", done: "已完成", review: "等待你确认构思", failed: "未完成",
    },
    progressWait: "正在进行，请稍候",
    progressCurrent: (title) => `正在处理：${title}`,
    progressCount: (done, total) => `${done} / ${total}`,
    // plan panel
    planTitle: "歌单构思",
    planIntro: "下面是专辑作者对你参考对话与主题的理解，以及据此展开的构思。确认无误才会开始生成音频。",
    planReviewBadge: "待确认构想",
    planApprovedBadge: "已确认",
    planDoneBadge: "已完成",
    readingTitle: "系统如何理解你的参考",
    intentLabel: "主题理解",
    readingNoRefs: "这次没有选择参考对话，构思完全来自你的主题描述。",
    readingUnderstoodLabel: "我听到的",
    readingUsedLabel: "它如何进入歌单",
    ideaTitle: "整体构想",
    ideaMindLabel: "核心想法",
    ideaCohesionLabel: "一致与变化",
    ideaContractLabel: "共同声音",
    outlineTitle: "曲目构思",
    outlineInstrumentsLabel: "乐器",
    outlineGrooveLabel: "律动",
    outlineHarmonyLabel: "和声",
    outlineDevelopmentLabel: "发展",
    outlineTargetLabel: "目标时长",
    chatTitle: "继续对话修改",
    chatIntro: "哪里不对、想换掉哪首、想调整整体气质，直接说。专辑作者会据此修改构思，改到你满意再确认。",
    chatPlaceholder: "例如：第 4 首去掉鼓，整体再安静一点。",
    chatSend: "发送",
    chatSending: "正在修改构思…",
    chatOpening: "这是我读完你的参考和主题后的理解与构思。确认无误就点开始生成；想调整就直接告诉我。",
    chatNeedMessage: "先写一句你想调整的地方。",
    approve: "确认构思，开始生成音频",
    approving: "正在开始…",
    planCollapsed: "查看歌单构思与修改记录",
    planCollapsedHint: "音频生成完成后仍可在这里回看当初的构思。",
    // player and list
    scopeCandidates: "候选",
    scopeIncluded: "已收录",
    scopeCount: (n) => `${n} 首`,
    playAll: "播放全部",
    nowPlaying: "正在播放",
    previousTrack: "上一首",
    nextTrack: "下一首",
    seekLabel: "播放进度",
    moveUp: "上移",
    moveDown: "下移",
    listCandidatesEmpty: "还没有候选曲目。",
    listIncludedEmpty: "还没有收录曲目。在「候选」里把喜欢的收进来，就能排成一张歌单。",
    playlistDuration: (d) => `共 ${d}`,
    shelfReviewHint: "进入确认 →",
    playbackError: "这段音频暂时无法播放。",
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
    failedTitle: "This run didn't finish",
    retryTask: "Retry",
    unadmitted: "Candidate",
    included: "Included",
    excluded: "Excluded",
    status: {
      queued: "Queued", composing: "Thinking", generating: "Generating audio",
      review: "Waiting for your confirmation", assembling: "Assembling", processing: "Processing",
      completed: "Completed", failed: "Not finished",
    },
    phase: {
      plan: "Reading the references and shaping the album", compose: "Writing each track's plan",
      generate: "Generating audio", assemble: "Assembling", done: "Completed",
      review: "Waiting for your confirmation", failed: "Not finished",
    },
    progressWait: "In progress, please wait",
    progressCurrent: (title) => `Working on: ${title}`,
    progressCount: (done, total) => `${done} / ${total}`,
    planTitle: "Album plan",
    planIntro: "Here is how the album author read your references and theme, and the plan it drew from them. Audio generation starts only after you confirm.",
    planReviewBadge: "Awaiting review",
    planApprovedBadge: "Confirmed",
    planDoneBadge: "Completed",
    readingTitle: "How the system understood your references",
    intentLabel: "Your theme, read as",
    readingNoRefs: "No reference conversations were chosen this time, so the plan comes entirely from your theme.",
    readingUnderstoodLabel: "What I heard",
    readingUsedLabel: "How it enters the album",
    ideaTitle: "The idea",
    ideaMindLabel: "Core idea",
    ideaCohesionLabel: "Consistency and change",
    ideaContractLabel: "Shared sound",
    outlineTitle: "Track plans",
    outlineInstrumentsLabel: "Instruments",
    outlineGrooveLabel: "Groove",
    outlineHarmonyLabel: "Harmony",
    outlineDevelopmentLabel: "Development",
    outlineTargetLabel: "Target length",
    chatTitle: "Keep talking to revise",
    chatIntro: "Say what is off, which track to swap, how the overall feel should shift. The album author revises the plan, and you confirm once you are happy.",
    chatPlaceholder: "e.g. drop the drums on track 4, and make the whole thing calmer.",
    chatSend: "Send",
    chatSending: "Revising the plan…",
    chatOpening: "Here is how I read your references and theme, and the plan I drew from them. Confirm if it looks right, or tell me what to adjust.",
    chatNeedMessage: "Write what you want to adjust first.",
    approve: "Confirm and start generating audio",
    approving: "Starting…",
    planCollapsed: "View the album plan and revision log",
    planCollapsedHint: "You can still look back at this plan once the audio is done.",
    scopeCandidates: "Candidates",
    scopeIncluded: "Included",
    scopeCount: (n) => `${n} ${n === 1 ? "track" : "tracks"}`,
    playAll: "Play all",
    nowPlaying: "Now playing",
    previousTrack: "Previous track",
    nextTrack: "Next track",
    seekLabel: "Playback position",
    moveUp: "Move up",
    moveDown: "Move down",
    listCandidatesEmpty: "No candidate tracks yet.",
    listIncludedEmpty: "Nothing included yet. Add the ones you like from Candidates to build the playlist.",
    playlistDuration: (d) => `${d} total`,
    shelfReviewHint: "Open to confirm →",
    playbackError: "This track's audio cannot play right now.",
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
  scope: "candidate",
  queue: [],
  queueScope: "candidate",
  queueIndex: -1,
  playingTrackId: null,
  playing: false,
  previewId: null,
  currentTime: 0,
  duration: 0,
  planOpen: false,
  pollTimer: null,
  busy: false,
  chatDraft: "",
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

function clockText(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
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

function orderedTracks(task) {
  return [...(task.albumTracks ?? [])].sort((first, second) => first.order - second.order);
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

// ---- detail ----

function progressModel(task) {
  const tracks = orderedTracks(task);
  const total = tracks.length || task.albumCandidateCount || 0;
  const prompts = tracks.filter((track) => track.musicSpec).length;
  const audio = tracks.filter((track) => track.audioFile).length;
  const percent = (done) => (total ? Math.round((done / total) * 100) : 0);
  const active = tracks.find((track) => track.status === "composing" || track.status === "generating");
  const base = { total, active: active?.title || "" };
  if (task.status === "completed") return { ...base, phase: "done", done: total, percent: 100 };
  if (task.status === "failed") return { ...base, phase: "failed", done: audio, percent: percent(audio) };
  if (task.status === "review") return { ...base, phase: "review", done: 0, percent: 0 };
  if (task.status === "generating") return { ...base, phase: "generate", done: audio, percent: percent(audio) };
  if (task.status === "assembling" || task.status === "processing") return { ...base, phase: "assemble", done: total, percent: 100 };
  if (!tracks.length) return { ...base, phase: "plan", done: 0, percent: 0, indeterminate: true };
  return { ...base, phase: "compose", done: prompts, percent: percent(prompts) };
}

function progressBar(model) {
  if (model.indeterminate) {
    return `<span class="pl-seg-bar is-indeterminate" role="progressbar" aria-label="${esc(t("phase").plan)}">${Array.from({ length: Math.min(model.total || 12, 28) }, () => "<i class=\"is-pending\"></i>").join("")}</span>`;
  }
  if (!model.total) return `<span class="pl-seg-bar is-indeterminate"><i class="is-pending"></i></span>`;
  const cells = Array.from({ length: model.total }, (_, index) =>
    `<i class="${index < model.done ? "is-on" : ""}"></i>`).join("");
  return `<span class="pl-seg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${model.total}" aria-valuenow="${model.done}" aria-valuetext="${esc(t("progressCount", model.done, model.total))}">${cells}</span>`;
}

function progressPanel(task) {
  const model = progressModel(task);
  const note = model.indeterminate ? t("progressWait")
    : model.active ? t("progressCurrent", model.active) : t("progressCount", model.done, model.total);
  return `
    <section class="pl-progress-card" aria-live="polite">
      <div class="pl-progress-head">
        <span class="pl-progress-phase">${esc(t("phase")[model.phase] ?? "")}</span>
        <span class="pl-progress-gauge num" aria-hidden="true">${model.indeterminate ? "…" : `${model.percent}%`}</span>
      </div>
      ${progressBar(model)}
      <p class="pl-progress-note">${esc(note)}</p>
    </section>`;
}

function readingPanel(task) {
  const briefing = task.playlistBriefing;
  if (!briefing) return "";
  const readings = briefing.referenceReadings ?? [];
  return `
    <section class="pl-plan-section">
      <h3>${esc(t("readingTitle"))}</h3>
      <p class="pl-intent"><span class="pl-label">${esc(t("intentLabel"))}</span>${esc(briefing.intentReading)}</p>
      ${readings.length ? `<div class="pl-readings">${readings.map((reading) => `
        <article class="pl-reading">
          <strong>${esc(reading.title)}</strong>
          <p><span class="pl-label">${esc(t("readingUnderstoodLabel"))}</span>${esc(reading.understood)}</p>
          <p><span class="pl-label">${esc(t("readingUsedLabel"))}</span>${esc(reading.usedFor)}</p>
        </article>`).join("")}</div>` : `<p class="pl-note">${esc(t("readingNoRefs"))}</p>`}
    </section>`;
}

function ideaPanel(task) {
  const plan = task.albumPlan;
  if (!plan) return "";
  return `
    <section class="pl-plan-section">
      <h3>${esc(t("ideaTitle"))}</h3>
      <p class="pl-mind">${esc(plan.albumMind)}</p>
      <dl class="pl-dl">
        <div><dt>${esc(t("ideaCohesionLabel"))}</dt><dd>${esc(plan.cohesionStrategy)}</dd></div>
        <div><dt>${esc(t("ideaContractLabel"))}</dt><dd>${esc(plan.sharedSoundContract)}</dd></div>
      </dl>
    </section>`;
}

function outlinePanel(task) {
  const plan = task.albumPlan;
  if (!plan?.tracks?.length) return "";
  return `
    <section class="pl-plan-section">
      <h3>${esc(t("outlineTitle"))}</h3>
      <ol class="pl-outlines">${plan.tracks.map((outline) => `
        <li class="pl-outline">
          <span class="pl-outline-num num">${String(outline.number).padStart(2, "0")}</span>
          <div class="pl-outline-body">
            <div class="pl-outline-top">
              <strong>${esc(outline.title)}</strong>
              <span class="pl-outline-dur num">${esc(durationText(outline.targetSeconds))}</span>
            </div>
            <p class="pl-outline-role">${esc(outline.musicalRole)}</p>
            <dl class="pl-outline-meta">
              <div><dt>${esc(t("outlineInstrumentsLabel"))}</dt><dd>${esc((outline.instruments ?? []).join(" · "))}</dd></div>
              <div><dt>${esc(t("outlineGrooveLabel"))}</dt><dd>${esc(outline.groove)}</dd></div>
              <div><dt>${esc(t("outlineHarmonyLabel"))}</dt><dd>${esc(outline.harmony)}</dd></div>
              <div><dt>${esc(t("outlineDevelopmentLabel"))}</dt><dd>${esc(outline.development)}</dd></div>
            </dl>
          </div>
        </li>`).join("")}</ol>
    </section>`;
}

function chatPanel(task) {
  const discussion = task.playlistDiscussion ?? [];
  const messages = discussion.length
    ? discussion
    : [{ id: "opening", role: "assistant", content: t("chatOpening") }];
  return `
    <section class="pl-plan-section pl-chat">
      <h3>${esc(t("chatTitle"))}</h3>
      <p class="pl-chat-intro">${esc(t("chatIntro"))}</p>
      <div class="pl-thread">
        ${messages.map((message) => `
          <div class="pl-bubble is-${esc(message.role)}">
            <p>${esc(message.content)}</p>
          </div>`).join("")}
        ${state.busy ? `<div class="pl-bubble is-assistant is-pending"><p>${esc(t("chatSending"))}</p></div>` : ""}
      </div>
      <div class="pl-chat-form">
        <textarea id="pl-chat-input" maxlength="2000" placeholder="${esc(t("chatPlaceholder"))}" ${state.busy ? "disabled" : ""}>${esc(state.chatDraft)}</textarea>
        <button class="pl-btn pl-btn-primary" type="button" data-action="send-message" ${state.busy ? "disabled" : ""}>${esc(t("chatSend"))}</button>
      </div>
      ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
    </section>`;
}

// ---- playlist queue and player ----

function listTracks(task, scope) {
  const tracks = task.albumTracks ?? [];
  if (scope === "included") {
    return (task.albumPlaylist ?? [])
      .map((id) => tracks.find((track) => track.id === id && track.admission === "included"))
      .filter(Boolean);
  }
  return orderedTracks(task);
}

function playableTracks(task, scope) {
  return listTracks(task, scope).filter((track) => track.audioFile && track.admission !== "excluded");
}

function totalDuration(tracks) {
  return tracks.reduce((total, track) => total + (track.audioFile ? track.durationSeconds || 0 : 0), 0);
}

function playerBar(task) {
  // Before playback begins, show the first playable track as ready so the
  // player is already there as soon as a playlist has audio.
  const waiting = !state.queue.length;
  const queue = waiting ? playableTracks(task, state.scope).map((track) => track.id) : state.queue;
  if (!queue.length) return "";
  const index = waiting ? 0 : state.queueIndex;
  const track = (task.albumTracks ?? []).find((item) => item.id === queue[index]);
  const duration = waiting ? track?.durationSeconds || 0 : (state.duration > 0 ? state.duration : 0);
  const position = waiting ? 0 : Math.min(state.currentTime, duration);
  return `
    <div class="pl-player" role="region" aria-label="${esc(t("nowPlaying"))}">
      <button class="pl-player-toggle" type="button" data-action="toggle-play" aria-label="${esc(state.playing ? t("pause") : t("listen"))}">
        <span aria-hidden="true">${state.playing ? "❚❚" : "▶"}</span>
      </button>
      <div class="pl-player-now">
        <span class="pl-player-label">${esc(t("nowPlaying"))}</span>
        <strong>${esc(track?.title || "—")}</strong>
        <small class="num">${esc(`${index + 1} / ${queue.length}`)}</small>
      </div>
      <input class="pl-player-seek" id="pl-player-seek" type="range" min="0" max="${duration}" step="0.1" value="${position}" aria-label="${esc(t("seekLabel"))}" />
      <span class="pl-player-time num"><span id="pl-player-elapsed">${esc(clockText(position))}</span> / <span id="pl-player-total">${esc(durationText(duration))}</span></span>
      <div class="pl-player-nav">
        <button type="button" data-action="prev-track" aria-label="${esc(t("previousTrack"))}" ${index <= 0 ? "disabled" : ""}>⏮</button>
        <button type="button" data-action="next-track" aria-label="${esc(t("nextTrack"))}" ${index >= queue.length - 1 ? "disabled" : ""}>⏭</button>
      </div>
    </div>`;
}

function trackRow(task, track, number, scope) {
  const isCurrent = state.playingTrackId === track.id;
  const isPlaying = isCurrent && state.playing;
  const working = track.status === "composing" || track.status === "generating";
  const stateWord = track.admission === "included" ? t("included")
    : track.admission === "excluded" ? t("excluded") : t("unadmitted");
  const percent = isCurrent && state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
  const playlistLength = (task.albumPlaylist ?? []).length;
  return `
    <div class="pl-track is-${esc(track.admission)}${working ? " is-working" : ""}${isCurrent ? " is-current" : ""}">
      <span class="pl-track-number num">${String(number).padStart(2, "0")}</span>
      <button class="pl-play${isPlaying ? " is-playing" : ""}" type="button"
        data-play="${esc(track.id)}" ${track.audioFile ? "" : "disabled"}
        aria-label="${esc(isPlaying ? t("pause") : t("listen"))}">${isPlaying ? "❚❚" : "▶"}</button>
      <div class="pl-track-body">
        <strong>${esc(track.title)}</strong>
        <span>${esc(statusLabel(track))} · ${esc(track.audioFile ? durationText(track.durationSeconds) : t("unadmitted"))} · ${esc(stateWord)}</span>
        ${isCurrent ? `<span class="pl-track-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>` : ""}
      </div>
      <div class="pl-track-actions">
        ${track.status === "failed"
          ? `<button class="pl-btn pl-btn-quiet" type="button" data-retry="${esc(track.id)}">${esc(t("retry"))}</button>`
          : `<button class="pl-btn pl-btn-quiet${track.admission === "included" ? " is-on" : ""}" type="button"
               data-admit="${esc(track.id)}" data-admission="included" ${track.audioFile ? "" : "disabled"}>${esc(t("include"))}</button>
             <button class="pl-btn pl-btn-quiet${track.admission === "excluded" ? " is-on" : ""}" type="button"
               data-admit="${esc(track.id)}" data-admission="excluded">${esc(t("exclude"))}</button>`}
        ${scope === "included" ? `<span class="pl-track-order">
          <button class="pl-btn pl-btn-quiet" type="button" data-move="${esc(track.id)}" data-direction="-1" aria-label="${esc(t("moveUp"))}" ${number === 1 ? "disabled" : ""}>↑</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-move="${esc(track.id)}" data-direction="1" aria-label="${esc(t("moveDown"))}" ${number === playlistLength ? "disabled" : ""}>↓</button>
        </span>` : ""}
      </div>
    </div>`;
}

// The header badge reflects how far the work actually got, so a playlist whose
// tracks are all generated reads "Completed" even if the task record stalled in
// another state (for example after the server restarted).
function planStateBadge(task) {
  const tracks = task.albumTracks ?? [];
  const allReady = tracks.length > 0
    && tracks.every((track) => Boolean(track.audioFile) || track.status === "completed");
  const phase = task.status === "review" ? "review"
    : task.status === "completed" || allReady ? "done"
      : "approved";
  const label = phase === "review" ? t("planReviewBadge")
    : phase === "done" ? t("planDoneBadge") : t("planApprovedBadge");
  return `<span class="pl-plan-state${phase === "review" ? "" : " is-approved"}"><span class="pl-state-dot" aria-hidden="true"></span>${esc(label)}</span>`;
}

function viewDetail() {
  const task = currentTask();
  if (!task) return `<p class="pl-empty">…</p>`;
  const plan = task.albumPlan;
  const reviewing = task.status === "review" && Boolean(plan);
  const running = ["queued", "composing", "generating", "assembling", "processing"].includes(task.status);
  const scope = state.scope;
  const tracks = listTracks(task, scope);
  const candidateCount = orderedTracks(task).length;
  const includedCount = listTracks(task, "included").length;
  const playable = playableTracks(task, scope);
  const anyPlayable = playableTracks(task, "candidate").length > 0;
  const readyCount = orderedTracks(task).filter((track) => track.audioFile).length;
  const planBody = `${readingPanel(task)}${ideaPanel(task)}${outlinePanel(task)}`;

  return `
    <button class="pl-back" type="button" data-action="shelf">${esc(t("back"))}</button>
    <header class="pl-detail-head">
      <div>
        <h1>${esc(plan?.albumTitle || task.title || task.description)}</h1>
        <p>${esc(plan?.albumMind || task.description)}</p>
      </div>
      ${plan ? planStateBadge(task) : ""}
    </header>

    ${task.status === "failed"
      ? `<div class="pl-note"><strong>${esc(t("failedTitle"))}</strong><p>${esc(task.error || "")}</p>
          <button class="pl-btn" type="button" data-action="retry-task">${esc(t("retryTask"))}</button></div>`
      : ""}

    ${reviewing ? `
      <section class="pl-plan">
        <div class="pl-plan-head">
          <h2>${esc(t("planTitle"))}</h2>
        </div>
        <p class="pl-plan-intro">${esc(t("planIntro"))}</p>
        ${planBody}
        ${chatPanel(task)}
        <div class="pl-approve">
          <button class="pl-btn pl-btn-primary pl-approve-btn" type="button" data-action="approve" ${state.busy ? "disabled" : ""}>
            ${esc(state.busy ? t("approving") : t("approve"))}
          </button>
        </div>
      </section>`
    : `
      ${running ? progressPanel(task) : ""}
      ${plan ? `<details class="pl-plan-fold"${state.planOpen ? " open" : ""}>
        <summary>${esc(t("planCollapsed"))}</summary>
        <p class="pl-plan-intro">${esc(t("planCollapsedHint"))}</p>
        ${planBody}
        ${(task.playlistDiscussion ?? []).length ? `<section class="pl-plan-section pl-chat"><h3>${esc(t("chatTitle"))}</h3>
          <div class="pl-thread">${(task.playlistDiscussion ?? []).map((message) => `<div class="pl-bubble is-${esc(message.role)}"><p>${esc(message.content)}</p></div>`).join("")}</div></section>` : ""}
      </details>` : ""}

      ${candidateCount ? `<div class="pl-toolbar">
        <div class="pl-scope" role="group" aria-label="${esc(t("title"))}">
          <button type="button" data-view-scope="candidate" aria-pressed="${scope === "candidate"}">${esc(t("scopeCandidates"))} <small class="num">${candidateCount}</small></button>
          <button type="button" data-view-scope="included" aria-pressed="${scope === "included"}">${esc(t("scopeIncluded"))} <small class="num">${includedCount}</small></button>
        </div>
        <button class="pl-btn pl-btn-primary" type="button" data-action="play-all" ${playable.length ? "" : "disabled"}>▶ ${esc(t("playAll"))}</button>
        <span class="pl-toolbar-duration num">${esc(t("playlistDuration", durationText(totalDuration(playable))))}</span>
        <div class="pl-toolbar-actions">
          <button class="pl-btn pl-btn-quiet" type="button" data-action="export" data-scope="included" ${readyCount ? "" : "disabled"}>${esc(t("exportIncluded"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="export" data-scope="candidate" ${readyCount ? "" : "disabled"}>${esc(t("exportCandidates"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-action="timestamps" ${readyCount ? "" : "disabled"}>${esc(t("timestamps"))}</button>
        </div>
      </div>` : ""}

      ${tracks.length
        ? `<div class="pl-tracks">${tracks.map((track, index) => trackRow(task, track, index + 1, scope)).join("")}</div>`
        : `<p class="pl-empty">${esc(t(scope === "included" ? "listIncludedEmpty" : "listCandidatesEmpty"))}</p>`}
      ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
    `}
    ${!reviewing && anyPlayable ? playerBar(task) : ""}
  `;
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
      else if (action === "approve") approvePlan();
      else if (action === "send-message") sendPlanMessage();
      else if (action === "play-all") startPlayback(state.scope);
      else if (action === "toggle-play") togglePlay();
      else if (action === "prev-track") stepTrack(-1);
      else if (action === "next-track") stepTrack(1);
      else if (action === "export") exportAlbum(button.dataset.scope, button);
      else if (action === "timestamps") exportTimestamps(button);
      else if (action === "retry-task") retryTask(button);
    });
  });

  root.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentId = button.dataset.open;
      state.view = "detail";
      state.message = "";
      state.planOpen = false;
      render();
      const status = currentTask()?.status;
      if (status === "review") loadTask(button.dataset.open);
      else if (!["completed", "failed"].includes(status)) pollTask();
    });
  });

  // Keep the plan fold open across the re-renders that polling causes.
  const planFold = root.querySelector(".pl-plan-fold");
  if (planFold) planFold.addEventListener("toggle", () => { state.planOpen = planFold.open; });

  const description = root.querySelector("#pl-description");
  if (description) description.addEventListener("input", () => { state.description = description.value; });
  const count = root.querySelector("#pl-count");
  if (count) count.addEventListener("change", () => { state.count = Number(count.value); });
  const minutes = root.querySelector("#pl-minutes");
  if (minutes) minutes.addEventListener("change", () => { state.minutes = Number(minutes.value); });
  const chatInput = root.querySelector("#pl-chat-input");
  if (chatInput) chatInput.addEventListener("input", () => { state.chatDraft = chatInput.value; });

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
  root.querySelectorAll("[data-view-scope]").forEach((button) => {
    button.addEventListener("click", () => { state.scope = button.dataset.viewScope; render(); });
  });
  root.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveTrack(button.dataset.move, Number(button.dataset.direction)));
  });
  const seek = root.querySelector("#pl-player-seek");
  if (seek) seek.addEventListener("input", () => seekTo(Number(seek.value)));
}

// ---- playback ----

function audioEl() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.addEventListener("timeupdate", () => { state.currentTime = audio.currentTime; updateSeek(); });
  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) state.duration = audio.duration;
    updateSeek();
  });
  audio.addEventListener("play", () => { state.playing = true; if (state.view === "detail") render(); });
  audio.addEventListener("pause", () => { state.playing = false; if (state.view === "detail") render(); });
  audio.addEventListener("ended", () => stepTrack(1));
  audio.addEventListener("error", () => {
    state.playing = false;
    state.previewId = null;
    if (state.playingTrackId) { state.playingTrackId = null; state.message = t("playbackError"); }
    if (state.view === "detail") render();
  });
  return audio;
}

function updateSeek() {
  const max = state.duration > 0 ? state.duration : 0;
  const seek = root.querySelector("#pl-player-seek");
  if (seek) {
    if (Number(seek.max) !== max) seek.max = String(max);
    seek.value = String(Math.min(state.currentTime, max));
  }
  const elapsed = root.querySelector("#pl-player-elapsed");
  if (elapsed) elapsed.textContent = clockText(state.currentTime);
  const total = root.querySelector("#pl-player-total");
  if (total) total.textContent = durationText(state.duration);
  const bar = root.querySelector(".pl-track.is-current .pl-track-progress i");
  if (bar && state.duration > 0) {
    bar.style.width = `${Math.min(100, (state.currentTime / state.duration) * 100)}%`;
  }
}

function playQueueTrack(index, autoplay = true) {
  const task = currentTask();
  const id = state.queue[index];
  const track = task?.albumTracks?.find((item) => item.id === id);
  if (!task || !track?.audioFile) return;
  state.queueIndex = index;
  state.playingTrackId = id;
  state.previewId = null;
  state.currentTime = 0;
  state.duration = track.durationSeconds || 0;
  const el = audioEl();
  el.src = `/api/tasks/${encodeURIComponent(task.id)}/album/tracks/${encodeURIComponent(id)}/audio`;
  el.currentTime = 0;
  render();
  if (autoplay) {
    el.play().catch(() => { state.playing = false; state.message = t("playbackError"); render(); });
  }
}

function startPlayback(scope) {
  const task = currentTask();
  if (!task) return;
  const queue = playableTracks(task, scope).map((track) => track.id);
  if (!queue.length) {
    state.message = t(scope === "included" ? "listIncludedEmpty" : "listCandidatesEmpty");
    render();
    return;
  }
  state.scope = scope;
  state.queue = queue;
  state.queueScope = scope;
  playQueueTrack(0, true);
}

function togglePlay() {
  if (!state.playingTrackId) { startPlayback(state.scope); return; }
  const el = audioEl();
  if (el.paused) el.play().catch(() => {});
  else el.pause();
}

function playTrack(trackId) {
  const task = currentTask();
  if (!task) return;
  const track = task.albumTracks?.find((item) => item.id === trackId);
  if (!track?.audioFile) return;
  if (state.playingTrackId === trackId) { togglePlay(); return; }
  let queue = playableTracks(task, state.scope).map((item) => item.id);
  if (!queue.includes(trackId)) {
    const other = state.scope === "candidate" ? "included" : "candidate";
    const otherQueue = playableTracks(task, other).map((item) => item.id);
    if (!otherQueue.includes(trackId)) return;
    state.scope = other;
    queue = otherQueue;
  }
  state.queue = queue;
  state.queueScope = state.scope;
  playQueueTrack(queue.indexOf(trackId), true);
}

function stepTrack(direction) {
  const next = state.queueIndex + direction;
  if (next < 0 || next >= state.queue.length) {
    if (direction > 0) pausePlayback();
    return;
  }
  playQueueTrack(next, true);
}

function pausePlayback() {
  state.playing = false;
  audioEl().pause();
}

function seekTo(value) {
  if (!(state.duration > 0)) return;
  const el = audioEl();
  el.currentTime = Math.max(0, Math.min(value, state.duration));
  state.currentTime = el.currentTime;
  updateSeek();
}

function togglePreview(url, id) {
  const el = audioEl();
  if (state.previewId === id && !el.paused) { el.pause(); state.previewId = null; return; }
  el.src = url;
  el.currentTime = 0;
  state.previewId = id;
  el.play().catch(() => { state.previewId = null; });
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

async function approvePlan() {
  if (state.busy) return;
  state.busy = true;
  state.message = "";
  render();
  try {
    const task = await api(`/api/tasks/${encodeURIComponent(state.currentId)}/plan/approve`, { method: "POST" });
    state.busy = false;
    replaceTask(task);
    render();
    pollTask();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function sendPlanMessage() {
  if (state.busy) return;
  const message = state.chatDraft.trim();
  if (!message) { state.message = t("chatNeedMessage"); render(); return; }
  state.busy = true;
  state.message = "";
  render();
  try {
    const task = await api(`/api/tasks/${encodeURIComponent(state.currentId)}/plan/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    state.busy = false;
    state.chatDraft = "";
    replaceTask(task);
    render();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    render();
  }
}

async function albumUpdate(taskId, route, method, payload) {
  const updated = await api(`/api/tasks/${encodeURIComponent(taskId)}/album/${route}`, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  replaceTask(updated);
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

async function moveTrack(trackId, direction) {
  const task = currentTask();
  if (!task) return;
  const ids = [...(task.albumPlaylist ?? [])];
  const index = ids.indexOf(trackId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try {
    const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/album/playlist`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackIds: ids }),
    });
    replaceTask(updated);
    render();
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
    replaceTask(task);
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
  const task = currentTask();
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
  const task = currentTask();
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
