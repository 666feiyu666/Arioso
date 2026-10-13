// MoodMic — a dedicated mood-to-music experience for the DH6012 course project.
// It reuses the existing Arioso backend (creative discussion + composition tasks)
// without adding new music-generation capabilities.

const COPY = {
  "zh-CN": {
    backEntry: "← 返回入口",
    moodEyebrow: "STEP 1 · 心情",
    moodTitle: "把此刻的心情，\n变成一段音乐。",
    moodLead: "先说说你现在的心情，以及希望这段音乐带给你什么感觉。不用懂音乐，用自己的话说就好。",
    moodChipsLabel: "或者，选几个贴近此刻的词",
    moodPlaceholder: "例如：今天有点累，但又很平静。希望这段音乐像雨后的黄昏，安静、温柔，有一点余温。",
    moodImage: "＋ 添加参考图片（可选）",
    moodImageHint: "一张图可以帮助我们理解你想要的感觉。",
    moodEmpty: "先写点什么，或选一个词，再继续。",
    continue: "继续",
    back: "返回",
    shapeEyebrow: "STEP 2 · 形态",
    shapeTitle: "你想要一首单曲，还是一张专辑？",
    shapeLead: "两者都从你的心情出发，只是承载的方式不同。",
    pieceKind: "SINGLE PIECE",
    pieceTitle: "一首单曲",
    pieceCopy: "一段完整的瞬间。像把这一个心情，完整地留在三分钟里。",
    albumKind: "ALBUM",
    albumTitle: "一张专辑",
    albumCopy: "一组有共同情绪方向的曲子，各有性格，又能连在一起听。",
    albumCount: "曲目数量",
    albumMinutes: "目标总时长",
    albumOptionsHint: "可以先按默认，之后随时能改。",
    clarifyEyebrow: "STEP 3 · 方向",
    clarifyTitle: "说说你更具体的期待。",
    clarifyLead: "多补充一点，音乐会更容易贴近你的心情。",
    director: "创作讨论",
    directorHint: "你可以随时补充",
    replyPlaceholder: "补充你的想法：想要的乐器、节奏、画面，或者不想要的东西……",
    send: "发送",
    thinking: "正在理解你的心情…",
    directionReady: "这个方向合适吗？",
    directionReadyHint: "你可以继续补充，或把当前共识整理成最终提示词。",
    makePrompt: "使用当前方向",
    promptLabel: "作曲提示词",
    promptHint: "可编辑；确认后即可开始创作。",
    advanced: "更多设置",
    generationMode: "生成模式",
    modeGenerate: "编曲并生成音乐",
    modeCompose: "仅生成编曲提示",
    lyriaModel: "Lyria 模型",
    lyriaClip: "Lyria 3 Clip · 30 秒",
    lyriaFull: "Lyria 3.5 · 完整歌曲",
    vocalRule: "人声规则",
    vocalAuto: "自动",
    vocalInstrumental: "纯器乐",
    vocalVocals: "人声",
    approve: "开始创作",
    creatingEyebrow: "STEP 4 · 创作中",
    creatingTitle: "正在为你创作…",
    creatingLead: "这通常需要一两分钟，你可以先泡杯茶。",
    trackPending: "等待中",
    listenEyebrow: "STEP 5 · 完成",
    listenFallbackTitle: "你的音乐已经好了。",
    listenAlbumFallbackTitle: "你的专辑已经好了。",
    listenLead: "戴上耳机，听听看。",
    download: "下载音频",
    exportAlbum: "导出整张专辑 (MP3)",
    exporting: "正在导出…",
    another: "再做一段",
    openWorkflow: "在工作流中打开",
    failedTitle: "这次创作中断了",
    failedLead: "可能是生成服务临时不可用。你可以重试。",
    retry: "重试",
    statusQueued: "排队中",
    statusComposing: "正在构思编曲",
    statusGenerating: "正在生成音频",
    statusAssembling: "正在拼接乐章",
    statusProcessing: "正在后期处理",
    statusCompleted: "已完成",
    statusFailed: "失败",
    phaseComposing: "Arioso 正在把你的心情整理成完整的音乐规格…",
    phaseGenerating: "Lyria 正在把这段编曲变成声音…",
    phaseAlbum: "正在逐首生成候选曲目，每首都会不一样…",
    phaseProcessing: "正在做最后的整理与导出…",
    errorGeneric: "出了点问题，请再试一次。",
    loading: "正在准备…",
  },
  en: {
    backEntry: "← Back to entrances",
    moodEyebrow: "STEP 1 · MOOD",
    moodTitle: "Turn how you feel\ninto a piece of music.",
    moodLead: "Start with your mood right now, and how you want the music to feel. No musical training needed — your own words are enough.",
    moodChipsLabel: "Or pick a few words close to this moment",
    moodPlaceholder: "e.g. Tired today, but calm. I want it to feel like dusk after rain — quiet, tender, still a little warm.",
    moodImage: "+ Add a reference image (optional)",
    moodImageHint: "An image can help us understand the feeling you want.",
    moodEmpty: "Write something or pick a word before continuing.",
    continue: "Continue",
    back: "Back",
    shapeEyebrow: "STEP 2 · FORM",
    shapeTitle: "A single piece, or an album?",
    shapeLead: "Both start from your mood — they just hold it differently.",
    pieceKind: "SINGLE PIECE",
    pieceTitle: "One piece",
    pieceCopy: "A complete moment — one feeling kept whole inside a few minutes.",
    albumKind: "ALBUM",
    albumTitle: "An album",
    albumCopy: "A set of tracks with a shared emotional direction: their own characters, listenable as a whole.",
    albumCount: "Number of tracks",
    albumMinutes: "Target length",
    albumOptionsHint: "Defaults are fine — you can change this later.",
    clarifyEyebrow: "STEP 3 · DIRECTION",
    clarifyTitle: "Tell us a bit more.",
    clarifyLead: "A little more detail helps the music fit your mood.",
    director: "Creative discussion",
    directorHint: "Add anything you like",
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
    lyriaModel: "Lyria model",
    lyriaClip: "Lyria 3 Clip · 30s",
    lyriaFull: "Lyria 3.5 · full song",
    vocalRule: "Vocals",
    vocalAuto: "Auto",
    vocalInstrumental: "Instrumental",
    vocalVocals: "With vocals",
    approve: "Start creating",
    creatingEyebrow: "STEP 4 · CREATING",
    creatingTitle: "Creating your music…",
    creatingLead: "This usually takes a minute or two. Put the kettle on.",
    trackPending: "Waiting",
    listenEyebrow: "STEP 5 · DONE",
    listenFallbackTitle: "Your music is ready.",
    listenAlbumFallbackTitle: "Your album is ready.",
    listenLead: "Put on your headphones and have a listen.",
    download: "Download audio",
    exportAlbum: "Export full album (MP3)",
    exporting: "Exporting…",
    another: "Create another",
    openWorkflow: "Open in workflow studio",
    failedTitle: "This run was interrupted",
    failedLead: "The generation service may be temporarily unavailable. You can retry.",
    retry: "Retry",
    statusQueued: "Queued",
    statusComposing: "Shaping the arrangement",
    statusGenerating: "Generating audio",
    statusAssembling: "Assembling movements",
    statusProcessing: "Post-processing",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    phaseComposing: "Arioso is shaping your mood into a complete musical spec…",
    phaseGenerating: "Lyria is turning that arrangement into sound…",
    phaseAlbum: "Generating candidate tracks one by one — each will differ…",
    phaseProcessing: "Doing the final assembly and export…",
    errorGeneric: "Something went wrong. Please try again.",
    loading: "Getting ready…",
  },
};

