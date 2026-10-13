// MoodMic — a personal place to record how you feel and turn one feeling into
// one piece of music. It reuses the existing Arioso backend (creative discussion
// and composition tasks) without adding new music-generation capabilities.

// ---------------------------------------------------------------------------
// Feeling language
//
// Four colour groups arranged by energy (higher above) and pleasantness
// (unpleasant left of pleasant). Colour is always paired with a text label.

const GROUPS = [
  {
    id: "coral", color: "#E87575",
    energy: "high", pleasant: false,
    meaning: { zh: "高能量 · 不愉快", en: "High energy · unpleasant" },
    emotions: [
      { id: "anxious", zh: "焦虑", en: "Anxious" },
      { id: "angry", zh: "愤怒", en: "Angry" },
      { id: "frustrated", zh: "烦闷", en: "Frustrated" },
      { id: "overwhelmed", zh: "不堪重负", en: "Overwhelmed" },
    ],
  },
  {
    id: "gold", color: "#E9BD46",
    energy: "high", pleasant: true,
    meaning: { zh: "高能量 · 愉快", en: "High energy · pleasant" },
    emotions: [
      { id: "excited", zh: "兴奋", en: "Excited" },
      { id: "joyful", zh: "喜悦", en: "Joyful" },
      { id: "energised", zh: "充满活力", en: "Energised" },
      { id: "enthusiastic", zh: "热情", en: "Enthusiastic" },
    ],
  },
  {
    id: "blue", color: "#779DD6",
    energy: "low", pleasant: false,
    meaning: { zh: "低能量 · 不愉快", en: "Low energy · unpleasant" },
    emotions: [
      { id: "sad", zh: "难过", en: "Sad" },
      { id: "lonely", zh: "孤单", en: "Lonely" },
      { id: "drained", zh: "疲惫", en: "Drained" },
      { id: "discouraged", zh: "气馁", en: "Discouraged" },
    ],
  },
  {
    id: "sage", color: "#83B59A",
    energy: "low", pleasant: true,
    meaning: { zh: "低能量 · 愉快", en: "Low energy · pleasant" },
    emotions: [
      { id: "calm", zh: "平静", en: "Calm" },
      { id: "content", zh: "满足", en: "Content" },
      { id: "relaxed", zh: "放松", en: "Relaxed" },
      { id: "peaceful", zh: "安宁", en: "Peaceful" },
    ],
  },
];

function groupById(id) {
  return GROUPS.find((group) => group.id === id) ?? GROUPS[0];
}

function emotionLabel(groupId, emotionId) {
  const emotion = groupById(groupId).emotions.find((item) => item.id === emotionId);
  if (!emotion) return emotionId;
  return state.language === "en" ? emotion.en : emotion.zh;
}

// ---------------------------------------------------------------------------

