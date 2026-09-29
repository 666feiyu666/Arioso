const examples = [
  {
    title: "午后爵士",
    description: "慵懒松弛的午后爵士，刷镲、低音提琴与温暖钢琴轻轻摇摆。",
    prompt: "一段 30 秒的慵懒午后爵士，纯器乐，78 BPM，轻柔的 swing 节奏。以刷镲、低音提琴和温暖的爵士钢琴为核心，加入少量圆润的次中音萨克斯即兴。整体松弛、惬意、带一点阳光洒进咖啡馆的暖意；动态克制，结尾自然收束并适合循环。不要人声。",
    tags: ["Jazz", "慵懒", "纯器乐"],
    vocalMode: "instrumental",
  },
  {
    title: "中土远征",
    description: "大气磅礴的史诗奇幻配乐，描绘古老群山、辽阔原野与英雄远征。",
    prompt: "一段 30 秒的大气磅礴史诗级奇幻背景音乐，纯器乐，具有霍比特人式中土世界的古老、壮阔与远征感，但不要复刻任何具体旋律。以圆号、低音弦乐、定音鼓和宏大的交响乐团为主体，加入爱尔兰哨笛与民谣小提琴的遥远色彩。开头从群山晨雾般的低沉主题展开，中段逐层推进，结尾抵达英勇而震撼的高潮。不要人声或合唱。",
    tags: ["Epic", "奇幻史诗", "纯器乐"],
    vocalMode: "instrumental",
  },
  {
    title: "山野欢歌",
    description: "明亮欢快的中国民谣，竹笛、琵琶与扬琴奏出热闹的山野气息。",
    prompt: "一段 30 秒欢快明亮的中国民谣，纯器乐，112 BPM，轻快的 2/4 节拍。以竹笛演奏朗朗上口的五声音阶旋律，琵琶与扬琴活泼应答，二胡点缀流畅的副旋律，并用轻巧的堂鼓、木鱼和拍手感节奏增添喜庆活力。整体自然、质朴、热烈，像春日山野里的集市与踏青。不要人声。",
    tags: ["中国民谣", "欢快", "纯器乐"],
    vocalMode: "instrumental",
  },
];

const statusLabels = {
  queued: "等待开始",
  composing: "正在整理编曲",
  generating: "Lyria 正在生成",
  completed: "已完成",
  failed: "生成失败",
};

const state = {
  tasks: [],
  selectedTaskId: null,
  playingTaskId: null,
  submitting: false,
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
};

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
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function taskIsPlaying(id) {
  return state.playingTaskId === id && !elements.audio.paused && !elements.audio.ended;
}