const CHIPS = [
  { id: "calm", zh: "平静", en: "Calm" },
  { id: "warm", zh: "温暖", en: "Warm" },
  { id: "tender", zh: "温柔", en: "Tender" },
  { id: "nostalgic", zh: "怀念", en: "Nostalgic" },
  { id: "melancholy", zh: "忧郁", en: "Melancholy" },
  { id: "nocturnal", zh: "夜色", en: "Nocturnal" },
  { id: "uplifting", zh: "振奋", en: "Uplifting" },
  { id: "bright", zh: "明亮", en: "Bright" },
  { id: "lonely", zh: "孤独", en: "Lonely" },
  { id: "hopeful", zh: "期盼", en: "Hopeful" },
];

const ALBUM_COUNTS = [8, 12, 14, 16];
const ALBUM_MINUTES = [20, 30, 35, 45];

const stage = document.querySelector("#mm-stage");
const langToggle = document.querySelector("#lang-toggle");

const state = {
  step: "mood",
  language: "zh-CN",
  chips: new Set(),
  moodText: "",
  shape: "single",
  candidateCount: 14,
  targetTotalMinutes: 35,
  image: null,
  imageUrl: null,
  session: null,
  pending: null,
  thinking: false,
  replyDraft: "",
  proposal: "",
  advanced: { mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" },
  task: null,
  pollTimer: null,
  busy: false,
  message: "",
  messageError: false,
};

function t(key) {
  return (COPY[state.language] ?? COPY["zh-CN"])[key] ?? key;
}

function chipLabel(chip) {
  return state.language === "en" ? chip.en : chip.zh;
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

// ---------------------------------------------------------------------------
// Task option / request builders

function discussionOptions() {
  const base = {
    description: "Pending creative discussion.",
    corpusMode: "none",
    workflowType: state.shape === "album" ? "04-album" : "01-general",
    compositionMode: state.shape === "album" ? "album" : "single",
  };
  if (state.shape === "album") {
    return {
      ...base,
      mode: "generate",
      lyriaModel: "lyria-3.5",
      vocalMode: "instrumental",
      candidateCount: state.candidateCount,
      targetTotalMinutes: state.targetTotalMinutes,
    };
  }
  return {
    ...base,
    mode: state.advanced.mode,
    lyriaModel: state.advanced.lyriaModel,
    vocalMode: state.advanced.vocalMode,
  };
}

function moodMessage() {
  const words = [...state.chips]
    .map((id) => CHIPS.find((chip) => chip.id === id))
    .filter(Boolean)
    .map(chipLabel);
  const detail = state.moodText.trim();
  const line = [...words, detail].filter(Boolean).join("，");
  const tail = /[。！？.!?]$/.test(line) ? "" : "。";
  if (state.language === "en") {
    const gloss = /[.!?]$/.test(line) ? "" : ".";
    return state.shape === "album"
      ? `I'd like to make an album from how I feel right now: ${line}${gloss}`
      : `I'd like to make a single piece from how I feel right now: ${line}${gloss}`;
  }
  return state.shape === "album"
    ? `我想把此刻的心情做成一张专辑：${line}${tail}`
    : `我想把此刻的心情写成一首单曲：${line}${tail}`;
}

// ---------------------------------------------------------------------------
// Rendering

function render() {
  document.documentElement.lang = state.language;
  langToggle.textContent = state.language === "zh-CN" ? "EN" : "中文";
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const value = (COPY[state.language] ?? COPY["zh-CN"])[node.dataset.i18n];
    if (value !== undefined) node.textContent = value;
  }
  const renderers = {
    mood: renderMood,
    shape: renderShape,
    clarify: renderClarify,
    creating: renderCreating,
    listen: renderListen,
  };
  (renderers[state.step] ?? renderMood)();
}

function head(eyebrow, title, lead) {
  return `
    <div class="mm-step-head">
      <p class="e-eyebrow accent">${esc(eyebrow)}</p>
      <h2 class="mm-title">${esc(title).replace(/\n/g, "<br />")}</h2>
      ${lead ? `<p class="mm-lead">${esc(lead)}</p>` : ""}
    </div>
  `;
}

function messageLine() {
  if (!state.message) return "";
  return `<p class="e-message${state.messageError ? " error" : ""}">${esc(state.message)}</p>`;
}

function setStage(html) {
  stage.innerHTML = html;
}

// Step 1 --------------------------------------------------------------------

function renderMood() {
  setStage(`
    ${head(t("moodEyebrow"), t("moodTitle"), t("moodLead"))}
    <div class="mm-card">
      <div class="mm-chips" role="group" aria-label="${esc(t("moodChipsLabel"))}">
        ${CHIPS.map((chip) => `
          <button class="mm-chip" type="button" data-chip="${chip.id}"
            aria-pressed="${state.chips.has(chip.id) ? "true" : "false"}">${esc(chipLabel(chip))}</button>
        `).join("")}
      </div>
      <label class="e-field">
        <span class="e-visually-hidden">${esc(t("moodChipsLabel"))}</span>
        <textarea class="e-textarea" id="mm-mood-text" maxlength="2000"
          placeholder="${esc(t("moodPlaceholder"))}">${esc(state.moodText)}</textarea>
      </label>
      <div class="mm-attach-row">
        <button class="e-btn e-btn-secondary" type="button" id="mm-attach">${esc(t("moodImage"))}</button>
        <input type="file" id="mm-image-input" accept="image/jpeg,image/png,image/webp" hidden />
        <span class="e-hint">${esc(t("moodImageHint"))}</span>
        ${state.imageUrl ? `
          <span class="mm-attach-preview">
            <img src="${esc(state.imageUrl)}" alt="" />
            <span>${esc(state.image?.name ?? "")}</span>
            <button type="button" id="mm-remove-image" aria-label="remove">×</button>
          </span>` : ""}
      </div>
      ${messageLine()}
      <div class="mm-actions">
        <button class="e-btn e-btn-primary" type="button" id="mm-next">${esc(t("continue"))} →</button>
      </div>
    </div>
  `);

  const textarea = stage.querySelector("#mm-mood-text");
  textarea.addEventListener("input", () => { state.moodText = textarea.value; });
  for (const button of stage.querySelectorAll("[data-chip]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.chip;
      if (state.chips.has(id)) state.chips.delete(id);
      else state.chips.add(id);
      button.setAttribute("aria-pressed", state.chips.has(id) ? "true" : "false");
    });
  }
  stage.querySelector("#mm-attach").addEventListener("click", () => stage.querySelector("#mm-image-input").click());
  stage.querySelector("#mm-image-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.image = file;
    state.imageUrl = URL.createObjectURL(file);
    state.message = "";
    renderMood();
  });
  stage.querySelector("#mm-remove-image")?.addEventListener("click", () => {
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.image = null;
    state.imageUrl = null;
    renderMood();
  });
  stage.querySelector("#mm-next").addEventListener("click", () => {
    state.moodText = textarea.value;
    if (!state.chips.size && !state.moodText.trim()) {
      state.message = t("moodEmpty");
      state.messageError = true;
      renderMood();
      return;
    }
    state.message = "";
    state.messageError = false;
    state.step = "shape";
    render();
  });
}