const COPY = {
  "zh-CN": {
    pageTitle: "MoodMic · 把心情变成音乐",
    tabMoodMic: "MoodMic", tabWorkflow: "工作流", tabHelp: "帮助", tabBarLabel: "主导航",
    switchLanguage: "切换界面语言",
    greeting: "现在感觉怎么样？",
    greetingLead: "选一个最贴近此刻的颜色和词。不用懂音乐，先把心情放下来。",
    moodGroupLabel: "选择一组心情色彩",
    moodWordLabel: "选一个词",
    noteLabel: "想补充点什么吗？（可选）",
    notePlaceholder: "例如：今天有点累，但又很平静……",
    musicFeelingLabel: "希望音乐是什么感觉？（可选）",
    musicFeelingPlaceholder: "例如：像雨后的黄昏，安静、温柔，有一点余温。",
    save: "保存这条心情",
    saveAndCreate: "保存并创作音乐",
    saved: "已记录。",
    calendarTitle: "我的心情日历",
    calendarLead: "每一天的圆点由当天的记录组成，颜色顺序就是记录的顺序。",
    legendTitle: "四种颜色的含义",
    prevMonth: "上个月",
    nextMonth: "下个月",
    today: "今天",
    emptyDay: "这一天还没有记录。",
    daySummary: (count) => `${count} 条心情记录`,
    daySummaryMusic: (count) => `${count} 条记录 · 有可播放的音乐`,
    dayDetail: "这一天的记录",
    addFeeling: "添加一条心情",
    retrospective: "补记",
    createFromFeeling: "用这个心情创作音乐",
    noMusicYet: "还没有音乐",
    musicNote: "有可播放的音乐",
    historyTitle: "我的音乐",
    historyLead: "从心情出发创作的每一首，都保留在这里。",
    historyEmpty: "还没有作品。记录一条心情，然后把它变成音乐吧。",
    shapeTitle: "塑造你的声音。",
    shapeLead: "你想让这段音乐成为什么样？可以多聊聊，也可以直接开始。",
    summaryTitle: "这次创作",
    summaryFeeling: "你的心情",
    summaryMusic: "音乐的感觉",
    summaryFormat: "形式",
    summaryFormatValue: "一首单曲",
    summaryJazzOn: "爵士灵感",
    summaryJazzOff: "无参考语料",
    noteEditHint: "可以随时修改，不会丢失。",
    director: "创作讨论",
    directorHint: "想到什么就说什么",
    replyPlaceholder: "补充你的想法：想要的乐器、节奏、画面，或者不想要的东西……",
    send: "发送",
    thinking: "正在理解你的心情…",
    directionReady: "这个方向合适吗？",
    directionReadyHint: "继续补充，或把目前的共识整理成最终提示词。",
    makePrompt: "使用当前方向",
    promptLabel: "作曲提示词",
    promptHint: "可编辑；确认后就可以开始创作。",
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
    whyNotJazz: "why not jazz",
    jazzOn: "已启用爵士灵感。",
    jazzExplain: "使用我们的爵士参考合集来启发这段音乐。",
    jazzTurnOff: "关闭爵士灵感",
    startCreating: "开始创作",
    back: "返回",
    creatingTitle: "正在创作你的音乐。",
    creatingLead: "在声音成形的时候，可以稍等一会儿。",
    statusQueued: "排队中",
    statusComposing: "正在构思编曲",
    statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章",
    statusProcessing: "正在后期处理",
    statusCompleted: "已完成",
    statusFailed: "未完成",
    phaseComposing: "Arioso 正在把你的心情整理成完整的音乐规格…",
    phaseGenerating: "正在把这段编曲变成声音…",
    phaseProcessing: "正在做最后的整理与导出…",
    phaseWaiting: "正在准备…",
    listenTitle: "你的音乐。",
    listenLead: "戴上耳机，听听看。",
    download: "下载音频",
    tryAgain: "再试一次",
    createAnother: "再做一首",
    failedTitle: "这一次没有完成",
    failedLead: "生成服务可能暂时不可用。你可以再试一次，之前的记录会保留。",
    errorGeneric: "出了点问题，请再试一次。",
    loading: "正在准备…",
    entryNoLonger: "这条心情记录已经不存在了。",
  },
  en: {
    pageTitle: "MoodMic · Music from your mood",
    tabMoodMic: "MoodMic", tabWorkflow: "Workflow", tabHelp: "Help", tabBarLabel: "Tab navigation",
    switchLanguage: "Switch interface language",
    greeting: "How are you feeling?",
    greetingLead: "Pick the colour and the word closest to right now. No musical training needed — just set the feeling down first.",
    moodGroupLabel: "Choose a feeling colour",
    moodWordLabel: "Choose a word",
    noteLabel: "Anything to add? (optional)",
    notePlaceholder: "e.g. Tired today, but calm…",
    musicFeelingLabel: "How should the music feel? (optional)",
    musicFeelingPlaceholder: "e.g. Like dusk after rain — quiet, tender, still a little warm.",
    save: "Save this feeling",
    saveAndCreate: "Save & create music",
    saved: "Recorded.",
    calendarTitle: "My mood calendar",
    calendarLead: "Each day's circle is made of that day's check-ins, in the order you recorded them.",
    legendTitle: "What the four colours mean",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    today: "Today",
    emptyDay: "No check-in on this day yet.",
    daySummary: (count) => `${count} check-in${count === 1 ? "" : "s"}`,
    daySummaryMusic: (count) => `${count} check-in${count === 1 ? "" : "s"} · music to play`,
    dayDetail: "This day's check-ins",
    addFeeling: "Add a feeling",
    retrospective: "Recorded later",
    createFromFeeling: "Create music from this feeling",
    noMusicYet: "No music yet",
    musicNote: "Music to play",
    historyTitle: "My music",
    historyLead: "Everything you have made from a feeling, kept here.",
    historyEmpty: "Nothing yet. Record a feeling, then turn it into music.",
    shapeTitle: "Shape your sound.",
    shapeLead: "What should this music become? Talk it through, or just begin.",
    summaryTitle: "This creation",
    summaryFeeling: "Your feeling",
    summaryMusic: "Feeling of the music",
    summaryFormat: "Form",
    summaryFormatValue: "One piece",
    summaryJazzOn: "Jazz inspiration",
    summaryJazzOff: "No reference corpus",
    noteEditHint: "Change anything — nothing is lost.",
    director: "Creative discussion",
    directorHint: "Say whatever comes to mind",
    replyPlaceholder: "Add your thoughts: instruments, tempo, imagery — or what you don't want…",
    send: "Send",
    thinking: "Reading your mood…",
    directionReady: "Does this direction feel right?",
    directionReadyHint: "Keep adding, or turn the current agreement into a final prompt.",
    makePrompt: "Use this direction",
    promptLabel: "Composition prompt",
    promptHint: "Editable — confirm to begin.",
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
    whyNotJazz: "why not jazz",
    jazzOn: "Jazz inspiration on.",
    jazzExplain: "Use our jazz reference collection to inspire your music.",
    jazzTurnOff: "Turn off jazz inspiration",
    startCreating: "Start creating",
    back: "Back",
    creatingTitle: "Creating your music.",
    creatingLead: "Stay for a moment while the sound takes shape.",
    statusQueued: "Queued",
    statusComposing: "Shaping the arrangement",
    statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements",
    statusProcessing: "Post-processing",
    statusCompleted: "Completed",
    statusFailed: "Not finished",
    phaseComposing: "Arioso is shaping your mood into a complete musical spec…",
    phaseGenerating: "Turning that arrangement into sound…",
    phaseProcessing: "Doing the final assembly and export…",
    phaseWaiting: "Getting ready…",
    listenTitle: "Your music.",
    listenLead: "Put on your headphones and have a listen.",
    download: "Download audio",
    tryAgain: "Try again",
    createAnother: "Create another",
    failedTitle: "This run didn't finish",
    failedLead: "The generation service may be temporarily unavailable. Try again — your earlier records stay.",
    errorGeneric: "Something went wrong. Please try again.",
    loading: "Getting ready…",
    entryNoLonger: "That feeling is no longer available.",
  },
};