function syncPlaybackControls() {
  document.querySelectorAll("[data-play-task]").forEach((button) => {
    const task = state.tasks.find((item) => item.id === button.dataset.playTask);
    const playing = taskIsPlaying(button.dataset.playTask);
    const title = task?.title || task?.description || "这首音乐";

    if (button.classList.contains("task-play")) {
      button.textContent = playing ? "Ⅱ" : "▶";
      button.setAttribute("aria-label", `${playing ? "暂停" : "播放"}${title}`);
      button.title = `${playing ? "暂停" : "播放"}${title}`;
    } else {
      button.textContent = playing
        ? "暂停播放"
        : state.playingTaskId === button.dataset.playTask
          ? "继续播放"
          : "在播放器中播放";
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
    elements.playerMeta.textContent = `${task.lyriaModel} · 完整成品`;
    elements.globalPlayer.hidden = false;
    elements.audio.src = `/api/tasks/${encodeURIComponent(task.id)}/audio`;
    elements.audio.load();
    await elements.audio.play();
  } catch (error) {
    elements.message.textContent = error instanceof Error ? error.message : "音频播放失败。";
  } finally {
    syncPlaybackControls();
  }
}

function renderExamples() {
  document.querySelector("#example-grid").innerHTML = examples.map((example, index) => `
    <button class="example-card" type="button" data-example="${index}">
      <span class="example-art" aria-hidden="true"></span>
      <span class="example-copy">
        <h4>${escapeHtml(example.title)}</h4>
        <p>${escapeHtml(example.description)}</p>
        <span class="example-tags">${example.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</span>
      </span>
    </button>
  `).join("");

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const example = examples[Number(button.dataset.example)];
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
    elements.taskList.innerHTML = '<p class="empty-tasks">还没有任务。<br />从一个声音画面开始吧。</p>';
    return;
  }
  elements.taskList.innerHTML = state.tasks.map((task) => `
    <div class="task-list-item">
      <button class="task-button ${task.id === state.selectedTaskId ? "active" : ""}" type="button" data-task-id="${task.id}">
        <strong>${escapeHtml(task.title || task.description)}</strong>
        <span class="task-meta">
          <span class="task-state-dot ${statusClass(task.status)}"></span>
          ${escapeHtml(statusLabels[task.status] || task.status)} · ${formatTime(task.updatedAt)}
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
  const title = task.title || (running ? "正在构思…" : "未命名作品");
  const spec = task.musicSpec;
  const promptPanel = spec ? `
    <div class="panel">
      <h3>Lyria 生成提示</h3>
      <div class="prompt-output">${escapeHtml(spec.lyriaPrompt)}</div>
    </div>
    <div class="panel">
      <h3>音乐方向</h3>
      <div class="spec-list">
        <div class="spec-row"><span>风格</span><strong>${escapeHtml(spec.genres.join(" · "))}</strong></div>
        <div class="spec-row"><span>情绪</span><strong>${escapeHtml(spec.moods.join(" → "))}</strong></div>
        <div class="spec-row"><span>速度</span><strong>${spec.tempo.bpm ? `${spec.tempo.bpm} BPM · ` : ""}${escapeHtml(spec.tempo.feel)}</strong></div>
        <div class="spec-row"><span>调性</span><strong>${escapeHtml([spec.tonality.tonic, spec.tonality.mode].filter(Boolean).join(" ") || "开放调性")}</strong></div>
        <div class="spec-row"><span>编制</span><strong>${escapeHtml(spec.instrumentation.map((item) => item.name).join(" · "))}</strong></div>
        <div class="spec-row"><span>人声</span><strong>${spec.vocals.enabled ? escapeHtml(["启用", spec.vocals.language, spec.vocals.style].filter(Boolean).join(" · ")) : "纯器乐 · 无人声"}</strong></div>
      </div>
    </div>
  ` : "";
  const audioPanel = task.audioFile ? `
    <div class="panel audio-panel">
      <div><h3>试听成品</h3><p>${escapeHtml(task.lyriaModel)} · MP3</p></div>
      <button class="listen-button" type="button" data-play-task="${task.id}"></button>
    </div>
  ` : "";
  const progress = running ? `
    <div class="progress-card">
      <p class="eyebrow accent">IN PROGRESS</p>
      <h3>${escapeHtml(statusLabels[task.status])}</h3>
      <div class="progress-line"></div>
      <p>${task.status === "generating" ? "编曲提示已经完成，正在等待 Lyria 返回音频。" : "OpenAI Composer 正在把你的描述整理成一致的音乐规格。"}</p>
    </div>
  ` : "";
  const error = task.status === "failed" ? `<div class="error-box">${escapeHtml(task.error || "任务未能完成。")}</div>` : "";

  elements.taskDetail.innerHTML = `
    <header class="task-header">
      <div>
        <p class="eyebrow">${escapeHtml(task.lyriaModel.toUpperCase())}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(task.description)}</p>
      </div>
      <span class="status-pill ${statusClass(task.status)}">${escapeHtml(statusLabels[task.status])}</span>
    </header>
    ${progress}${error}
    ${spec ? `<div class="result-grid">${promptPanel}${audioPanel}</div>` : ""}
  `;
  elements.taskDetail.querySelectorAll("[data-play-task]").forEach((button) => {
    button.addEventListener("click", () => playTask(button.dataset.playTask));
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
        elements.playerMeta.textContent = `${playing.lyriaModel} · 完整成品`;
      }
    }
  } catch {
    // A temporary polling failure should not replace the current interface.
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
    if (!response.ok) throw new Error(result.error || "无法创建任务。");
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

renderExamples();
elements.form.addEventListener("submit", submitTask);
elements.audio.addEventListener("play", syncPlaybackControls);
elements.audio.addEventListener("pause", syncPlaybackControls);
elements.audio.addEventListener("ended", syncPlaybackControls);
elements.audio.addEventListener("error", () => {
  elements.message.textContent = "音频加载失败，请重启本地服务后重试。";
  syncPlaybackControls();
});
document.querySelector("#new-task").addEventListener("click", () => { showHome(); elements.input.focus(); });
document.querySelector("#back-home").addEventListener("click", showHome);
refreshTasks();
setInterval(refreshTasks, 1500);
