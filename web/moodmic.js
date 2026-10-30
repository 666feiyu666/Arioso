// MoodMic — a chat-style workspace. Every creation is a conversation kept in the
// left rail; you describe a feeling in your own words, refine the direction in
// the thread, and one piece is made from it. The feeling is a colour read from
// the final prompt, and you can change it any time.
//
// The mood calendar lives on its own page (/calendar.html) and links back here
// to the conversation a day belongs to.

import {
  GROUPS, api, applyI18n, customEmotionDraft, emotionLabel, esc, groupById, groupName,
  persistLanguage, readLanguage, todayISO,
} from "./mood-common.js";
import { createAlbumStage } from "./album-view.js";
import { openSettingsDialog } from "./settings-dialog.js";

// Four starting prompts, one per feeling colour. They fill the otherwise
// empty MoodMic screen and reuse the four mood signals already defined in
// mood-common.js (coral / gold / blue / sage).
const EXAMPLES = {
  coral: {
    zh: "雨还没停，我需要一段能接住这点烦躁的音乐。",
    en: "The rain won't let up — I want something to hold this restlessness.",
  },
  gold: {
    zh: "今晚很兴奋，想要一首明亮、让人想动起来的曲子。",
    en: "I'm wired tonight — give me something bright and kinetic.",
  },
  blue: {
    zh: "有点累，也有点孤单，想要一段慢慢流淌的音乐。",
    en: "Tired and a little lonely — a slower current of music.",
  },
  sage: {
    zh: "现在很平静，来一段让下午更松弛的声音。",
    en: "Calm right now — something to make the afternoon looser.",
  },
};

// Each melody point plays a short pre-generated example for its mood group.
// The files live in Assets/music/ and are served under /assets/.
const MOOD_AUDIO = {
  coral: "/assets/music/red-example.mp3",
  gold: "/assets/music/yellow-example.mp3",
  blue: "/assets/music/blue-example.mp3",
  sage: "/assets/music/green-example.mp3",
};

const COPY = {
  "zh-CN": {
    pageTitle: "MoodMic · 把心情变成音乐",
    tabMoodMic: "MoodMic", tabCalendar: "心情日历", tabWorkflow: "工作流", tabPlaylist: "播放列表（测试）", tabHelp: "帮助",
    tabBarLabel: "主导航", switchLanguage: "切换界面语言", openSettings: "设置",
    historyLabel: "对话记录",
    collapseSide: "收起对话记录",
    expandSide: "展开对话记录",
    newChat: "新对话",
    deleteChat: "删除对话",
    deleteChatConfirm: (title) => `删除「${title}」？由它生成的任务与音频也会一并删除，且无法恢复。`,
    historyEmpty: "还没有对话。",
    untitled: "新对话",
    greeting: "把此刻的心情变成音乐。",
    greetingLead: "用你自己的话写下此刻的心情和想要的音乐。",
    examplesLead: "先听听看：点彩色小圆点，或卡片上的「试听」。想写了，点卡片上的文字就能开始。",
    playMood: (name) => `试听${name}情绪的音乐`,
    stopMood: (name) => `暂停${name}情绪的音乐`,
    listen: "试听",
    nowPlaying: "正在播放",
    composerPlaceholder: "说说此刻的心情，和想要的音乐…",
    composerHint: "Enter 发送，Shift + Enter 换行",
    send: "发送",
    attachImage: "＋ 图片",
    removeImage: "移除图片",
    thinking: "正在回复…",
    directionReady: "这个方向合适吗？",
    directionReadyHint: "继续补充，或把目前的共识整理成创作简报。",
    makePrompt: "整理成创作简报",
    promptLabel: "创作简报",
    promptHint: "可编辑；第一段是创意描述，第二段是音乐方向。确认后开始创作。",
    refsTitle: "参与本次生成",
    refsPoems: "诗歌",
    refsMusic: "音乐参考",
    refsStyle: "风格",
    refsStandard: "曲目",
    refsEmpty: "本次生成没有使用参考数据。",
    poemRefs: (list) => `参考诗作：${list}`,
    moodTitle: "你的心情",
    moodColorLabel: "颜色",
    moodWordLabel: "情绪词",
    customEmotionPlaceholder: "或写下你自己的词，例如「振奋」",
    moodJudged: (emotion) => `读出的心情是「${emotion}」。你可以改。`,
    moodEdited: (from, to) => `原本读出的心情是「${from}」，现在是「${to}」。`,
    moodManual: "选一个颜色和词。",
    moodNeedPick: "选一个心情颜色和词，再开始创作。",
    musicRefLabel: "音乐参考",
    musicRefHelp: "Auto 让 Composer 自行选择；选具体类型则用该类型的语料。",
    musicRefAuto: "Auto（自动选择）",
    musicRefNone: "不使用语料",
    musicRefJazz: "Jazz",
    musicRefBlues: "Blues",
    musicRefElectronic: "Electronic",
    musicRefInstrumentalRock: "Instrumental Rock",
    musicRefInstrumentalHipHop: "Instrumental Hip-Hop",
    startCreating: "开始创作",
    advanced: "更多设置",
    generationMode: "生成方式",
    modeGenerate: "编曲并生成音乐",
    modeCompose: "只生成编曲提示",
    lyriaModel: "音色模型",
    lyriaClip: "短片段 · 30 秒",
    lyriaFull: "完整曲目",
    vocalRule: "人声",
    vocalAuto: "自动",
    vocalInstrumental: "纯器乐",
    vocalVocals: "带人声",
    creatingTitle: "正在创作你的音乐。",
    creatingLead: "声音成形要一点时间，稍等。",
    statusQueued: "排队中", statusComposing: "正在构思编曲", statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章", statusProcessing: "正在后期处理",
    statusCompleted: "已完成", statusFailed: "未完成",
    statusReview: "待你确认",
    statusPlanning: "编曲提示已就绪",
    promptConfirmTitle: "确认生成音乐",
    promptConfirmLead: "Lyria 生成提示已就绪。确认后开始生成音频。",
    promptEditHint: "可以直接修改这段提示；确认后会按你修改后的文字生成。",
    promptConfirmAction: "确认生成",
    reviewTitle: "这首音乐符合你的想法吗？",
    reviewLead: "先听一遍。如果和你的需求明显不符，可以重新生成；觉得可以就保留这首。",
    reviewMatchNote: "自动检查认为这首音乐基本符合你的需求。",
    reviewMismatchNote: "自动检查发现它可能与你的需求有明显出入。",
    reviewPointsLabel: "核对要点",
    reviewRegenerate: "重新生成",
    reviewKeep: "保留这首",
    phaseComposing: "正在把你的想法整理成完整的音乐规格…",
    phaseGenerating: "正在把这段编曲变成声音…",
    phaseProcessing: "正在做最后的整理与导出…",
    phaseWaiting: "正在准备…",
    listenTitle: "你的音乐。",
    lyriaPrompt: "Lyria 生成提示",
    download: "下载音频",
    tryAgain: "再试一次",
    createAnother: "开始新的对话",
    failedTitle: "这一次没有完成",
    failedLead: "生成服务可能暂时不可用。你可以再试一次，之前的记录会保留。",
    errorGeneric: "出了点问题，请再试一次。",
    loading: "正在准备…",
    sessionGone: "这个对话已经不在了。",
    albumContinueTitle: "把这支曲子变成一张专辑",
    albumContinueLead: "这张专辑从你刚保留的这首开始：它的想法和音乐方案是第一份参考。",
    albumSourceLabel: "源曲目",
    albumThemeLabel: "专辑主题",
    albumThemePlaceholder: "例如：把这些雨夜的质感延展成一组深夜专注的器乐。",
    albumCountLabel: "曲目数",
    albumMinutesLabel: "目标总时长",
    albumPlanAction: "规划这张专辑 →",
    albumPlanning: "正在规划…",
    albumNeedTheme: "先写一句这张专辑想要的样子。",
    albumFailedLead: "这张专辑没有继续下去。可以从原来的位置接着来。",
    albumRetryAction: "继续这张专辑",
    albumEyebrow: "专辑",
  },
  en: {
    pageTitle: "MoodMic · Music from your mood",
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar", tabWorkflow: "Workflow", tabPlaylist: "Playlist (test)", tabHelp: "Help",
    tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language", openSettings: "Settings",
    historyLabel: "Conversations",
    collapseSide: "Collapse conversations",
    expandSide: "Expand conversations",
    newChat: "New chat",
    deleteChat: "Delete conversation",
    deleteChatConfirm: (title) => `Delete “${title}”? Tasks and audio created from it are deleted too. This cannot be undone.`,
    historyEmpty: "No conversations yet.",
    untitled: "New chat",
    greeting: "Turn how you feel into music.",
    greetingLead: "Describe the feeling and the music you want in your own words.",
    examplesLead: "Have a listen first: tap a coloured dot, or Listen on a card. To start writing, tap the card's words.",
    playMood: (name) => `Play the ${name} example`,
    stopMood: (name) => `Pause the ${name} example`,
    listen: "Listen",
    nowPlaying: "Playing",
    composerPlaceholder: "Describe how you feel, and the music you want…",
    composerHint: "Enter to send, Shift + Enter for a new line",
    send: "Send",
    attachImage: "＋ Image",
    removeImage: "Remove image",
    thinking: "Replying…",
    directionReady: "Does this direction feel right?",
    directionReadyHint: "Keep adding, or turn the current agreement into a creative brief.",
    makePrompt: "Draft the brief",
    promptLabel: "Creative brief",
    promptHint: "Editable — paragraph 1 is the creative description, paragraph 2 the musical direction. Confirm to begin.",
    refsTitle: "What shaped this piece",
    refsPoems: "Poetry",
    refsMusic: "Music references",
    refsStyle: "Style",
    refsStandard: "Standard",
    refsEmpty: "No reference material was used for this piece.",
    poemRefs: (list) => `Poetry references: ${list}`,
    moodTitle: "Your feeling",
    moodColorLabel: "Colour",
    moodWordLabel: "Emotion word",
    customEmotionPlaceholder: "Or write your own word, e.g. “Energised”",
    moodJudged: (emotion) => `The feeling reads as “${emotion}”. You can change it.`,
    moodEdited: (from, to) => `It read “${from}”; it is now “${to}”.`,
    moodManual: "Pick a colour and a word.",
    moodNeedPick: "Pick a feeling colour and word before creating.",
    musicRefLabel: "Music reference",
    musicRefHelp: "Auto lets the Composer choose; a specific type binds the local corpus.",
    musicRefAuto: "Auto",
    musicRefNone: "No reference corpus",
    musicRefJazz: "Jazz",
    musicRefBlues: "Blues",
    musicRefElectronic: "Electronic",
    musicRefInstrumentalRock: "Instrumental Rock",
    musicRefInstrumentalHipHop: "Instrumental Hip-Hop",
    startCreating: "Start creating",
    advanced: "More settings",
    generationMode: "Mode",
    modeGenerate: "Arrange & generate music",
    modeCompose: "Arrange only (text prompt)",
    lyriaModel: "Sound model",
    lyriaClip: "Short clip · 30s",
    lyriaFull: "Full piece",
    vocalRule: "Vocals",
    vocalAuto: "Auto",
    vocalInstrumental: "Instrumental",
    vocalVocals: "With vocals",
    creatingTitle: "Creating your music.",
    creatingLead: "Give it a moment while the sound takes shape.",
    statusQueued: "Queued", statusComposing: "Shaping the arrangement", statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements", statusProcessing: "Post-processing",
    statusCompleted: "Completed", statusFailed: "Not finished",
    statusReview: "Needs your confirmation",
    statusPlanning: "Composition prompt ready",
    promptConfirmTitle: "Confirm to generate",
    promptConfirmLead: "The Lyria generation prompt is ready. Confirm to start generating audio.",
    promptEditHint: "You can edit this prompt — generation follows your wording once you confirm.",
    promptConfirmAction: "Confirm generation",
    reviewTitle: "Does this music match what you asked for?",
    reviewLead: "Listen first. If it clearly misses the request, regenerate; if it works, keep this one.",
    reviewMatchNote: "The automatic check found this broadly matches your request.",
    reviewMismatchNote: "The automatic check found a clear mismatch with your request.",
    reviewPointsLabel: "Checkpoints",
    reviewRegenerate: "Regenerate",
    reviewKeep: "Keep this",
    phaseComposing: "Shaping your idea into a complete musical spec…",
    phaseGenerating: "Turning that arrangement into sound…",
    phaseProcessing: "Doing the final assembly and export…",
    phaseWaiting: "Getting ready…",
    listenTitle: "Your music.",
    lyriaPrompt: "Lyria generation prompt",
    download: "Download audio",
    tryAgain: "Try again",
    createAnother: "Start a new chat",
    failedTitle: "This run didn't finish",
    failedLead: "The generation service may be temporarily unavailable. Try again — your earlier records stay.",
    errorGeneric: "Something went wrong. Please try again.",
    loading: "Getting ready…",
    sessionGone: "That conversation is no longer available.",
    albumContinueTitle: "Turn this piece into an album",
    albumContinueLead: "The album starts from the song you just kept: its idea and music spec become the first reference.",
    albumSourceLabel: "Source song",
    albumThemeLabel: "Album theme",
    albumThemePlaceholder: "e.g. grow this rain-night texture into a set of late-night focus instrumentals.",
    albumCountLabel: "Tracks",
    albumMinutesLabel: "Target duration",
    albumPlanAction: "Plan the album →",
    albumPlanning: "Planning…",
    albumNeedTheme: "Write one line about the album you want first.",
    albumFailedLead: "This album did not continue. You can pick it up from the stage that stopped.",
    albumRetryAction: "Continue the album",
    albumEyebrow: "Album",
  },
};