// Step 2 --------------------------------------------------------------------

function renderShape() {
  setStage(`
    ${head(t("shapeEyebrow"), t("shapeTitle"), t("shapeLead"))}
    <div class="mm-card">
      <div class="mm-shape-grid">
        <button class="mm-shape" type="button" data-shape="single" aria-pressed="${state.shape === "single"}">
          <span class="mm-shape-kind">${esc(t("pieceKind"))}</span>
          <h3>${esc(t("pieceTitle"))}</h3>
          <p>${esc(t("pieceCopy"))}</p>
        </button>
        <button class="mm-shape" type="button" data-shape="album" aria-pressed="${state.shape === "album"}">
          <span class="mm-shape-kind">${esc(t("albumKind"))}</span>
          <h3>${esc(t("albumTitle"))}</h3>
          <p>${esc(t("albumCopy"))}</p>
        </button>
      </div>
      <div class="mm-album-options" id="mm-album-options" ${state.shape === "album" ? "" : "hidden"}>
        <label class="mm-inline-field">
          <span>${esc(t("albumCount"))}</span>
          <select id="mm-album-count">
            ${ALBUM_COUNTS.map((n) => `<option value="${n}" ${n === state.candidateCount ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </label>
        <label class="mm-inline-field">
          <span>${esc(t("albumMinutes"))}</span>
          <select id="mm-album-minutes">
            ${ALBUM_MINUTES.map((n) => `<option value="${n}" ${n === state.targetTotalMinutes ? "selected" : ""}>${n} min</option>`).join("")}
          </select>
        </label>
        <p class="e-hint" style="align-self:flex-end">${esc(t("albumOptionsHint"))}</p>
      </div>
      ${messageLine()}
      <div class="mm-actions">
        <button class="e-btn e-btn-secondary" type="button" id="mm-back">${esc(t("back"))}</button>
        <button class="e-btn e-btn-primary" type="button" id="mm-start" ${state.busy ? "disabled" : ""}>
          ${esc(state.busy ? t("loading") : t("continue"))} →
        </button>
      </div>
    </div>
  `);

  for (const button of stage.querySelectorAll("[data-shape]")) {
    button.addEventListener("click", () => {
      state.shape = button.dataset.shape;
      renderShape();
    });
  }
  const count = stage.querySelector("#mm-album-count");
  count?.addEventListener("change", () => { state.candidateCount = Number(count.value); });
  const minutes = stage.querySelector("#mm-album-minutes");
  minutes?.addEventListener("change", () => { state.targetTotalMinutes = Number(minutes.value); });
  stage.querySelector("#mm-back").addEventListener("click", () => { state.step = "mood"; render(); });
  stage.querySelector("#mm-start").addEventListener("click", beginDiscussion);
}

async function beginDiscussion() {
  if (state.busy) return;
  state.busy = true;
  state.message = "";
  renderShape();
  try {
    let session = await api("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discussionOptions()),
    });
    let attachmentIds = [];
    if (state.image) {
      const updated = await api(
        `/api/discussions/${encodeURIComponent(session.id)}/attachments?name=${encodeURIComponent(state.image.name)}`,
        { method: "POST", headers: { "Content-Type": state.image.type }, body: state.image },
      );
      session = updated;
      const attachment = updated.attachments?.at(-1);
      if (attachment) attachmentIds = [attachment.id];
    }
    state.session = session;
    state.pending = { content: moodMessage(), imageUrl: state.imageUrl };
    state.thinking = true;
    state.step = "clarify";
    render();

    const replied = await api(`/api/discussions/${encodeURIComponent(session.id)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: moodMessage(), attachmentIds }),
    });
    state.session = replied;
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
    state.messageError = true;
    state.step = "shape";
  } finally {
    state.pending = null;
    state.thinking = false;
    state.busy = false;
    render();
  }
}

