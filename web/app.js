const translations = {
  "zh-CN": {
    pageTitle: "Arioso · AI 音乐工坊",
    newTask: "新建任务", tasks: "任务", musicTasks: "音乐任务", settings: "设置",
    localWorkspace: "本地创作空间", heroEyebrow: "COMPOSE WITH INTENT",
    heroTitle: "把一个念头，<br />写成一段音乐。",
    heroCopy: "描述场景、情绪或声音。Arioso 会先整理成完整乐曲规格，再交给 Lyria 生成。",
    generationSettings: "生成设置", generationMode: "生成模式", modeGenerate: "编曲并生成音乐",
    modeCompose: "仅生成编曲提示", lyriaModel: "Lyria 模型", lyriaClip: "Lyria 3 Clip · 30 秒",
    lyriaFull: "Lyria 3.5 · 完整歌曲", examplesTitle: "从一个声音画面开始",
    examplesHint: "选择示例后仍可自由修改", backHome: "← 返回创作台", nowPlaying: "正在播放",
    noMusicSelected: "未选择音乐", promptPlaceholder: "例如：慵懒的午后爵士，刷镲与温暖钢琴轻轻摇摆……",
    promptLabel: "描述想生成的音乐", startGeneration: "开始生成", vocalRule: "人声规则",
    vocalAuto: "自动", vocalInstrumental: "纯器乐", vocalEnabled: "人声", preferences: "PREFERENCES",
    close: "关闭", interfaceLanguage: "界面语言", apiConfiguration: "API 配置",
    apiNeverShown: "密钥只保存在本机，界面不会回显完整内容。",
    apiKeyPlaceholder: "输入新 Key；留空则保留当前配置", testConnection: "测试连接",
    removeSavedKey: "移除已保存的 Key", rememberApiKeys: "记住 API Key",
    rememberApiKeysHelp: "开启后写入本机 .env；关闭后仅在本次服务运行期间使用。",
    cancel: "取消", save: "保存", configuredKey: "已配置 · {masked}", missingKey: "尚未配置",
    settingsSaved: "设置已保存。", settingsLoadFailed: "无法读取设置。", settingsSaveFailed: "无法保存设置。",
    apiKeyRequired: "请先输入 API Key，或配置可用的环境变量。", testingConnection: "正在测试连接…",
    connectionOk: "连接成功。", connectionFailed: "连接失败，请检查 API Key 和网络连接。",
    keyCleared: "已移除保存的 API Key。", keyFallback: "已移除本地保存的 Key；当前仍检测到环境变量中的可用 Key。",
    emptyTasks: "还没有任务。<br />从一个声音画面开始吧。",
    queued: "等待开始", composing: "正在整理编曲", generating: "Lyria 正在生成", completed: "已完成",
    failed: "生成失败", pause: "暂停", play: "播放", pausePlayback: "暂停播放", resumePlayback: "继续播放",
    playInPlayer: "在播放器中播放", thisMusic: "这首音乐", finishedTrack: "完整成品",
    audioPlaybackFailed: "音频播放失败。", audioLoadFailed: "音频加载失败，请重启本地服务后重试。",
    unnamedWork: "未命名作品", thinking: "正在构思…", lyriaPrompt: "Lyria 生成提示", musicalDirection: "音乐方向",
    genre: "风格", mood: "情绪", tempo: "速度", tonality: "调性", instrumentation: "编制", vocals: "人声",
    retrievalContext: "检索记录", retrievalQuery: "英文检索描述", retrievedReferences: "参考曲目",
    openTonality: "开放调性", enabled: "启用", instrumentalNoVocals: "纯器乐 · 无人声", listen: "试听成品",
    inProgress: "IN PROGRESS", generatingProgress: "编曲提示已经完成，正在等待 Lyria 返回音频。",
    composingProgress: "OpenAI Composer 正在把你的描述整理成一致的音乐规格。",
    taskInterrupted: "任务已中断", taskFailedFallback: "任务未能完成。", continueTask: "继续此任务",
    restoring: "正在恢复…", restoreFailed: "无法恢复任务。", createFailed: "无法创建任务。",
  },
  en: {
    pageTitle: "Arioso · AI Music Studio",
    newTask: "New task", tasks: "Tasks", musicTasks: "Music tasks", settings: "Settings",
    localWorkspace: "Local creative space", heroEyebrow: "COMPOSE WITH INTENT",
    heroTitle: "Turn an idea<br />into a piece of music.",
    heroCopy: "Describe a scene, feeling, or sound. Arioso shapes it into a complete music specification before sending it to Lyria.",
    generationSettings: "Generation settings", generationMode: "Mode", modeGenerate: "Compose and generate music",
    modeCompose: "Compose prompt only", lyriaModel: "Lyria model", lyriaClip: "Lyria 3 Clip · 30 seconds",
    lyriaFull: "Lyria 3.5 · Full song", examplesTitle: "Start with a sonic scene",
    examplesHint: "Choose an example, then edit it freely", backHome: "← Back to studio", nowPlaying: "NOW PLAYING",
    noMusicSelected: "No music selected", promptPlaceholder: "For example: lazy afternoon jazz with brushes and warm, gently swinging piano…",
    promptLabel: "Describe the music to create", startGeneration: "Start generation", vocalRule: "Vocal rule",
    vocalAuto: "Auto", vocalInstrumental: "Instrumental", vocalEnabled: "Vocals", preferences: "PREFERENCES",
    close: "Close", interfaceLanguage: "Interface language", apiConfiguration: "API configuration",
    apiNeverShown: "Keys stay on this computer and are never displayed in full.",
    apiKeyPlaceholder: "Enter a new key; leave blank to keep the current one", testConnection: "Test connection",
    removeSavedKey: "Remove saved key", rememberApiKeys: "Remember API keys",
    rememberApiKeysHelp: "When enabled, keys are written to the local .env; otherwise they last only for this server session.",
    cancel: "Cancel", save: "Save", configuredKey: "Configured · {masked}", missingKey: "Not configured",
    settingsSaved: "Settings saved.", settingsLoadFailed: "Settings could not be loaded.", settingsSaveFailed: "Settings could not be saved.",
    apiKeyRequired: "Enter an API key or configure a valid environment variable first.", testingConnection: "Testing connection…",
    connectionOk: "Connection successful.", connectionFailed: "Connection failed. Check the API key and network connection.",
    keyCleared: "The saved API key was removed.", keyFallback: "The locally saved key was removed; a key is still available from the environment.",
    emptyTasks: "No tasks yet.<br />Start with a sonic scene.",
    queued: "Waiting to start", composing: "Composing", generating: "Lyria is generating", completed: "Completed",
    failed: "Generation failed", pause: "Pause ", play: "Play ", pausePlayback: "Pause", resumePlayback: "Resume",
    playInPlayer: "Play in player", thisMusic: "this music", finishedTrack: "Finished track",
    audioPlaybackFailed: "Audio playback failed.", audioLoadFailed: "Audio failed to load. Restart the local server and try again.",
    unnamedWork: "Untitled work", thinking: "Thinking…", lyriaPrompt: "Lyria generation prompt", musicalDirection: "Musical direction",
    genre: "Genre", mood: "Mood", tempo: "Tempo", tonality: "Tonality", instrumentation: "Instrumentation", vocals: "Vocals",
    retrievalContext: "Retrieval record", retrievalQuery: "English retrieval description", retrievedReferences: "Reference tracks",
    openTonality: "Open tonality", enabled: "Enabled", instrumentalNoVocals: "Instrumental · no vocals", listen: "Listen",
    inProgress: "IN PROGRESS", generatingProgress: "The composition prompt is ready. Waiting for Lyria to return audio.",
    composingProgress: "OpenAI Composer is turning your description into a coherent music specification.",
    taskInterrupted: "Task interrupted", taskFailedFallback: "The task could not be completed.", continueTask: "Continue task",
    restoring: "Restoring…", restoreFailed: "The task could not be restored.", createFailed: "The task could not be created.",
  },
};

