import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { measureAudioDuration } from "../audio/stitch.js";
import { planAlbum, planPlaylist, refinePlaylistPlan, composeAlbumTrack, reviewAlbumCandidates, reviseAlbumTrack } from "../composer/album-agent.js";
import { composeMusic } from "../composer/composer-agent.js";
import { composeOrchestralMovement, planOrchestralWork } from "../composer/orchestral-agent.js";
import { loadConfig, type AriosoConfig } from "../config/env.js";
import { SettingsStore, SUPPORTED_LANGUAGES, type ApiProvider, type InterfaceLanguage } from "../config/settings.js";
import { CreativeSessionStore } from "../discussion/creative-session-store.js";
import { LangChainDiscussionAgent } from "../discussion/langchain-discussion.js";
import { resolveCreativeSessionPhase } from "../discussion/session-graph.js";
import {
  MAX_DISCUSSION_IMAGE_BYTES,
  type CreativeSession,
  type DiscussionAgent,
  type DiscussionTaskOptions,
} from "../discussion/types.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import { JourneyRuntime } from "../journey/journey-runtime.js";
import { JourneyStore } from "../journey/journey-store.js";
import { JourneyTransitionError } from "../journey/journey-graph.js";
import { runMoodMicGeneration } from "../moodmic/moodmic-graph.js";
import { MAX_PLAYLIST_REFERENCES, type PlaylistReference } from "../playlist/reference.js";
import { MAX_PLAYLIST_DISCUSSION_MESSAGES, MAX_PLAYLIST_FEEDBACK_LENGTH, type PlaylistDiscussionMessage } from "../playlist/briefing.js";
import type { PoemRetriever } from "../retrieval/poem-retriever.js";
import {
  MUSIC_TYPES,
  loadMusicRetriever,
  type MusicRetrievalTrace,
} from "../retrieval/music-retriever.js";
import {
  ALBUM_MAX_CANDIDATES,
  ALBUM_MAX_TOTAL_MINUTES,
  ALBUM_MIN_CANDIDATES,
  ALBUM_MIN_TOTAL_MINUTES,
  type AlbumPlan,
} from "../schema/album-plan.js";
import { TaskStore, parseTaskInput, type AlbumAdmission, type AlbumAudioExport, type MusicTask } from "./task-store.js";
import { MoodEntryStore, isCalendarDate, isMoodGroup, type MoodEntryInput } from "./mood-store.js";
import { LangChainMoodClassifier, type MoodClassifier } from "./mood-classifier.js";
import { MoodChatStore, isMusicReference, type MoodChat } from "./mood-chat-store.js";
import { poemReferencesForProposal } from "./poem-proposal.js";
import { HttpError, readBinaryBody, readJsonBody, sendAudio, sendFile, sendJson, serveAsset, serveStatic } from "./http.js";
import { isRecord } from "../utils/validation.js";
import { runBackgroundMusicProducer } from "../producer/background-music-producer.js";
import { productionArtifactPath } from "../producer/pipeline.js";
import { PRODUCTION_ARTIFACTS, type ProductionArtifact } from "../producer/types.js";

function readApplicationVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : "";
  } catch {
    return "";
  }
}

const APPLICATION_VERSION = readApplicationVersion();

async function sendAlbumExport(request: IncomingMessage, response: ServerResponse, exported: AlbumAudioExport): Promise<void> {
  const encodedName = encodeURIComponent(exported.fileName)
    .replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase());
  response.setHeader("Content-Disposition", "attachment; filename=\"album.mp3\"; filename*=UTF-8''" + encodedName);
  response.setHeader("X-Album-Track-Count", exported.trackCount);
  response.setHeader("X-Album-Duration-Seconds", exported.durationSeconds);
  await sendAudio(request, response, exported.outputPath);
}

const REQUEST_RETRY_DELAYS_MS = [750, 1_500];

function isRetryableRequestError(error: unknown): boolean {
  const candidate = error as { status?: unknown; statusCode?: unknown } | null;
  const status = Number(candidate?.status ?? candidate?.statusCode);
  if (status === 408 || status === 409 || status === 429 || status >= 500) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    "fetch failed",
    "network",
    "timeout",
    "timed out",
    "econnreset",
    "econnrefused",
    "eai_again",
    "socket hang up",
  ].some((fragment) => message.includes(fragment));
}

async function withRequestRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryDelay = REQUEST_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined || !isRetryableRequestError(error)) {
        throw error;
      }
      await delay(retryDelay);
    }
  }
}