const WEEKDAYS = {
  "zh-CN": ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const stage = document.querySelector("#mm-stage");
const langToggle = document.querySelector("#lang-toggle");

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

const state = {
  view: "home",
  language: "zh-CN",
  entries: [],
  entriesLoaded: false,
  month: null, // { year, month } (month 1-12)
  selectedDate: null,
  draft: {
    group: null,
    emotion: null,
    note: "",
    musicFeeling: "",
    date: todayISO(),
    retrospective: false,
  },
  activeEntryId: null,
  session: null,
  pending: null,
  thinking: false,
  replyDraft: "",
  proposal: "",
  jazz: false,
  advanced: { mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" },
  task: null,
  pollTimer: null,
  busy: false,
  saving: false,
  message: "",
  messageError: false,
};

function t(key, ...args) {
  const value = (COPY[state.language] ?? COPY["zh-CN"])[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(status) {
  const map = {
    queued: "statusQueued",
    composing: "statusComposing",
    generating: "statusGenerating",
    assembling: "statusAssembling",
    processing: "statusProcessing",
    completed: "statusCompleted",
    failed: "statusFailed",
  };
  return t(map[status] ?? "statusQueued");
}

async function api(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new Error((data && data.error) || t("errorGeneric"));
  }
  return data;
}

function activeEntry() {
  return state.entries.find((entry) => entry.id === state.activeEntryId) ?? null;
}

// Entries for one calendar day, oldest first (record order, clockwise on the marker).
function entriesOn(date) {
  return state.entries
    .filter((entry) => entry.date === date)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function playableTasks(entry) {
  return (entry.tasks ?? []);
}

function entryHasMusic(entry) {
  return playableTasks(entry).some((task) => task.status === "completed");
}

// ---------------------------------------------------------------------------
// Rendering

function render() {
  document.documentElement.lang = state.language;
  langToggle.textContent = state.language === "zh-CN" ? "EN" : "中文";
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const value = (COPY[state.language] ?? COPY["zh-CN"])[node.dataset.i18n];
    if (typeof value === "string") node.textContent = value;
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    const value = (COPY[state.language] ?? COPY["zh-CN"])[node.dataset.i18nAriaLabel];
    if (typeof value === "string") node.setAttribute("aria-label", value);
  }
  document.title = t("pageTitle");
  const renderers = {
    home: renderHome,
    date: renderDate,
    shape: renderShape,
    creating: renderCreating,
    listen: renderListen,
  };
  (renderers[state.view] ?? renderHome)();
}

function setStage(html) {
  stage.innerHTML = html;
}

function messageLine() {
  if (!state.message) return "";
  return `<p class="e-message${state.messageError ? " error" : ""}">${esc(state.message)}</p>`;
}

function mainHead(title, lead) {
  return `
    <div class="mm-hero">
      <h2 class="mm-title">${esc(title)}</h2>
      ${lead ? `<p class="mm-lead">${esc(lead)}</p>` : ""}
    </div>
  `;
}

// Marker background for one calendar day: solid for a single check-in, or equal
// colour segments in chronological order, clockwise from the top.
function markerStyle(list) {
  const colors = list.map((entry) => groupById(entry.group).color);
  if (colors.length <= 1) return `background:${colors[0] ?? "transparent"}`;
  const n = colors.length;
  const stops = colors
    .map((color, index) => `${color} ${((index * 360) / n).toFixed(3)}deg ${(((index + 1) * 360) / n).toFixed(3)}deg`)
    .join(", ");
  return `background: conic-gradient(from 0deg, ${stops})`;
}

function dayCellStyle(list) {
  if (!list.length) return "";
  return `style="${markerStyle(list)}"`;
}

// ---------------------------------------------------------------------------
// Home: feeling picker + calendar + history

function renderGroupPicker() {
  return `
    <div class="mm-groups" role="group" aria-label="${esc(t("moodGroupLabel"))}">
      ${GROUPS.map((group) => {
        const selected = state.draft.group === group.id;
        return `
          <button class="mm-group" type="button" data-group="${group.id}"
            aria-pressed="${selected}" style="--group:${group.color}">
            <span class="mm-group-swatch" aria-hidden="true"></span>
            <span class="mm-group-meaning">${esc(state.language === "en" ? group.meaning.en : group.meaning.zh)}</span>
          </button>`;
      }).join("")}
    </div>
  `;
}

function renderWordPicker() {
  const group = state.draft.group ? groupById(state.draft.group) : null;
  if (!group) return "";
  return `
    <div class="mm-words" role="group" aria-label="${esc(t("moodWordLabel"))}">
      ${group.emotions.map((emotion) => `
        <button class="mm-word" type="button" data-emotion="${emotion.id}"
          aria-pressed="${state.draft.emotion === emotion.id}"
          style="--group:${group.color}">${esc(state.language === "en" ? emotion.en : emotion.zh)}</button>
      `).join("")}
    </div>
  `;
}

function renderFeelingForm() {
  const canSave = Boolean(state.draft.group && state.draft.emotion);
  return `
    <div class="mm-card mm-feel">
      ${renderGroupPicker()}
      ${renderWordPicker()}
      <label class="e-field">
        <span>${esc(t("noteLabel"))}</span>
        <textarea class="e-textarea" id="mm-note" maxlength="2000"
          placeholder="${esc(t("notePlaceholder"))}">${esc(state.draft.note)}</textarea>
      </label>
      <label class="e-field">
        <span>${esc(t("musicFeelingLabel"))}</span>
        <textarea class="e-textarea" id="mm-music-feeling" maxlength="2000"
          placeholder="${esc(t("musicFeelingPlaceholder"))}">${esc(state.draft.musicFeeling)}</textarea>
      </label>
      ${messageLine()}
      <div class="mm-actions">
        <button class="e-btn e-btn-secondary" type="button" id="mm-save" ${canSave && !state.saving ? "" : "disabled"}>${esc(t("save"))}</button>
        <button class="e-btn e-btn-primary" type="button" id="mm-save-create" ${canSave && !state.saving ? "" : "disabled"}>${esc(t("saveAndCreate"))} →</button>
      </div>
    </div>
  `;
}

function bindFeelingForm(onSaved) {
  const note = stage.querySelector("#mm-note");
  note?.addEventListener("input", () => { state.draft.note = note.value; });
  const musicFeeling = stage.querySelector("#mm-music-feeling");
  musicFeeling?.addEventListener("input", () => { state.draft.musicFeeling = musicFeeling.value; });

  for (const button of stage.querySelectorAll("[data-group]")) {
    button.addEventListener("click", () => {
      const groupId = button.dataset.group;
      if (state.draft.group === groupId) return;
      state.draft.group = groupId;
      state.draft.emotion = null;
      state.message = "";
      render();
    });
  }
  for (const button of stage.querySelectorAll("[data-emotion]")) {
    button.addEventListener("click", () => {
      state.draft.emotion = button.dataset.emotion;
      for (const other of stage.querySelectorAll("[data-emotion]")) {
        other.setAttribute("aria-pressed", state.draft.emotion === other.dataset.emotion ? "true" : "false");
      }
      stage.querySelector("#mm-save")?.removeAttribute("disabled");
      stage.querySelector("#mm-save-create")?.removeAttribute("disabled");
    });
  }

  stage.querySelector("#mm-save")?.addEventListener("click", () => saveFeeling(false, onSaved));
  stage.querySelector("#mm-save-create")?.addEventListener("click", () => saveFeeling(true, onSaved));
}

function renderCalendar() {
  const { year, month } = state.month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first
  const today = todayISO();
  const monthLabel = state.language === "en"
    ? new Date(year, month - 1, 1).toLocaleString("en", { month: "long", year: "numeric" })
    : `${year} 年 ${month} 月`;

  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<li class="mm-day is-blank" aria-hidden="true"></li>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const list = entriesOn(iso);
    const isToday = iso === today;
    const hasMusic = list.some(entryHasMusic);
    const summary = list.length
      ? (hasMusic ? t("daySummaryMusic", list.length) : t("daySummary", list.length))
      : t("emptyDay");
    const timeSummary = list
      .map((entry) => `${emotionLabel(entry.group, entry.emotion)}`)
      .join(" · ");
    const label = list.length
      ? `${monthLabel} ${day} — ${timeSummary}. ${summary}`
      : `${monthLabel} ${day} — ${summary}`;
    cells.push(`
      <li class="mm-day${list.length ? " has-entry" : ""}${isToday ? " is-today" : ""}">
        <button class="mm-day-btn" type="button" data-date="${iso}"
          aria-label="${esc(label)}" aria-pressed="${state.selectedDate === iso ? "true" : "false"}"
          title="${esc(label)}">
          <span class="mm-day-number">${day}</span>
          ${list.length ? `<span class="mm-marker" ${dayCellStyle(list)}></span>
            <span class="mm-day-count">${list.length}</span>` : ""}
          ${hasMusic ? `<span class="mm-day-note" aria-hidden="true">♪</span>` : ""}
        </button>
      </li>
    `);
  }

  return `
    <section class="mm-calendar" aria-labelledby="mm-calendar-title">
      <div class="mm-calendar-head">
        <div>
          <h3 id="mm-calendar-title">${esc(t("calendarTitle"))}</h3>
          <p class="e-hint">${esc(t("calendarLead"))}</p>
        </div>
        <div class="mm-month-nav">
          <button class="e-btn e-btn-ghost" type="button" id="mm-prev" aria-label="${esc(t("prevMonth"))}">‹</button>
          <span class="mm-month-label">${esc(monthLabel)}</span>
          <button class="e-btn e-btn-ghost" type="button" id="mm-next" aria-label="${esc(t("nextMonth"))}">›</button>
        </div>
      </div>
      <ol class="mm-weekdays" aria-hidden="true">
        ${WEEKDAYS[state.language].map((name) => `<li>${esc(name)}</li>`).join("")}
      </ol>
      <ol class="mm-days">
        ${cells.join("")}
      </ol>
      <ul class="mm-legend" aria-label="${esc(t("legendTitle"))}">
        ${GROUPS.map((group) => `
          <li><span class="mm-legend-swatch" style="background:${group.color}" aria-hidden="true"></span>
            <span>${esc(state.language === "en" ? group.meaning.en : group.meaning.zh)}</span></li>
        `).join("")}
      </ul>
      ${state.selectedDate ? renderDayPeek(state.selectedDate) : ""}
    </section>
  `;
}

function renderDayPeek(date) {
  const list = entriesOn(date);
  const isPast = date < todayISO();
  const label = state.language === "en"
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${dateParts(date).year} 年 ${dateParts(date).month} 月 ${dateParts(date).day} 日`;
  return `
    <div class="mm-peek" id="mm-peek">
      <div class="mm-peek-head">
        <strong>${esc(label)}</strong>
        <button class="e-btn e-btn-ghost" type="button" id="mm-peek-open">${esc(t("dayDetail"))} →</button>
      </div>
      ${list.length
        ? `<ul class="mm-peek-list">${list.map((entry) => `
            <li><span class="mm-dot" style="background:${groupById(entry.group).color}"></span>
              <span>${esc(emotionLabel(entry.group, entry.emotion))}</span></li>
          `).join("")}</ul>`
        : `<p class="e-hint">${esc(t("emptyDay"))}</p>`}
      ${!list.length && isPast ? `<button class="e-btn e-btn-secondary" type="button" id="mm-peek-add">${esc(t("addFeeling"))}</button>` : ""}
    </div>
  `;
}

function taskSummaryLine(task) {
  const when = new Date(task.createdAt).toLocaleString(state.language === "en" ? "en" : "zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return `${when} · ${statusLabel(task.status)}`;
}

function renderHistory() {
  const rows = state.entries
    .flatMap((entry) => playableTasks(entry).map((task) => ({ entry, task })))
    .sort((a, b) => b.task.createdAt.localeCompare(a.task.createdAt));
  return `
    <section class="mm-history" aria-labelledby="mm-history-title">
      <h3 id="mm-history-title">${esc(t("historyTitle"))}</h3>
      <p class="e-hint">${esc(t("historyLead"))}</p>
      ${rows.length ? `<ul class="mm-history-list">${rows.map(({ entry, task }) => `
        <li class="mm-history-item">
          <span class="mm-dot" style="background:${groupById(entry.group).color}" title="${esc(emotionLabel(entry.group, entry.emotion))}"></span>
          <div class="mm-history-body">
            <span class="mm-history-title">${esc(task.title || emotionLabel(entry.group, entry.emotion))}</span>
            <span class="mm-history-meta">${esc(emotionLabel(entry.group, entry.emotion))} · ${esc(taskSummaryLine(task))}</span>
          </div>
          ${task.status === "completed"
            ? `<button class="e-btn e-btn-ghost" type="button" data-play="${esc(task.id)}">▶</button>`
            : `<span class="mm-history-state">${esc(statusLabel(task.status))}</span>`}
          ${task.status === "failed"
            ? `<button class="e-btn e-btn-ghost" type="button" data-retry="${esc(task.id)}">${esc(t("tryAgain"))}</button>`
            : ""}
        </li>
      `).join("")}</ul>` : `<p class="e-hint">${esc(t("historyEmpty"))}</p>`}
      <audio class="mm-player" controls preload="none" id="mm-history-audio"></audio>
    </section>
  `;
}

function renderHome() {
  if (!state.entriesLoaded) {
    setStage(`${mainHead(t("greeting"), t("greetingLead"))}<div class="mm-card"><p class="e-hint">${esc(t("loading"))}</p></div>`);
    return;
  }
  setStage(`
    ${mainHead(t("greeting"), t("greetingLead"))}
    ${renderFeelingForm()}
    ${renderCalendar()}
    ${renderHistory()}
  `);

  bindFeelingForm(() => render());

  stage.querySelector("#mm-prev")?.addEventListener("click", () => shiftMonth(-1));
  stage.querySelector("#mm-next")?.addEventListener("click", () => shiftMonth(1));
  for (const button of stage.querySelectorAll("[data-date]")) {
    button.addEventListener("click", () => {
      state.selectedDate = button.dataset.date;
      render();
    });
  }
  stage.querySelector("#mm-peek-open")?.addEventListener("click", () => openDate(state.selectedDate));
  stage.querySelector("#mm-peek-add")?.addEventListener("click", () => openDate(state.selectedDate));
  bindHistory();
}

function bindHistory() {
  const audio = stage.querySelector("#mm-history-audio");
  for (const button of stage.querySelectorAll("[data-play]")) {
    button.addEventListener("click", () => {
      if (!audio) return;
      audio.src = `/api/tasks/${encodeURIComponent(button.dataset.play)}/audio`;
      audio.play().catch(() => {});
    });
  }
  for (const button of stage.querySelectorAll("[data-retry]")) {
    button.addEventListener("click", () => retryAsNewAttempt(button.dataset.retry));
  }
}

function shiftMonth(delta) {
  let { year, month } = state.month;
  month += delta;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  state.month = { year, month };
  render();
}

function openDate(date) {
  state.selectedDate = date;
  state.draft = {
    group: null, emotion: null, note: "", musicFeeling: "",
    date, retrospective: date < todayISO(),
  };
  state.message = "";
  state.view = "date";
  render();
}

// ---------------------------------------------------------------------------
// Date detail

function renderDate() {
  const date = state.selectedDate ?? todayISO();
  const list = entriesOn(date);
  const { year, month, day } = dateParts(date);
  const label = state.language === "en"
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${year} 年 ${month} 月 ${day} 日`;

  setStage(`
    <div class="mm-hero">
      <button class="e-btn e-btn-ghost mm-back" type="button" id="mm-back">← ${esc(t("back"))}</button>
      <h2 class="mm-title">${esc(label)}</h2>
      <p class="mm-lead">${esc(list.length ? t("dayDetail") : t("emptyDay"))}</p>
    </div>
    ${list.map(renderEntryCard).join("")}
    <div class="mm-card mm-feel">
      <h3>${esc(t("addFeeling"))}</h3>
      ${renderGroupPicker()}
      ${renderWordPicker()}
      <label class="e-field">
        <span>${esc(t("noteLabel"))}</span>
        <textarea class="e-textarea" id="mm-note" maxlength="2000"
          placeholder="${esc(t("notePlaceholder"))}">${esc(state.draft.note)}</textarea>
      </label>
      <label class="e-field">
        <span>${esc(t("musicFeelingLabel"))}</span>
        <textarea class="e-textarea" id="mm-music-feeling" maxlength="2000"
          placeholder="${esc(t("musicFeelingPlaceholder"))}">${esc(state.draft.musicFeeling)}</textarea>
      </label>
      ${messageLine()}
      <div class="mm-actions">
        <button class="e-btn e-btn-primary" type="button" id="mm-save" ${state.draft.group && state.draft.emotion && !state.saving ? "" : "disabled"}>${esc(t("save"))}</button>
      </div>
    </div>
  `);

  stage.querySelector("#mm-back").addEventListener("click", backHome);
  bindFeelingForm(() => { state.view = "date"; render(); });
  for (const button of stage.querySelectorAll("[data-create-from]")) {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.createFrom);
      if (entry) startCreate(entry);
    });
  }
  for (const button of stage.querySelectorAll("[data-create-any]")) {
    button.addEventListener("click", () => {
      const entry = entriesOn(date)[0];
      if (entry) startCreate(entry);
    });
  }
  for (const button of stage.querySelectorAll("[data-play]")) {
    button.addEventListener("click", () => {
      const audio = stage.querySelector(`#audio-${CSS.escape(button.dataset.play)}`);
      if (audio) { audio.play().catch(() => {}); }
    });
  }
  for (const button of stage.querySelectorAll("[data-retry]")) {
    button.addEventListener("click", () => retryAsNewAttempt(button.dataset.retry));
  }
}