// Step 3 --------------------------------------------------------------------

function moodBadge(message) {
  const mood = message.mood;
  if (!mood || !(mood.label || mood.imagery)) return "";
  const label = mood.label || mood.imagery;
  return `<span class="mm-mood-badge">${esc(label)}</span>`;
}

function renderClarify() {
  const session = state.session;
  const messages = session?.messages ?? [];
  const parts = messages.map((message) => {
    const images = (message.attachmentIds ?? []).map((id) => {
      const attachment = session.attachments?.find((item) => item.id === id);
      return attachment
        ? `<img src="/api/discussions/${encodeURIComponent(session.id)}/attachments/${encodeURIComponent(attachment.id)}" alt="${esc(attachment.originalName)}" />`
        : "";
    }).join("");
    return `<article class="mm-msg ${message.role}">${images}${moodBadge(message)}${esc(message.content)}</article>`;
  });
  if (state.pending) {
    const image = state.pending.imageUrl ? `<img src="${esc(state.pending.imageUrl)}" alt="" />` : "";
    parts.push(`<article class="mm-msg user">${image}${esc(state.pending.content)}</article>`);
  }
  if (state.thinking) {
    parts.push(`<div class="mm-typing" role="status" aria-label="${esc(t("thinking"))}"><span></span><span></span><span></span></div>`);
  }

  const hasAssistant = messages.some((message) => message.role === "assistant");
  const hasProposal = Boolean(state.proposal);
  const showDirection = hasAssistant && !hasProposal && !state.thinking;

  setStage(`
    ${head(t("clarifyEyebrow"), t("clarifyTitle"), t("clarifyLead"))}
    <div class="mm-card mm-discussion">
      <div class="mm-disc-head">
        <div>
          <strong>${esc(t("director"))}</strong>
        </div>
        <span class="mm-disc-status">${esc(state.thinking ? t("thinking") : t("directorHint"))}</span>
      </div>
      <div class="mm-thread">${parts.join("")}</div>

      <div class="mm-reply">
        <textarea class="e-textarea" id="mm-reply" maxlength="4000"
          placeholder="${esc(t("replyPlaceholder"))}">${esc(state.replyDraft)}</textarea>
        <button class="e-btn e-btn-secondary" type="button" id="mm-send" ${state.thinking ? "disabled" : ""}>${esc(t("send"))}</button>
      </div>

      ${showDirection ? `
        <div class="mm-direction">
          <div>
            <strong>${esc(t("directionReady"))}</strong>
            <span>${esc(t("directionReadyHint"))}</span>
          </div>
          <button class="e-btn e-btn-primary" type="button" id="mm-make-prompt">${esc(t("makePrompt"))} →</button>
        </div>` : ""}

      ${hasProposal ? `
        <div class="mm-proposal">
          <div class="mm-proposal-head">
            <label for="mm-proposal-text"><strong>${esc(t("promptLabel"))}</strong></label>
            <span>${esc(t("promptHint"))}</span>
          </div>
          <textarea class="e-textarea" id="mm-proposal-text" maxlength="8000">${esc(state.proposal)}</textarea>
          ${state.shape === "single" ? `
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
            </details>` : ""}
          <div class="mm-actions">
            <button class="e-btn e-btn-secondary" type="button" id="mm-more">${esc(t("back"))}</button>
            <button class="e-btn e-btn-primary" type="button" id="mm-approve" ${state.busy ? "disabled" : ""}>${esc(t("approve"))} →</button>
          </div>
        </div>` : ""}

      ${messageLine()}
    </div>
  `);

  const reply = stage.querySelector("#mm-reply");
  reply.addEventListener("input", () => { state.replyDraft = reply.value; });
  reply.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendDiscussionReply();
  });
  stage.querySelector("#mm-send").addEventListener("click", sendDiscussionReply);
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

  const thread = stage.querySelector(".mm-thread");
  if (thread) thread.scrollTop = thread.scrollHeight;
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
      }),
    });
    state.session = result.session;
    state.task = result.task;
    state.step = "creating";
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