async function runTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
  albumTrackId?: string,
  language?: InterfaceLanguage,
): Promise<void> {
  try {
    if (task.compositionMode === "album") {
      if (task.albumProduction) {
        await runBackgroundMusicProducer(store, task, config, () => runAlbumTask(store, store.get(task.id) ?? task, config, albumTrackId));
      } else {
        await runAlbumTask(store, task, config, albumTrackId);
      }
      return;
    }
    if (task.compositionMode === "orchestral") {
      await runOrchestralTask(store, task, config);
      return;
    }

    let spec = task.musicSpec;
    if (!spec) {
      await store.update(task.id, { status: "composing", error: undefined });
      spec = await composeMusic(task.description, {
        apiKey: config.openAiApiKey,
        model: task.composerModel,
        lyriaModel: task.lyriaModel,
        vocalMode: task.vocalMode ?? "auto",
        corpusMode: task.corpusMode ?? "none",
        ...(task.musicType ? { musicType: task.musicType } : {}),
        onMusicRetrieval: async (trace: MusicRetrievalTrace) => {
          await store.update(task.id, { musicRetrieval: trace });
        },
      });
      await store.update(task.id, { musicSpec: spec, title: spec.title });
    }

    if (task.mode === "compose") {
      await store.update(task.id, { status: "completed", error: undefined });
      return;
    }

    // MoodMic creations run the generation check: generate, let Gemini listen,
    // then deliver or pause for the user's regenerate/keep decision.
    if (task.moodChatId) {
      await runMoodMicGeneration(store, store.get(task.id) ?? task, config, {
        ...(language ? { language } : {}),
      });
      return;
    }

    await store.update(task.id, { status: "generating", error: undefined });
    const client = new LyriaClient(config.geminiApiKey!);
    const generated = await withRequestRetry(() => client.generate(spec.lyriaPrompt, {
      model: task.lyriaModel,
    }));
    const latestTask = store.get(task.id) ?? task;
    const audioFile = await store.writeAudio(latestTask, generated.audio);
    await store.update(task.id, {
      status: "completed",
      audioFile,
      generatedText: generated.generatedText,
      error: undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.update(task.id, { status: "failed", error: message });
  }
}

async function runOrchestralTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
): Promise<void> {
  let currentTask = task;
  let workPlan = currentTask.orchestralPlan;

  if (!workPlan) {
    await store.update(currentTask.id, { status: "composing", error: undefined });
    workPlan = await planOrchestralWork(currentTask.description, {
      apiKey: config.openAiApiKey,
      model: currentTask.composerModel,
      lyriaModel: currentTask.lyriaModel,
    });
    const now = new Date().toISOString();
    currentTask = await store.update(currentTask.id, {
      title: workPlan.title,
      orchestralPlan: workPlan,
      movements: workPlan.movements.map((movement) => ({
        id: crypto.randomUUID(),
        order: movement.order,
        title: movement.title,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      })),
    });
  }

  for (const movement of currentTask.movements ?? []) {
    if (movement.status === "completed") continue;

    try {
      let movementPlan = movement.plan;
      if (!movementPlan) {
        await store.update(currentTask.id, { status: "composing", error: undefined });
        await store.updateMovement(currentTask.id, movement.id, {
          status: "composing",
          error: undefined,
        });
        movementPlan = await composeOrchestralMovement(workPlan, movement.order, {
          apiKey: config.openAiApiKey,
          model: currentTask.composerModel,
          lyriaModel: currentTask.lyriaModel,
        });
        currentTask = await store.updateMovement(currentTask.id, movement.id, {
          title: movementPlan.title,
          plan: movementPlan,
          status: currentTask.mode === "compose" ? "completed" : "queued",
          error: undefined,
        });
      }

      if (currentTask.mode === "compose") continue;

      await store.update(currentTask.id, { status: "generating", error: undefined });
      await store.updateMovement(currentTask.id, movement.id, {
        status: "generating",
        error: undefined,
      });
      const client = new LyriaClient(config.geminiApiKey!);
      const generated = await withRequestRetry(() => client.generate(movementPlan.lyriaPrompt, {
        model: currentTask.lyriaModel,
      }));
      const currentMovement = currentTask.movements?.find(
        (candidate) => candidate.id === movement.id,
      ) ?? movement;
      const audioFile = await store.writeMovementAudio(
        currentTask,
        currentMovement,
        generated.audio,
      );
      currentTask = await store.updateMovement(currentTask.id, movement.id, {
        status: "completed",
        audioFile,
        generatedText: generated.generatedText,
        error: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateMovement(currentTask.id, movement.id, {
        status: "failed",
        error: message,
      });
      throw error;
    }
  }

  if (currentTask.mode === "compose") {
    await store.update(currentTask.id, { status: "completed", error: undefined });
    return;
  }

  currentTask = store.get(currentTask.id) ?? currentTask;
  await store.update(currentTask.id, { status: "assembling", error: undefined });
  const assembled = await store.assembleOrchestralAudio(currentTask);
  await store.update(currentTask.id, {
    status: "completed",
    audioFile: assembled.audioFile,
    orchestralAssembly: assembled.assembly,
    error: undefined,
  });
}

export async function runAlbumTask(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
  retryTrackId?: string,
): Promise<void> {
  let current = store.get(task.id) ?? task;
  if (current.status === "completed" && current.albumPromptsReady
    && current.albumTracks?.length && current.albumTracks.every((track) =>
      track.status === "completed" && (current.mode === "compose" || Boolean(track.audioFile)))) return;
  const generationTrackId = current.albumPromptsReady ? retryTrackId : undefined;
  const options = {
    apiKey: config.openAiApiKey,
    model: current.composerModel,
    lyriaModel: current.lyriaModel,
  };
  if (!current.albumPlan) {
    await store.update(task.id, { status: "composing", error: undefined });
    const references = current.playlistReferences ?? [];
    const now = new Date().toISOString();
    const outlineTracks = (plan: AlbumPlan) => plan.tracks.map((outline) => ({
      id: crypto.randomUUID(), order: outline.number, title: outline.title,
      targetDurationSeconds: outline.targetSeconds,
      admission: "candidate" as const, status: "queued" as const, createdAt: now, updatedAt: now,
    }));
    if (current.workflowType === "05-playlist") {
      const { plan, briefing } = await planPlaylist(current.description, {
        ...options,
        candidateCount: current.albumCandidateCount ?? 14,
        targetTotalMinutes: current.albumTargetTotalMinutes ?? 35,
        ...(references.length ? { references } : {}),
      });
      current = await store.update(task.id, {
        title: plan.albumTitle, albumPlan: plan, albumPlaylist: [],
        playlistBriefing: briefing, playlistDiscussion: [], playlistPlanApproved: false,
        albumPlanRevision: (current.albumPlanRevision ?? 0) + 1,
        albumTracks: outlineTracks(plan),
      });
      // Pause for the user to confirm the author's reading before paying for generation.
      await store.update(task.id, { status: "review", error: undefined });
      return;
    }
    const plan = await planAlbum(current.description, {
      ...options,
      candidateCount: current.albumCandidateCount ?? 14,
      targetTotalMinutes: current.albumTargetTotalMinutes ?? 35,
      ...(references.length ? { references } : {}),
    });
    current = await store.update(task.id, {
      title: plan.albumTitle, albumPlan: plan, albumPlaylist: [],
      albumPlanRevision: (current.albumPlanRevision ?? 0) + 1,
      albumTracks: outlineTracks(plan),
    });
  }
  const plan = current.albumPlan!;
  if (current.workflowType === "05-playlist" && !current.playlistPlanApproved) {
    // A playlist that resumes before the user confirms stays paused.
    await store.update(task.id, { status: "review", error: undefined });
    return;
  }
  if (!current.albumPromptsReady) {
    await store.update(task.id, { status: "composing", error: undefined });
    for (const track of current.albumTracks ?? []) {
      if (track.musicSpec) continue;
      await store.updateAlbumTrack(task.id, track.id, { status: "composing", error: undefined });
      try {
        const musicSpec = await composeAlbumTrack(plan, track.order, options);
        current = await store.updateAlbumTrack(task.id, track.id, {
          musicSpec, title: musicSpec.title, status: "queued", error: undefined,
        });
      } catch (error) {
        await store.updateAlbumTrack(task.id, track.id, {
          status: "failed", error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    const orderedSpecs = () => {
      const tracks = [...(store.get(task.id)?.albumTracks ?? [])].sort((a, b) => a.order - b.order);
      if (tracks.length !== plan.tracks.length || tracks.some((track) => !track.musicSpec)) {
        throw new Error("Album candidate prompts are incomplete.");
      }
      return tracks.map((track) => track.musicSpec!);
    };
    current = store.get(task.id) ?? current;
    if (!current.albumReview) {
      const albumReview = await reviewAlbumCandidates(plan, orderedSpecs(), options);
      current = await store.update(task.id, { albumReview });
    }
    for (const finding of current.albumReview!.candidates) {
      if (finding.verdict !== "needs-work" || !finding.revisionBrief
        || current.albumRevisedTrackNumbers?.includes(finding.number)) continue;
      const track = current.albumTracks?.find((candidate) => candidate.order === finding.number);
      if (!track?.musicSpec) throw new Error(`Missing candidate ${finding.number}.`);
      const musicSpec = await reviseAlbumTrack(
        plan, finding.number, track.musicSpec, finding.revisionBrief, orderedSpecs(), options,
      );
      current = store.get(task.id) ?? current;
      current = await store.update(task.id, {
        albumTracks: current.albumTracks!.map((candidate) => candidate.id === track.id
          ? { ...candidate, musicSpec, title: musicSpec.title, updatedAt: new Date().toISOString() }
          : candidate),
        albumRevisedTrackNumbers: [...(current.albumRevisedTrackNumbers ?? []), finding.number],
      });
    }
    if (!current.albumFinalReview) {
      const albumFinalReview = await reviewAlbumCandidates(plan, orderedSpecs(), options);
      current = await store.update(task.id, { albumFinalReview });
    }
    current = await store.update(task.id, { albumPromptsReady: true });
  }
  if (current.mode === "compose") {
    for (const track of current.albumTracks ?? []) {
      await store.updateAlbumTrack(task.id, track.id, { status: "completed", error: undefined });
    }
    await store.update(task.id, { status: "completed", error: undefined });
    return;
  }
  if (!current.albumTracks?.length) throw new Error("Album candidate tracks are missing.");
  await store.update(task.id, { status: "generating", error: undefined });
  const client = new LyriaClient(config.geminiApiKey!);
  for (const track of current.albumTracks) {
    if (generationTrackId && track.id !== generationTrackId) continue;
    if (track.audioFile && track.status === "completed") continue;
    try {
      if (!track.musicSpec) throw new Error("Candidate prompt is missing.");
      await store.updateAlbumTrack(task.id, track.id, { status: "generating", error: undefined });
      const generated = await withRequestRetry(() => client.generate(track.musicSpec!.lyriaPrompt, {
        model: current.lyriaModel,
      }));
      const audioFile = await store.writeAlbumTrackAudio(current, track, generated.audio);
      let durationSeconds: number | undefined;
      try {
        durationSeconds = measureAudioDuration(generated.audio);
      } catch {
        // Audio stays available when its duration cannot be measured locally.
      }
      await store.updateAlbumTrack(task.id, track.id, {
        status: "completed", audioFile, generatedText: generated.generatedText,
        ...(durationSeconds === undefined ? {} : { durationSeconds }), error: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.updateAlbumTrack(task.id, track.id, { status: "failed", error: message });
    }
  }
  const failures = (store.get(task.id)?.albumTracks ?? [])
    .filter((track) => track.status !== "completed")
    .map((track) => `Candidate ${track.order}: ${track.error ?? "Awaiting generation."}`);
  await store.update(task.id, {
    status: failures.length ? "failed" : "completed",
    error: failures.length ? failures.join(" ") : undefined,
  });
}

function isApiProvider(value: unknown): value is ApiProvider {
  return value === "openai" || value === "gemini";
}

function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return SUPPORTED_LANGUAGES.includes(value as InterfaceLanguage);
}

async function testApiConnection(provider: ApiProvider, apiKey: string): Promise<boolean> {
  try {
    const response = provider === "openai"
      ? await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(20_000),
        })
      : await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
          headers: { "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(20_000),
        });
    return response.ok;
  } catch {
    return false;
  }
}

export interface AriosoServerOptions {
  environment?: NodeJS.ProcessEnv;
  envPath?: string;
  preferencesPath?: string;
  discussionAgent?: DiscussionAgent;
  moodClassifier?: MoodClassifier;
  /** Injected poetry retriever; the on-disk corpus is loaded lazily otherwise. */
  poemRetriever?: PoemRetriever;
}

function discussionTaskOptions(value: unknown): DiscussionTaskOptions {
  if (!isRecord(value)) throw new Error("A discussion request is required.");
  const parsed = parseTaskInput({ ...value, description: "Pending creative discussion." });
  const { description: _description, sourceDiscussionId: _sourceDiscussionId, ...taskOptions } = parsed;
  return taskOptions;
}

function decodedFileName(value: string | null): string {
  if (!value) return "image";
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "Invalid image filename.");
  }
}

function moodText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > 2000) throw new HttpError(400, `${field} is too long.`);
  return trimmed || undefined;
}

function parseMoodEntryInput(value: unknown): MoodEntryInput {
  if (!isRecord(value)) throw new HttpError(400, "A feeling is required.");
  if (!isCalendarDate(value.date)) throw new HttpError(400, "A calendar date (YYYY-MM-DD) is required.");
  if (!isMoodGroup(value.group)) throw new HttpError(400, "A known feeling group is required.");
  if (typeof value.emotion !== "string" || !value.emotion.trim() || value.emotion.trim().length > 64) {
    throw new HttpError(400, "Choose an emotion word.");
  }
  if (value.retrospective !== undefined && typeof value.retrospective !== "boolean") {
    throw new HttpError(400, "retrospective must be a boolean.");
  }
  return {
    date: value.date,
    group: value.group,
    emotion: value.emotion.trim(),
    note: moodText(value.note, "note"),
    musicFeeling: moodText(value.musicFeeling, "musicFeeling"),
    ...(value.retrospective === true ? { retrospective: true } : {}),
  };
}

function parseMoodEntryPatch(value: unknown) {
  if (!isRecord(value)) throw new HttpError(400, "A feeling update is required.");
  if (value.date !== undefined && !isCalendarDate(value.date)) {
    throw new HttpError(400, "A calendar date (YYYY-MM-DD) is required.");
  }
  if (value.group !== undefined && !isMoodGroup(value.group)) {
    throw new HttpError(400, "A known feeling group is required.");
  }
  if (value.emotion !== undefined
    && (typeof value.emotion !== "string" || !value.emotion.trim())) {
    throw new HttpError(400, "Choose an emotion word.");
  }
  if (value.retrospective !== undefined && typeof value.retrospective !== "boolean") {
    throw new HttpError(400, "retrospective must be a boolean.");
  }
  return {
    ...(value.date !== undefined ? { date: value.date } : {}),
    ...(value.group !== undefined ? { group: value.group } : {}),
    ...(value.emotion !== undefined ? { emotion: value.emotion.trim().slice(0, 64) } : {}),
    ...(value.note !== undefined ? { note: moodText(value.note, "note") } : {}),
    ...(value.musicFeeling !== undefined ? { musicFeeling: moodText(value.musicFeeling, "musicFeeling") } : {}),
    ...(value.retrospective !== undefined ? { retrospective: value.retrospective } : {}),
  };
}

export async function createAriosoServer(options: AriosoServerOptions = {}) {
  const baseEnvironment = options.environment ?? process.env;
  const settings = new SettingsStore({
    envPath: path.resolve(options.envPath ?? baseEnvironment.ARIOSO_ENV_PATH ?? ".env"),
    preferencesPath: path.resolve(
      options.preferencesPath
        ?? baseEnvironment.ARIOSO_SETTINGS_PATH
        ?? "outputs/settings.json",
    ),
    environment: baseEnvironment,
  });
  const environment = await settings.runtimeEnvironment();
  const outputDirectory = environment.ARIOSO_OUTPUT_DIR ?? "outputs";
  const store = new TaskStore(path.resolve(outputDirectory, "tasks"));
  const discussionStore = new CreativeSessionStore(path.resolve(outputDirectory, "discussions"));
  const moodStore = new MoodEntryStore(path.resolve(outputDirectory, "moodmic", "entries.json"));
  const moodChatStore = new MoodChatStore(path.resolve(outputDirectory, "moodmic", "chats"));
  const journeyStore = new JourneyStore(path.resolve(outputDirectory, "journeys"));
  const discussionAgent = options.discussionAgent ?? new LangChainDiscussionAgent();
  const poemRetriever = options.poemRetriever;
  const moodClassifier = options.moodClassifier ?? new LangChainMoodClassifier();
  await store.initialize();
  await discussionStore.initialize();
  await moodStore.initialize();
  await moodChatStore.initialize();
  await journeyStore.initialize();
  const journeys = new JourneyRuntime({ tasks: store, journeys: journeyStore });
  const activeTaskIds = new Set<string>();
  // Serialises confirmation-chat revisions on their own: pausing at "review"
  // leaves the planning run nominally active for a moment, so it must not gate
  // whether the user can confirm or revise.
  const planRevisions = new Set<string>();
  const activeDiscussionSubmissions = new Set<string>();
  const activeMoodSubmissions = new Set<string>();
  const discussionView = async (session: CreativeSession) => {
    const taskIds = session.taskIds ?? (session.submittedTaskId ? [session.submittedTaskId] : []);
    const tasks = taskIds.flatMap((id) => {
      const task = store.get(id);
      return task ? [task] : [];
    });
    const latestTask = tasks.at(-1);
    return {
      ...session,
      taskIds,
      phase: await resolveCreativeSessionPhase(session.status, latestTask?.status),
      tasks,
    };
  };
  const moodChatView = async (chat: MoodChat) => {
    const tasks = chat.taskIds.flatMap((id) => {
      const task = store.get(id);
      return task ? [task] : [];
    });
    const latestTask = tasks.at(-1);
    return {
      ...chat,
      phase: await resolveCreativeSessionPhase(chat.status, latestTask?.status),
      tasks,
    };
  };
  const startTask = (task: MusicTask, config: AriosoConfig, albumTrackId?: string): void => {
    activeTaskIds.add(task.id);
    void (async () => {
      const language = task.moodChatId ? await settings.language() : undefined;
      await runTask(store, task, config, albumTrackId, language);
    })()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to persist task ${task.id}: ${message}`);
      })
      .finally(() => {
        activeTaskIds.delete(task.id);
        void syncJourneyForTask(store.get(task.id));
      });
  };

  // Journeys never own task state: whenever a linked task settles, the journey
  // re-derives its phase from that task and persists the transition.
  const syncJourneyForTask = async (task: MusicTask | undefined): Promise<void> => {
    if (!task) return;
    const journey = journeys.journeyForTask(task);
    if (!journey) return;
    try {
      await journeys.sync(journey.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to advance journey ${journey.id}: ${message}`);
    }
  };

  const journeyResponse = async (identifier: string) => {
    const journey = await journeys.sync(identifier);
    return journeys.view(journey);
  };

  const journeySafe = async (operation: () => Promise<unknown>): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Unable to advance a journey: ${message}`);
    }
  };

  const withJourney = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof JourneyTransitionError) {
        throw new HttpError(error.message === "Journey not found." ? 404 : 409, error.message);
      }
      throw error;
    }
  };

  // Resolve a MoodMic conversation into a reference the album planner can use:
  // the agreed creative intent plus the structured MusicSpec of its music.
  const playlistReferenceFor = (chatId: string): PlaylistReference | undefined => {
    const chat = moodChatStore.get(chatId);
    if (!chat) return undefined;
    const tasks = chat.taskIds.flatMap((id) => {
      const candidate = store.get(id);
      return candidate ? [candidate] : [];
    });
    const source = [...tasks].reverse().find((candidate) => candidate.audioFile)
      ?? [...tasks].reverse().find((candidate) => candidate.musicSpec);
    const prompt = chat.proposal?.trim()
      || chat.messages.find((message) => message.role === "user")?.content?.trim()
      || "";
    if (!prompt) return undefined;
    return {
      chatId: chat.id,
      title: source?.title?.trim() || prompt.slice(0, 40),
      prompt,
      ...(source ? { taskId: source.id } : {}),
      ...(source?.musicSpec ? { musicSpec: source.musicSpec } : {}),
    };
  };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname);
      const audioMatch = /^\/api\/tasks\/([^/]+)\/audio$/.exec(url.pathname);
      const movementAudioMatch = /^\/api\/tasks\/([^/]+)\/movements\/([^/]+)\/audio$/
        .exec(url.pathname);
      const albumTrackMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)$/.exec(url.pathname);
      const albumTrackAudioMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)\/audio$/.exec(url.pathname);
      const albumTrackRetryMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)\/retry$/.exec(url.pathname);
      const albumExportAudioMatch = /^\/api\/tasks\/([^/]+)\/album\/exports\/([a-f0-9]{64})\/(audio|timestamps)$/.exec(url.pathname);
      const albumExportMatch = /^\/api\/tasks\/([^/]+)\/album\/export$/.exec(url.pathname);
      const albumPlaylistMatch = /^\/api\/tasks\/([^/]+)\/album\/playlist$/.exec(url.pathname);
      const playlistPlanApproveMatch = /^\/api\/tasks\/([^/]+)\/plan\/approve$/.exec(url.pathname);
      const playlistPlanMessagesMatch = /^\/api\/tasks\/([^/]+)\/plan\/messages$/.exec(url.pathname);
      const productionArtifactMatch = /^\/api\/tasks\/([^/]+)\/production\/(audio|video|tracklist|manifest)$/.exec(url.pathname);
      const retryMatch = /^\/api\/tasks\/([^/]+)\/retry$/.exec(url.pathname);
      const reviewDecisionMatch = /^\/api\/tasks\/([^/]+)\/review$/.exec(url.pathname);
      const credentialMatch = /^\/api\/settings\/credentials\/(openai|gemini)$/.exec(url.pathname);
      const discussionMatch = /^\/api\/discussions\/([^/]+)$/.exec(url.pathname);
      const discussionMessagesMatch = /^\/api\/discussions\/([^/]+)\/messages$/.exec(url.pathname);
      const discussionProposalMatch = /^\/api\/discussions\/([^/]+)\/proposal$/.exec(url.pathname);
      const discussionSubmitMatch = /^\/api\/discussions\/([^/]+)\/submit$/.exec(url.pathname);
      const discussionAttachmentsMatch = /^\/api\/discussions\/([^/]+)\/attachments$/.exec(url.pathname);
      const discussionAttachmentMatch = /^\/api\/discussions\/([^/]+)\/attachments\/([^/]+)$/.exec(url.pathname);
      const moodChatMatch = /^\/api\/mood-chats\/([^/]+)$/.exec(url.pathname);
      const moodChatMessagesMatch = /^\/api\/mood-chats\/([^/]+)\/messages$/.exec(url.pathname);
      const moodChatProposalMatch = /^\/api\/mood-chats\/([^/]+)\/proposal$/.exec(url.pathname);
      const moodChatSubmitMatch = /^\/api\/mood-chats\/([^/]+)\/submit$/.exec(url.pathname);
      const moodChatAttachmentsMatch = /^\/api\/mood-chats\/([^/]+)\/attachments$/.exec(url.pathname);
      const moodChatAttachmentMatch = /^\/api\/mood-chats\/([^/]+)\/attachments\/([^/]+)$/.exec(url.pathname);
      const moodEntryMatch = /^\/api\/mood-entries\/([^/]+)$/.exec(url.pathname);
      const moodEntryTaskMatch = /^\/api\/mood-entries\/([^/]+)\/tasks$/.exec(url.pathname);
      const journeyMatch = /^\/api\/journeys\/([^/]+)$/.exec(url.pathname);
      const journeyContinueMatch = /^\/api\/journeys\/([^/]+)\/continue-album$/.exec(url.pathname);
      const journeyPlanMessagesMatch = /^\/api\/journeys\/([^/]+)\/album-plan\/messages$/.exec(url.pathname);
      const journeyPlanApproveMatch = /^\/api\/journeys\/([^/]+)\/album-plan\/approve$/.exec(url.pathname);
      const journeyRetryMatch = /^\/api\/journeys\/([^/]+)\/retry$/.exec(url.pathname);
      if (request.method === "GET" && url.pathname === "/api/capabilities") {
        // Available music types follow the corpus on disk, so an unpopulated
        // type is never offered as if it had validated references.
        const music = await loadMusicRetriever();
        const capabilities = {
          apiVersion: 11,
          version: APPLICATION_VERSION,
          workflows: ["01-general", "02-music", "03-orchestral", "04-album", "05-playlist"],
          discussionSessions: true,
          creativeSessionTimeline: true,
          discussionImages: { types: ["image/jpeg", "image/png", "image/webp"], maximumBytes: MAX_DISCUSSION_IMAGE_BYTES },
          discussionMood: true,
          moodEntries: true,
          albumPlaylist: true,
          albumExport: true,
          backgroundMusicProducer: { denoiser: "denoising-historical-recordings", outputChannels: 1, listeningReview: "required" },
          albumCandidates: { minimum: 12, maximum: 28, default: 14 },
          musicCorpus: {
            types: MUSIC_TYPES,
            available: music.retriever.availableTypes(),
            availability: music.availability,
          },
          playlistReferences: true,
          playlistPlanConfirmation: true,
          orchestralAssembly: true,
          orchestralPromptFormat: "orchestral-v1",
          orchestralDuration: {
            minimumTotalMinutes: 5,
            maximumTotalMinutes: 12,
            maximumMovementMinutes: 3,
          },
        };
        sendJson(response, 200, capabilities);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/discussions") {
        const taskOptions = discussionTaskOptions(await readJsonBody(request));
        sendJson(response, 201, await discussionView(await discussionStore.create(taskOptions)));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/discussions") {
        sendJson(response, 200, await Promise.all(discussionStore.list().map(discussionView)));
        return;
      }

      if (request.method === "GET" && discussionMatch?.[1]) {
        const session = discussionStore.get(discussionMatch[1]);
        if (!session) throw new HttpError(404, "Discussion session not found.");
        sendJson(response, 200, await discussionView(session));
        return;
      }

      if (request.method === "POST" && discussionAttachmentsMatch?.[1]) {
        const sessionId = discussionAttachmentsMatch[1];
        if (!discussionStore.get(sessionId)) throw new HttpError(404, "Discussion session not found.");
        const mimeType = String(request.headers["content-type"] ?? "").split(";", 1)[0]!.trim().toLowerCase();
        const data = await readBinaryBody(request, MAX_DISCUSSION_IMAGE_BYTES);
        const session = await discussionStore.addAttachment(sessionId, {
          originalName: decodedFileName(url.searchParams.get("name")), mimeType, data,
        });
        sendJson(response, 201, await discussionView(session));
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD")
        && discussionAttachmentMatch?.[1] && discussionAttachmentMatch[2]) {
        const attachment = discussionStore.attachmentPath(
          discussionAttachmentMatch[1], discussionAttachmentMatch[2],
        );
        if (!attachment) throw new HttpError(404, "Discussion image is not available.");
        await sendFile(request, response, attachment.path, attachment.mimeType);
        return;
      }

      if (request.method === "POST" && discussionMessagesMatch?.[1]) {
        const sessionId = discussionMessagesMatch[1];
        const session = discussionStore.get(sessionId);
        if (!session) throw new HttpError(404, "Discussion session not found.");
        const value = await readJsonBody(request);
        if (!isRecord(value)
          || (value.content !== undefined && typeof value.content !== "string")
          || (value.attachmentIds !== undefined && (!Array.isArray(value.attachmentIds)
            || !value.attachmentIds.every((id: unknown) => typeof id === "string")))) {
          throw new HttpError(400, "A valid discussion message is required.");
        }
        await discussionStore.addMessage(
          sessionId, "user", typeof value.content === "string" ? value.content : "",
          (value.attachmentIds as string[] | undefined) ?? [],
        );
        const runtime = await settings.runtimeEnvironment();
        const config = loadConfig(false, runtime);
        const reply = await discussionAgent.respond(await discussionStore.agentMessages(sessionId), {
          apiKey: config.openAiApiKey,
          model: config.openAiModel,
          language: await settings.language(),
          compositionMode: session.taskOptions.compositionMode,
          workflowType: session.taskOptions.workflowType,
          candidateCount: session.taskOptions.candidateCount,
          targetTotalMinutes: session.taskOptions.targetTotalMinutes,
        });
        sendJson(response, 200, await discussionView(
          await discussionStore.addMessage(sessionId, "assistant", reply.content, [], reply.mood),
        ));
        return;
      }

      if (request.method === "POST" && discussionProposalMatch?.[1]) {
        const sessionId = discussionProposalMatch[1];
        const session = discussionStore.get(sessionId);
        if (!session) throw new HttpError(404, "Discussion session not found.");
        const runtime = await settings.runtimeEnvironment();
        const config = loadConfig(false, runtime);
        const proposal = await discussionAgent.propose(await discussionStore.agentMessages(sessionId), {
          apiKey: config.openAiApiKey,
          model: config.openAiModel,
          language: await settings.language(),
          compositionMode: session.taskOptions.compositionMode,
          workflowType: session.taskOptions.workflowType,
          candidateCount: session.taskOptions.candidateCount,
          targetTotalMinutes: session.taskOptions.targetTotalMinutes,
        });
        sendJson(response, 200, await discussionView(await discussionStore.setProposal(sessionId, proposal)));
        return;
      }

      if (request.method === "POST" && discussionSubmitMatch?.[1]) {
        const sessionId = discussionSubmitMatch[1];
        const session = discussionStore.get(sessionId);
        if (!session) throw new HttpError(404, "Discussion session not found.");
        if (session.status === "submitted" || activeDiscussionSubmissions.has(sessionId)) {
          throw new HttpError(409, "This discussion has already been submitted.");
        }
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.prompt !== "string" || !value.prompt.trim()) {
          throw new HttpError(400, "An approved prompt is required.");
        }
        const prompt = value.prompt.trim();
        const compositionMode = session.taskOptions.compositionMode;
        const locked = compositionMode === "album" || compositionMode === "orchestral";
        const overrides = locked
          ? { mode: "generate", lyriaModel: "lyria-3.5", vocalMode: "instrumental" }
          : {
              ...(typeof value.mode === "string" ? { mode: value.mode } : {}),
              ...(typeof value.lyriaModel === "string" ? { lyriaModel: value.lyriaModel } : {}),
              ...(typeof value.vocalMode === "string" ? { vocalMode: value.vocalMode } : {}),
              // The music reference setting can change before creation, so the
              // chosen value is authoritative at submit time.
              ...(typeof value.corpusMode === "string" ? { corpusMode: value.corpusMode } : {}),
              ...(isMusicReference(value.musicReference) ? { musicReference: value.musicReference } : {}),
              ...(typeof value.workflowType === "string" ? { workflowType: value.workflowType } : {}),
            };
        activeDiscussionSubmissions.add(sessionId);
        try {
          await discussionStore.setProposal(sessionId, prompt);
          const input = parseTaskInput({
            ...session.taskOptions,
            ...overrides,
            description: prompt,
          });
          input.sourceDiscussionId = sessionId;
          const config = loadConfig(input.mode === "generate", await settings.runtimeEnvironment());
          const task = await store.create(input, config);
          await discussionStore.markSubmitted(sessionId, task.id, prompt);
          startTask(task, config);
          sendJson(response, 202, {
            session: await discussionView(discussionStore.get(sessionId)!), task,
          });
        } finally {
          activeDiscussionSubmissions.delete(sessionId);
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mood-chats") {
        const body = await readJsonBody(request);
        // "jazz: true" is the legacy form of an explicit Jazz selection.
        const musicReference = isRecord(body) && isMusicReference(body.musicReference)
          ? body.musicReference
          : isRecord(body) && body.jazz === true ? "jazz" : "auto";
        sendJson(response, 201, await moodChatView(await moodChatStore.create(musicReference)));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mood-chats") {
        sendJson(response, 200, await Promise.all(moodChatStore.list().map(moodChatView)));
        return;
      }

      if (request.method === "GET" && moodChatMatch?.[1]) {
        const chat = moodChatStore.get(moodChatMatch[1]);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        sendJson(response, 200, await moodChatView(chat));
        return;
      }

      if (request.method === "POST" && moodChatAttachmentsMatch?.[1]) {
        const chatId = moodChatAttachmentsMatch[1];
        if (!moodChatStore.get(chatId)) throw new HttpError(404, "Conversation not found.");
        const mimeType = String(request.headers["content-type"] ?? "").split(";", 1)[0]!.trim().toLowerCase();
        const data = await readBinaryBody(request, MAX_DISCUSSION_IMAGE_BYTES);
        const chat = await moodChatStore.addAttachment(chatId, {
          originalName: decodedFileName(url.searchParams.get("name")), mimeType, data,
        });
        sendJson(response, 201, await moodChatView(chat));
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD")
        && moodChatAttachmentMatch?.[1] && moodChatAttachmentMatch[2]) {
        const attachment = moodChatStore.attachmentPath(
          moodChatAttachmentMatch[1], moodChatAttachmentMatch[2],
        );
        if (!attachment) throw new HttpError(404, "Image is not available.");
        await sendFile(request, response, attachment.path, attachment.mimeType);
        return;
      }

      if (request.method === "POST" && moodChatMessagesMatch?.[1]) {
        const chatId = moodChatMessagesMatch[1];
        const chat = moodChatStore.get(chatId);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        const value = await readJsonBody(request);
        if (!isRecord(value)
          || (value.content !== undefined && typeof value.content !== "string")
          || (value.attachmentIds !== undefined && (!Array.isArray(value.attachmentIds)
            || !value.attachmentIds.every((id: unknown) => typeof id === "string")))) {
          throw new HttpError(400, "A valid message is required.");
        }
        await moodChatStore.addMessage(
          chatId, "user", typeof value.content === "string" ? value.content : "",
          (value.attachmentIds as string[] | undefined) ?? [],
        );
        const config = loadConfig(false, await settings.runtimeEnvironment());
        const reply = await discussionAgent.respond(await moodChatStore.agentMessages(chatId), {
          apiKey: config.openAiApiKey,
          model: config.openAiModel,
          language: await settings.language(),
          compositionMode: "single",
          workflowType: chat.musicReference === "none" ? "01-general" : "02-music",
        });
        sendJson(response, 200, await moodChatView(
          await moodChatStore.addMessage(chatId, "assistant", reply.content, [], reply.mood),
        ));
        return;
      }

      if (request.method === "POST" && moodChatProposalMatch?.[1]) {
        const chatId = moodChatProposalMatch[1];
        const chat = moodChatStore.get(chatId);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        const config = loadConfig(false, await settings.runtimeEnvironment());
        // Poetry retrieval runs only here, from the most complete expression of
        // intent, and stays advisory even when the corpus is unavailable.
        const poetry = await poemReferencesForProposal(
          chat,
          poemRetriever
            ? { loadRetriever: async () => poemRetriever }
            : {},
        );
        const proposal = await discussionAgent.propose(
          await moodChatStore.agentMessages(chatId),
          {
            apiKey: config.openAiApiKey,
            model: config.openAiModel,
            language: await settings.language(),
            compositionMode: "single",
            workflowType: chat.musicReference === "none" ? "01-general" : "02-music",
          },
          poetry.references,
        );
        sendJson(response, 200, await moodChatView(
          await moodChatStore.setProposal(chatId, proposal, poetry.trace),
        ));
        return;
      }

      if (request.method === "POST" && moodChatSubmitMatch?.[1]) {
        const chatId = moodChatSubmitMatch[1];
        const chat = moodChatStore.get(chatId);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        if (chat.status === "submitted" || activeMoodSubmissions.has(chatId)) {
          throw new HttpError(409, "This conversation has already been submitted.");
        }
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.prompt !== "string" || !value.prompt.trim()) {
          throw new HttpError(400, "An approved prompt is required.");
        }
        const prompt = value.prompt.trim();
        const musicReference = isMusicReference(value.musicReference)
          ? value.musicReference
          : chat.musicReference;
        const usesMusicCorpus = musicReference !== "none";
        activeMoodSubmissions.add(chatId);
        try {
          await moodChatStore.setProposal(chatId, prompt);
          const input = parseTaskInput({
            description: prompt,
            compositionMode: "single",
            workflowType: usesMusicCorpus ? "02-music" : "01-general",
            corpusMode: usesMusicCorpus ? "music" : "none",
            ...(usesMusicCorpus && musicReference !== "auto" ? { musicType: musicReference } : {}),
            mode: typeof value.mode === "string" ? value.mode : "generate",
            lyriaModel: typeof value.lyriaModel === "string" ? value.lyriaModel : "lyria-3.5",
            vocalMode: typeof value.vocalMode === "string" ? value.vocalMode : "instrumental",
          });
          input.sourceDiscussionId = chatId;
          input.moodChatId = chatId;
          const config = loadConfig(input.mode === "generate", await settings.runtimeEnvironment());
          const task = await store.create(input, config);
          await moodChatStore.markSubmitted(chatId, task.id, prompt);
          // The journey starts with the conversation; its first stage is the song.
          await journeys.startForMoodChat({ moodChatId: chatId, songTaskId: task.id });
          startTask(task, config);
          sendJson(response, 202, { chat: await moodChatView(moodChatStore.get(chatId)!), task });
        } finally {
          activeMoodSubmissions.delete(chatId);
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mood-entries") {
        sendJson(response, 200, {
          entries: moodStore.list().map((entry) => ({
            ...entry,
            tasks: entry.taskIds.flatMap((id) => {
              const task = store.get(id);
              return task ? [task] : [];
            }),
          })),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mood-entries") {
        sendJson(response, 201, await moodStore.create(parseMoodEntryInput(await readJsonBody(request))));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mood-entries/classify") {
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.text !== "string" || !value.text.trim()) {
          throw new HttpError(400, "A feeling description is required.");
        }
        const text = value.text.trim().slice(0, 2000);
        // Resolve the model configuration best-effort; the classifier itself
        // falls back to the offline lexicon when no key is available.
        let apiKey = "";
        let model = process.env.OPENAI_MODEL ?? "gpt-6-sol";
        try {
          const config = loadConfig(false, await settings.runtimeEnvironment());
          apiKey = config.openAiApiKey;
          model = config.openAiModel;
        } catch {
          /* No model configured: classify offline. */
        }
        const result = await moodClassifier.classify(text, {
          apiKey,
          model,
          language: await settings.language(),
        });
        sendJson(response, 200, result);
        return;
      }

      if (moodEntryMatch?.[1]) {
        const entryId = moodEntryMatch[1];
        if (!moodStore.get(entryId)) throw new HttpError(404, "Mood entry not found.");
        if (request.method === "PATCH") {
          sendJson(response, 200, await moodStore.update(entryId, parseMoodEntryPatch(await readJsonBody(request))));
          return;
        }
        if (request.method === "DELETE") {
          await moodStore.remove(entryId);
          sendJson(response, 200, { removed: entryId });
          return;
        }
      }

      if (request.method === "POST" && moodEntryTaskMatch?.[1]) {
        const entryId = moodEntryTaskMatch[1];
        if (!entryId) throw new HttpError(404, "Mood entry not found.");
        if (!moodStore.get(entryId)) throw new HttpError(404, "Mood entry not found.");
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.taskId !== "string" || !store.get(value.taskId)) {
          throw new HttpError(400, "A known task is required to link to this feeling.");
        }
        const task = store.get(value.taskId)!;
        const journey = journeys.journeyForTask(task);
        if (journey) {
          try {
            await journeys.linkMoodEntry(journey.id, entryId);
          } catch {
            /* The feeling link is best-effort lineage. */
          }
        }
        sendJson(response, 200, await moodStore.linkTask(entryId, value.taskId));
        return;
      }

      if (request.method === "GET" && journeyMatch?.[1]) {
        const identifier = journeyMatch[1];
        sendJson(response, 200, await withJourney(() => journeyResponse(identifier)));
        return;
      }

      if (request.method === "POST" && journeyContinueMatch?.[1]) {
        const identifier = journeyContinueMatch[1];
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.theme !== "string" || !value.theme.trim()) {
          throw new HttpError(400, "An album theme is required.");
        }
        const theme = value.theme.trim();
        if (theme.length > 8_000) throw new HttpError(400, "The album theme is too long.");
        const candidateCount = value.candidateCount === undefined ? undefined : Number(value.candidateCount);
        if (candidateCount !== undefined && (!Number.isInteger(candidateCount)
          || candidateCount < ALBUM_MIN_CANDIDATES || candidateCount > ALBUM_MAX_CANDIDATES)) {
          throw new HttpError(400, `Album candidate count must be an integer from ${ALBUM_MIN_CANDIDATES} to ${ALBUM_MAX_CANDIDATES}.`);
        }
        const targetTotalMinutes = value.targetTotalMinutes === undefined
          ? undefined : Number(value.targetTotalMinutes);
        if (targetTotalMinutes !== undefined && (!Number.isFinite(targetTotalMinutes)
          || targetTotalMinutes < ALBUM_MIN_TOTAL_MINUTES || targetTotalMinutes > ALBUM_MAX_TOTAL_MINUTES)) {
          throw new HttpError(400, `Album length must be ${ALBUM_MIN_TOTAL_MINUTES}–${ALBUM_MAX_TOTAL_MINUTES} minutes.`);
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const result = await withJourney(() => journeys.continueAlbum(identifier, {
          theme,
          ...(candidateCount === undefined ? {} : { candidateCount }),
          ...(targetTotalMinutes === undefined ? {} : { targetTotalMinutes }),
          ...(typeof value.songTaskId === "string" ? { songTaskId: value.songTaskId } : {}),
        }, config));
        // Planning continues in the background; the request returns immediately.
        if (result.created) startTask(result.task, config);
        sendJson(response, result.created ? 202 : 200, journeys.view(result.journey));
        return;
      }

      if (request.method === "POST" && journeyPlanMessagesMatch?.[1]) {
        const identifier = journeyPlanMessagesMatch[1];
        const journey = await withJourney(() => journeys.sync(identifier));
        const task = journey.albumTaskId ? store.get(journey.albumTaskId) : undefined;
        if (!task) throw new HttpError(404, "This journey has no album plan yet.");
        if (journey.phase !== "album-review" || task.status !== "review"
          || !task.albumPlan || !task.playlistBriefing) {
          throw new HttpError(409, "This album plan is not open for changes.");
        }
        if (planRevisions.has(task.id)) {
          throw new HttpError(409, "This album plan is already being revised.");
        }
        const value = await readJsonBody(request);
        const message = isRecord(value) && typeof value.message === "string" ? value.message.trim() : "";
        if (!message) throw new HttpError(400, "A revision message is required.");
        if (message.length > MAX_PLAYLIST_FEEDBACK_LENGTH) {
          throw new HttpError(400, "The revision message is too long.");
        }
        const discussion = task.playlistDiscussion ?? [];
        if (discussion.filter((entry) => entry.role === "user").length >= MAX_PLAYLIST_DISCUSSION_MESSAGES) {
          throw new HttpError(409, "This plan has reached its revision limit.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const userMessage: PlaylistDiscussionMessage = {
          id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString(),
        };
        planRevisions.add(task.id);
        try {
          // A revision invalidates the previous approval before it is written.
          await withJourney(() => journeys.notePlanRevised(task));
          const refined = await refinePlaylistPlan({
            description: task.description,
            plan: task.albumPlan,
            briefing: task.playlistBriefing,
            references: task.playlistReferences ?? [],
            history: [...discussion, userMessage],
            feedback: message,
          }, { apiKey: config.openAiApiKey, model: task.composerModel, lyriaModel: task.lyriaModel });
          const latest = store.get(task.id);
          if (!latest || latest.playlistPlanApproved || latest.status !== "review") {
            throw new HttpError(409, "This album plan is no longer open for changes.");
          }
          const now = new Date().toISOString();
          const assistantMessage: PlaylistDiscussionMessage = {
            id: crypto.randomUUID(), role: "assistant", content: refined.reply, createdAt: now,
          };
          await store.update(task.id, {
            title: refined.plan.albumTitle,
            albumPlan: refined.plan,
            playlistBriefing: refined.briefing,
            playlistDiscussion: [...discussion, userMessage, assistantMessage],
            albumPlanRevision: (latest.albumPlanRevision ?? 1) + 1,
            playlistPlanApproved: false,
            albumTracks: refined.plan.tracks.map((outline) => ({
              id: crypto.randomUUID(), order: outline.number, title: outline.title,
              targetDurationSeconds: outline.targetSeconds,
              admission: "candidate", status: "queued", createdAt: now, updatedAt: now,
            })),
          });
        } finally {
          planRevisions.delete(task.id);
        }
        sendJson(response, 200, await journeyResponse(identifier));
        return;
      }

      if (request.method === "POST" && journeyPlanApproveMatch?.[1]) {
        const identifier = journeyPlanApproveMatch[1];
        let value: unknown = {};
        try {
          value = await readJsonBody(request);
        } catch (error) {
          if (!(error instanceof HttpError) || error.status !== 400) throw error;
        }
        const revision = isRecord(value) && value.revision !== undefined ? Number(value.revision) : undefined;
        if (revision !== undefined && (!Number.isInteger(revision) || revision < 1)) {
          throw new HttpError(400, "A plan revision number is required.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const result = await withJourney(() => journeys.approvePlan(identifier, revision));
        // Approval is persisted before dispatch, so a second click cannot start
        // a second billable run.
        if (result.approved) startTask(result.task, config);
        sendJson(response, result.approved ? 202 : 200, journeys.view(result.journey));
        return;
      }

      if (request.method === "POST" && journeyRetryMatch?.[1]) {
        const identifier = journeyRetryMatch[1];
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const result = await withJourney(() => journeys.retry(identifier));
        startTask(result.task, config);
        sendJson(response, 202, journeys.view(result.journey));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/settings") {
        sendJson(response, 200, await settings.snapshot());
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/settings") {
        const value = await readJsonBody(request);
        if (!isRecord(value)) {
          throw new Error("A settings request is required.");
        }
        const candidate = value;
        const language = candidate.language;
        const submittedCredentials: Array<{ provider: ApiProvider; key: string }> = [];

        if (language !== undefined && !isInterfaceLanguage(language)) {
          throw new Error("Unsupported interface language.");
        }

        const credentials = candidate.credentials;
        if (credentials !== undefined) {
          if (!isRecord(credentials)) {
            throw new Error("Invalid API configuration.");
          }
          const credentialValues = credentials;
          for (const provider of ["openai", "gemini"] as const) {
            const apiKey = credentialValues[provider];
            if (apiKey !== undefined) {
              if (typeof apiKey !== "string" || !apiKey.trim()) {
                throw new Error("API key is required.");
              }
              if (/[\r\n]/u.test(apiKey.trim())) {
                throw new Error("API keys cannot contain line breaks.");
              }
              submittedCredentials.push({ provider, key: apiKey });
            }
          }
        }

        // Validate the whole request before changing any setting.
        if (language !== undefined) {
          await settings.saveLanguage(language);
        }
        for (const { provider, key } of submittedCredentials) {
          await settings.saveCredential(provider, key, candidate.remember === true);
        }

        sendJson(response, 200, await settings.snapshot());
        return;
      }

      if (request.method === "DELETE" && credentialMatch?.[1]) {
        const provider = credentialMatch[1];
        if (!isApiProvider(provider)) {
          throw new Error("Unknown API provider.");
        }
        await settings.clearCredential(provider);
        sendJson(response, 200, await settings.snapshot());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/settings/test") {
        const value = await readJsonBody(request);
        if (!isRecord(value)) {
          throw new Error("A connection test request is required.");
        }
        const candidate = value;
        if (!isApiProvider(candidate.provider)) {
          throw new Error("Unknown API provider.");
        }
        const submittedKey = typeof candidate.apiKey === "string"
          ? candidate.apiKey.trim()
          : "";
        const apiKey = submittedKey || await settings.resolveCredential(candidate.provider);
        if (!apiKey) {
          throw new Error("API key is required.");
        }
        sendJson(response, 200, {
          ok: await testApiConnection(candidate.provider, apiKey),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/tasks") {
        sendJson(response, 200, store.list());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/playlists/references") {
        sendJson(response, 200, {
          references: moodChatStore.list().flatMap((chat) => {
            const reference = playlistReferenceFor(chat.id);
            if (!reference) return [];
            const task = reference.taskId ? store.get(reference.taskId) : undefined;
            return [{
              ...reference,
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              ...(task?.audioFile ? { audioUrl: `/api/tasks/${task.id}/audio` } : {}),
            }];
          }),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/playlists") {
        const value = await readJsonBody(request);
        if (!isRecord(value)) throw new HttpError(400, "A playlist request is required.");
        const referenceChatIds = Array.isArray(value.referenceChatIds)
          ? value.referenceChatIds.filter((id: unknown): id is string => typeof id === "string")
          : [];
        if (referenceChatIds.length > MAX_PLAYLIST_REFERENCES) {
          throw new HttpError(400, `Choose at most ${MAX_PLAYLIST_REFERENCES} references.`);
        }
        const references: PlaylistReference[] = [];
        for (const chatId of referenceChatIds) {
          const reference = playlistReferenceFor(chatId);
          if (!reference) throw new HttpError(400, "A selected MoodMic creation is unavailable.");
          references.push(reference);
        }
        const input = parseTaskInput({
          description: value.description,
          mode: "generate",
          vocalMode: "instrumental",
          corpusMode: "none",
          compositionMode: "album",
          workflowType: "05-playlist",
          candidateCount: value.candidateCount,
          targetTotalMinutes: value.targetTotalMinutes,
          lyriaModel: "lyria-3.5",
        });
        if (references.length) input.playlistReferences = references;
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const task = await store.create(input, config);
        if (input.moodChatId) {
          try {
            await journeys.adoptSongTask(input.moodChatId, task);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Unable to adopt task ${task.id} into its journey: ${message}`);
          }
        }
        startTask(task, config);
        sendJson(response, 202, task);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const body = await readJsonBody(request);
        const input = parseTaskInput(body);
        // A MoodMic "try again" creates a fresh attempt; keep it inside the
        // generation check when it names a known conversation.
        if (isRecord(body) && typeof body.moodChatId === "string" && moodChatStore.get(body.moodChatId)) {
          input.moodChatId = body.moodChatId;
        }
        const config = loadConfig(
          input.mode === "generate",
          await settings.runtimeEnvironment(),
        );
        const task = await store.create(input, config);
        startTask(task, config);
        sendJson(response, 202, task);
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") && productionArtifactMatch?.[1] && productionArtifactMatch[2]) {
        const task = store.get(productionArtifactMatch[1]);
        const artifact = productionArtifactMatch[2] as ProductionArtifact;
        const file = task ? productionArtifactPath(store, task, artifact) : undefined;
        if (!file) throw new HttpError(404, "Production artifact is not available.");
        response.setHeader("Content-Disposition", `attachment; filename="${PRODUCTION_ARTIFACTS[artifact]}"`);
        await sendAudio(request, response, file);
        return;
      }

      if (request.method === "PATCH" && albumTrackMatch?.[1] && albumTrackMatch[2]) {
        const task = store.get(albumTrackMatch[1]);
        const track = task?.albumTracks?.find((candidate) => candidate.id === albumTrackMatch[2]);
        if (!task || task.compositionMode !== "album" || !track) {
          throw new HttpError(404, "Album track not found.");
        }
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.admission !== "string"
          || !["candidate", "included", "excluded"].includes(value.admission)) {
          throw new HttpError(400, "Unsupported album admission.");
        }
        sendJson(response, 200, await store.setAlbumAdmission(task.id, track.id, value.admission as AlbumAdmission));
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") && albumExportAudioMatch?.[1] && albumExportAudioMatch[2]) {
        const task = store.get(albumExportAudioMatch[1]);
        const exported = task && task.compositionMode === "album"
          ? await store.albumAudioExport(task, albumExportAudioMatch[2]) : undefined;
        if (!exported) throw new HttpError(404, "Album export is not available.");
        if (albumExportAudioMatch[3] === "timestamps") {
          const fileName = exported.fileName.replace(/\.mp3$/i, " - Timestamps.txt");
          const encodedName = encodeURIComponent(fileName)
            .replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase());
          response.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": "attachment; filename=\"timestamps.txt\"; filename*=UTF-8''" + encodedName,
            "Content-Length": Buffer.byteLength(exported.timestampsText),
            "Cache-Control": "private, no-cache",
          });
          response.end(request.method === "HEAD" ? undefined : exported.timestampsText);
          return;
        }
        await sendAlbumExport(request, response, exported);
        return;
      }

      if (request.method === "POST" && albumExportMatch?.[1]) {
        const task = store.get(albumExportMatch[1]);
        if (!task || task.compositionMode !== "album") throw new HttpError(404, "Album task not found.");
        const value = await readJsonBody(request);
        if (!isRecord(value) || (value.scope !== undefined
          && value.scope !== "included" && value.scope !== "candidate")) {
          throw new HttpError(400, "Unsupported album export scope.");
        }
        if (value.format !== undefined && value.format !== "mp3" && value.format !== "manifest") {
          throw new HttpError(400, "Unsupported album export format.");
        }
        const exported = await store.exportAlbumAudio(task, value.scope ?? "included");
        // Exporting the album is the end of a journey; legacy albums have none.
        await journeySafe(() => journeys.noteAlbumExported(task));
        if (value.format === "manifest") {
          const { exportId, fileName, trackCount, durationSeconds, chapters, timestampsText } = exported;
          sendJson(response, 200, {
            exportId, fileName, trackCount, durationSeconds, chapters, timestampsText,
            audioUrl: "/api/tasks/" + encodeURIComponent(task.id) + "/album/exports/" + exportId + "/audio",
            timestampsUrl: "/api/tasks/" + encodeURIComponent(task.id) + "/album/exports/" + exportId + "/timestamps",
          });
          return;
        }
        await sendAlbumExport(request, response, exported);
        return;
      }

      if (request.method === "PUT" && albumPlaylistMatch?.[1]) {
        const task = store.get(albumPlaylistMatch[1]);
        if (!task || task.compositionMode !== "album") throw new HttpError(404, "Album task not found.");
        const value = await readJsonBody(request);
        if (!isRecord(value) || !Array.isArray(value.trackIds)
          || !value.trackIds.every((id: unknown) => typeof id === "string")) {
          throw new HttpError(400, "A playlist track ID array is required.");
        }
        sendJson(response, 200, await store.setAlbumPlaylist(task.id, value.trackIds as string[]));
        return;
      }

      if (request.method === "POST" && playlistPlanApproveMatch?.[1]) {
        const task = store.get(playlistPlanApproveMatch[1]);
        if (!task || task.workflowType !== "05-playlist" || task.compositionMode !== "album") {
          throw new HttpError(404, "Playlist task not found.");
        }
        if (!task.albumPlan || !task.playlistBriefing) {
          throw new HttpError(409, "This playlist has no plan to confirm yet.");
        }
        if (task.playlistPlanApproved || task.status !== "review" || planRevisions.has(task.id)) {
          throw new HttpError(409, "This playlist plan is not awaiting confirmation.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const queued = await store.update(task.id, { status: "queued", playlistPlanApproved: true, error: undefined });
        startTask(queued, config);
        sendJson(response, 202, queued);
        return;
      }

      if (request.method === "POST" && playlistPlanMessagesMatch?.[1]) {
        const task = store.get(playlistPlanMessagesMatch[1]);
        if (!task || task.workflowType !== "05-playlist" || task.compositionMode !== "album") {
          throw new HttpError(404, "Playlist task not found.");
        }
        if (!task.albumPlan || !task.playlistBriefing) {
          throw new HttpError(409, "This playlist has no plan to revise yet.");
        }
        if (task.playlistPlanApproved || task.status !== "review" || planRevisions.has(task.id)) {
          throw new HttpError(409, "This playlist plan is no longer open for changes.");
        }
        const value = await readJsonBody(request);
        const message = isRecord(value) && typeof value.message === "string" ? value.message.trim() : "";
        if (!message) throw new HttpError(400, "A revision message is required.");
        if (message.length > MAX_PLAYLIST_FEEDBACK_LENGTH) {
          throw new HttpError(400, "The revision message is too long.");
        }
        const discussion = task.playlistDiscussion ?? [];
        if (discussion.filter((entry) => entry.role === "user").length >= MAX_PLAYLIST_DISCUSSION_MESSAGES) {
          throw new HttpError(409, "This plan has reached its revision limit.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const userMessage: PlaylistDiscussionMessage = {
          id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString(),
        };
        planRevisions.add(task.id);
        try {
          const refined = await refinePlaylistPlan({
            description: task.description,
            plan: task.albumPlan,
            briefing: task.playlistBriefing,
            references: task.playlistReferences ?? [],
            history: [...discussion, userMessage],
            feedback: message,
          }, { apiKey: config.openAiApiKey, model: task.composerModel, lyriaModel: task.lyriaModel });
          const now = new Date().toISOString();
          // The user may have confirmed while this revision was running.
          const latest = store.get(task.id);
          if (!latest || latest.playlistPlanApproved || latest.status !== "review") {
            throw new HttpError(409, "This playlist plan is no longer open for changes.");
          }
          const assistantMessage: PlaylistDiscussionMessage = {
            id: crypto.randomUUID(), role: "assistant", content: refined.reply, createdAt: now,
          };
          const updated = await store.update(task.id, {
            title: refined.plan.albumTitle,
            albumPlan: refined.plan,
            playlistBriefing: refined.briefing,
            playlistDiscussion: [...discussion, userMessage, assistantMessage],
            albumTracks: refined.plan.tracks.map((outline) => ({
              id: crypto.randomUUID(), order: outline.number, title: outline.title,
              targetDurationSeconds: outline.targetSeconds,
              admission: "candidate", status: "queued", createdAt: now, updatedAt: now,
            })),
          });
          sendJson(response, 200, updated);
        } finally {
          planRevisions.delete(task.id);
        }
        return;
      }

      if (request.method === "POST" && albumTrackRetryMatch?.[1] && albumTrackRetryMatch[2]) {
        const task = store.get(albumTrackRetryMatch[1]);
        const track = task?.albumTracks?.find((candidate) => candidate.id === albumTrackRetryMatch[2]);
        if (!task || task.compositionMode !== "album" || !track) {
          throw new HttpError(404, "Album track not found.");
        }
        if (track.status !== "failed" || activeTaskIds.has(task.id)) {
          throw new HttpError(409, "Only failed candidates in an idle album can be continued.");
        }
        const config = loadConfig(task.mode === "generate", await settings.runtimeEnvironment());
        if (activeTaskIds.has(task.id) || store.get(task.id)?.albumTracks?.find((candidate) => candidate.id === track.id)?.status !== "failed") {
          throw new HttpError(409, "Only failed candidates in an idle album can be continued.");
        }
        // Reserve this album before awaiting persistence to prevent double generation.
        activeTaskIds.add(task.id);
        let queued: MusicTask;
        try {
          queued = await store.update(task.id, { status: "queued", error: undefined });
        } catch (error) {
          activeTaskIds.delete(task.id);
          throw error;
        }
        startTask(queued, config, track.id);
        sendJson(response, 202, queued);
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") && albumTrackAudioMatch?.[1] && albumTrackAudioMatch[2]) {
        const task = store.get(albumTrackAudioMatch[1]);
        const track = task?.albumTracks?.find((candidate) => candidate.id === albumTrackAudioMatch[2]);
        const audioPath = task && track ? store.albumTrackAudioPath(task, track) : undefined;
        if (!task || !track || !audioPath) throw new HttpError(404, "Candidate audio is not available.");
        await sendAudio(request, response, audioPath);
        return;
      }

      if (request.method === "POST" && reviewDecisionMatch?.[1]) {
        const task = store.get(reviewDecisionMatch[1]);
        if (!task || !task.moodChatId) throw new HttpError(404, "MoodMic task not found.");
        if (task.status !== "review") {
          throw new HttpError(409, "This task is not awaiting a review decision.");
        }
        if (activeTaskIds.has(task.id)) throw new HttpError(409, "This task is already being processed.");
        const value = await readJsonBody(request);
        if (!isRecord(value) || (value.decision !== "regenerate" && value.decision !== "keep")) {
          throw new HttpError(400, "A review decision of \"regenerate\" or \"keep\" is required.");
        }
        if (value.decision === "keep") {
          const kept = await store.update(task.id, { status: "completed", error: undefined });
          await journeySafe(() => journeys.noteSongReady(kept));
          sendJson(response, 200, kept);
          return;
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        if (store.get(task.id)?.status !== "review" || activeTaskIds.has(task.id)) {
          throw new HttpError(409, "This task is not awaiting a review decision.");
        }
        activeTaskIds.add(task.id);
        let queued: MusicTask;
        try {
          queued = await store.update(task.id, { status: "queued", error: undefined });
        } catch (error) {
          activeTaskIds.delete(task.id);
          throw error;
        }
        await journeySafe(() => journeys.noteSongRegenerating(queued));
        startTask(queued, config);
        sendJson(response, 202, queued);
        return;
      }

      if (request.method === "POST" && retryMatch?.[1]) {
        const task = store.get(retryMatch[1]);
        if (!task) {
          sendJson(response, 404, { error: "Task not found." });
          return;
        }
        if (task.status !== "failed" || activeTaskIds.has(task.id)) {
          sendJson(response, 409, { error: "Only failed tasks can be continued." });
          return;
        }

        const config = loadConfig(
          task.mode === "generate",
          await settings.runtimeEnvironment(),
        );
        if (store.get(task.id)?.status !== "failed" || activeTaskIds.has(task.id)) {
          sendJson(response, 409, { error: "Only failed tasks can be continued." });
          return;
        }
        activeTaskIds.add(task.id);
        let queued: MusicTask;
        try {
          queued = await store.update(task.id, { status: "queued", error: undefined });
        } catch (error) {
          activeTaskIds.delete(task.id);
          throw error;
        }
        startTask(queued, config);
        sendJson(response, 202, queued);
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") && audioMatch?.[1]) {
        const task = store.get(audioMatch[1]);
        const audioPath = task ? store.audioPath(task) : undefined;
        if (!task || !audioPath) {
          sendJson(response, 404, { error: "Audio is not available." });
          return;
        }
        await sendAudio(request, response, audioPath);
        return;
      }

      if (
        (request.method === "GET" || request.method === "HEAD")
        && movementAudioMatch?.[1]
        && movementAudioMatch[2]
      ) {
        const task = store.get(movementAudioMatch[1]);
        const movement = task?.movements?.find(
          (candidate) => candidate.id === movementAudioMatch[2],
        );
        const audioPath = task && movement
          ? store.movementAudioPath(task, movement)
          : undefined;
        if (!task || !movement || !audioPath) {
          sendJson(response, 404, { error: "Movement audio is not available." });
          return;
        }
        await sendAudio(request, response, audioPath);
        return;
      }

      if (request.method === "GET" && taskMatch?.[1]) {
        const task = store.get(taskMatch[1]);
        if (!task) {
          sendJson(response, 404, { error: "Task not found." });
          return;
        }
        sendJson(response, 200, task);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "Not found." });
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD")
        && url.pathname.startsWith("/assets/")) {
        await serveAsset(url.pathname.slice("/assets/".length), response, request.method);
        return;
      }

      await serveStatic(url.pathname, response, request.method);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as NodeJS.ErrnoException | null)?.code;
      const status = error instanceof HttpError ? error.status
        : code && code !== "ERR_INVALID_URL" ? 500 : 400;
      sendJson(response, status, { error: message });
    }
  });
}

async function main(): Promise<void> {
  const server = await createAriosoServer();
  const port = Number.parseInt(process.env.ARIOSO_WEB_PORT ?? "4173", 10);
  const host = process.env.ARIOSO_WEB_HOST ?? "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`Arioso is ready at http://${host}:${port}`);
  });
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Arioso web failed: ${message}`);
    process.exitCode = 1;
  });
}