function renderEntryCard(entry) {
  const group = groupById(entry.group);
  const time = new Date(entry.createdAt).toLocaleTimeString(
    state.language === "en" ? "en" : "zh-CN", { hour: "2-digit", minute: "2-digit" },
  );
  const tasks = playableTasks(entry);
  return `
    <article class="mm-card mm-entry" style="--group:${group.color}">
      <header class="mm-entry-head">
        <span class="mm-dot" style="background:${group.color}"></span>
        <strong>${esc(emotionLabel(entry.group, entry.emotion))}</strong>
        <span class="mm-entry-time">${esc(time)}</span>
        ${entry.retrospective ? `<span class="mm-tag">${esc(t("retrospective"))}</span>` : ""}
      </header>
      ${entry.note ? `<p class="mm-entry-note">${esc(entry.note)}</p>` : ""}
      ${entry.musicFeeling ? `<p class="mm-entry-music"><span>${esc(t("summaryMusic"))}</span> ${esc(entry.musicFeeling)}</p>` : ""}
      <div class="mm-entry-music-list">
        ${tasks.length ? tasks.map((task) => {
          const ready = task.status === "completed";
          return `<div class="mm-entry-task">
            <span class="mm-entry-task-title">${esc(task.title || emotionLabel(entry.group, entry.emotion))}</span>
            <span class="mm-entry-task-status">${esc(statusLabel(task.status))}</span>
            ${ready
              ? `<audio id="audio-${esc(task.id)}" class="mm-mini-player" controls preload="none"
                   src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
                 <a class="e-btn e-btn-ghost" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>`
              : task.status === "failed"
                ? `<button class="e-btn e-btn-ghost" type="button" data-retry="${esc(task.id)}">${esc(t("tryAgain"))}</button>`
                : ""}
          </div>`;
        }).join("") : `<span class="e-hint">${esc(t("noMusicYet"))}</span>`}
      </div>
      <div class="mm-entry-actions">
        <button class="e-btn e-btn-secondary" type="button" data-create-from="${esc(entry.id)}">${esc(t("createFromFeeling"))} →</button>
      </div>
    </article>
  `;
}

