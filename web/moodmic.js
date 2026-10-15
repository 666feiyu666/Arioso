// MoodMic — a chat-style workspace. Every creation is a conversation kept in the
// left rail; you describe a feeling in your own words, refine the direction in
// the thread, and one piece is made from it. The feeling is a colour read from
// the final prompt, and you can change it any time.
//
// The mood calendar lives on its own page (/calendar.html) and links back here
// to the conversation a day belongs to.

import {
  GROUPS, api, applyI18n, emotionLabel, esc, groupById, groupName,
  persistLanguage, readLanguage,
} from "./mood-common.js";

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
    tabMoodMic: "MoodMic", tabCalendar: "心情日历", tabWorkflow: "工作流", tabHelp: "帮助",
    tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    historyLabel: "对话记录",
    newChat: "新对话",
    historyEmpty: "还没有对话。",
    untitled: "新对话",
    greeting: "把此刻的心情变成音乐。",
    greetingLead: "用你自己的话写下此刻的心情和想要的音乐。",
    examplesLead: "不知道从哪写起？点一种心情，先起个头；点彩色的小圆点可以试听这一类的音乐。",
    playMood: (name) => `试听${name}情绪的音乐`,
    tapToPlay: "点圆点试听",
    nowPlaying: "正在播放",
    composerPlaceholder: "说说此刻的心情，和想要的音乐…",
    composerHint: "Enter 发送，Shift + Enter 换行",
    send: "发送",
    attachImage: "＋ 图片",
    removeImage: "移除图片",
    thinking: "正在回复…",
    directionReady: "这个方向合适吗？",
    directionReadyHint: "继续补充，或把目前的共识整理成最终提示词。",
    makePrompt: "使用当前方向",
    promptLabel: "作曲提示词",
    promptHint: "可编辑；确认后开始创作。",
    moodTitle: "你的心情",
    moodColorLabel: "颜色",
    moodWordLabel: "情绪词",
    moodJudged: (emotion) => `读出的心情是「${emotion}」。你可以改。`,
    moodEdited: (from, to) => `原本读出的心情是「${from}」，现在是「${to}」。`,
    moodManual: "选一个颜色和词。",
    moodNeedPick: "选一个心情颜色和词，再开始创作。",
    jazzExplain: "用我们的爵士参考合集来启发这段音乐。",
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
    creatingLead: "在声音成形的时候，可以稍等一会儿。",
    statusQueued: "排队中", statusComposing: "正在构思编曲", statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章", statusProcessing: "正在后期处理",
    statusCompleted: "已完成", statusFailed: "未完成",
    statusReview: "待你确认",
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
  },
  en: {
    pageTitle: "MoodMic · Music from your mood",
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar", tabWorkflow: "Workflow", tabHelp: "Help",
    tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    historyLabel: "Conversations",
    newChat: "New chat",
    historyEmpty: "No conversations yet.",
    untitled: "New chat",
    greeting: "Turn how you feel into music.",
    greetingLead: "Describe the feeling and the music you want in your own words.",
    examplesLead: "Not sure where to start? Pick a feeling to get you going — tap a coloured dot to hear that mood.",
    playMood: (name) => `Play the ${name} example`,
    tapToPlay: "Tap the dot to listen",
    nowPlaying: "Playing",
    composerPlaceholder: "Describe how you feel, and the music you want…",
    composerHint: "Enter to send, Shift + Enter for a new line",
    send: "Send",
    attachImage: "＋ Image",
    removeImage: "Remove image",
    thinking: "Replying…",
    directionReady: "Does this direction feel right?",
    directionReadyHint: "Keep adding, or turn the current agreement into a final prompt.",
    makePrompt: "Use this direction",
    promptLabel: "Composition prompt",
    promptHint: "Editable — confirm to begin.",
    moodTitle: "Your feeling",
    moodColorLabel: "Colour",
    moodWordLabel: "Emotion word",
    moodJudged: (emotion) => `The feeling reads as “${emotion}”. You can change it.`,
    moodEdited: (from, to) => `It read “${from}”; it is now “${to}”.`,
    moodManual: "Pick a colour and a word.",
    moodNeedPick: "Pick a feeling colour and word before creating.",
    jazzExplain: "Use our jazz reference collection to inspire your music.",
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
    creatingLead: "Stay for a moment while the sound takes shape.",
    statusQueued: "Queued", statusComposing: "Shaping the arrangement", statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements", statusProcessing: "Post-processing",
    statusCompleted: "Completed", statusFailed: "Not finished",
    statusReview: "Needs your confirmation",
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
  },
};