const examples = [
  {
    title: "午后爵士",
    description: "慵懒松弛的午后爵士，刷镲、低音提琴与温暖钢琴轻轻摇摆。",
    prompt: "一段 30 秒的慵懒午后爵士，纯器乐，78 BPM，轻柔的 swing 节奏。以刷镲、低音提琴和温暖的爵士钢琴为核心，加入少量圆润的次中音萨克斯即兴。整体松弛、惬意、带一点阳光洒进咖啡馆的暖意；动态克制，结尾自然收束并适合循环。不要人声。",
    tags: ["Jazz", "慵懒", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Afternoon Jazz",
      description: "Loose afternoon jazz with brushes, double bass, and warm, gently swinging piano.",
      prompt: "A 30-second lazy afternoon jazz instrumental at 78 BPM with a gentle swing. Center the arrangement on brushed drums, double bass, and warm jazz piano, with a small amount of rounded tenor saxophone improvisation. Keep it relaxed, sunlit, and intimate, with restrained dynamics and a natural loop-friendly ending. Instrumental only, no vocals.",
      tags: ["Jazz", "Relaxed", "Instrumental"],
    },
  },
  {
    title: "中土远征",
    description: "大气磅礴的史诗奇幻配乐，描绘古老群山、辽阔原野与英雄远征。",
    prompt: "一段 30 秒的大气磅礴史诗级奇幻背景音乐，纯器乐，具有霍比特人式中土世界的古老、壮阔与远征感，但不要复刻任何具体旋律。以圆号、低音弦乐、定音鼓和宏大的交响乐团为主体，加入爱尔兰哨笛与民谣小提琴的遥远色彩。开头从群山晨雾般的低沉主题展开，中段逐层推进，结尾抵达英勇而震撼的高潮。不要人声或合唱。",
    tags: ["Epic", "奇幻史诗", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Mythic Expedition",
      description: "Expansive epic-fantasy scoring for ancient mountains, open plains, and a heroic expedition.",
      prompt: "A 30-second grand epic-fantasy instrumental with an ancient, expansive sense of expedition, without copying any existing melody. Build around horns, low strings, timpani, and full orchestra, colored by distant tin whistle and folk fiddle. Begin with a low theme like morning mist over mountains, build in layers, and arrive at a heroic, powerful climax. Instrumental only, with no vocals or choir.",
      tags: ["Epic", "Fantasy", "Instrumental"],
    },
  },
  {
    title: "山野欢歌",
    description: "明亮欢快的中国民谣，竹笛、琵琶与扬琴奏出热闹的山野气息。",
    prompt: "一段 30 秒欢快明亮的中国民谣，纯器乐，112 BPM，轻快的 2/4 节拍。以竹笛演奏朗朗上口的五声音阶旋律，琵琶与扬琴活泼应答，二胡点缀流畅的副旋律，并用轻巧的堂鼓、木鱼和拍手感节奏增添喜庆活力。整体自然、质朴、热烈，像春日山野里的集市与踏青。不要人声。",
    tags: ["中国民谣", "欢快", "纯器乐"],
    vocalMode: "instrumental",
    en: {
      title: "Mountain Folk Song",
      description: "Bright Chinese folk music led by bamboo flute, pipa, and yangqin.",
      prompt: "A 30-second bright and joyful Chinese folk instrumental at 112 BPM in a light 2/4 meter. Feature bamboo flute on a memorable pentatonic melody, with lively responses from pipa and yangqin, a flowing erhu countermelody, and light tanggu, woodblock, and handclap-like percussion. Keep it natural, rustic, and celebratory, like a spring market in the mountains. Instrumental only, no vocals.",
      tags: ["Chinese folk", "Joyful", "Instrumental"],
    },
  },
];