function backHome() {
  state.view = "home";
  state.message = "";
  state.selectedDate = null;
  render();
  loadEntries().catch(() => {});
}

// ---------------------------------------------------------------------------
// Saving a feeling

async function saveFeeling(createAfter, onSaved) {
  if (state.saving || !state.draft.group || !state.draft.emotion) return;
  state.saving = true;
  state.message = "";
  onSaved?.();
  try {
    const entry = await api("/api/mood-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: state.draft.date,
        group: state.draft.group,
        emotion: state.draft.emotion,
        note: state.draft.note,
        musicFeeling: state.draft.musicFeeling,
        retrospective: state.draft.retrospective,
      }),
    });
    await loadEntries();
    state.draft = {
      group: null, emotion: null, note: "", musicFeeling: "",
      date: state.draft.date, retrospective: state.draft.retrospective,
    };
    state.saving = false;
    if (createAfter) {
      startCreate(state.entries.find((item) => item.id === entry.id) ?? entry);
      return;
    }
    state.message = t("saved");
    state.messageError = false;
    if (state.view === "date") render();
    else { state.view = "home"; render(); }
  } catch (error) {
    state.saving = false;
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    render();
  }
}

async function loadEntries() {
  const data = await api("/api/mood-entries");
  state.entries = Array.isArray(data?.entries) ? data.entries : [];
  state.entriesLoaded = true;
}