const STATUS_KEYS = {
  queued: "statusQueued", composing: "statusComposing", planning: "statusPlanning", generating: "statusGenerating",
  review: "statusReview", assembling: "statusAssembling", processing: "statusProcessing",
  completed: "statusCompleted", failed: "statusFailed",
};

const side = document.querySelector("#mm-side");
const stage = document.querySelector("#mm-stage");
const layout = document.querySelector(".mm-layout");
const langToggle = document.querySelector("#lang-toggle");

// Collapsing the rail is a preference, so it survives a reload.
const SIDE_STORAGE_KEY = "arioso.moodmic.side";

function readSidePreference() {
  try {
    return localStorage.getItem(SIDE_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function persistSidePreference(collapsed) {
  try {
    localStorage.setItem(SIDE_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    /* Storage may be unavailable; the layout still toggles for this visit. */
  }
}

function applySideState() {
  if (layout) layout.classList.toggle("is-side-collapsed", state.sideCollapsed);
}

function toggleSidebar() {
  state.sideCollapsed = !state.sideCollapsed;
  applySideState();
  persistSidePreference(state.sideCollapsed);
  renderSidebar();
}

const state = {
  language: "zh-CN",
  discussions: [],
  currentId: null,
  session: null,
  input: "",
  attachments: [],
  pending: null,
  thinking: false,
  sending: false,
  threadSignature: null,
  replyDraft: "",
  proposal: "",
  // The Lyria prompt the user is reviewing; "" means "use the composed one".
  lyriaPrompt: "",
  judged: false,
  detected: null,
  mood: { group: null, emotion: null },
  musicReference: "auto",
  musicTypes: [],
  advanced: { mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" },
  entries: [],
  activeEntryId: null,
  task: null,
  // The conversation rail can collapse so the chat column gets the width.
  sideCollapsed: false,
  // The journey links this conversation's song to the album planned from it.
  journey: null,
  albumTask: null,
  albumTheme: "",
  albumCount: 14,
  albumMinutes: 35,
  albumBusy: false,
  journeyTimer: null,
  pollTimer: null,
  playing: null,
  moodAudio: null,
  busy: false,
  message: "",
  messageError: false,
};

function t(key, ...args) {
  const value = (COPY[state.language] ?? COPY["zh-CN"])[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function statusLabel(status) {
  return t(STATUS_KEYS[status] ?? "statusQueued");
}

function formatTitleTime(value) {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Title rule: time - song title when a piece has been made, otherwise
// time - the opening words of the conversation.
function sessionTitle(session) {
  const time = formatTitleTime(session?.createdAt);
  const task = sessionTasks(session).at(-1);
  let name;
  if (task?.title) {
    name = task.title;
  } else {
    const first = (session?.messages ?? []).find((message) => message.role === "user");
    const text = (first?.content ?? "").trim().replace(/\s+/g, " ");
    name = text ? (text.length > 14 ? `${text.slice(0, 14)}…` : text) : t("untitled");
  }
  return time ? `${time} - ${name}` : name;
}

function sessionTasks(session) {
  return session?.tasks ?? [];
}

function entryForSession(sessionId) {
  return state.entries.find((entry) => (entry.tasks ?? []).some((task) => task.sourceDiscussionId === sessionId)) ?? null;
}

function activeTask() {
  const tasks = sessionTasks(state.session);
  return state.task ?? tasks.at(-1) ?? null;
}

// The album stage is shared with the Playlist page. Here it reads and writes
// the album task of this journey, and approval goes through the journey route
// so a revision number binds the confirmation to the plan on screen.
const albumStage = createAlbumStage({
  language: () => state.language,
  api,
  getTask: () => state.albumTask,
  setTask: (task) => { state.albumTask = task; },
  rerender: () => render(),
  approve: async (task) => {
    const body = await api(`/api/journeys/${encodeURIComponent(state.currentId)}/album-plan/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: task.albumPlanRevision }),
    });
    state.journey = body.journey;
    state.albumTask = body.albumTask;
    pollJourney();
  },
  revise: async (task, message) => {
    const body = await api(`/api/journeys/${encodeURIComponent(state.currentId)}/album-plan/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    state.journey = body.journey;
    state.albumTask = body.albumTask;
  },
  onRunning: () => pollJourney(),
});

// ---------------------------------------------------------------------------

function render() {
  applyI18n(COPY, state.language);
  langToggle.textContent = state.language === "zh-CN" ? "EN" : "中文";
  applySideState();
  renderSidebar();
  renderChat();
}

function renderSidebar() {
  // Keep the reader's place: re-rendering the list must not jump the sidebar.
  const previousScrollTop = side.scrollTop;
  const collapsed = state.sideCollapsed;
  const toggleLabel = collapsed ? t("expandSide") : t("collapseSide");
  side.innerHTML = `
    <div class="mm-side-head">
      <span class="mm-side-label">${esc(t("historyLabel"))}</span>
      <button class="mm-side-toggle" type="button" id="mm-side-toggle"
        aria-controls="mm-side" aria-expanded="${collapsed ? "false" : "true"}"
        aria-label="${esc(toggleLabel)}" title="${esc(toggleLabel)}">
        <span aria-hidden="true">${collapsed ? "›" : "‹"}</span>
      </button>
    </div>
    <button class="e-btn e-btn-secondary mm-new" type="button" id="mm-new" aria-label="${esc(t("newChat"))}">
      <span class="mm-new-text">＋ ${esc(t("newChat"))}</span>
      <span class="mm-new-icon" aria-hidden="true">＋</span>
    </button>
    ${state.discussions.length ? `<ul class="mm-side-list">${state.discussions.map((discussion) => {
      const meta = sideMeta(discussion);
      return `
      <li>
        <button class="mm-side-item${discussion.id === state.currentId ? " is-active" : ""}"
          type="button" data-open="${esc(discussion.id)}">
          <span class="mm-side-title">${esc(sessionTitle(discussion))}</span>
          ${meta ? `<span class="mm-side-meta">${esc(meta)}</span>` : ""}
        </button>
        <button class="mm-side-delete" type="button" data-delete-chat="${esc(discussion.id)}"
          aria-label="${esc(t("deleteChat"))}" title="${esc(t("deleteChat"))}">×</button>
      </li>`;
    }).join("")}</ul>` : `<p class="e-hint mm-side-empty">${esc(t("historyEmpty"))}</p>`}
  `;
  side.querySelector("#mm-side-toggle").addEventListener("click", toggleSidebar);
  side.querySelector("#mm-new").addEventListener("click", newChat);
  for (const button of side.querySelectorAll("[data-open]")) {
    button.addEventListener("click", () => openDiscussion(button.dataset.open));
  }
  for (const button of side.querySelectorAll("[data-delete-chat]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteChat(button.dataset.deleteChat);
    });
  }
  side.scrollTop = previousScrollTop;
}

function sideMeta(session) {
  const task = sessionTasks(session).at(-1);
  if (task) return statusLabel(task.status);
  const hasUser = (session.messages ?? []).some((message) => message.role === "user");
  if (!hasUser) return "";
  if (session.proposal) return t("promptLabel");
  return statusLabel("composing");
}

// ---------------------------------------------------------------------------

function mainHead() {
  return `
    <div class="mm-chat-head">
      <h2 class="mm-title">${esc(state.session ? sessionTitle(state.session) : t("greeting"))}</h2>
      ${state.session ? "" : `<p class="mm-lead">${esc(t("greetingLead"))}</p>`}
    </div>
  `;
}

function renderExamples() {
  const key = state.language === "en" ? "en" : "zh";
  const rows = [70, 150, 80, 150];
  const dots = GROUPS.map((group, index) => {
    const cx = (index + 0.5) * 250;
    const cy = rows[index];
    const playing = state.playing === group.id;
    return `
        <g class="mm-melody-point${playing ? " is-playing" : ""}" data-point="${group.id}"
          style="--group:${group.color}"
          role="button" tabindex="0" aria-pressed="${playing ? "true" : "false"}"
          aria-label="${esc(t("playMood", groupName(group, state.language)))}">
          <circle class="mm-melody-hit" cx="${cx}" cy="${cy}" r="24" fill="transparent" />
          <circle class="mm-melody-ring" cx="${cx}" cy="${cy}" r="11"
            fill="none" stroke="${group.color}" stroke-width="2" vector-effect="non-scaling-stroke" />
          <circle class="mm-melody-dot" cx="${cx}" cy="${cy}" r="8"
            fill="var(--bg)" stroke="${group.color}" stroke-width="3" vector-effect="non-scaling-stroke" />
        </g>`;
  }).join("");
  return `
    <div class="mm-examples">
      <svg class="mm-melody${state.playing ? " is-playing" : ""}" viewBox="0 0 1000 220" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path class="mm-melody-path" aria-hidden="true"
          d="M0,110 C41.7,110 83.3,70 125,70 C208.3,70 291.7,150 375,150 C458.3,150 541.7,80 625,80 C708.3,80 791.7,150 875,150 C916.7,150 958.3,110 1000,110"
          fill="none" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />${dots}
      </svg>
      <p class="mm-examples-lead">${esc(t("examplesLead"))}</p>
      <div class="mm-examples-grid">
        ${GROUPS.map((group) => {
          const text = EXAMPLES[group.id]?.[key] ?? "";
          const playing = state.playing === group.id;
          const name = groupName(group, state.language);
          const playLabel = t("playMood", name);
          const stopLabel = t("stopMood", name);
          return `
          <div class="mm-example${playing ? " is-playing" : ""}" data-example-group="${group.id}" style="--group:${group.color}">
            <button class="mm-example-start" type="button" data-example="${esc(text)}">
              <span class="mm-example-mood"><span class="mm-example-swatch" aria-hidden="true"></span>${esc(name)}</span>
              <span class="mm-example-text">${esc(text)}</span>
            </button>
            <div class="mm-example-foot">
              <button class="mm-example-play${playing ? " is-playing" : ""}" type="button" data-play-group="${group.id}"
                aria-pressed="${playing ? "true" : "false"}"
                aria-label="${esc(playing ? stopLabel : playLabel)}"
                data-play-label="${esc(playLabel)}" data-stop-label="${esc(stopLabel)}">
                <span class="mm-example-play-icon" aria-hidden="true"></span>
                <span class="mm-example-play-label">${esc(playing ? t("nowPlaying") : t("listen"))}</span>
              </button>
              <span class="mm-example-play-time" aria-hidden="true"></span>
            </div>
            <span class="mm-example-progress" aria-hidden="true"><i></i></span>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

// A stable fingerprint of what the thread is showing. When it changes, new
// output has arrived and the thread follows it down; otherwise the reader's
// position is kept, so a plain re-render never jumps the view.
function threadSignature() {
  const session = state.session;
  const submitted = sessionTasks(session).length > 0 || session?.status === "submitted";
  return [
    session ? 1 : 0,
    session?.messages?.length ?? 0,
    state.pending ? 1 : 0,
    state.thinking ? 1 : 0,
    state.proposal ? 1 : 0,
    state.busy ? 1 : 0,
    submitted ? 1 : 0,
  ].join(":");
}

function renderChat() {
  const previousThread = stage.querySelector("#mm-thread");
  const previousScrollTop = previousThread ? previousThread.scrollTop : 0;
  const previousSignature = state.threadSignature ?? null;
  stage.innerHTML = `
    ${mainHead()}
    <div class="mm-thread${state.session ? "" : " is-empty"}" id="mm-thread">${renderThread()}</div>
    ${renderComposer()}
    ${messageLine()}
  `;
  bindChat();
  const thread = stage.querySelector("#mm-thread");
  if (thread) {
    const signature = threadSignature();
    if (previousSignature !== null && signature !== previousSignature) {
      thread.scrollTop = thread.scrollHeight;
    } else {
      thread.scrollTop = previousScrollTop;
    }
    state.threadSignature = signature;
  }
}

function messageLine() {
  if (!state.message) return "";
  return `<p class="e-message${state.messageError ? " error" : ""}">${esc(state.message)}</p>`;
}

function messageImages(message) {
  const session = state.session;
  return (message.attachmentIds ?? []).map((id) => {
    const attachment = session?.attachments?.find((item) => item.id === id);
    if (!attachment) return "";
    return `<img class="mm-msg-img" alt="${esc(attachment.originalName)}"
      src="/api/mood-chats/${encodeURIComponent(session.id)}/attachments/${encodeURIComponent(attachment.id)}" />`;
  }).join("");
}

function renderThread() {
  const session = state.session;
  const parts = [];
  if (!session) parts.push(renderExamples());
  for (const message of session?.messages ?? []) {
    parts.push(`<article class="mm-msg ${message.role}">${messageImages(message)}${esc(message.content)}</article>`);
  }
  if (state.pending) {
    const previews = (state.pending.urls ?? [])
      .map((url) => `<img class="mm-msg-img" src="${esc(url)}" alt="" />`).join("");
    parts.push(`<article class="mm-msg user">${previews}${esc(state.pending.content)}</article>`);
  }
  if (state.thinking) parts.push('<div class="mm-typing" role="status"><span></span><span></span><span></span></div>');

  const submitted = sessionTasks(session).length > 0 || session?.status === "submitted";
  if (submitted) {
    parts.push(renderResult());
  } else if (session) {
    if (state.proposal) {
      parts.push(renderProposal());
    } else if (session.messages?.some((message) => message.role === "assistant") && !state.thinking) {
      parts.push(`
        <div class="mm-direction">
          <div>
            <strong>${esc(t("directionReady"))}</strong>
            <span>${esc(t("directionReadyHint"))}</span>
          </div>
          <button class="e-btn e-btn-primary${state.busy ? " is-loading" : ""}" type="button" id="mm-make-prompt" ${state.busy ? "disabled" : ""}>${esc(t("makePrompt"))} →</button>
        </div>
      `);
    }
  }
  return parts.join("");
}

const MUSIC_TYPE_LABELS = {
  jazz: "musicRefJazz",
  blues: "musicRefBlues",
  electronic: "musicRefElectronic",
  "instrumental-rock": "musicRefInstrumentalRock",
  "instrumental-hip-hop": "musicRefInstrumentalHipHop",
};

function musicReferenceOptions() {
  const choices = [
    ["auto", t("musicRefAuto")],
    ["none", t("musicRefNone")],
    ...state.musicTypes.map((type) => [type, t(MUSIC_TYPE_LABELS[type] ?? type)]),
  ];
  return choices.map(([value, label]) =>
    `<option value="${esc(value)}"${state.musicReference === value ? " selected" : ""}>${esc(label)}</option>`
  ).join("");
}

function renderPoemReferences() {
  const references = state.session?.poem_retrieval?.references ?? [];
  if (!references.length) return "";
  const titles = references
    .map((reference) => `《${reference.title}》${reference.author}`)
    .join(" · ");
  return `<p class="mm-poem-refs">${esc(t("poemRefs", titles))}</p>`;
}

function renderColorPicker() {
  return `
    <div class="mm-colors" role="group" aria-label="${esc(t("moodColorLabel"))}">
      ${GROUPS.map((group) => `
        <button class="mm-color" type="button" data-group="${group.id}"
          aria-pressed="${state.mood.group === group.id}" style="--group:${group.color}">
          <span class="mm-color-swatch" aria-hidden="true"></span>
          <span>${esc(groupName(group, state.language))}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderWordPicker() {
  if (!state.mood.group) return "";
  const group = groupById(state.mood.group);
  const custom = customEmotionDraft(state.mood.group, state.mood.emotion);
  return `
    <div class="mm-words" role="group" aria-label="${esc(t("moodWordLabel"))}">
      ${group.emotions.map((emotion) => `
        <button class="mm-word" type="button" data-emotion="${emotion.id}"
          aria-pressed="${state.mood.emotion === emotion.id}"
          style="--group:${group.color}">${esc(state.language === "en" ? emotion.en : emotion.zh)}</button>
      `).join("")}
    </div>
    <input class="e-input mm-custom-word" type="text" id="mm-custom-emotion" maxlength="64"
      data-group="${group.id}" style="--group:${group.color}"
      value="${esc(custom)}" placeholder="${esc(t("customEmotionPlaceholder"))}"
      aria-label="${esc(t("customEmotionPlaceholder"))}" />
  `;
}

function moodHint() {
  if (!state.judged) return "";
  if (state.detected && state.mood.group && state.mood.emotion) {
    if (state.mood.group === state.detected.group && state.mood.emotion === state.detected.emotion) {
      return t("moodJudged", detectedLabel());
    }
    return t("moodEdited", detectedLabel(), moodLabel());
  }
  if (state.detected) return t("moodJudged", detectedLabel());
  return t("moodManual");
}

// Reflect a typed emotion on the confirm button without re-rendering, so the
// field keeps focus and the caret while the user is still typing.
function syncMoodReady() {
  const ready = Boolean(state.mood.group && state.mood.emotion);
  const approve = stage.querySelector("#mm-approve");
  if (approve) approve.disabled = !ready || state.busy;
  const hint = stage.querySelector("#mm-mood-need");
  if (hint) hint.hidden = ready;
}

function moodLabel() {
  return state.mood.group && state.mood.emotion
    ? emotionLabel(state.mood.group, state.mood.emotion, state.language) : "";
}

function detectedLabel() {
  return state.detected ? emotionLabel(state.detected.group, state.detected.emotion, state.language) : "";
}

// Keep both paragraphs of the creative brief readable without an inner scrollbar.
function autoGrowProposalText(textarea) {
  if (!textarea) return;
  const maxHeight = Math.round(window.innerHeight * 0.6);
  textarea.style.height = "auto";
  const needed = textarea.scrollHeight;
  textarea.style.height = `${Math.min(needed, maxHeight)}px`;
  textarea.style.overflowY = needed > maxHeight ? "auto" : "hidden";
}

function renderProposal() {
  const moodReady = Boolean(state.mood.group && state.mood.emotion);
  return `
    <div class="mm-block mm-proposal">
      <div class="mm-mood-pick">
        <div class="mm-mood-pick-head">
          <strong>${esc(t("moodTitle"))}</strong>
          <span class="mm-mood-hint">${esc(moodHint())}</span>
        </div>
        ${renderColorPicker()}
        ${renderWordPicker()}
      </div>
      ${renderPoemReferences()}
      <div class="mm-proposal-head">
        <label for="mm-proposal-text"><strong>${esc(t("promptLabel"))}</strong></label>
        <span>${esc(t("promptHint"))}</span>
      </div>
      <textarea class="e-textarea" id="mm-proposal-text" maxlength="8000">${esc(state.proposal)}</textarea>
      <div class="mm-music-ref">
        <label class="mm-inline-field" for="mm-music-ref">
          <span>${esc(t("musicRefLabel"))}</span>
          <select id="mm-music-ref">${musicReferenceOptions()}</select>
        </label>
        <span class="mm-music-ref-note">${esc(t("musicRefHelp"))}</span>
      </div>
      <details class="mm-advanced">
        <summary>${esc(t("advanced"))}</summary>
        <div class="mm-advanced-inner">
          <label class="mm-inline-field">
            <span>${esc(t("generationMode"))}</span>
            <select id="mm-mode">
              <option value="generate" ${state.advanced.mode === "generate" ? "selected" : ""}>${esc(t("modeGenerate"))}</option>
              <option value="compose" ${state.advanced.mode === "compose" ? "selected" : ""}>${esc(t("modeCompose"))}</option>
            </select>
          </label>
          <label class="mm-inline-field">
            <span>${esc(t("lyriaModel"))}</span>
            <select id="mm-lyria">
              <option value="lyria-3-clip-preview" ${state.advanced.lyriaModel === "lyria-3-clip-preview" ? "selected" : ""}>${esc(t("lyriaClip"))}</option>
              <option value="lyria-3.5" ${state.advanced.lyriaModel === "lyria-3.5" ? "selected" : ""}>${esc(t("lyriaFull"))}</option>
            </select>
          </label>
          <label class="mm-inline-field">
            <span>${esc(t("vocalRule"))}</span>
            <select id="mm-vocal">
              <option value="auto" ${state.advanced.vocalMode === "auto" ? "selected" : ""}>${esc(t("vocalAuto"))}</option>
              <option value="instrumental" ${state.advanced.vocalMode === "instrumental" ? "selected" : ""}>${esc(t("vocalInstrumental"))}</option>
              <option value="vocals" ${state.advanced.vocalMode === "vocals" ? "selected" : ""}>${esc(t("vocalVocals"))}</option>
            </select>
          </label>
        </div>
      </details>
      <div class="mm-actions">
        <button class="e-btn e-btn-primary" type="button" id="mm-approve" ${moodReady && !state.busy ? "" : "disabled"}>${esc(t("startCreating"))} →</button>
      </div>
      <p class="e-hint" id="mm-mood-need"${moodReady ? " hidden" : ""}>${esc(t("moodNeedPick"))}</p>
    </div>
  `;
}

// Poetry comes from the Director's own trace; music references are resolved by
// the server from the IDs the Composer recorded.
function renderReferences(task) {
  const poems = state.session?.poem_retrieval?.references ?? [];
  // A journey response carries the raw task, so fall back to the conversation's
  // resolved copy of the same task before concluding there were no references.
  const music = Array.isArray(task.musicReferences)
    ? task.musicReferences
    : (state.session?.tasks ?? []).find((candidate) => candidate.id === task.id)?.musicReferences ?? [];
  const rows = [];
  if (poems.length) {
    const titles = poems.map((reference) => `《${esc(reference.title)}》${esc(reference.author)}`).join(" · ");
    rows.push(`<p class="mm-ref-row"><span>${esc(t("refsPoems"))}</span><span>${titles}</span></p>`);
  }
  if (music.length) {
    const types = [...new Set(music.map((reference) => reference.musicType))]
      .map((type) => esc(t(MUSIC_TYPE_LABELS[type] ?? type))).join(" · ");
    const styles = music.filter((reference) => reference.kind === "style")
      .map((reference) => `《${esc(reference.title)}》`);
    const standards = music.filter((reference) => reference.kind === "standard")
      .map((reference) => `《${esc(reference.title)}》`);
    const parts = [types];
    if (styles.length) parts.push(`${esc(t("refsStyle"))} ${styles.join(" ")}`);
    if (standards.length) parts.push(`${esc(t("refsStandard"))} ${standards.join(" ")}`);
    rows.push(`<p class="mm-ref-row"><span>${esc(t("refsMusic"))}</span><span>${parts.join(" · ")}</span></p>`);
  }
  if (!rows.length) rows.push(`<p class="mm-ref-row"><span>${esc(t("refsEmpty"))}</span></p>`);
  return `<div class="mm-refs"><p class="mm-refs-title">${esc(t("refsTitle"))}</p>${rows.join("")}</div>`;
}

function renderResult() {
  const task = activeTask();
  const entry = entryForSession(state.session?.id);
  if (!task) return "";
  const group = entry ? groupById(entry.group) : null;
  if (task.status === "failed") {
    return `
      <div class="mm-block mm-result" style="--group:#b1412a">
        <div class="mm-error-box">
          <strong>${esc(t("failedTitle"))}</strong>
          <span>${esc(task.error || t("failedLead"))}</span>
        </div>
        <div class="mm-foot-actions">
          <button class="e-btn e-btn-primary" type="button" id="mm-retry">${esc(t("tryAgain"))}</button>
          <button class="e-btn e-btn-secondary" type="button" id="mm-new-2">${esc(t("createAnother"))}</button>
        </div>
      </div>`;
  }
  if (task.status === "planning") {
    // The composed prompt is a starting point: it stays editable until the user
    // confirms, and whatever is in the box is what Lyria receives.
    const prompt = state.lyriaPrompt || task.musicSpec?.lyriaPrompt || "";
    return `
      <div class="mm-block mm-result" style="--group:${group?.color ?? "#b1642f"}">
        <h3 class="mm-review-title">${esc(t("promptConfirmTitle"))}</h3>
        <p class="mm-review-lead">${esc(t("promptConfirmLead"))}</p>
        ${prompt ? `<label class="mm-prompt" for="mm-lyria-prompt">
          <strong>${esc(t("lyriaPrompt"))}</strong>
          <textarea class="e-textarea mm-lyria-prompt" id="mm-lyria-prompt" maxlength="8000">${esc(prompt)}</textarea>
        </label>
        <p class="e-hint">${esc(t("promptEditHint"))}</p>` : ""}
        <div class="mm-foot-actions">
          <button class="e-btn e-btn-primary" type="button" id="mm-prompt-approve" ${state.busy ? "disabled" : ""}>${esc(t("promptConfirmAction"))}</button>
        </div>
      </div>`;
  }
  if (task.status === "review") {
    const review = task.musicReview;
    const points = review?.mismatchedPoints ?? [];
    const note = review?.verdict === "match" ? t("reviewMatchNote") : t("reviewMismatchNote");
    return `
      <div class="mm-block mm-result mm-review" style="--group:${group?.color ?? "#b1642f"}">
        <h3 class="mm-review-title">${esc(t("reviewTitle"))}</h3>
        <p class="mm-review-lead">${esc(t("reviewLead"))}</p>
        <audio class="mm-player" controls preload="metadata" src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
        <div class="mm-review-note">
          <strong>${esc(note)}</strong>
          ${review?.summary ? `<span class="mm-review-summary">${esc(review.summary)}</span>` : ""}
          ${points.length ? `<div class="mm-review-points"><span>${esc(t("reviewPointsLabel"))}</span><ul>${points.map((point) => `<li>${esc(point)}</li>`).join("")}</ul></div>` : ""}
        </div>
        <div class="mm-foot-actions">
          <button class="e-btn e-btn-primary" type="button" id="mm-review-regenerate" ${state.busy ? "disabled" : ""}>${esc(t("reviewRegenerate"))}</button>
          <button class="e-btn e-btn-secondary" type="button" id="mm-review-keep" ${state.busy ? "disabled" : ""}>${esc(t("reviewKeep"))}</button>
        </div>
      </div>`;
  }
  if (task.status !== "completed") {
    const progress = `
      <div class="mm-progress">
        <div class="mm-disc" aria-hidden="true"></div>
        <h3>${esc(statusLabel(task.status))}</h3>
        <p>${esc(progressPhase(task))}</p>
        <div class="mm-bar"><span></span></div>
      </div>`;
    return `<div class="mm-block mm-result" style="--group:${group?.color ?? "#b1642f"}">${progress}</div>`;
  }
  return `
    <div class="mm-block mm-result" style="--group:${group?.color ?? "#b1642f"}">
      ${entry ? `<p class="mm-result-mood"><span class="mm-dot" style="background:${group.color}"></span>${esc(emotionLabel(entry.group, entry.emotion, state.language))}</p>` : ""}
      <h3 class="mm-result-title">${esc(task.title || t("listenTitle"))}</h3>
      ${task.description ? `<p class="mm-result-desc">${esc(task.description)}</p>` : ""}
      <audio class="mm-player" controls preload="metadata" src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
      ${renderReferences(task)}
      ${task.musicSpec?.lyriaPrompt ? `
      <details class="mm-prompt">
        <summary>${esc(t("lyriaPrompt"))}</summary>
        <div class="mm-prompt-body">${esc(task.musicSpec.lyriaPrompt)}</div>
      </details>` : ""}
      <div class="mm-foot-actions">
        <a class="e-btn e-btn-secondary" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>
        <button class="e-btn e-btn-primary" type="button" id="mm-new-2">${esc(t("createAnother"))}</button>
      </div>
    </div>
    ${renderJourney(task)}
  `;
}

// After the song is kept, the same conversation carries on into an album: the
// theme is set here, the plan is confirmed here, and background progress,
// playback and curation are the shared album stage.
function renderJourney(task) {
  const journey = state.journey;
  if (!journey) return "";
  if (state.albumTask) {
    return `<div class="mm-album">
      <p class="mm-album-eyebrow">${esc(t("albumEyebrow"))}</p>
      ${albumStage.render()}
    </div>`;
  }
  if (journey.phase === "failed") {
    return `<div class="mm-album mm-album-setup">
      <div class="mm-album-head">
        <h3>${esc(t("albumContinueTitle"))}</h3>
        <p>${esc(t("albumFailedLead"))}</p>
      </div>
      ${journey.error ? `<p class="e-hint">${esc(journey.error)}</p>` : ""}
      <div class="mm-album-actions">
        <button class="e-btn e-btn-primary" type="button" id="mm-journey-retry">${esc(t("albumRetryAction"))}</button>
      </div>
    </div>`;
  }
  if (journey.phase !== "song-ready") return "";
  return `<div class="mm-album mm-album-setup">
    <div class="mm-album-head">
      <h3>${esc(t("albumContinueTitle"))}</h3>
      <p>${esc(t("albumContinueLead"))}</p>
    </div>
    <div class="mm-album-source">
      <span class="mm-album-source-label">${esc(t("albumSourceLabel"))}</span>
      <strong>${esc(task.title || t("listenTitle"))}</strong>
      <span>${esc((task.description || "").slice(0, 160))}</span>
    </div>
    <label class="mm-album-field" for="mm-album-theme">
      <span>${esc(t("albumThemeLabel"))}</span>
      <textarea class="e-textarea" id="mm-album-theme" maxlength="4000"
        placeholder="${esc(t("albumThemePlaceholder"))}">${esc(state.albumTheme)}</textarea>
    </label>
    <div class="mm-album-fields">
      <label class="mm-inline-field"><span>${esc(t("albumCountLabel"))}</span>
        <select id="mm-album-count">${[12, 13, 14, 15, 24, 25, 26, 27, 28].map((value) =>
          `<option value="${value}"${value === state.albumCount ? " selected" : ""}>${value}</option>`).join("")}</select>
      </label>
      <label class="mm-inline-field"><span>${esc(t("albumMinutesLabel"))}</span>
        <select id="mm-album-minutes">${[30, 35, 40, 65].map((value) =>
          `<option value="${value}"${value === state.albumMinutes ? " selected" : ""}>${value} min</option>`).join("")}</select>
      </label>
    </div>
    <div class="mm-album-actions">
      <button class="e-btn e-btn-primary" type="button" id="mm-album-plan" ${state.albumBusy ? "disabled" : ""}>
        ${esc(state.albumBusy ? t("albumPlanning") : t("albumPlanAction"))}
      </button>
    </div>
  </div>`;
}

function progressPhase(task) {
  if (!task) return t("phaseWaiting");
  if (task.status === "composing") return t("phaseComposing");
  if (task.status === "generating") return t("phaseGenerating");
  if (task.status === "assembling" || task.status === "processing") return t("phaseProcessing");
  return t("phaseWaiting");
}

function renderComposer() {
  const submitted = sessionTasks(state.session).length > 0 || state.session?.status === "submitted";
  if (submitted) return "";
  // Once the brief exists, the only next step is "start creating": keeping the
  // message composer would put two competing primary actions on screen.
  if (state.proposal) return "";
  const previews = state.attachments.length ? `
    <div class="mm-attach-row">
      ${state.attachments.map((item, index) => `
        <span class="mm-thumb">
          <img src="${esc(item.url)}" alt="" />
          <button type="button" data-remove-attach="${index}" aria-label="${esc(t("removeImage"))}">×</button>
        </span>`).join("")}
    </div>` : "";
  return `
    <form class="mm-composer" id="mm-composer">
      ${previews}
      <textarea class="e-textarea" id="mm-input" maxlength="2000"
        placeholder="${esc(t("composerPlaceholder"))}">${esc(state.input)}</textarea>
      <div class="mm-composer-foot">
        <div class="mm-composer-tools">
          <button class="mm-attach-btn" type="button" id="mm-attach">${esc(t("attachImage"))}</button>
          <input type="file" id="mm-image-input" accept="image/jpeg,image/png,image/webp" hidden />
          <span class="e-hint">${esc(t("composerHint"))}</span>
        </div>
        <button class="e-btn e-btn-primary" type="submit" id="mm-send" ${state.thinking || state.sending ? "disabled" : ""}>${esc(t("send"))}</button>
      </div>
    </form>
  `;
}

function bindChat() {
  const input = stage.querySelector("#mm-input");
  if (input) {
    input.addEventListener("input", () => { state.input = input.value; });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage();
      }
    });
    input.focus();
  }
  stage.querySelector("#mm-composer")?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  stage.querySelector("#mm-attach")?.addEventListener("click", () => stage.querySelector("#mm-image-input").click());
  const imageInput = stage.querySelector("#mm-image-input");
  imageInput?.addEventListener("change", () => {
    for (const file of [...(imageInput.files ?? [])]) {
      state.attachments.push({ file, url: URL.createObjectURL(file) });
    }
    imageInput.value = "";
    render();
  });
  for (const button of stage.querySelectorAll("[data-remove-attach]")) {
    button.addEventListener("click", () => {
      const [removed] = state.attachments.splice(Number(button.dataset.removeAttach), 1);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      render();
    });
  }
  stage.querySelector("#mm-make-prompt")?.addEventListener("click", generateProposal);
  stage.querySelector("#mm-approve")?.addEventListener("click", approveAndCreate);
  stage.querySelector("#mm-music-ref")?.addEventListener("change", (event) => {
    state.musicReference = event.target.value;
    render();
  });
  const proposalText = stage.querySelector("#mm-proposal-text");
  if (proposalText) {
    autoGrowProposalText(proposalText);
    proposalText.addEventListener("input", () => {
      state.proposal = proposalText.value;
      autoGrowProposalText(proposalText);
    });
  }
  stage.querySelector("#mm-mode")?.addEventListener("change", (event) => { state.advanced.mode = event.target.value; });
  stage.querySelector("#mm-lyria")?.addEventListener("change", (event) => { state.advanced.lyriaModel = event.target.value; });
  stage.querySelector("#mm-vocal")?.addEventListener("change", (event) => { state.advanced.vocalMode = event.target.value; });
  for (const button of stage.querySelectorAll("[data-group]")) {
    button.addEventListener("click", () => {
      if (state.mood.group === button.dataset.group) return;
      state.mood.group = button.dataset.group;
      state.mood.emotion = null;
      render();
    });
  }
  for (const button of stage.querySelectorAll("[data-emotion]")) {
    button.addEventListener("click", () => { state.mood.emotion = button.dataset.emotion; render(); });
  }
  // A typed word is a first-class emotion: it replaces the built-in choice and
  // is stored as its own text, so the four colours all accept new words.
  const customEmotion = stage.querySelector("#mm-custom-emotion");
  if (customEmotion) {
    customEmotion.addEventListener("input", () => {
      state.mood.emotion = customEmotion.value.trim() || null;
      for (const button of stage.querySelectorAll("[data-emotion]")) {
        button.setAttribute("aria-pressed", "false");
      }
      syncMoodReady();
    });
  }
  stage.querySelector("#mm-retry")?.addEventListener("click", () => retryAsNewAttempt(state.session?.tasks?.at(-1)?.id));
  stage.querySelector("#mm-new-2")?.addEventListener("click", newChat);
  stage.querySelector("#mm-review-regenerate")?.addEventListener("click", () => decideReview("regenerate"));
  stage.querySelector("#mm-review-keep")?.addEventListener("click", () => decideReview("keep"));
  stage.querySelector("#mm-prompt-approve")?.addEventListener("click", approvePrompt);
  // Editing the prompt must not re-render, or the caret would jump on each key.
  const lyriaPrompt = stage.querySelector("#mm-lyria-prompt");
  if (lyriaPrompt) {
    lyriaPrompt.addEventListener("input", () => { state.lyriaPrompt = lyriaPrompt.value; });
  }
  // The album continuation: theme, size, and the shared album stage.
  stage.querySelector("#mm-album-theme")?.addEventListener("input", (event) => {
    state.albumTheme = event.target.value;
  });
  stage.querySelector("#mm-album-count")?.addEventListener("change", (event) => {
    state.albumCount = Number(event.target.value);
  });
  stage.querySelector("#mm-album-minutes")?.addEventListener("change", (event) => {
    state.albumMinutes = Number(event.target.value);
  });
  stage.querySelector("#mm-album-plan")?.addEventListener("click", continueAlbum);
  stage.querySelector("#mm-journey-retry")?.addEventListener("click", retryJourney);
  if (state.albumTask) albumStage.bind(stage);
  for (const button of stage.querySelectorAll("[data-example]")) {
    button.addEventListener("click", () => {
      // Fill the composer in place — no re-render, so the melody curve and its
      // four points keep their state instead of replaying the entrance.
      state.input = button.dataset.example;
      const input = stage.querySelector("#mm-input");
      if (input) {
        input.value = state.input;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }
  // Link each example card to its data point on the melody curve.
  for (const card of stage.querySelectorAll("[data-example-group]")) {
    const dot = stage.querySelector(`.mm-melody-dot[data-point="${card.dataset.exampleGroup}"]`);
    const setActive = (on) => {
      card.classList.toggle("is-active", on);
      dot?.classList.toggle("is-active", on);
    };
    card.addEventListener("mouseenter", () => setActive(true));
    card.addEventListener("mouseleave", () => setActive(false));
    card.addEventListener("focusin", () => setActive(true));
    card.addEventListener("focusout", () => setActive(false));
  }
  // One playing mood at a time, driven by a melody point or a card's Listen.
  for (const point of stage.querySelectorAll(".mm-melody-point")) {
    const groupId = point.dataset.point;
    const card = stage.querySelector(`.mm-example[data-example-group="${groupId}"]`);
    // Hovering a point enlarges it (CSS) and lights up its card, so the dot
    // reads as something to press and which mood it belongs to.
    const setActive = (on) => {
      point.classList.toggle("is-active", on);
      card?.classList.toggle("is-active", on);
    };
    point.addEventListener("mouseenter", () => setActive(true));
    point.addEventListener("mouseleave", () => setActive(false));
    point.addEventListener("focusin", () => setActive(true));
    point.addEventListener("focusout", () => setActive(false));
    point.addEventListener("click", () => toggleMoodAudio(groupId));
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMoodAudio(groupId);
      }
    });
  }
  for (const button of stage.querySelectorAll("[data-play-group]")) {
    button.addEventListener("click", () => toggleMoodAudio(button.dataset.playGroup));
  }
}

// ---------------------------------------------------------------------------

// One shared audio element drives every melody point, so starting a second
// mood stops the first instead of stacking playback.
function ensureMoodAudio() {
  if (state.moodAudio) return state.moodAudio;
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", () => setMoodPlaying(null));
  audio.addEventListener("error", () => setMoodPlaying(null));
  audio.addEventListener("timeupdate", () => updateMoodPlayback());
  audio.addEventListener("loadedmetadata", () => updateMoodPlayback());
  state.moodAudio = audio;
  return audio;
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Draw the current playback position on the card that owns it.
function updateMoodPlayback() {
  const audio = state.moodAudio;
  if (!audio || !state.playing) return;
  const card = stage.querySelector(`.mm-example[data-example-group="${state.playing}"]`);
  if (!card) return;
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const ratio = duration ? Math.min(1, audio.currentTime / duration) : 0;
  const bar = card.querySelector(".mm-example-progress i");
  if (bar) bar.style.width = `${(ratio * 100).toFixed(2)}%`;
  const time = card.querySelector(".mm-example-play-time");
  if (time) time.textContent = formatClock(audio.currentTime);
}

// Reflect the playing mood on the melody points and cards without re-rendering,
// so the curve keeps its entrance instead of replaying it on every toggle.
function pushMoodPlayingToDom(groupId) {
  const melody = stage.querySelector(".mm-melody");
  if (melody) melody.classList.toggle("is-playing", Boolean(groupId));
  for (const point of stage.querySelectorAll(".mm-melody-point")) {
    const on = point.dataset.point === groupId;
    point.classList.toggle("is-playing", on);
    point.setAttribute("aria-pressed", on ? "true" : "false");
  }
  for (const card of stage.querySelectorAll("[data-example-group]")) {
    const on = card.dataset.exampleGroup === groupId;
    card.classList.toggle("is-playing", on);
    const bar = card.querySelector(".mm-example-progress i");
    if (bar) bar.style.width = "0%";
    const time = card.querySelector(".mm-example-play-time");
    if (time) time.textContent = "";
    const play = card.querySelector(".mm-example-play");
    if (play) {
      play.classList.toggle("is-playing", on);
      play.setAttribute("aria-pressed", on ? "true" : "false");
      const label = on ? play.dataset.stopLabel : play.dataset.playLabel;
      if (label) play.setAttribute("aria-label", label);
      const text = play.querySelector(".mm-example-play-label");
      if (text) text.textContent = on ? t("nowPlaying") : t("listen");
    }
  }
}

function setMoodPlaying(groupId) {
  state.playing = groupId;
  if (stage) pushMoodPlayingToDom(groupId);
}

function toggleMoodAudio(groupId) {
  if (!MOOD_AUDIO[groupId]) return;
  const audio = ensureMoodAudio();
  if (state.playing === groupId) {
    audio.pause();
    setMoodPlaying(null);
    return;
  }
  audio.src = MOOD_AUDIO[groupId];
  audio.currentTime = 0;
  setMoodPlaying(groupId);
  const started = audio.play();
  if (started && typeof started.catch === "function") {
    started.catch(() => setMoodPlaying(null));
  }
}

function stopMoodAudio() {
  if (state.moodAudio) state.moodAudio.pause();
  state.playing = null;
  if (stage) pushMoodPlayingToDom(null);
}

function chatOptions() {
  return { musicReference: state.musicReference };
}

function resetForNewSession() {
  state.proposal = "";
  state.lyriaPrompt = "";
  state.judged = false;
  state.detected = null;
  state.mood = { group: null, emotion: null };
  state.musicReference = "auto";
  state.task = null;
  state.activeEntryId = null;
}

async function sendMessage() {
  const text = state.input.trim();
  const files = state.attachments;
  if ((!text && !files.length) || state.sending || state.thinking) return;
  state.sending = true;
  state.input = "";
  state.attachments = [];
  state.message = "";
  render();
  try {
    if (!state.session || state.session.status === "submitted") {
      const session = await api("/api/mood-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatOptions()),
      });
      state.session = session;
      state.currentId = session.id;
      resetForNewSession();
    }
    const sessionId = state.session.id;
    const attachmentIds = [];
    for (const item of files) {
      const updated = await api(
        `/api/mood-chats/${encodeURIComponent(sessionId)}/attachments?name=${encodeURIComponent(item.file.name)}`,
        { method: "POST", headers: { "Content-Type": item.file.type || "application/octet-stream" }, body: item.file },
      );
      state.session = updated;
      const attachment = updated.attachments?.at(-1);
      if (attachment) attachmentIds.push(attachment.id);
    }
    state.pending = { content: text, urls: files.map((item) => item.url) };
    state.thinking = true;
    render();
    const replied = await api(`/api/mood-chats/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, attachmentIds }),
    });
    state.session = replied;
    await loadDiscussions();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  } finally {
    for (const item of files) if (item.url) URL.revokeObjectURL(item.url);
    state.pending = null;
    state.thinking = false;
    state.sending = false;
    render();
  }
}

async function generateProposal() {
  const session = state.session;
  if (!session || state.busy) return;
  state.busy = true;
  state.message = "";
  render();
  try {
    const updated = await api(`/api/mood-chats/${encodeURIComponent(session.id)}/proposal`, { method: "POST" });
    state.session = updated;
    state.proposal = updated.proposal ?? "";
    if (state.proposal && !state.judged) await readFeelingFromPrompt(state.proposal);
    await loadDiscussions();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  } finally {
    state.busy = false;
    render();
  }
}

async function readFeelingFromPrompt(prompt) {
  try {
    const result = await api("/api/mood-entries/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt }),
    });
    if (result && result.group && result.emotion) {
      state.detected = { group: result.group, emotion: result.emotion };
      state.mood = { group: result.group, emotion: result.emotion };
    } else {
      state.detected = null;
    }
  } catch {
    state.detected = null;
  }
  state.judged = true;
}

async function approveAndCreate() {
  const session = state.session;
  const prompt = state.proposal.trim();
  const { group, emotion } = state.mood;
  if (!session || state.busy || !prompt || !group || !emotion) return;
  state.busy = true;
  state.message = "";
  state.lyriaPrompt = "";
  render();
  try {
    const entry = await rememberFeeling(group, emotion);
    const result = await api(`/api/mood-chats/${encodeURIComponent(session.id)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        mode: state.advanced.mode,
        lyriaModel: state.advanced.lyriaModel,
        vocalMode: state.advanced.vocalMode,
        musicReference: state.musicReference,
      }),
    });
    state.session = result.chat;
    state.task = result.task;
    state.activeEntryId = entry.id;
    await linkTask(entry.id, result.task.id);
    await loadDiscussions();
    state.busy = false;
    render();
    pollTask();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    state.busy = false;
    render();
  }
}

async function rememberFeeling(group, emotion) {
  const note = state.session?.messages?.find((message) => message.role === "user")?.content?.trim() ?? "";
  const existing = entryForSession(state.session?.id);
  if (existing) {
    const entry = await api(`/api/mood-entries/${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group, emotion, note }),
    });
    await loadEntries();
    return entry;
  }
  const entry = await api("/api/mood-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: todayISO(), group, emotion, note }),
  });
  await loadEntries();
  return entry;
}

async function linkTask(entryId, taskId) {
  if (!entryId || !taskId) return;
  try {
    await api(`/api/mood-entries/${encodeURIComponent(entryId)}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    await loadEntries();
  } catch {
    /* Best-effort linking. */
  }
}

async function retryAsNewAttempt(taskId) {
  const task = state.session?.tasks?.find((item) => item.id === taskId) ?? activeTask();
  const entry = entryForSession(state.session?.id);
  if (!task || state.busy) return;
  state.busy = true;
  state.message = "";
  state.lyriaPrompt = "";
  try {
    const created = await api("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: task.description,
        mode: task.mode,
        vocalMode: task.vocalMode,
        corpusMode: task.corpusMode,
        workflowType: task.workflowType,
        lyriaModel: task.lyriaModel,
      }),
    });
    if (entry) await linkTask(entry.id, created.id);
    state.task = created;
    state.busy = false;
    render();
    pollTask();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

async function approvePrompt() {
  const task = activeTask();
  if (!task || state.busy || task.status !== "planning") return;
  const prompt = state.lyriaPrompt.trim();
  state.busy = true;
  state.message = "";
  render();
  try {
    const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/prompt/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompt ? { prompt } : {}),
    });
    state.task = updated;
    state.lyriaPrompt = "";
    state.busy = false;
    render();
    pollTask();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

async function decideReview(decision) {
  const task = activeTask();
  if (!task || state.busy || task.status !== "review") return;
  state.busy = true;
  state.message = "";
  render();
  try {
    const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    state.task = updated;
    state.busy = false;
    render();
    if (decision === "regenerate") pollTask();
  } catch (error) {
    state.busy = false;
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

function pollTask() {
  clearTimeout(state.pollTimer);
  const id = activeTask()?.id;
  if (!id) return;
  const tick = async () => {
    try {
      const task = await api(`/api/tasks/${encodeURIComponent(id)}`);
      state.task = task;
      if (task.status === "completed" || task.status === "failed" || task.status === "review" || task.status === "planning") {
        await loadEntries();
        await loadDiscussions();
        render();
        // The journey follows the song: a kept song offers the album step.
        await loadJourney();
        return;
      }
      render();
    } catch {
      /* Transient; keep polling. */
    }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

// ---- journey ------------------------------------------------------------

const ACTIVE_JOURNEY_PHASES = ["song-running", "album-planning", "album-running"];

async function loadJourney() {
  const chatId = state.currentId;
  if (!chatId) return;
  try {
    const body = await api(`/api/journeys/${encodeURIComponent(chatId)}`);
    if (state.currentId !== chatId) return;
    state.journey = body.journey;
    state.albumTask = body.albumTask ?? null;
    if (body.songTask) state.task = body.songTask;
    render();
    if (ACTIVE_JOURNEY_PHASES.includes(body.journey.phase)) pollJourney(1200);
  } catch {
    // A conversation without a journey simply has nothing more to show.
    state.journey = null;
    state.albumTask = null;
  }
}

function pollJourney(delay = 1500, attempt = 0) {
  clearTimeout(state.journeyTimer);
  const chatId = state.currentId;
  if (!chatId) return;
  const tick = async () => {
    if (state.currentId !== chatId) return;
    try {
      const body = await api(`/api/journeys/${encodeURIComponent(chatId)}`);
      state.journey = body.journey;
      state.albumTask = body.albumTask ?? null;
      if (body.songTask) state.task = body.songTask;
      render();
      if (ACTIVE_JOURNEY_PHASES.includes(body.journey.phase)) {
        state.journeyTimer = setTimeout(tick, 2500);
      }
    } catch {
      if (attempt < 5) state.journeyTimer = setTimeout(() => pollJourney(2500, attempt + 1), 2500);
    }
  };
  state.journeyTimer = setTimeout(tick, delay);
}

async function continueAlbum() {
  const chatId = state.currentId;
  const theme = state.albumTheme.trim();
  if (!chatId || state.albumBusy) return;
  if (!theme) {
    state.message = t("albumNeedTheme");
    state.messageError = true;
    render();
    return;
  }
  state.albumBusy = true;
  state.message = "";
  render();
  try {
    const body = await api(`/api/journeys/${encodeURIComponent(chatId)}/continue-album`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme,
        candidateCount: state.albumCount,
        targetTotalMinutes: state.albumMinutes,
      }),
    });
    state.journey = body.journey;
    state.albumTask = body.albumTask ?? null;
    state.albumBusy = false;
    state.albumTheme = "";
    render();
    pollJourney(1000);
  } catch (error) {
    state.albumBusy = false;
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

async function retryJourney() {
  const chatId = state.currentId;
  if (!chatId) return;
  try {
    const body = await api(`/api/journeys/${encodeURIComponent(chatId)}/retry`, { method: "POST" });
    state.journey = body.journey;
    state.albumTask = body.albumTask ?? null;
    render();
    pollJourney(1200);
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

// ---------------------------------------------------------------------------

function newChat() {
  clearTimeout(state.pollTimer);
  clearTimeout(state.journeyTimer);
  stopMoodAudio();
  albumStage.stop();
  albumStage.reset();
  state.currentId = null;
  state.session = null;
  state.input = "";
  state.pending = null;
  state.thinking = false;
  state.message = "";
  state.journey = null;
  state.albumTask = null;
  state.albumTheme = "";
  resetForNewSession();
  history.replaceState(null, "", "/");
  render();
}

async function deleteChat(id) {
  const discussion = state.discussions.find((item) => item.id === id)
    ?? (state.session?.id === id ? state.session : null);
  const title = discussion ? sessionTitle(discussion) : "";
  if (!window.confirm(t("deleteChatConfirm", title))) return;
  try {
    await api(`/api/mood-chats/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (state.currentId === id) newChat();
    await loadDiscussions();
    render();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

async function openDiscussion(id) {
  clearTimeout(state.pollTimer);
  stopMoodAudio();
  let session = state.discussions.find((discussion) => discussion.id === id) ?? null;
  if (!session) {
    try {
      session = await api(`/api/mood-chats/${encodeURIComponent(id)}`);
    } catch {
      session = null;
    }
  }
  if (!session) {
    state.message = t("sessionGone");
    state.messageError = true;
    render();
    return;
  }
  state.currentId = id;
  state.session = session;
  state.input = "";
  state.message = "";
  state.task = sessionTasks(session).at(-1) ?? null;
  state.proposal = session.proposal ?? "";
  state.musicReference = session.musicReference ?? "auto";
  // Reset the journey view before restoring it for this conversation.
  clearTimeout(state.journeyTimer);
  state.journey = null;
  state.albumTask = null;
  state.albumTheme = "";
  albumStage.reset();
  const entry = entryForSession(id);
  state.activeEntryId = entry?.id ?? null;
  if (entry) {
    state.detected = { group: entry.group, emotion: entry.emotion };
    state.mood = { group: entry.group, emotion: entry.emotion };
    state.judged = true;
  } else {
    state.detected = null;
    state.mood = { group: null, emotion: null };
    state.judged = false;
  }
  history.replaceState(null, "", `/?chat=${encodeURIComponent(id)}`);
  render();
  if (state.task && state.task.status !== "completed" && state.task.status !== "failed") pollTask();
  // Restore the journey stage this conversation had reached, if any.
  if (session.status === "submitted") void loadJourney();
  // A conversation that has a prompt but is not submitted yet: read its feeling again.
  if (!entry && session.proposal && session.status !== "submitted") {
    await readFeelingFromPrompt(session.proposal);
    render();
  }
}

async function loadDiscussions() {
  try {
    const data = await api("/api/mood-chats");
    state.discussions = Array.isArray(data) ? data : [];
  } catch {
    /* Keep the previous list. */
  }
}

async function loadMusicTypes() {
  try {
    const capabilities = await api("/api/capabilities");
    const available = capabilities?.musicCorpus?.available;
    // Only types with validated collections are offered.
    state.musicTypes = Array.isArray(available) ? available : [];
  } catch {
    /* Keep the previous list. */
  }
}

async function loadEntries() {
  try {
    const data = await api("/api/mood-entries");
    state.entries = Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    /* Keep the previous list. */
  }
}

// ---------------------------------------------------------------------------

langToggle.addEventListener("click", async () => {
  state.language = state.language === "zh-CN" ? "en" : "zh-CN";
  render();
  await persistLanguage(state.language);
});

// Settings lives in the top bar so the API keys and the interface language are
// reachable without leaving the home page. Saving a different language redraws
// the page in it.
document.querySelector("#open-settings").addEventListener("click", () => {
  openSettingsDialog({
    language: state.language,
    onSaved: (settings) => {
      const next = settings?.language;
      if ((next === "en" || next === "zh-CN") && next !== state.language) {
        state.language = next;
        render();
      }
    },
  });
});

async function boot() {
  state.language = await readLanguage();
  state.sideCollapsed = readSidePreference();
  await Promise.all([loadDiscussions(), loadEntries(), loadMusicTypes()]);
  const params = new URLSearchParams(window.location.search);
  const chatId = params.get("chat");
  if (chatId) {
    await openDiscussion(chatId);
  } else {
    render();
  }
}

boot();