const state = {
  tasks: [],
  selectedTaskId: null,
  playingTaskId: null,
  submitting: false,
  language: "zh-CN",
  settings: null,
};
const elements = {
  homeView: document.querySelector("#home-view"),
  taskView: document.querySelector("#task-view"),
  taskDetail: document.querySelector("#task-detail"),
  taskList: document.querySelector("#task-list"),
  taskCount: document.querySelector("#task-count"),
  form: document.querySelector("#composer-form"),
  input: document.querySelector("#prompt-input"),
  submit: document.querySelector("#submit-task"),
  message: document.querySelector("#form-message"),
  mode: document.querySelector("#mode-select"),
  lyriaModel: document.querySelector("#lyria-model-select"),
  vocalModes: document.querySelectorAll('input[name="vocal-mode"]'),
  globalPlayer: document.querySelector("#global-player"),
  audio: document.querySelector("#audio-player"),
  playerTitle: document.querySelector("#player-title"),
  playerMeta: document.querySelector("#player-meta"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  settingsMessage: document.querySelector("#settings-message"),
  language: document.querySelector("#language-select"),
  openAiKey: document.querySelector("#openai-api-key"),
  geminiKey: document.querySelector("#gemini-api-key"),
  rememberApiKeys: document.querySelector("#remember-api-keys"),
  saveSettings: document.querySelector("#save-settings"),
};

function t(key, values = {}) {
  const catalog = translations[state.language] || translations["zh-CN"];
  const template = catalog[key] ?? translations["zh-CN"][key] ?? key;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function statusLabel(status) {
  return t(status);
}

function localizedExample(example) {
  return state.language === "en" ? { ...example, ...example.en } : example;
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  renderExamples();
  renderTaskList();
  const selected = state.tasks.find((task) => task.id === state.selectedTaskId);
  if (selected) renderTaskDetail(selected);
  if (state.playingTaskId) {
    const playing = state.tasks.find((task) => task.id === state.playingTaskId);
    if (playing) elements.playerMeta.textContent = `${playing.lyriaModel} · ${t("finishedTrack")}`;
  }
  renderCredentialStatus();
}

function selectedVocalMode() {
  return [...elements.vocalModes].find((input) => input.checked)?.value ?? "auto";
}

function selectVocalMode(mode) {
  const input = [...elements.vocalModes].find((candidate) => candidate.value === mode);
  if (input) input.checked = true;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function statusClass(status) {
  if (["queued", "composing", "generating"].includes(status)) return "running";
  return status;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(state.language, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function taskIsPlaying(id) {
  return state.playingTaskId === id && !elements.audio.paused && !elements.audio.ended;
}

function syncPlaybackControls() {
  document.querySelectorAll("[data-play-task]").forEach((button) => {
    const task = state.tasks.find((item) => item.id === button.dataset.playTask);
    const playing = taskIsPlaying(button.dataset.playTask);
    const title = task?.title || task?.description || t("thisMusic");

    if (button.classList.contains("task-play")) {
      button.textContent = playing ? "Ⅱ" : "▶";
      button.setAttribute("aria-label", `${playing ? t("pause") : t("play")}${title}`);
      button.title = `${playing ? t("pause") : t("play")}${title}`;
    } else {
      button.textContent = playing
        ? t("pausePlayback")
        : state.playingTaskId === button.dataset.playTask
          ? t("resumePlayback")
          : t("playInPlayer");
    }
  });
}

async function playTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task?.audioFile) return;

  try {
    if (state.playingTaskId === id) {
      if (elements.audio.paused) {
        await elements.audio.play();
      } else {
        elements.audio.pause();
      }
      return;
    }

    state.playingTaskId = id;
    elements.playerTitle.textContent = task.title || task.description;
    elements.playerMeta.textContent = `${task.lyriaModel} · ${t("finishedTrack")}`;
    elements.globalPlayer.hidden = false;
    elements.audio.src = `/api/tasks/${encodeURIComponent(task.id)}/audio`;
    elements.audio.load();
    await elements.audio.play();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : t("audioPlaybackFailed");
  } finally {
    syncPlaybackControls();
  }
}

function renderExamples() {
  document.querySelector("#example-grid").innerHTML = examples.map((source, index) => {
    const example = localizedExample(source);
    return `
    <button class="example-card" type="button" data-example="${index}">
      <span class="example-art" aria-hidden="true"></span>
      <span class="example-copy">
        <h4>${escapeHtml(example.title)}</h4>
        <p>${escapeHtml(example.description)}</p>
        <span class="example-tags">${example.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
      </span>
    </button>
  `;
  }).join("");

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = examples[Number(button.dataset.example)];
      if (!source) return;
      const example = localizedExample(source);
      elements.input.value = example.prompt;
      selectVocalMode(example.vocalMode);
      elements.input.focus();
      elements.input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function renderTaskList() {
  elements.taskCount.textContent = String(state.tasks.length);
  if (!state.tasks.length) {
    elements.taskList.innerHTML = `<p class="empty-tasks">${t("emptyTasks")}</p>`;
    return;
  }
  elements.taskList.innerHTML = state.tasks.map((task) => `
    <div class="task-list-item">
      <button class="task-button ${task.id === state.selectedTaskId ? "active" : ""}" type="button" data-task-id="${task.id}">
        <strong>${escapeHtml(task.title || task.description)}</strong>
        <span class="task-meta">
          <span class="task-state-dot ${statusClass(task.status)}"></span>
          ${escapeHtml(statusLabel(task.status))} · ${formatTime(task.updatedAt)}
        </span>
      </button>
      ${task.audioFile ? `<button class="task-play" type="button" data-play-task="${task.id}"></button>` : ""}
    </div>
  `).join("");
  elements.taskList.querySelectorAll("[data-task-id]").forEach((button) => {
    button.addEventListener("click", () => selectTask(button.dataset.taskId));
  });
  elements.taskList.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
  });
  syncPlaybackControls();
}

function renderTaskDetail(task) {
  const running = ["queued", "composing", "generating"].includes(task.status);
  const title = task.title || (running ? t("thinking") : t("unnamedWork"));
  const spec = task.musicSpec;
  const promptPanel = spec ? `
    <div class="panel">
      <h3>${t("lyriaPrompt")}</h3>
      <div class="prompt-output">${escapeHtml(spec.lyriaPrompt)}</div>
    </div>
    <div class="panel">
      <h3>${t("musicalDirection")}</h3>
      <div class="spec-list">
        <div class="spec-row"><span>${t("genre")}</span><strong>${escapeHtml(spec.genres.join(" · "))}</strong></div>
        <div class="spec-row"><span>${t("mood")}</span><strong>${escapeHtml(spec.moods.join(" → "))}</strong></div>
        <div class="spec-row"><span>${t("tempo")}</span><strong>${spec.tempo.bpm ? `${spec.tempo.bpm} BPM · ` : ""}${escapeHtml(spec.tempo.feel)}</strong></div>
        <div class="spec-row"><span>${t("tonality")}</span><strong>${escapeHtml([spec.tonality.tonic, spec.tonality.mode].filter(Boolean).join(" ") || t("openTonality"))}</strong></div>
        <div class="spec-row"><span>${t("instrumentation")}</span><strong>${escapeHtml(spec.instrumentation.map((item) => item.name).join(" · "))}</strong></div>
        <div class="spec-row"><span>${t("vocals")}</span><strong>${spec.vocals.enabled ? escapeHtml([t("enabled"), spec.vocals.language, spec.vocals.style].filter(Boolean).join(" · ")) : t("instrumentalNoVocals")}</strong></div>
      </div>
    </div>
  ` : "";
  const retrievalPanel = task.retrievalQuery ? `
    <div class="panel">
      <h3>${t("retrievalContext")}</h3>
      <div class="spec-list">
        <div class="spec-row"><span>${t("retrievalQuery")}</span><strong>${escapeHtml(task.retrievalQuery)}</strong></div>
        <div class="spec-row"><span>${t("retrievedReferences")}</span><strong>${escapeHtml((task.retrievedReferenceIds || []).join(" · "))}</strong></div>
      </div>
    </div>
  ` : "";
  const audioPanel = task.audioFile ? `
    <div class="panel audio-panel">
      <div><h3>${t("listen")}</h3><p>${escapeHtml(task.lyriaModel)} · MP3</p></div>
      <button class="listen-button" type="button" data-play-task="${task.id}"></button>
    </div>
  ` : "";
  const progress = running ? `
    <div class="progress-card">
      <p class="eyebrow accent">${t("inProgress")}</p>
      <h3>${escapeHtml(statusLabel(task.status))}</h3>
      <div class="progress-line"></div>
      <p>${task.status === "generating" ? t("generatingProgress") : t("composingProgress")}</p>
    </div>
  ` : "";
  const error = task.status === "failed" ? `
    <div class="error-box">
      <div>
        <strong>${t("taskInterrupted")}</strong>
        <p>${escapeHtml(task.error || t("taskFailedFallback"))}</p>
      </div>
      <button class="retry-button" type="button" data-retry-task="${task.id}">${t("continueTask")}</button>
    </div>
  ` : "";

  elements.taskDetail.innerHTML = `
    <header class="task-header">
      <div>
        <p class="eyebrow">${escapeHtml(task.lyriaModel.toUpperCase())}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(task.description)}</p>
      </div>
      <span class="status-pill ${statusClass(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </header>
    ${progress}${error}
    ${spec || retrievalPanel ? `<div class="result-grid">${promptPanel}${retrievalPanel}${audioPanel}</div>` : ""}
  `;
  elements.taskDetail.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
  });
  elements.taskDetail.querySelectorAll("[data-retry-task]").forEach((button) => {
    button.addEventListener("click", () => retryTask(button.dataset.retryTask, button));
  });
  syncPlaybackControls();
}