// ---------------------------------------------------------------------------
// Creating one piece from a feeling

function moodMessageFor(entry) {
  const group = groupById(entry.group);
  const emotion = state.language === "en" ? group.emotions.find((item) => item.id === entry.emotion)?.en : group.emotions.find((item) => item.id === entry.emotion)?.zh;
  const word = emotion || entry.emotion;
  if (state.language === "en") {
    const parts = [`Right now I feel ${word}.`];
    if (entry.musicFeeling) parts.push(`I want the music to feel: ${entry.musicFeeling}.`);
    if (entry.note) parts.push(entry.note);
    parts.push("Write a single piece of music from this feeling.");
    return parts.join(" ");
  }
  const parts = [`我现在的心情是「${word}」。`];
  if (entry.musicFeeling) parts.push(`希望这段音乐带给我这样的感觉：${entry.musicFeeling}。`);
  if (entry.note) parts.push(entry.note);
  parts.push("请把这个心情写成一首单曲。");
  return parts.join("");
}

function discussionOptions() {
  return {
    description: "Pending creative discussion.",
    workflowType: state.jazz ? "02-jazz" : "01-general",
    corpusMode: state.jazz ? "jazz" : "none",
    compositionMode: "single",
    mode: state.advanced.mode,
    lyriaModel: state.advanced.lyriaModel,
    vocalMode: state.advanced.vocalMode,
  };
}

