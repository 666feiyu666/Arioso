// The album stage: plan review, background progress, continuous playback and
// candidate curation. It is used by both the Playlist page and the MoodMic
// journey, so the two never drift apart in behaviour or wording.
//
// The stage never owns persistence: it reads the album task the caller holds,
// asks the caller to approve or revise a plan, and uses the shared album
// endpoints for inclusion, ordering, retry and export.

const COPY = {
  "zh-CN": {
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
    retryTask: "重试并继续",
    unadmitted: "候选",
    included: "已收录",
    excluded: "已排除",
    status: {
      queued: "排队中", composing: "正在构思", generating: "正在生成音频",
      review: "等待你确认构思", assembling: "正在拼接", processing: "正在处理",
      completed: "已完成", failed: "未完成",
    },
    phase: {
      plan: "通读参考，构思专辑", compose: "撰写每首曲目方案", generate: "生成音频",
      assemble: "拼接导出", done: "已完成", review: "等待你确认构思", failed: "未完成",
    },
    progressWait: "正在进行，请稍候",
    progressCurrent: (title) => `正在处理：${title}`,
    progressCount: (done, total) => `${done} / ${total}`,
    planTitle: "专辑构思",
    planIntro: "下面是专辑作者对你选的歌与主题的理解，以及据此展开的构思。确认无误才会开始生成音频。",
    planReviewBadge: "待确认构想",
    planApprovedBadge: "已确认",
    planDoneBadge: "已完成",
    readingTitle: "系统如何理解你的参考",
    intentLabel: "主题理解",
    readingNoRefs: "这次没有参考曲目，构思完全来自你的主题描述。",
    readingUnderstoodLabel: "我听到的",
    readingUsedLabel: "它如何进入专辑",
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
    chatOpening: "这是我读完你的歌和主题后的理解与构思。确认无误就开始生成；想调整就直接告诉我。",
    chatNeedMessage: "先写一句你想调整的地方。",
    approve: "确认构思，开始生成音频",
    approving: "正在开始…",
    planCollapsed: "查看专辑构思与修改记录",
    planCollapsedHint: "音频生成完成后仍可在这里回看当初的构思。",
    scopeCandidates: "候选",
    scopeIncluded: "已收录",
    playAll: "播放全部",
    nowPlaying: "正在播放",
    previousTrack: "上一首",
    nextTrack: "下一首",
    seekLabel: "播放进度",
    moveUp: "上移",
    moveDown: "下移",
    listCandidatesEmpty: "还没有候选曲目。",
    listIncludedEmpty: "还没有收录曲目。在「候选」里把喜欢的收进来，就能排成一张专辑。",
    playlistDuration: (d) => `共 ${d}`,
    playbackError: "这段音频暂时无法播放。",
  },
  en: {
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
    retryTask: "Retry and continue",
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
    planIntro: "Here is how the album author read your song and theme, and the plan it drew from them. Audio generation starts only after you confirm.",
    planReviewBadge: "Awaiting review",
    planApprovedBadge: "Confirmed",
    planDoneBadge: "Completed",
    readingTitle: "How the system understood your references",
    intentLabel: "Your theme, read as",
    readingNoRefs: "No reference song was attached this time, so the plan comes entirely from your theme.",
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
    chatOpening: "Here is how I read your song and theme, and the plan I drew from them. Confirm if it looks right, or tell me what to adjust.",
    chatNeedMessage: "Write what you want to adjust first.",
    approve: "Confirm and start generating audio",
    approving: "Starting…",
    planCollapsed: "View the album plan and revision log",
    planCollapsedHint: "You can still look back at this plan once the audio is done.",
    scopeCandidates: "Candidates",
    scopeIncluded: "Included",
    playAll: "Play all",
    nowPlaying: "Now playing",
    previousTrack: "Previous track",
    nextTrack: "Next track",
    seekLabel: "Playback position",
    moveUp: "Move up",
    moveDown: "Move down",
    listCandidatesEmpty: "No candidate tracks yet.",
    listIncludedEmpty: "Nothing included yet. Add the ones you like from Candidates to build the album.",
    playlistDuration: (d) => `${d} total`,
    playbackError: "This track's audio cannot play right now.",
  },
};

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function text(language, key, ...args) {
  const value = (COPY[language] ?? COPY["zh-CN"])[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

export function durationText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function clockText(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function orderedTracks(task) {
  return [...(task.albumTracks ?? [])].sort((first, second) => first.order - second.order);
}

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

// The header badge reflects how far the work actually got, so an album whose
// tracks are all generated reads "Completed" even if the record stalled in
// another state (for example after the server restarted).
export function albumPlanBadge(task, language) {
  const tracks = task.albumTracks ?? [];
  const allReady = tracks.length > 0
    && tracks.every((track) => Boolean(track.audioFile) || track.status === "completed");
  const phase = task.status === "review" ? "review"
    : task.status === "completed" || allReady ? "done" : "approved";
  const label = phase === "review" ? text(language, "planReviewBadge")
    : phase === "done" ? text(language, "planDoneBadge") : text(language, "planApprovedBadge");
  return `<span class="pl-plan-state${phase === "review" ? "" : " is-approved"}"><span class="pl-state-dot" aria-hidden="true"></span>${esc(label)}</span>`;
}

/**
 * Create one album stage bound to the caller's task accessors.
 *
 * options: {
 *   language: () => string
 *   api: (path, options) => Promise<any>
 *   getTask, setTask
 *   rerender: () => void        // re-render the page that hosts the stage
 *   approve: (task) => Promise  // page-specific approval (task or journey route)
 *   revise: (task, message) => Promise
 *   onRunning: () => void       // generation started; the page may poll
 * }
 */
export function createAlbumStage(options) {
  const state = {
    scope: "candidate",
    queue: [],
    queueIndex: -1,
    playingTrackId: null,
    playing: false,
    previewId: null,
    currentTime: 0,
    duration: 0,
    planOpen: false,
    busy: false,
    chatDraft: "",
    message: "",
  };
  let audio = null;

  const t = (key, ...args) => text(options.language(), key, ...args);
  const task = () => options.getTask();
  const accept = (updated) => {
    if (updated) options.setTask(updated);
    options.rerender();
  };
  const fail = (error) => {
    state.message = error instanceof Error ? error.message : String(error);
    options.rerender();
  };

  // ---- planning -----------------------------------------------------------

  function progressModel(task) {
    const tracks = orderedTracks(task);
    const total = tracks.length || task.albumCandidateCount || 0;
    const prompts = tracks.filter((track) => track.musicSpec).length;
    const ready = tracks.filter((track) => track.audioFile).length;
    const percent = (done) => (total ? Math.round((done / total) * 100) : 0);
    const active = tracks.find((track) => track.status === "composing" || track.status === "generating");
    const base = { total, active: active?.title || "" };
    if (task.status === "completed") return { ...base, phase: "done", done: total, percent: 100 };
    if (task.status === "failed") return { ...base, phase: "failed", done: ready, percent: percent(ready) };
    if (task.status === "review") return { ...base, phase: "review", done: 0, percent: 0 };
    if (task.status === "generating") return { ...base, phase: "generate", done: ready, percent: percent(ready) };
    if (task.status === "assembling" || task.status === "processing") {
      return { ...base, phase: "assemble", done: total, percent: 100 };
    }
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
          <button class="pl-btn pl-btn-primary" type="button" data-album-action="send-message" ${state.busy ? "disabled" : ""}>${esc(t("chatSend"))}</button>
        </div>
        ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
      </section>`;
  }

  function planReview(task) {
    return `
      <section class="pl-plan">
        <div class="pl-plan-head">
          <h2>${esc(t("planTitle"))}</h2>
        </div>
        <p class="pl-plan-intro">${esc(t("planIntro"))}</p>
        ${readingPanel(task)}
        ${ideaPanel(task)}
        ${outlinePanel(task)}
        ${chatPanel(task)}
        <div class="pl-approve">
          <button class="pl-btn pl-btn-primary pl-approve-btn" type="button" data-album-action="approve" ${state.busy ? "disabled" : ""}>
            ${esc(state.busy ? t("approving") : t("approve"))}
          </button>
        </div>
      </section>`;
  }

  // ---- curation -----------------------------------------------------------

  function playerBar(activeTask) {
    // Before playback begins, show the first playable track as ready so the
    // player is already there as soon as an album has audio.
    const waiting = !state.queue.length;
    const queue = waiting ? playableTracks(activeTask, state.scope).map((track) => track.id) : state.queue;
    if (!queue.length) return "";
    const index = waiting ? 0 : state.queueIndex;
    const track = (activeTask.albumTracks ?? []).find((item) => item.id === queue[index]);
    const duration = waiting ? track?.durationSeconds || 0 : (state.duration > 0 ? state.duration : 0);
    const position = waiting ? 0 : Math.min(state.currentTime, duration);
    return `
      <div class="pl-player" role="region" aria-label="${esc(t("nowPlaying"))}">
        <button class="pl-player-toggle" type="button" data-album-action="toggle-play" aria-label="${esc(state.playing ? t("pause") : t("listen"))}">
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
          <button type="button" data-album-action="prev-track" aria-label="${esc(t("previousTrack"))}" ${index <= 0 ? "disabled" : ""}>⏮</button>
          <button type="button" data-album-action="next-track" aria-label="${esc(t("nextTrack"))}" ${index >= queue.length - 1 ? "disabled" : ""}>⏭</button>
        </div>
      </div>`;
  }

  function trackRow(activeTask, track, number, scope) {
    const isCurrent = state.playingTrackId === track.id;
    const isPlaying = isCurrent && state.playing;
    const working = track.status === "composing" || track.status === "generating";
    const stateWord = track.admission === "included" ? t("included")
      : track.admission === "excluded" ? t("excluded") : t("unadmitted");
    const percent = isCurrent && state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
    const playlistLength = (activeTask.albumPlaylist ?? []).length;
    return `
      <div class="pl-track is-${esc(track.admission)}${working ? " is-working" : ""}${isCurrent ? " is-current" : ""}">
        <span class="pl-track-number num">${String(number).padStart(2, "0")}</span>
        <button class="pl-play${isPlaying ? " is-playing" : ""}" type="button"
          data-album-action="play" data-track="${esc(track.id)}" ${track.audioFile ? "" : "disabled"}
          aria-label="${esc(isPlaying ? t("pause") : t("listen"))}">${isPlaying ? "❚❚" : "▶"}</button>
        <div class="pl-track-body">
          <strong>${esc(track.title)}</strong>
          <span>${esc(t("status")[track.status] ?? track.status)} · ${esc(track.audioFile ? durationText(track.durationSeconds) : t("unadmitted"))} · ${esc(stateWord)}</span>
          ${isCurrent ? `<span class="pl-track-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>` : ""}
        </div>
        <div class="pl-track-actions">
          ${track.status === "failed"
            ? `<button class="pl-btn pl-btn-quiet" type="button" data-album-action="retry-track" data-track="${esc(track.id)}">${esc(t("retry"))}</button>`
            : `<button class="pl-btn pl-btn-quiet${track.admission === "included" ? " is-on" : ""}" type="button"
                 data-album-action="admit" data-track="${esc(track.id)}" data-admission="included" ${track.audioFile ? "" : "disabled"}>${esc(t("include"))}</button>
               <button class="pl-btn pl-btn-quiet${track.admission === "excluded" ? " is-on" : ""}" type="button"
                 data-album-action="admit" data-track="${esc(track.id)}" data-admission="excluded">${esc(t("exclude"))}</button>`}
          ${scope === "included" ? `<span class="pl-track-order">
            <button class="pl-btn pl-btn-quiet" type="button" data-album-action="move" data-track="${esc(track.id)}" data-direction="-1" aria-label="${esc(t("moveUp"))}" ${number === 1 ? "disabled" : ""}>↑</button>
            <button class="pl-btn pl-btn-quiet" type="button" data-album-action="move" data-track="${esc(track.id)}" data-direction="1" aria-label="${esc(t("moveDown"))}" ${number === playlistLength ? "disabled" : ""}>↓</button>
          </span>` : ""}
        </div>
      </div>`;
  }

  function curation(task) {
    const scope = state.scope;
    const tracks = listTracks(task, scope);
    const candidateCount = orderedTracks(task).length;
    const includedCount = listTracks(task, "included").length;
    const playable = playableTracks(task, scope);
    const anyPlayable = playableTracks(task, "candidate").length > 0;
    const readyCount = orderedTracks(task).filter((track) => track.audioFile).length;
    const planBody = `${readingPanel(task)}${ideaPanel(task)}${outlinePanel(task)}`;
    return `
      ${task.status === "failed" ? "" : progressPanel(task)}
      ${task.albumPlan ? `<details class="pl-plan-fold"${state.planOpen ? " open" : ""}>
        <summary>${esc(t("planCollapsed"))}</summary>
        <p class="pl-plan-intro">${esc(t("planCollapsedHint"))}</p>
        ${planBody}
        ${(task.playlistDiscussion ?? []).length ? `<section class="pl-plan-section pl-chat"><h3>${esc(t("chatTitle"))}</h3>
          <div class="pl-thread">${(task.playlistDiscussion ?? []).map((message) => `<div class="pl-bubble is-${esc(message.role)}"><p>${esc(message.content)}</p></div>`).join("")}</div></section>` : ""}
      </details>` : ""}

      ${candidateCount ? `<div class="pl-toolbar">
        <div class="pl-scope" role="group" aria-label="${esc(t("scopeCandidates"))}">
          <button type="button" data-album-action="scope" data-scope="candidate" aria-pressed="${scope === "candidate"}">${esc(t("scopeCandidates"))} <small class="num">${candidateCount}</small></button>
          <button type="button" data-album-action="scope" data-scope="included" aria-pressed="${scope === "included"}">${esc(t("scopeIncluded"))} <small class="num">${includedCount}</small></button>
        </div>
        <button class="pl-btn pl-btn-primary" type="button" data-album-action="play-all" ${playable.length ? "" : "disabled"}>▶ ${esc(t("playAll"))}</button>
        <span class="pl-toolbar-duration num">${esc(t("playlistDuration", durationText(totalDuration(playable))))}</span>
        <div class="pl-toolbar-actions">
          <button class="pl-btn pl-btn-quiet" type="button" data-album-action="export" data-scope="included" ${readyCount ? "" : "disabled"}>${esc(t("exportIncluded"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-album-action="export" data-scope="candidate" ${readyCount ? "" : "disabled"}>${esc(t("exportCandidates"))}</button>
          <button class="pl-btn pl-btn-quiet" type="button" data-album-action="timestamps" ${readyCount ? "" : "disabled"}>${esc(t("timestamps"))}</button>
        </div>
      </div>` : ""}

      ${tracks.length
        ? `<div class="pl-tracks">${tracks.map((track, index) => trackRow(task, track, index + 1, scope)).join("")}</div>`
        : `<p class="pl-empty">${esc(t(scope === "included" ? "listIncludedEmpty" : "listCandidatesEmpty"))}</p>`}
      ${state.message ? `<p class="pl-message">${esc(state.message)}</p>` : ""}
      ${anyPlayable ? playerBar(task) : ""}`;
  }

  function failure(task) {
    if (task.status !== "failed") return "";
    return `
      <div class="pl-note"><strong>${esc(t("failedTitle"))}</strong><p>${esc(task.error || "")}</p>
        <button class="pl-btn" type="button" data-album-action="retry-task">${esc(t("retryTask"))}</button></div>`;
  }

  function render() {
    const activeTask = task();
    if (!activeTask) return "";
    const reviewing = activeTask.status === "review" && Boolean(activeTask.albumPlan);
    const running = ["queued", "composing", "generating", "assembling", "processing"].includes(activeTask.status);
    return `
      ${failure(activeTask)}
      ${reviewing
        ? planReview(activeTask)
        : `${running ? progressPanel(activeTask) : ""}${curation(activeTask)}`}`;
  }

  // ---- playback -----------------------------------------------------------

  function audioEl() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", () => {
      state.currentTime = audio.currentTime;
      updateSeek();
    });
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) state.duration = audio.duration;
      updateSeek();
    });
    audio.addEventListener("play", () => {
      state.playing = true;
      options.rerender();
    });
    audio.addEventListener("pause", () => {
      state.playing = false;
      options.rerender();
    });
    audio.addEventListener("ended", () => stepTrack(1));
    audio.addEventListener("error", () => {
      state.previewId = null;
      if (state.playingTrackId) {
        state.playingTrackId = null;
        state.message = t("playbackError");
      }
      options.rerender();
    });
    return audio;
  }

  function updateSeek() {
    const root = document.querySelector(".pl-player");
    if (!root) return;
    const max = state.duration > 0 ? state.duration : 0;
    const seek = root.querySelector(".pl-player-seek");
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
    const activeTask = task();
    const id = state.queue[index];
    const track = activeTask?.albumTracks?.find((item) => item.id === id);
    if (!activeTask || !track?.audioFile) return;
    state.queueIndex = index;
    state.playingTrackId = id;
    state.previewId = null;
    state.currentTime = 0;
    state.duration = track.durationSeconds || 0;
    const el = audioEl();
    el.src = `/api/tasks/${encodeURIComponent(activeTask.id)}/album/tracks/${encodeURIComponent(id)}/audio`;
    el.currentTime = 0;
    options.rerender();
    if (autoplay) {
      el.play().catch(() => {
        state.playing = false;
        state.message = t("playbackError");
        options.rerender();
      });
    }
  }

  function startPlayback(scope) {
    const activeTask = task();
    if (!activeTask) return;
    const queue = playableTracks(activeTask, scope).map((track) => track.id);
    if (!queue.length) {
      state.message = t(scope === "included" ? "listIncludedEmpty" : "listCandidatesEmpty");
      options.rerender();
      return;
    }
    state.scope = scope;
    state.queue = queue;
    playQueueTrack(0, true);
  }

  function togglePlay() {
    if (!state.playingTrackId) {
      startPlayback(state.scope);
      return;
    }
    const el = audioEl();
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function playTrack(trackId) {
    const activeTask = task();
    if (!activeTask) return;
    const track = activeTask.albumTracks?.find((item) => item.id === trackId);
    if (!track?.audioFile) return;
    if (state.playingTrackId === trackId) {
      togglePlay();
      return;
    }
    let queue = playableTracks(activeTask, state.scope).map((item) => item.id);
    if (!queue.includes(trackId)) {
      const other = state.scope === "candidate" ? "included" : "candidate";
      const otherQueue = playableTracks(activeTask, other).map((item) => item.id);
      if (!otherQueue.includes(trackId)) return;
      state.scope = other;
      queue = otherQueue;
    }
    state.queue = queue;
    playQueueTrack(queue.indexOf(trackId), true);
  }

  function stepTrack(direction) {
    const next = state.queueIndex + direction;
    if (next < 0 || next >= state.queue.length) {
      if (direction > 0) {
        state.playing = false;
        audioEl().pause();
      }
      return;
    }
    playQueueTrack(next, true);
  }

  function seekTo(value) {
    if (!(state.duration > 0)) return;
    const el = audioEl();
    el.currentTime = Math.max(0, Math.min(value, state.duration));
    state.currentTime = el.currentTime;
    updateSeek();
  }

  // ---- actions ------------------------------------------------------------

  async function approvePlan() {
    if (state.busy) return;
    state.busy = true;
    state.message = "";
    options.rerender();
    try {
      await options.approve(task());
      options.onRunning?.();
    } catch (error) {
      fail(error);
    } finally {
      state.busy = false;
      options.rerender();
    }
  }

  async function sendPlanMessage() {
    if (state.busy) return;
    const message = state.chatDraft.trim();
    if (!message) {
      state.message = t("chatNeedMessage");
      options.rerender();
      return;
    }
    state.busy = true;
    state.message = "";
    options.rerender();
    try {
      await options.revise(task(), message);
      state.chatDraft = "";
    } catch (error) {
      fail(error);
    } finally {
      state.busy = false;
      options.rerender();
    }
  }

  async function albumUpdate(route, method, payload) {
    const activeTask = task();
    const updated = await options.api(`/api/tasks/${encodeURIComponent(activeTask.id)}/album/${route}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    accept(updated);
    return updated;
  }

  async function retryTask() {
    const activeTask = task();
    try {
      const updated = await options.api(`/api/tasks/${encodeURIComponent(activeTask.id)}/retry`, { method: "POST" });
      accept(updated);
      options.onRunning?.();
    } catch (error) {
      fail(error);
    }
  }

  async function exportAlbum(scope) {
    const activeTask = task();
    state.busy = true;
    options.rerender();
    try {
      const manifest = await options.api(`/api/tasks/${encodeURIComponent(activeTask.id)}/album/export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, format: "manifest" }),
      });
      downloadFile(manifest.audioUrl, manifest.fileName);
    } catch (error) {
      state.message = error instanceof Error ? error.message : t("exportUnavailable");
    } finally {
      state.busy = false;
      options.rerender();
    }
  }

  async function exportTimestamps() {
    const activeTask = task();
    try {
      const manifest = await options.api(`/api/tasks/${encodeURIComponent(activeTask.id)}/album/export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "included", format: "manifest" }),
      });
      downloadFile(manifest.timestampsUrl, (manifest.fileName || "album").replace(/\.mp3$/i, " - Timestamps.txt"));
    } catch (error) {
      fail(error);
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

  async function moveTrack(trackId, direction) {
    const activeTask = task();
    const ids = [...(activeTask.albumPlaylist ?? [])];
    const index = ids.indexOf(trackId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      const updated = await options.api(`/api/tasks/${encodeURIComponent(activeTask.id)}/album/playlist`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackIds: ids }),
      });
      accept(updated);
    } catch (error) {
      fail(error);
    }
  }

  function bind(root) {
    if (!root) return;
    for (const button of root.querySelectorAll("[data-album-action]")) {
      button.addEventListener("click", () => {
        const action = button.dataset.albumAction;
        if (action === "approve") approvePlan();
        else if (action === "send-message") sendPlanMessage();
        else if (action === "scope") {
          state.scope = button.dataset.scope;
          options.rerender();
        } else if (action === "play-all") startPlayback(state.scope);
        else if (action === "toggle-play") togglePlay();
        else if (action === "prev-track") stepTrack(-1);
        else if (action === "next-track") stepTrack(1);
        else if (action === "play") playTrack(button.dataset.track);
        else if (action === "admit") {
          button.disabled = true;
          albumUpdate(`tracks/${encodeURIComponent(button.dataset.track)}`, "PATCH", {
            admission: button.dataset.admission,
          }).catch(fail);
        } else if (action === "retry-track") {
          button.disabled = true;
          albumUpdate(`tracks/${encodeURIComponent(button.dataset.track)}/retry`, "POST", {})
            .then(() => options.onRunning?.())
            .catch(fail);
        } else if (action === "move") moveTrack(button.dataset.track, Number(button.dataset.direction));
        else if (action === "retry-task") retryTask();
        else if (action === "export") exportAlbum(button.dataset.scope);
        else if (action === "timestamps") exportTimestamps();
      });
    }
    // Keep the plan fold open across the re-renders that polling causes.
    const planFold = root.querySelector(".pl-plan-fold");
    if (planFold) planFold.addEventListener("toggle", () => { state.planOpen = planFold.open; });
    const chatInput = root.querySelector("#pl-chat-input");
    if (chatInput) chatInput.addEventListener("input", () => { state.chatDraft = chatInput.value; });
    const seek = root.querySelector("#pl-player-seek");
    if (seek) seek.addEventListener("input", () => seekTo(Number(seek.value)));
  }

  return {
    render,
    bind,
    /** Called by the page when an album is opened or replaced. */
    reset(next = {}) {
      Object.assign(state, {
        scope: "candidate", queue: [], queueIndex: -1, playingTrackId: null, playing: false,
        currentTime: 0, duration: 0, planOpen: false, busy: false, chatDraft: "", message: "",
      }, next);
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
      }
    },
    setMessage(message) {
      state.message = message;
    },
    stop() {
      if (audio) audio.pause();
    },
  };
}
