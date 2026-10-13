// The mood calendar page (/calendar.html): a month grid of the music that was
// actually made, plus a detail panel for the selected day.
//
// The grid is built from the pieces that still exist (GET /api/tasks) — every
// piece is placed on the day it was created. A piece keeps the colour of the
// mood recorded when it was made; a piece with no matching record (for example
// one started in the workflow studio) uses the brand colour. Nothing is drawn
// from history alone: delete a piece and it leaves the calendar.

import {
  GROUPS, WEEKDAYS, api, applyI18n, dateParts, emotionLabel, esc,
  groupById, groupName, markerStyle, readLanguage, persistLanguage,
} from "./mood-common.js";

const COPY = {
  "zh-CN": {
    pageTitle: "心情日历 · MoodMic",
    tabMoodMic: "MoodMic", tabCalendar: "心情日历", tabWorkflow: "工作流", tabHelp: "帮助",
    tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    title: "我的心情日历",
    lead: "每一天的圆点，来自当天真正做出来的作品；颜色就是记录时的心情。",
    legendTitle: "四种颜色的含义",
    prevMonth: "上个月", nextMonth: "下个月",
    emptyDay: "这一天还没有作品。",
    daySummary: (count) => `${count} 件作品`,
    daySummaryMusic: (count) => `${count} 件作品 · 有可播放的音乐`,
    pickDay: "选择日历里的某一天，查看当天做出的作品。",
    untitledWork: "未命名作品",
    viewChat: "查看这次对话",
    editColor: "编辑心情颜色",
    cancel: "取消",
    save: "保存",
    moodColorLabel: "颜色",
    moodWordLabel: "情绪词",
    needPick: "先选一个颜色和词。",
    download: "下载音频",
    tryAgain: "再试一次",
    statusQueued: "排队中", statusComposing: "正在构思编曲", statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章", statusProcessing: "正在后期处理",
    statusCompleted: "已完成", statusFailed: "未完成",
    loading: "正在准备…",
    errorGeneric: "出了点问题，请再试一次。",
  },
  en: {
    pageTitle: "Mood calendar · MoodMic",
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar", tabWorkflow: "Workflow", tabHelp: "Help",
    tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    title: "My mood calendar",
    lead: "Each day's circle is built from the pieces you actually made — coloured by the mood you recorded.",
    legendTitle: "What the four colours mean",
    prevMonth: "Previous month", nextMonth: "Next month",
    emptyDay: "No pieces made on this day yet.",
    daySummary: (count) => `${count} piece${count === 1 ? "" : "s"}`,
    daySummaryMusic: (count) => `${count} piece${count === 1 ? "" : "s"} · music to play`,
    pickDay: "Pick a day in the calendar to see the pieces you made.",
    untitledWork: "Untitled work",
    viewChat: "Open this conversation",
    editColor: "Edit mood colour",
    cancel: "Cancel",
    save: "Save",
    moodColorLabel: "Colour",
    moodWordLabel: "Emotion word",
    needPick: "Pick a colour and a word first.",
    download: "Download audio",
    tryAgain: "Try again",
    statusQueued: "Queued", statusComposing: "Shaping the arrangement", statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements", statusProcessing: "Post-processing",
    statusCompleted: "Completed", statusFailed: "Not finished",
    loading: "Getting ready…",
    errorGeneric: "Something went wrong. Please try again.",
  },
};

const STATUS_KEYS = {
  queued: "statusQueued", composing: "statusComposing", generating: "statusGenerating",
  assembling: "statusAssembling", processing: "statusProcessing",
  completed: "statusCompleted", failed: "statusFailed",
};

const stage = document.querySelector("#mm-stage");
const langToggle = document.querySelector("#lang-toggle");