async function startCreate(entry) {
  if (!entry || state.busy) return;
  state.busy = true;
  state.message = "";
  state.jazz = false;
  state.session = null;
  state.proposal = "";
  state.task = null;
  state.replyDraft = "";
  state.activeEntryId = entry.id;
  state.view = "shape";
  state.thinking = true;
  state.pending = { content: moodMessageFor(entry) };
  render();

  try {
    const session = await api("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discussionOptions()),
    });
    state.session = session;
    const replied = await api(`/api/discussions/${encodeURIComponent(session.id)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: moodMessageFor(entry), attachmentIds: [] }),
    });
    state.session = replied;
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  } finally {
    state.pending = null;
    state.thinking = false;
    state.busy = false;
    render();
  }
}

function renderShape() {
  const entry = activeEntry();
  if (!entry) {
    state.view = "home";
    renderHome();
    return;
  }
  const group = groupById(entry.group);
  const messages = state.session?.messages ?? [];
  const parts = messages.map((message) => {
    return `<article class="mm-msg ${message.role}">${esc(message.content)}</article>`;
  });
  if (state.pending) parts.push(`<article class="mm-msg user">${esc(state.pending.content)}</article>`);
  if (state.thinking) {
    parts.push('<div class="mm-typing" role="status"><span></span><span></span><span></span></div>');
  }
  const hasAssistant = messages.some((message) => message.role === "assistant");
  const showDirection = hasAssistant && !state.proposal && !state.thinking;

  setStage(`
    ${mainHead(t("shapeTitle"), t("shapeLead"))}
    <div class="mm-card mm-summary" style="--group:${group.color}">
      <h3>${esc(t("summaryTitle"))}</h3>
      <div class="mm-summary-grid">
        <div>
          <span class="mm-summary-key">${esc(t("summaryFeeling"))}</span>
          <span class="mm-summary-value"><span class="mm-dot" style="background:${group.color}"></span>
            ${esc(emotionLabel(entry.group, entry.emotion))}</span>
        </div>
        <div>
          <span class="mm-summary-key">${esc(t("summaryFormat"))}</span>
          <span class="mm-summary-value">${esc(t("summaryFormatValue"))}</span>
        </div>
        <div>
          <span class="mm-summary-key">${esc(t("summaryJazzOn"))}</span>
          <span class="mm-summary-value">${esc(state.jazz ? t("summaryJazzOn") : t("summaryJazzOff"))}</span>
        </div>
      </div>
      <label class="e-field">
        <span>${esc(t("musicFeelingLabel"))}</span>
        <textarea class="e-textarea" id="mm-summary-music" maxlength="2000"
          placeholder="${esc(t("musicFeelingPlaceholder"))}">${esc(entry.musicFeeling ?? "")}</textarea>
      </label>
      <label class="e-field">
        <span>${esc(t("noteLabel"))}</span>
        <textarea class="e-textarea" id="mm-summary-note" maxlength="2000"
          placeholder="${esc(t("notePlaceholder"))}">${esc(entry.note ?? "")}</textarea>
      </label>
      <p class="e-hint">${esc(t("noteEditHint"))}</p>
    </div>

    <div class="mm-card mm-discussion">
      <div class="mm-disc-head">
        <strong>${esc(t("director"))}</strong>
        <span class="mm-disc-status">${esc(state.thinking ? t("thinking") : t("directorHint"))}</span>
      </div>
      <div class="mm-thread">${parts.join("")}</div>
      <div class="mm-reply">
        <textarea class="e-textarea" id="mm-reply" maxlength="4000"
          placeholder="${esc(t("replyPlaceholder"))}">${esc(state.replyDraft)}</textarea>
        <button class="e-btn e-btn-secondary" type="button" id="mm-send" ${state.thinking ? "disabled" : ""}>${esc(t("send"))}</button>
      </div>

      <div class="mm-jazz${state.jazz ? " is-on" : ""}">
        <button class="mm-jazz-btn" type="button" id="mm-jazz" aria-pressed="${state.jazz}">why not jazz</button>
        <span class="mm-jazz-note">${esc(state.jazz ? `${t("jazzOn")} ${t("jazzExplain")}` : t("jazzExplain"))}</span>
      </div>

      ${showDirection ? `
        <div class="mm-direction">
          <div>
            <strong>${esc(t("directionReady"))}</strong>
            <span>${esc(t("directionReadyHint"))}</span>
          </div>
          <button class="e-btn e-btn-primary" type="button" id="mm-make-prompt">${esc(t("makePrompt"))} →</button>
        </div>` : ""}

      ${state.proposal ? `
        <div class="mm-proposal">
          <div class="mm-proposal-head">
            <label for="mm-proposal-text"><strong>${esc(t("promptLabel"))}</strong></label>
            <span>${esc(t("promptHint"))}</span>
          </div>
          <textarea class="e-textarea" id="mm-proposal-text" maxlength="8000">${esc(state.proposal)}</textarea>
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
            <button class="e-btn e-btn-secondary" type="button" id="mm-more">${esc(t("back"))}</button>
            <button class="e-btn e-btn-primary" type="button" id="mm-approve" ${state.busy ? "disabled" : ""}>${esc(t("startCreating"))} →</button>
          </div>
        </div>` : ""}

      ${messageLine()}
      <div class="mm-actions mm-shape-actions">
        <button class="e-btn e-btn-secondary" type="button" id="mm-shape-back">${esc(t("back"))}</button>
      </div>
    </div>
  `);

  const reply = stage.querySelector("#mm-reply");
  reply.addEventListener("input", () => { state.replyDraft = reply.value; });
  reply.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendDiscussionReply();
  });
  stage.querySelector("#mm-send").addEventListener("click", sendDiscussionReply);
  stage.querySelector("#mm-jazz").addEventListener("click", () => {
    state.jazz = !state.jazz;
    render();
  });
  stage.querySelector("#mm-shape-back").addEventListener("click", backHome);
  stage.querySelector("#mm-make-prompt")?.addEventListener("click", generateProposal);
  stage.querySelector("#mm-more")?.addEventListener("click", () => {
    if (state.proposal) { state.proposal = ""; render(); }
  });
  const proposalText = stage.querySelector("#mm-proposal-text");
  proposalText?.addEventListener("input", () => { state.proposal = proposalText.value; });
  stage.querySelector("#mm-mode")?.addEventListener("change", (event) => { state.advanced.mode = event.target.value; });
  stage.querySelector("#mm-lyria")?.addEventListener("change", (event) => { state.advanced.lyriaModel = event.target.value; });
  stage.querySelector("#mm-vocal")?.addEventListener("change", (event) => { state.advanced.vocalMode = event.target.value; });
  stage.querySelector("#mm-approve")?.addEventListener("click", approveAndCreate);

  const summaryMusic = stage.querySelector("#mm-summary-music");
  summaryMusic?.addEventListener("change", () => patchEntry(entry.id, { musicFeeling: summaryMusic.value }));
  const summaryNote = stage.querySelector("#mm-summary-note");
  summaryNote?.addEventListener("change", () => patchEntry(entry.id, { note: summaryNote.value }));

  const thread = stage.querySelector(".mm-thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
}

async function patchEntry(id, patch) {
  try {
    await api(`/api/mood-entries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadEntries();
  } catch {
    /* The edit stays in the field; persistence is best-effort. */
  }
}