function showHome() {
  state.selectedTaskId = null;
  elements.homeView.hidden = false;
  elements.taskView.hidden = true;
  renderTaskList();
}

function selectTask(id) {
  state.selectedTaskId = id;
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  elements.homeView.hidden = true;
  elements.taskView.hidden = false;
  renderTaskList();
  renderTaskDetail(task);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshTasks() {
  try {
    const response = await fetch("/api/tasks", { cache: "no-store" });
    if (!response.ok) return;
    const previousSelected = state.tasks.find((task) => task.id === state.selectedTaskId);
    state.tasks = await response.json();
    renderTaskList();
    if (state.selectedTaskId) {
      const selected = state.tasks.find((task) => task.id === state.selectedTaskId);
      if (selected && selected.updatedAt !== previousSelected?.updatedAt) {
        renderTaskDetail(selected);
      }
    }
    if (state.playingTaskId) {
      const playing = state.tasks.find((task) => task.id === state.playingTaskId);
      if (playing) {
        elements.playerTitle.textContent = playing.title || playing.description;
        elements.playerMeta.textContent = `${playing.lyriaModel} · ${t("finishedTrack")}`;
      }
    }
  } catch {
    // A temporary polling failure should not replace the current interface.
  }
}

async function retryTask(id, button) {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = t("restoring");
  elements.message.textContent = "";

  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(id)}/retry`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("restoreFailed"));

    const index = state.tasks.findIndex((task) => task.id === result.id);
    if (index >= 0) state.tasks[index] = result;
    renderTaskList();
    if (state.selectedTaskId === result.id) renderTaskDetail(result);
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : String(error);
    button.disabled = false;
    button.textContent = t("continueTask");
  }
}

async function submitTask(event) {
  event.preventDefault();
  if (state.submitting) return;
  state.submitting = true;
  elements.submit.disabled = true;
  elements.message.textContent = "";

  try {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: elements.input.value,
        mode: elements.mode.value,
        lyriaModel: elements.lyriaModel.value,
        vocalMode: selectedVocalMode(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("createFailed"));
    elements.input.value = "";
    state.tasks.unshift(result);
    selectTask(result.id);
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    state.submitting = false;
    elements.submit.disabled = false;
  }
}

function setSettingsMessage(message, success = false) {
  elements.settingsMessage.textContent = message;
  elements.settingsMessage.classList.toggle("success", success);
}

function renderCredentialStatus() {
  if (!state.settings) return;
  for (const provider of ["openai", "gemini"]) {
    const summary = state.settings.credentials[provider];
    const status = document.querySelector(`#${provider}-key-status`);
    status.textContent = summary.configured
      ? t("configuredKey", { masked: summary.masked })
      : t("missingKey");
    status.classList.toggle("configured", summary.configured);
  }
}