const state = {
  language: "zh-CN",
  pieces: [],
  taskEntry: new Map(),
  loaded: false,
  month: null,
  selectedDate: null,
  editingId: null,
  draft: { group: null, emotion: null },
  saving: false,
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

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// The local calendar day a piece belongs to, from its creation time.
function taskDate(task) {
  const date = new Date(task.createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// One piece per MoodMic conversation — the latest one, exactly the piece the
// MoodMic front end shows. Workflow-studio tasks belong to no conversation, so
// they never reach this calendar.
function piecesOn(date) {
  return state.pieces
    .filter(({ task }) => taskDate(task) === date)
    .slice()
    .sort((a, b) => String(a.task.createdAt).localeCompare(String(b.task.createdAt)));
}

function entryForTask(task) {
  return state.taskEntry.get(task.id) ?? null;
}

function colorForTask(task) {
  const entry = entryForTask(task);
  return entry ? groupById(entry.group).color : "var(--brand)";
}

// ---------------------------------------------------------------------------

function render() {
  applyI18n(COPY, state.language);
  langToggle.textContent = state.language === "zh-CN" ? "EN" : "中文";
  setStage();
}

function setStage() {
  if (!state.loaded) {
    stage.innerHTML = `${mainHead(t("title"), t("lead"))}<div class="mm-card"><p class="e-hint">${esc(t("loading"))}</p></div>`;
    return;
  }
  stage.innerHTML = `
    ${mainHead(t("title"), t("lead"))}
    <div class="mm-card">${renderCalendar()}</div>
    ${renderDetail()}
    ${messageLine()}
  `;
  bind();
}

function mainHead(title, lead) {
  return `
    <div class="mm-hero">
      <h2 class="mm-title">${esc(title)}</h2>
      ${lead ? `<p class="mm-lead">${esc(lead)}</p>` : ""}
    </div>
  `;
}

function messageLine() {
  if (!state.message) return "";
  return `<p class="e-message${state.messageError ? " error" : ""}">${esc(state.message)}</p>`;
}

function renderCalendar() {
  const { year, month } = state.month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
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
    const list = piecesOn(iso);
    const isToday = iso === today;
    const hasMusic = list.some(({ task }) => task.status === "completed");
    const summary = list.length
      ? (hasMusic ? t("daySummaryMusic", list.length) : t("daySummary", list.length))
      : t("emptyDay");
    const label = `${monthLabel} ${day} — ${summary}`;
    cells.push(`
      <li class="mm-day${list.length ? " has-entry" : ""}${isToday ? " is-today" : ""}">
        <button class="mm-day-btn" type="button" data-date="${iso}"
          aria-label="${esc(label)}" aria-pressed="${state.selectedDate === iso ? "true" : "false"}"
          title="${esc(label)}">
          <span class="mm-day-number">${day}</span>
          ${list.length ? `<span class="mm-marker" style="${markerStyle(list.map(({ task }) => colorForTask(task)))}"></span>
            <span class="mm-day-count">${list.length}</span>` : ""}
          ${hasMusic ? `<span class="mm-day-note" aria-hidden="true">♪</span>` : ""}
        </button>
      </li>
    `);
  }

  return `
    <section class="mm-calendar" aria-labelledby="mm-calendar-title">
      <div class="mm-calendar-head">
        <h3 id="mm-calendar-title" class="e-visually-hidden">${esc(t("title"))}</h3>
        <div class="mm-month-nav">
          <button class="e-btn e-btn-ghost" type="button" id="mm-prev" aria-label="${esc(t("prevMonth"))}">‹</button>
          <span class="mm-month-label">${esc(monthLabel)}</span>
          <button class="e-btn e-btn-ghost" type="button" id="mm-next" aria-label="${esc(t("nextMonth"))}">›</button>
        </div>
      </div>
      <ol class="mm-weekdays" aria-hidden="true">
        ${WEEKDAYS[state.language].map((name) => `<li>${esc(name)}</li>`).join("")}
      </ol>
      <ol class="mm-days">${cells.join("")}</ol>
      <ul class="mm-legend" aria-label="${esc(t("legendTitle"))}">
        ${GROUPS.map((group) => `
          <li><span class="mm-legend-swatch" style="background:${group.color}" aria-hidden="true"></span>
            <span>${esc(groupName(group, state.language))}</span></li>
        `).join("")}
      </ul>
    </section>
  `;
}

function taskLine(task) {
  const when = new Date(task.createdAt).toLocaleString(
    state.language === "en" ? "en" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );
  return `${when} · ${statusLabel(task.status)}`;
}

function renderDetail() {
  if (!state.selectedDate) {
    return `<div class="mm-card"><p class="e-hint">${esc(t("pickDay"))}</p></div>`;
  }
  const date = state.selectedDate;
  const list = piecesOn(date);
  const label = state.language === "en"
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${dateParts(date).year} 年 ${dateParts(date).month} 月 ${dateParts(date).day} 日`;

  return `
    <section class="mm-day-detail" aria-label="${esc(label)}">
      <div class="mm-day-detail-head">
        <h3>${esc(label)}</h3>
      </div>
      ${list.length ? list.map(renderTaskCard).join("") : `<div class="mm-card"><p class="e-hint">${esc(t("emptyDay"))}</p></div>`}
    </section>
  `;
}

function renderTaskCard({ task, chat }) {
  const entry = entryForTask(task);
  const group = entry ? groupById(entry.group) : null;
  const color = group ? group.color : "var(--brand)";
  const chatId = chat?.id ?? null;
  const editing = entry && state.editingId === entry.id;

  return `
    <article class="mm-card mm-entry" style="--group:${color}">
      <header class="mm-entry-head">
        <span class="mm-dot" style="background:${color}"></span>
        <strong>${esc(task.title || t("untitledWork"))}</strong>
        ${entry ? `<span class="mm-entry-time">${esc(emotionLabel(entry.group, entry.emotion, state.language))}</span>` : ""}
      </header>
      ${task.description ? `<p class="mm-entry-note">${esc(task.description)}</p>` : ""}
      <div class="mm-entry-music-list">
        <div class="mm-entry-task">
          <span class="mm-entry-task-status">${esc(taskLine(task))}</span>
          ${task.status === "completed"
            ? `<audio class="mm-mini-player" controls preload="none" src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
               <a class="e-btn e-btn-ghost" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>`
            : task.status === "failed"
              ? `<button class="e-btn e-btn-ghost" type="button" data-retry="${esc(task.id)}">${esc(t("tryAgain"))}</button>`
              : ""}
        </div>
      </div>
      ${entry ? (editing ? renderColorEditor(entry) : `
        <div class="mm-entry-actions">
          ${chatId ? `<a class="e-btn e-btn-secondary" href="/?chat=${encodeURIComponent(chatId)}">${esc(t("viewChat"))} →</a>` : ""}
          <button class="e-btn e-btn-ghost" type="button" data-edit="${esc(entry.id)}">${esc(t("editColor"))}</button>
        </div>`) : ""}
    </article>
  `;
}

function renderColorEditor(entry) {
  const group = state.draft.group ? groupById(state.draft.group) : null;
  const canSave = Boolean(state.draft.group && state.draft.emotion) && !state.saving;
  return `
    <div class="mm-edit">
      <div class="mm-colors" role="group" aria-label="${esc(t("moodColorLabel"))}">
        ${GROUPS.map((item) => `
          <button class="mm-color" type="button" data-group="${item.id}"
            aria-pressed="${state.draft.group === item.id}" style="--group:${item.color}">
            <span class="mm-color-swatch" aria-hidden="true"></span>
            <span>${esc(groupName(item, state.language))}</span>
          </button>
        `).join("")}
      </div>
      ${group ? `
        <div class="mm-words" role="group" aria-label="${esc(t("moodWordLabel"))}">
          ${group.emotions.map((emotion) => `
            <button class="mm-word" type="button" data-emotion="${emotion.id}"
              aria-pressed="${state.draft.emotion === emotion.id}"
              style="--group:${group.color}">${esc(state.language === "en" ? emotion.en : emotion.zh)}</button>
          `).join("")}
        </div>` : ""}
      ${state.draft.group && !state.draft.emotion ? `<p class="e-hint">${esc(t("needPick"))}</p>` : ""}
      <div class="mm-actions">
        <button class="e-btn e-btn-secondary" type="button" data-cancel-edit="1">${esc(t("cancel"))}</button>
        <button class="e-btn e-btn-primary" type="button" data-save-edit="${esc(entry.id)}" ${canSave ? "" : "disabled"}>${esc(t("save"))}</button>
      </div>
    </div>
  `;
}

function bind() {
  stage.querySelector("#mm-prev")?.addEventListener("click", () => shiftMonth(-1));
  stage.querySelector("#mm-next")?.addEventListener("click", () => shiftMonth(1));
  for (const button of stage.querySelectorAll("[data-date]")) {
    button.addEventListener("click", () => {
      state.selectedDate = state.selectedDate === button.dataset.date ? null : button.dataset.date;
      state.editingId = null;
      state.message = "";
      render();
    });
  }
  for (const button of stage.querySelectorAll("[data-edit]")) {
    button.addEventListener("click", () => {
      const entry = [...state.taskEntry.values()].find((item) => item.id === button.dataset.edit);
      if (!entry) return;
      state.editingId = entry.id;
      state.draft = { group: entry.group, emotion: entry.emotion };
      state.message = "";
      render();
    });
  }
  for (const button of stage.querySelectorAll("[data-group]")) {
    button.addEventListener("click", () => {
      if (state.draft.group === button.dataset.group) return;
      state.draft.group = button.dataset.group;
      state.draft.emotion = null;
      render();
    });
  }
  for (const button of stage.querySelectorAll("[data-emotion]")) {
    button.addEventListener("click", () => { state.draft.emotion = button.dataset.emotion; render(); });
  }
  stage.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
    state.editingId = null;
    state.draft = { group: null, emotion: null };
    render();
  });
  stage.querySelector("[data-save-edit]")?.addEventListener("click", (event) => {
    saveColor(event.currentTarget.dataset.saveEdit);
  });
  for (const button of stage.querySelectorAll("[data-retry]")) {
    button.addEventListener("click", () => retryAsNewAttempt(button.dataset.retry));
  }
}

async function saveColor(entryId) {
  if (state.saving || !state.draft.group || !state.draft.emotion) return;
  state.saving = true;
  state.message = "";
  render();
  try {
    await api(`/api/mood-entries/${encodeURIComponent(entryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: state.draft.group, emotion: state.draft.emotion }),
    });
    state.editingId = null;
    state.draft = { group: null, emotion: null };
    await loadData();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  }
  state.saving = false;
  render();
}