async function sendDiscussionReply() {
  const session = state.session;
  const content = state.replyDraft.trim();
  if (!session || state.thinking || !content) return;
  state.pending = { content };
  state.replyDraft = "";
  state.thinking = true;
  state.message = "";
  render();
  try {
    const updated = await api(`/api/discussions/${encodeURIComponent(session.id)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, attachmentIds: [] }),
    });
    state.session = updated;
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    state.replyDraft = content;
  } finally {
    state.pending = null;
    state.thinking = false;
    render();
  }
}

async function generateProposal() {
  const session = state.session;
  if (!session || state.busy) return;
  state.busy = true;
  state.thinking = true;
  state.message = "";
  render();
  try {
    const updated = await api(`/api/discussions/${encodeURIComponent(session.id)}/proposal`, { method: "POST" });
    state.session = updated;
    state.proposal = updated.proposal ?? "";
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  } finally {
    state.thinking = false;
    state.busy = false;
    render();
  }
}

async function approveAndCreate() {
  const session = state.session;
  const prompt = state.proposal.trim();
  if (!session || state.busy || !prompt) return;
  state.busy = true;
  state.message = "";
  render();
  try {
    const result = await api(`/api/discussions/${encodeURIComponent(session.id)}/submit`, {
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
    state.session = result.session;
    state.task = result.task;
    await linkTask(state.activeEntryId, result.task.id);
    state.view = "creating";
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
    /* Linking is best-effort; the task still exists on its own. */
  }
}

async function retryAsNewAttempt(taskId) {
  const entry = state.entries.find((item) => (item.tasks ?? []).some((task) => task.id === taskId));
  const task = entry?.tasks?.find((item) => item.id === taskId);
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
    await linkTask(entry.id, created.id);
    state.activeEntryId = entry.id;
    state.task = created;
    state.view = "creating";
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

// ---------------------------------------------------------------------------
// Creating / listening

function progressPhase() {
  const task = state.task;
  if (!task) return t("phaseWaiting");
  if (task.status === "composing") return t("phaseComposing");
  if (task.status === "generating") return t("phaseGenerating");
  if (task.status === "assembling" || task.status === "processing") return t("phaseProcessing");
  return t("phaseWaiting");
}

function renderCreating() {
  const task = state.task;
  setStage(`
    ${mainHead(t("creatingTitle"), t("creatingLead"))}
    <div class="mm-card">
      <div class="mm-progress">
        <div class="mm-disc" aria-hidden="true"></div>
        <h3>${esc(statusLabel(task?.status ?? "queued"))}</h3>
        <p>${esc(progressPhase())}</p>
        <div class="mm-bar"><span></span></div>
      </div>
      ${messageLine()}
    </div>
  `);
}

function pollTask() {
  clearTimeout(state.pollTimer);
  const id = state.task?.id;
  if (!id) return;
  const tick = async () => {
    try {
      const task = await api(`/api/tasks/${encodeURIComponent(id)}`);
      state.task = task;
      if (task.status === "completed" || task.status === "failed") {
        await loadEntries();
        state.view = "listen";
        render();
        return;
      }
      if (state.view === "creating") renderCreating();
    } catch {
      /* Transient; keep polling. */
    }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

function renderListen() {
  const task = state.task;
  const entry = activeEntry();
  const group = entry ? groupById(entry.group) : null;
  const title = task?.title || (entry ? emotionLabel(entry.group, entry.emotion) : t("listenTitle"));

  if (task?.status === "failed") {
    setStage(`
      ${mainHead(t("failedTitle"), t("failedLead"))}
      <div class="mm-card">
        <div class="mm-error-box">
          <strong>${esc(t("failedTitle"))}</strong>
          <span>${esc(task.error || t("failedLead"))}</span>
        </div>
        <div class="mm-foot-actions">
          <button class="e-btn e-btn-primary" type="button" id="mm-retry">${esc(t("tryAgain"))}</button>
          <button class="e-btn e-btn-secondary" type="button" id="mm-again">${esc(t("createAnother"))}</button>
        </div>
      </div>
    `);
    stage.querySelector("#mm-retry").addEventListener("click", () => retryAsNewAttempt(task.id));
    stage.querySelector("#mm-again").addEventListener("click", backHome);
    return;
  }

  setStage(`
    ${mainHead(t("listenTitle"), t("listenLead"))}
    <div class="mm-card mm-result" style="--group:${group?.color ?? "#b1642f"}">
      ${entry ? `<p class="mm-result-mood"><span class="mm-dot" style="background:${group.color}"></span>${esc(emotionLabel(entry.group, entry.emotion))}</p>` : ""}
      <h3 class="mm-result-title">${esc(title)}</h3>
      ${task?.description ? `<p class="mm-result-desc">${esc(task.description)}</p>` : ""}
      <audio class="mm-player" controls preload="metadata"
        src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
      <div class="mm-foot-actions">
        <a class="e-btn e-btn-secondary" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>
        <button class="e-btn e-btn-primary" type="button" id="mm-again">${esc(t("createAnother"))}</button>
      </div>
    </div>
  `);
  stage.querySelector("#mm-again").addEventListener("click", backHome);
}

// ---------------------------------------------------------------------------

async function setLanguage(next, persist) {
  state.language = next;
  render();
  if (persist) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
    } catch {
      /* Best-effort preference. */
    }
  }
}

langToggle.addEventListener("click", () => setLanguage(state.language === "zh-CN" ? "en" : "zh-CN", true));

async function boot() {
  try {
    const settings = await api("/api/settings");
    if (settings?.language === "en" || settings?.language === "zh-CN") state.language = settings.language;
  } catch {
    /* Fall back to the default language. */
  }
  const now = new Date();
  state.month = { year: now.getFullYear(), month: now.getMonth() + 1 };
  render();
  try {
    await loadEntries();
  } catch {
    state.entriesLoaded = true;
  }
  render();
}

boot();