const STATUS_KEYS = {
  queued: "statusQueued", composing: "statusComposing", generating: "statusGenerating",
  review: "statusReview", assembling: "statusAssembling", processing: "statusProcessing",
  completed: "statusCompleted", failed: "statusFailed",
};

const side = document.querySelector("#mm-side");
const stage = document.querySelector("#mm-stage");
const langToggle = document.querySelector("#lang-toggle");

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  judged: false,
  detected: null,
  mood: { group: null, emotion: null },
  jazz: false,
  advanced: { mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" },
  entries: [],
  activeEntryId: null,
  task: null,
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

// ---------------------------------------------------------------------------

function render() {
  applyI18n(COPY, state.language);
  langToggle.textContent = state.language === "zh-CN" ? "EN" : "中文";
  renderSidebar();
  renderChat();
}

function renderSidebar() {
  // Keep the reader's place: re-rendering the list must not jump the sidebar.
  const previousScrollTop = side.scrollTop;
  side.innerHTML = `
    <button class="e-btn e-btn-secondary mm-new" type="button" id="mm-new">＋ ${esc(t("newChat"))}</button>
    ${state.discussions.length ? `<ul class="mm-side-list">${state.discussions.map((discussion) => {
      const meta = sideMeta(discussion);
      return `
      <li>
        <button class="mm-side-item${discussion.id === state.currentId ? " is-active" : ""}"
          type="button" data-open="${esc(discussion.id)}">
          <span class="mm-side-title">${esc(sessionTitle(discussion))}</span>
          ${meta ? `<span class="mm-side-meta">${esc(meta)}</span>` : ""}
        </button>
      </li>`;
    }).join("")}</ul>` : `<p class="e-hint mm-side-empty">${esc(t("historyEmpty"))}</p>`}
  `;
  side.querySelector("#mm-new").addEventListener("click", newChat);
  for (const button of side.querySelectorAll("[data-open]")) {
    button.addEventListener("click", () => openDiscussion(button.dataset.open));
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
      <svg class="mm-melody" viewBox="0 0 1000 220" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path class="mm-melody-path" aria-hidden="true"
          d="M0,110 C41.7,110 83.3,70 125,70 C208.3,70 291.7,150 375,150 C458.3,150 541.7,80 625,80 C708.3,80 791.7,150 875,150 C916.7,150 958.3,110 1000,110"
          fill="none" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />${dots}
      </svg>
      <p class="mm-examples-lead">${esc(t("examplesLead"))}</p>
      <div class="mm-examples-grid">
        ${GROUPS.map((group) => {
          const text = EXAMPLES[group.id]?.[key] ?? "";
          const playing = state.playing === group.id;
          return `
          <button class="mm-example${playing ? " is-playing" : ""}" type="button" data-example="${esc(text)}" data-example-group="${group.id}" style="--group:${group.color}">
            <span class="mm-example-mood"><span class="mm-example-swatch" aria-hidden="true"></span>${esc(groupName(group, state.language))}</span>
            <span class="mm-example-text">${esc(text)}</span>
            <span class="mm-example-state">${esc(playing ? t("nowPlaying") : t("tapToPlay"))}</span>
          </button>`;
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
  return `
    <div class="mm-words" role="group" aria-label="${esc(t("moodWordLabel"))}">
      ${group.emotions.map((emotion) => `
        <button class="mm-word" type="button" data-emotion="${emotion.id}"
          aria-pressed="${state.mood.emotion === emotion.id}"
          style="--group:${group.color}">${esc(state.language === "en" ? emotion.en : emotion.zh)}</button>
      `).join("")}
    </div>
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

function moodLabel() {
  return state.mood.group && state.mood.emotion
    ? emotionLabel(state.mood.group, state.mood.emotion, state.language) : "";
}

function detectedLabel() {
  return state.detected ? emotionLabel(state.detected.group, state.detected.emotion, state.language) : "";
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
      <div class="mm-proposal-head">
        <label for="mm-proposal-text"><strong>${esc(t("promptLabel"))}</strong></label>
        <span>${esc(t("promptHint"))}</span>
      </div>
      <textarea class="e-textarea" id="mm-proposal-text" maxlength="8000">${esc(state.proposal)}</textarea>
      <div class="mm-jazz${state.jazz ? " is-on" : ""}">
        <button class="mm-jazz-btn" type="button" id="mm-jazz" aria-pressed="${state.jazz}">why not jazz</button>
        <span class="mm-jazz-note">${esc(t("jazzExplain"))}</span>
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
      ${!moodReady ? `<p class="e-hint">${esc(t("moodNeedPick"))}</p>` : ""}
    </div>
  `;
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
  `;
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
  stage.querySelector("#mm-jazz")?.addEventListener("click", () => { state.jazz = !state.jazz; render(); });
  const proposalText = stage.querySelector("#mm-proposal-text");
  proposalText?.addEventListener("input", () => { state.proposal = proposalText.value; });
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
  stage.querySelector("#mm-retry")?.addEventListener("click", () => retryAsNewAttempt(state.session?.tasks?.at(-1)?.id));
  stage.querySelector("#mm-new-2")?.addEventListener("click", newChat);
  stage.querySelector("#mm-review-regenerate")?.addEventListener("click", () => decideReview("regenerate"));
  stage.querySelector("#mm-review-keep")?.addEventListener("click", () => decideReview("keep"));
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
    card.addEventListener("focus", () => setActive(true));
    card.addEventListener("blur", () => setActive(false));
  }
  // Each melody point plays its mood's example; only one plays at a time.
  for (const point of stage.querySelectorAll(".mm-melody-point")) {
    const groupId = point.dataset.point;
    point.addEventListener("click", () => toggleMoodAudio(groupId));
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMoodAudio(groupId);
      }
    });
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
  state.moodAudio = audio;
  return audio;
}

// Reflect the playing mood on the melody points and cards without re-rendering,
// so the curve keeps its entrance instead of replaying it on every toggle.
function pushMoodPlayingToDom(groupId) {
  for (const point of stage.querySelectorAll(".mm-melody-point")) {
    const on = point.dataset.point === groupId;
    point.classList.toggle("is-playing", on);
    point.setAttribute("aria-pressed", on ? "true" : "false");
  }
  for (const card of stage.querySelectorAll("[data-example-group]")) {
    const on = card.dataset.exampleGroup === groupId;
    card.classList.toggle("is-playing", on);
    const stateEl = card.querySelector(".mm-example-state");
    if (stateEl) stateEl.textContent = on ? t("nowPlaying") : t("tapToPlay");
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
  return { jazz: state.jazz };
}

function resetForNewSession() {
  state.proposal = "";
  state.judged = false;
  state.detected = null;
  state.mood = { group: null, emotion: null };
  state.jazz = false;
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
        corpusMode: state.jazz ? "jazz" : "none",
        workflowType: state.jazz ? "02-jazz" : "01-general",
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
      if (task.status === "completed" || task.status === "failed" || task.status === "review") {
        await loadEntries();
        await loadDiscussions();
        render();
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

// ---------------------------------------------------------------------------

function newChat() {
  clearTimeout(state.pollTimer);
  stopMoodAudio();
  state.currentId = null;
  state.session = null;
  state.input = "";
  state.pending = null;
  state.thinking = false;
  state.message = "";
  resetForNewSession();
  history.replaceState(null, "", "/");
  render();
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

async function boot() {
  state.language = await readLanguage();
  await Promise.all([loadDiscussions(), loadEntries()]);
  const params = new URLSearchParams(window.location.search);
  const chatId = params.get("chat");
  if (chatId) {
    await openDiscussion(chatId);
  } else {
    render();
  }
}

boot();
