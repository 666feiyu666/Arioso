// The mood calendar page (/calendar.html): a month grid of feelings and music,
// plus a detail panel for the selected day.
//
// Feeling records are not entered here. This page reads what was recorded while
// creating music, lets you re-colour a record, and links each record back to the
// conversation it came from.

import {
  GROUPS, WEEKDAYS, api, applyI18n, dateParts, emotionLabel, esc,
  groupById, groupName, markerStyle, entryHasMusic, readLanguage, persistLanguage,
} from "./mood-common.js";

const COPY = {
  "zh-CN": {
    pageTitle: "心情日历 · MoodMic",
    tabMoodMic: "MoodMic", tabCalendar: "心情日历", tabWorkflow: "工作流", tabHelp: "帮助",
    tabBarLabel: "主导航", switchLanguage: "切换界面语言",
    title: "我的心情日历",
    lead: "每一天的圆点由当天的记录组成，颜色顺序就是记录的顺序。",
    legendTitle: "四种颜色的含义",
    prevMonth: "上个月", nextMonth: "下个月",
    emptyDay: "这一天还没有记录。",
    daySummary: (count) => `${count} 条心情记录`,
    daySummaryMusic: (count) => `${count} 条记录 · 有可播放的音乐`,
    pickDay: "选择日历里的某一天，查看当天的记录。",
    retrospective: "补记",
    viewChat: "查看这次对话",
    editColor: "编辑颜色",
    cancel: "取消",
    save: "保存",
    moodColorLabel: "颜色",
    moodWordLabel: "情绪词",
    needPick: "先选一个颜色和词。",
    noMusicYet: "还没有音乐",
    download: "下载音频",
    tryAgain: "再试一次",
    statusQueued: "排队中", statusComposing: "正在构思编曲", statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章", statusProcessing: "正在后期处理",
    statusCompleted: "已完成", statusFailed: "未完成",
    summaryMusic: "音乐的感觉",
    loading: "正在准备…",
    errorGeneric: "出了点问题，请再试一次。",
  },
  en: {
    pageTitle: "Mood calendar · MoodMic",
    tabMoodMic: "MoodMic", tabCalendar: "Mood calendar", tabWorkflow: "Workflow", tabHelp: "Help",
    tabBarLabel: "Tab navigation", switchLanguage: "Switch interface language",
    title: "My mood calendar",
    lead: "Each day's circle is made of that day's check-ins, in the order you recorded them.",
    legendTitle: "What the four colours mean",
    prevMonth: "Previous month", nextMonth: "Next month",
    emptyDay: "No check-in on this day yet.",
    daySummary: (count) => `${count} check-in${count === 1 ? "" : "s"}`,
    daySummaryMusic: (count) => `${count} check-in${count === 1 ? "" : "s"} · music to play`,
    pickDay: "Pick a day in the calendar to see its check-ins.",
    retrospective: "Recorded later",
    viewChat: "Open this conversation",
    editColor: "Edit colour",
    cancel: "Cancel",
    save: "Save",
    moodColorLabel: "Colour",
    moodWordLabel: "Emotion word",
    needPick: "Pick a colour and a word first.",
    noMusicYet: "No music yet",
    download: "Download audio",
    tryAgain: "Try again",
    statusQueued: "Queued", statusComposing: "Shaping the arrangement", statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements", statusProcessing: "Post-processing",
    statusCompleted: "Completed", statusFailed: "Not finished",
    summaryMusic: "Feeling of the music",
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
  entries: [],
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

function entriesOn(date) {
  return state.entries
    .filter((entry) => entry.date === date)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function chatIdFor(entry) {
  const task = (entry.tasks ?? []).find((item) => item.sourceDiscussionId);
  return task?.sourceDiscussionId ?? null;
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
    const list = entriesOn(iso);
    const isToday = iso === today;
    const hasMusic = list.some(entryHasMusic);
    const summary = list.length
      ? (hasMusic ? t("daySummaryMusic", list.length) : t("daySummary", list.length))
      : t("emptyDay");
    const words = list.map((entry) => emotionLabel(entry.group, entry.emotion, state.language)).join(" · ");
    const label = list.length
      ? `${monthLabel} ${day} — ${words}. ${summary}`
      : `${monthLabel} ${day} — ${summary}`;
    cells.push(`
      <li class="mm-day${list.length ? " has-entry" : ""}${isToday ? " is-today" : ""}">
        <button class="mm-day-btn" type="button" data-date="${iso}"
          aria-label="${esc(label)}" aria-pressed="${state.selectedDate === iso ? "true" : "false"}"
          title="${esc(label)}">
          <span class="mm-day-number">${day}</span>
          ${list.length ? `<span class="mm-marker" style="${markerStyle(list.map((entry) => entry.group))}"></span>
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
  const list = entriesOn(date);
  const label = state.language === "en"
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${dateParts(date).year} 年 ${dateParts(date).month} 月 ${dateParts(date).day} 日`;

  return `
    <section class="mm-day-detail" aria-label="${esc(label)}">
      <div class="mm-day-detail-head">
        <h3>${esc(label)}</h3>
      </div>
      ${list.length ? list.map(renderEntryCard).join("") : `<div class="mm-card"><p class="e-hint">${esc(t("emptyDay"))}</p></div>`}
    </section>
  `;
}

function renderEntryCard(entry) {
  const group = groupById(entry.group);
  const time = new Date(entry.createdAt).toLocaleTimeString(
    state.language === "en" ? "en" : "zh-CN", { hour: "2-digit", minute: "2-digit" },
  );
  const tasks = entry.tasks ?? [];
  const chatId = chatIdFor(entry);
  const editing = state.editingId === entry.id;

  return `
    <article class="mm-card mm-entry" style="--group:${group.color}">
      <header class="mm-entry-head">
        <span class="mm-dot" style="background:${group.color}"></span>
        <strong>${esc(emotionLabel(entry.group, entry.emotion, state.language))}</strong>
        <span class="mm-entry-time">${esc(time)}</span>
        ${entry.retrospective ? `<span class="mm-tag">${esc(t("retrospective"))}</span>` : ""}
      </header>
      ${entry.note ? `<p class="mm-entry-note">${esc(entry.note)}</p>` : ""}
      ${entry.musicFeeling ? `<p class="mm-entry-music"><span>${esc(t("summaryMusic"))}</span> ${esc(entry.musicFeeling)}</p>` : ""}
      <div class="mm-entry-music-list">
        ${tasks.length ? tasks.map((task) => `
          <div class="mm-entry-task">
            <span class="mm-entry-task-title">${esc(task.title || emotionLabel(entry.group, entry.emotion, state.language))}</span>
            <span class="mm-entry-task-status">${esc(taskLine(task))}</span>
            ${task.status === "completed"
              ? `<audio class="mm-mini-player" controls preload="none" src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
                 <a class="e-btn e-btn-ghost" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>`
              : task.status === "failed"
                ? `<button class="e-btn e-btn-ghost" type="button" data-retry="${esc(task.id)}">${esc(t("tryAgain"))}</button>`
                : ""}
          </div>
        `).join("") : `<span class="e-hint">${esc(t("noMusicYet"))}</span>`}
      </div>
      ${editing ? renderColorEditor(entry) : `
        <div class="mm-entry-actions">
          ${chatId ? `<a class="e-btn e-btn-secondary" href="/?chat=${encodeURIComponent(chatId)}">${esc(t("viewChat"))} →</a>` : ""}
          <button class="e-btn e-btn-ghost" type="button" data-edit="${esc(entry.id)}">${esc(t("editColor"))}</button>
        </div>`}
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
      const entry = state.entries.find((item) => item.id === button.dataset.edit);
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
    await loadEntries();
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
  const entry = state.entries.find((item) => (item.tasks ?? []).some((task) => task.id === taskId));
  const task = entry?.tasks?.find((item) => item.id === taskId);
  if (!task) return;
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
    await api(`/api/mood-entries/${encodeURIComponent(entry.id)}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: created.id }),
    });
    state.message = t("statusQueued");
    state.messageError = false;
    await loadEntries();
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
  }
  render();
}

async function loadEntries() {
  const data = await api("/api/mood-entries");
  state.entries = Array.isArray(data?.entries) ? data.entries : [];
  state.loaded = true;
}

async function boot() {
  state.language = await readLanguage();
  const now = new Date();
  state.month = { year: now.getFullYear(), month: now.getMonth() + 1 };
  render();
  try {
    await loadEntries();
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