function shiftMonth(delta) {
  let { year, month } = state.month;
  month += delta;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  state.month = { year, month };
  render();
}

async function retryAsNewAttempt(taskId) {
  const piece = state.pieces.find(({ task }) => task.id === taskId);
  if (!piece) return;
  const task = piece.task;
  const entry = entryForTask(task);
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
    if (entry) {
      await api(`/api/mood-entries/${encodeURIComponent(entry.id)}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: created.id }),
      });
    }
    state.message = t("statusQueued");
    state.messageError = false;
    await loadData();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  }
  render();
}

async function loadData() {
  const [chatsData, entriesData] = await Promise.all([
    api("/api/mood-chats"),
    api("/api/mood-entries"),
  ]);
  const chats = Array.isArray(chatsData) ? chatsData : [];
  const entries = Array.isArray(entriesData?.entries) ? entriesData.entries : [];
  const byTask = new Map();
  for (const entry of entries) {
    for (const taskId of entry.taskIds ?? []) {
      byTask.set(taskId, entry);
    }
  }
  state.taskEntry = byTask;
  // One piece per conversation, taken from the latest task — the same piece
  // MoodMic itself displays for that conversation.
  state.pieces = chats.flatMap((chat) => {
    const task = (chat.tasks ?? []).at(-1);
    return task ? [{ task, chat }] : [];
  });
  state.loaded = true;
}

async function boot() {
  state.language = await readLanguage();
  const now = new Date();
  state.month = { year: now.getFullYear(), month: now.getMonth() + 1 };
  render();
  try {
    await loadData();
  } catch {
    state.loaded = true;
  }
  render();
}

langToggle.addEventListener("click", async () => {
  state.language = state.language === "zh-CN" ? "en" : "zh-CN";
  render();
  await persistLanguage(state.language);
});

boot();