// Step 4 --------------------------------------------------------------------

function progressPhase() {
  const task = state.task;
  if (!task) return t("loading");
  if (task.compositionMode === "album" && (task.status === "generating" || task.status === "composing")) {
    return t("phaseAlbum");
  }
  if (task.status === "composing") return t("phaseComposing");
  if (task.status === "generating") return t("phaseGenerating");
  if (task.status === "assembling" || task.status === "processing") return t("phaseProcessing");
  return t("loading");
}

function renderCreating() {
  const task = state.task;
  const tracks = (task?.albumTracks ?? []).slice().sort((a, b) => a.order - b.order);
  const trackList = task?.compositionMode === "album" && tracks.length
    ? `<ul class="mm-track-progress">${tracks.map((track) => {
        const cls = track.status === "completed" ? "done" : track.status === "failed" ? "failed" : "active";
        return `<li class="${cls}"><span class="mm-dot"></span><span class="mm-track-title">${String(track.order).padStart(2, "0")} · ${esc(track.title)}</span><span class="mm-track-state">${esc(statusLabel(track.status))}</span></li>`;
      }).join("")}</ul>`
    : "";

  setStage(`
    ${head(t("creatingEyebrow"), t("creatingTitle"), t("creatingLead"))}
    <div class="mm-card">
      <div class="mm-progress">
        <div class="mm-disc" aria-hidden="true"></div>
        <h3>${esc(statusLabel(task?.status ?? "queued"))}</h3>
        <p>${esc(progressPhase())}</p>
        <div class="mm-bar"><span></span></div>
        ${trackList}
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
        state.step = "listen";
        render();
        return;
      }
    } catch {
      /* Transient; keep polling. */
    }
    state.pollTimer = setTimeout(tick, 2500);
  };
  state.pollTimer = setTimeout(tick, 1500);
}

// Step 5 --------------------------------------------------------------------

function albumTracksInOrder(task) {
  const all = task.albumTracks ?? [];
  const playlist = task.albumPlaylist ?? [];
  if (playlist.length) {
    const ordered = playlist
      .map((trackId) => all.find((track) => track.id === trackId))
      .filter(Boolean);
    const rest = all.filter((track) => !playlist.includes(track.id));
    return [...ordered, ...rest].sort((a, b) => a.order - b.order);
  }
  return all.slice().sort((a, b) => a.order - b.order);
}

function renderListen() {
  const task = state.task;
  const failed = task?.status === "failed";
  if (failed) {
    setStage(`
      ${head(t("listenEyebrow"), t("failedTitle"), t("failedLead"))}
      <div class="mm-card">
        <div class="mm-error-box">
          <strong>${esc(t("failedTitle"))}</strong>
          <span>${esc(task.error || t("failedLead"))}</span>
        </div>
        <div class="mm-foot-actions">
          <button class="e-btn e-btn-primary" type="button" id="mm-retry">${esc(t("retry"))}</button>
          <button class="e-btn e-btn-secondary" type="button" id="mm-again">${esc(t("another"))}</button>
        </div>
      </div>
    `);
    stage.querySelector("#mm-retry").addEventListener("click", () => {
      state.step = "creating";
      render();
      pollTask();
    });
    stage.querySelector("#mm-again").addEventListener("click", resetAll);
    return;
  }

  const isAlbum = task?.compositionMode === "album";
  const title = task?.title || t(isAlbum ? "listenAlbumFallbackTitle" : "listenFallbackTitle");
  const desc = task?.description || "";

  if (!isAlbum) {
    setStage(`
      ${head(t("listenEyebrow"), title, t("listenLead"))}
      <div class="mm-card">
        <p class="mm-result-desc">${esc(desc)}</p>
        <audio class="mm-player" controls preload="metadata"
          src="/api/tasks/${encodeURIComponent(task.id)}/audio"></audio>
        <div class="mm-foot-actions">
          <a class="e-btn e-btn-secondary" href="/api/tasks/${encodeURIComponent(task.id)}/audio" download>${esc(t("download"))}</a>
          <a class="e-btn e-btn-secondary" href="/workflow.html">${esc(t("openWorkflow"))}</a>
          <button class="e-btn e-btn-primary" type="button" id="mm-again">${esc(t("another"))}</button>
        </div>
      </div>
    `);
    stage.querySelector("#mm-again").addEventListener("click", resetAll);
    return;
  }

  const tracks = albumTracksInOrder(task);
  const playable = tracks.filter((track) => track.status === "completed");
  setStage(`
    ${head(t("listenEyebrow"), title, t("listenLead"))}
    <div class="mm-card">
      <p class="mm-result-desc">${esc(desc)}</p>
      <audio class="mm-player" controls preload="metadata" id="mm-album-audio"></audio>
      <ul class="mm-track-list" id="mm-track-list">
        ${tracks.map((track) => {
          const ready = track.status === "completed";
          return `<li class="${ready ? "" : "pending"}" ${ready ? `data-track="${esc(track.id)}"` : ""}>
            <span class="mm-track-index">${String(track.order).padStart(2, "0")}</span>
            <span class="mm-track-name">${esc(track.title)}</span>
            <span class="mm-track-state">${esc(ready ? "" : statusLabel(track.status))}</span>
          </li>`;
        }).join("")}
      </ul>
      <div class="mm-foot-actions">
        <button class="e-btn e-btn-secondary" type="button" id="mm-export"
          ${playable.length ? "" : "disabled"}>${esc(t("exportAlbum"))}</button>
        <a class="e-btn e-btn-secondary" href="/workflow.html">${esc(t("openWorkflow"))}</a>
        <button class="e-btn e-btn-primary" type="button" id="mm-again">${esc(t("another"))}</button>
      </div>
      ${messageLine()}
    </div>
  `);

  const audio = stage.querySelector("#mm-album-audio");
  stage.querySelectorAll("[data-track]").forEach((item) => {
    item.addEventListener("click", () => {
      const trackId = item.dataset.track;
      audio.src = `/api/tasks/${encodeURIComponent(task.id)}/album/tracks/${encodeURIComponent(trackId)}/audio`;
      stage.querySelectorAll("[data-track]").forEach((other) => other.setAttribute("aria-current", "false"));
      item.setAttribute("aria-current", "true");
      audio.play().catch(() => {});
    });
  });

  stage.querySelector("#mm-export").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = t("exporting");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/album/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "included" }),
      });
      if (!response.ok) throw new Error(t("errorGeneric"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MoodMic-album.mp3";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      state.message = error instanceof Error ? error.message : String(error);
      state.messageError = true;
      render();
      return;
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  stage.querySelector("#mm-again").addEventListener("click", resetAll);
}

function resetAll() {
  clearTimeout(state.pollTimer);
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  Object.assign(state, {
    step: "mood",
    chips: new Set(),
    moodText: "",
    shape: "single",
    image: null,
    imageUrl: null,
    session: null,
    pending: null,
    thinking: false,
    replyDraft: "",
    proposal: "",
    task: null,
    busy: false,
    message: "",
    messageError: false,
  });
  render();
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

try {
  const settings = await api("/api/settings");
  if (settings?.language === "en" || settings?.language === "zh-CN") state.language = settings.language;
} catch {
  /* Fall back to the default language. */
}

render();