async function loadSettings() {
  const response = await fetch("/api/settings", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || t("settingsLoadFailed"));
  state.settings = result;
  state.language = result.language;
  elements.language.value = result.language;
  elements.openAiKey.value = "";
  elements.geminiKey.value = "";
  applyTranslations();
}

async function openSettings() {
  setSettingsMessage("");
  try {
    await loadSettings();
    elements.settingsDialog.showModal();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : t("settingsLoadFailed");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  elements.saveSettings.disabled = true;
  setSettingsMessage("");

  const credentials = {};
  if (elements.openAiKey.value.trim()) credentials.openai = elements.openAiKey.value.trim();
  if (elements.geminiKey.value.trim()) credentials.gemini = elements.geminiKey.value.trim();

  try {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: elements.language.value,
        remember: elements.rememberApiKeys.checked,
        ...(Object.keys(credentials).length ? { credentials } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("settingsSaveFailed"));
    state.settings = result;
    state.language = result.language;
    elements.openAiKey.value = "";
    elements.geminiKey.value = "";
    applyTranslations();
    elements.settingsDialog.close();
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    elements.saveSettings.disabled = false;
  }
}

async function testConnection(provider, button) {
  const input = provider === "openai" ? elements.openAiKey : elements.geminiKey;
  button.disabled = true;
  setSettingsMessage(t("testingConnection"));
  try {
    const response = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: input.value.trim() || undefined }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("connectionFailed"));
    setSettingsMessage(result.ok ? t("connectionOk") : t("connectionFailed"), result.ok);
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("connectionFailed"));
  } finally {
    button.disabled = false;
  }
}

async function clearCredential(provider, button) {
  button.disabled = true;
  setSettingsMessage("");
  try {
    const response = await fetch(`/api/settings/credentials/${provider}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t("settingsSaveFailed"));
    state.settings = result;
    const input = provider === "openai" ? elements.openAiKey : elements.geminiKey;
    input.value = "";
    renderCredentialStatus();
    setSettingsMessage(
      result.credentials[provider].configured ? t("keyFallback") : t("keyCleared"),
      true,
    );
  } catch (error) {
    setSettingsMessage(error instanceof Error ? error.message : t("settingsSaveFailed"));
  } finally {
    button.disabled = false;
  }
}

elements.form.addEventListener("submit", submitTask);
elements.settingsForm.addEventListener("submit", saveSettings);
elements.audio.addEventListener("play", syncPlaybackControls);
elements.audio.addEventListener("pause", syncPlaybackControls);
elements.audio.addEventListener("ended", syncPlaybackControls);
elements.audio.addEventListener("error", () => {
  elements.message.textContent = t("audioLoadFailed");
  syncPlaybackControls();
});
document.querySelector("#new-task").addEventListener("click", () => { showHome(); elements.input.focus(); });
document.querySelector("#back-home").addEventListener("click", showHome);
document.querySelector("#open-settings").addEventListener("click", openSettings);
document.querySelector("#close-settings").addEventListener("click", () => elements.settingsDialog.close());
document.querySelector("#cancel-settings").addEventListener("click", () => elements.settingsDialog.close());
elements.language.addEventListener("change", () => {
  state.language = elements.language.value;
  applyTranslations();
});
elements.settingsDialog.addEventListener("close", () => {
  if (state.settings && state.language !== state.settings.language) {
    state.language = state.settings.language;
    elements.language.value = state.language;
    applyTranslations();
  }
});
document.querySelectorAll("[data-test-provider]").forEach((button) => {
  button.addEventListener("click", () => testConnection(button.dataset.testProvider, button));
});
document.querySelectorAll("[data-clear-provider]").forEach((button) => {
  button.addEventListener("click", () => clearCredential(button.dataset.clearProvider, button));
});

try {
  await loadSettings();
} catch {
  applyTranslations();
}
refreshTasks();
setInterval(refreshTasks, 1500);
