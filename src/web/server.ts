import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { configureModelDeadlines, refinePlaylistPlan } from "../composer/bounded-agent.js";
import { loadConfig, timeoutsFor, type AriosoConfig } from "../config/env.js";
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
import { JourneyRuntime } from "../journey/journey-runtime.js";
import { JourneyStore } from "../journey/journey-store.js";
import { JourneyTransitionError } from "../journey/journey-graph.js";
import { MAX_PLAYLIST_REFERENCES, type PlaylistReference } from "../playlist/reference.js";
import { MAX_PLAYLIST_DISCUSSION_MESSAGES, MAX_PLAYLIST_FEEDBACK_LENGTH, type PlaylistDiscussionMessage } from "../playlist/briefing.js";
import type { PoemRetriever } from "../retrieval/poem-retriever.js";
import { MUSIC_TYPES, loadMusicRetriever } from "../retrieval/music-retriever.js";
import {
  ALBUM_MAX_CANDIDATES,
  ALBUM_MAX_TOTAL_MINUTES,
  ALBUM_MIN_CANDIDATES,
  ALBUM_MIN_TOTAL_MINUTES,
} from "../schema/album-plan.js";
import { runTask, TaskAdmission } from "./task-runtime.js";
import { TaskStore, parseTaskInput, type AlbumAdmission, type AlbumAudioExport, type MusicTask } from "./task-store.js";
import { MoodEntryStore, isCalendarDate, isMoodGroup, type MoodEntryInput } from "./mood-store.js";
import { LangChainMoodClassifier, type MoodClassifier } from "./mood-classifier.js";
import { MoodChatStore, isMusicReference, type MoodChat } from "./mood-chat-store.js";
import { musicReferencesForTask } from "./music-references.js";
import { poemReferencesForChat } from "./poem-references.js";
import { HttpError, readBinaryBody, readJsonBody, sendAudio, sendFile, sendJson, serveAsset, serveStatic } from "./http.js";
import { isRecord } from "../utils/validation.js";
import { KeyedQueue } from "../utils/queues.js";
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

async function readOptionalJsonBody(request: IncomingMessage): Promise<unknown> {
  // An absent body is legal for endpoints whose payload is optional; it means
  // "no change", which is different from malformed JSON.
  if (!Number(request.headers["content-length"] ?? 0)) return undefined;
  return readJsonBody(request);
}

/**
 * Confirming the Lyria prompt may carry an edited version of it. No body means
 * "use the prompt the Composer wrote", which keeps the older clients working.
 */
function parseApprovedPrompt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || value.prompt === undefined) return undefined;
  if (typeof value.prompt !== "string") throw new HttpError(400, "The prompt must be text.");
  const prompt = value.prompt.trim();
  if (!prompt) throw new HttpError(400, "The prompt cannot be empty.");
  if (prompt.length > 8_000) throw new HttpError(400, "The prompt is too long.");
  return prompt;
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
  // Model-call deadlines come from the same environment the server runs with.
  try {
    configureModelDeadlines(timeoutsFor(loadConfig(false, environment)));
  } catch {
    /* No model configured yet: the built-in deadlines apply. */
  }
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
  const activeTaskIds = new TaskAdmission();
  /**
   * Application-level admission for user decisions: one decision at a time per
   * task or journey, so overlapping requests cannot both pass the same gate.
   * This lock is process-local; it does not coordinate a second CLI or server
   * process, and it makes no provider-level exactly-once claim.
   */
  const decisions = new KeyedQueue();
  const RUNNING_TASK_STATUSES = new Set(["queued", "composing", "generating", "assembling", "processing"]);

  /**
   * Deletes the tasks a conversation produced, together with their audio,
   * any journey that pointed at them, and mood-entry references. Running tasks
   * block the whole deletion so nothing is removed half-way.
   */
  const deleteConversationTasks = async (taskIds: string[]): Promise<string[]> => {
    const unique = [...new Set(taskIds)];
    const running = unique
      .map((id) => store.get(id))
      .filter((task): task is MusicTask => Boolean(task
        && (RUNNING_TASK_STATUSES.has(task.status) || activeTaskIds.has(task.id))));
    if (running.length) {
      throw new HttpError(409, "A task created from this conversation is still running.");
    }
    for (const id of unique) {
      await store.delete(id);
      await moodStore.unlinkTask(id);
    }
    const removed = new Set(unique);
    for (const journey of journeyStore.list()) {
      const linked = [journey.songTaskId, journey.albumTaskId]
        .some((id) => Boolean(id && removed.has(id)));
      if (linked) await journeyStore.remove(journey.id);
    }
    return unique;
  };
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
  // A stored trace keeps IDs only; the interface needs titles, so resolve them
  // against the same local corpus that produced them.
  const taskWithMusicReferences = async (task: MusicTask) => {
    const musicReferences = await musicReferencesForTask(task, loadMusicRetriever);
    return musicReferences ? { ...task, musicReferences } : task;
  };
  const moodChatView = async (chat: MoodChat) => {
    const tasks = await Promise.all(chat.taskIds.flatMap((id) => {
      const task = store.get(id);
      return task ? [task] : [];
    }).map(taskWithMusicReferences));
    const latestTask = tasks.at(-1);
    return {
      ...chat,
      phase: await resolveCreativeSessionPhase(chat.status, latestTask?.status),
      tasks,
    };
  };
  /**
   * Reserves the task's single execution owner and starts it. A duplicate
   * dispatch is ignored: it must not start a second runner, and it must not
   * release the reservation the first runner owns. The owning runner releases it
   * in its own `finally` path.
   */
  const startTask = (task: MusicTask, config: AriosoConfig, albumTrackId?: string): boolean => {
    if (!activeTaskIds.reserve(task.id)) {
      console.error(`Task ${task.id} is already running; the duplicate dispatch was ignored.`);
      return false;
    }
    void (async () => {
      const language = task.moodChatId ? await settings.language() : undefined;
      await runTask(store, task, config, albumTrackId, language);
    })()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to persist task ${task.id}: ${message}`);
      })
      .finally(() => {
        activeTaskIds.release(task.id);
        void syncJourneyForTask(store.get(task.id));
      });
    return true;
  };

  /**
   * Runs one user decision under its resource's admission gate. The caller's
   * `decide` rereads the authoritative record, validates the expected
   * status/revision, persists the decision, and reserves dispatch inside this
   * gate, so a concurrent request sees the committed state instead of a stale
   * snapshot. Callers must not await a provider inside `decide`.
   */
  const decideTask = <T>(taskId: string, decide: (task: MusicTask | undefined) => Promise<T>): Promise<T> =>
    decisions.run(`task:${taskId}`, () => decide(store.get(taskId)));
  const decideJourney = <T>(identifier: string, decide: (journeyId: string) => Promise<T>): Promise<T> =>
    // Resolve aliases to the canonical journey before locking, so a chat id and
    // a journey id cannot take two different gates for the same journey.
    decisions.run(`journey:${journeys.find(identifier)?.id ?? identifier}`,
      () => decide(journeys.find(identifier)?.id ?? identifier));

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
      const promptApproveMatch = /^\/api\/tasks\/([^/]+)\/prompt\/approve$/.exec(url.pathname);
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

      if (request.method === "DELETE" && discussionMatch?.[1]) {
        const sessionId = discussionMatch[1];
        const session = discussionStore.get(sessionId);
        if (!session) throw new HttpError(404, "Discussion session not found.");
        if (activeDiscussionSubmissions.has(sessionId)) {
          throw new HttpError(409, "This discussion is still being submitted.");
        }
        const taskIds = [...new Set([
          ...(session.taskIds ?? []),
          ...store.list()
            .filter((task) => task.sourceDiscussionId === sessionId)
            .map((task) => task.id),
        ])];
        const deletedTaskIds = await deleteConversationTasks(taskIds);
        await discussionStore.delete(sessionId);
        sendJson(response, 200, { deleted: { sessionId, taskIds: deletedTaskIds } });
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
        // One submission at a time per discussion: the second request sees the
        // submitted record instead of starting a duplicate task.
        const submitted = await decisions.run(`discussion:${sessionId}`, async () => {
          const current = discussionStore.get(sessionId);
          if (!current) throw new HttpError(404, "Discussion session not found.");
          if (current.status === "submitted" || activeDiscussionSubmissions.has(sessionId)) {
            throw new HttpError(409, "This discussion has already been submitted.");
          }
          activeDiscussionSubmissions.add(sessionId);
          try {
            await discussionStore.setProposal(sessionId, prompt);
            const input = parseTaskInput({
              ...current.taskOptions,
              ...overrides,
              description: prompt,
            });
            input.sourceDiscussionId = sessionId;
            const config = loadConfig(input.mode === "generate", await settings.runtimeEnvironment());
            const task = await store.create(input, config);
            await discussionStore.markSubmitted(sessionId, task.id, prompt);
            startTask(task, config);
            return {
              session: await discussionView(discussionStore.get(sessionId)!), task,
            };
          } finally {
            activeDiscussionSubmissions.delete(sessionId);
          }
        });
        sendJson(response, 202, submitted);
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

      if (request.method === "DELETE" && moodChatMatch?.[1]) {
        const chatId = moodChatMatch[1];
        const chat = moodChatStore.get(chatId);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        if (activeMoodSubmissions.has(chatId)) {
          throw new HttpError(409, "This conversation is still being submitted.");
        }
        const journey = journeyStore.findByChatId(chatId);
        const taskIds = [...new Set([
          ...chat.taskIds,
          ...store.list()
            .filter((task) => task.moodChatId === chatId || task.sourceDiscussionId === chatId)
            .map((task) => task.id),
          ...(journey?.songTaskId ? [journey.songTaskId] : []),
          ...(journey?.albumTaskId ? [journey.albumTaskId] : []),
        ])];
        const deletedTaskIds = await deleteConversationTasks(taskIds);
        await journeyStore.removeForChat(chatId);
        await moodChatStore.delete(chatId);
        sendJson(response, 200, { deleted: { conversationId: chatId, taskIds: deletedTaskIds } });
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
        // Retrieval runs before the reply so the discussion itself can draw on
        // the reference material it selects for this turn.
        const poetry = await poemReferencesForChat(
          moodChatStore.get(chatId) ?? chat,
          poemRetriever
            ? { loadRetriever: async () => poemRetriever }
            : {},
        );
        const reply = await discussionAgent.respond(await moodChatStore.agentMessages(chatId), {
          apiKey: config.openAiApiKey,
          model: config.openAiModel,
          language: await settings.language(),
          compositionMode: "single",
          workflowType: chat.musicReference === "none" ? "01-general" : "02-music",
        }, poetry.references);
        await moodChatStore.addMessage(chatId, "assistant", reply.content, [], reply.mood);
        sendJson(response, 200, await moodChatView(
          await moodChatStore.setPoemRetrieval(chatId, poetry.trace),
        ));
        return;
      }

      if (request.method === "POST" && moodChatProposalMatch?.[1]) {
        const chatId = moodChatProposalMatch[1];
        const chat = moodChatStore.get(chatId);
        if (!chat) throw new HttpError(404, "Conversation not found.");
        const config = loadConfig(false, await settings.runtimeEnvironment());
        // The proposal reuses the discussion's references when the effective
        // context is unchanged, and retrieves again when it is not. Retrieval
        // stays advisory even when the corpus is unavailable.
        const poetry = await poemReferencesForChat(
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
        const value = await readJsonBody(request);
        if (!isRecord(value) || typeof value.prompt !== "string" || !value.prompt.trim()) {
          throw new HttpError(400, "An approved prompt is required.");
        }
        const prompt = value.prompt.trim();
        // One submission at a time per conversation: the second request sees the
        // submitted record instead of starting a duplicate task.
        const submitted = await decisions.run(`mood-chat:${chatId}`, async () => {
          const current = moodChatStore.get(chatId);
          if (!current) throw new HttpError(404, "Conversation not found.");
          if (current.status === "submitted" || activeMoodSubmissions.has(chatId)) {
            throw new HttpError(409, "This conversation has already been submitted.");
          }
          const musicReference = isMusicReference(value.musicReference)
            ? value.musicReference
            : current.musicReference;
          const usesMusicCorpus = musicReference !== "none";
          activeMoodSubmissions.add(chatId);
          try {
            // Submitting an approved brief keeps the trace it was retrieved with.
            await moodChatStore.setProposal(chatId, prompt, current.poem_retrieval);
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
            return { chat: await moodChatView(moodChatStore.get(chatId)!), task };
          } finally {
            activeMoodSubmissions.delete(chatId);
          }
        });
        sendJson(response, 202, submitted);
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
        const result = await withJourney(() => decideJourney(identifier, (journeyId) =>
          journeys.continueAlbum(journeyId, {
            theme,
            ...(candidateCount === undefined ? {} : { candidateCount }),
            ...(targetTotalMinutes === undefined ? {} : { targetTotalMinutes }),
            ...(typeof value.songTaskId === "string" ? { songTaskId: value.songTaskId } : {}),
          }, config)));
        // Planning continues in the background; the request returns immediately.
        if (result.created) startTask(result.task, config);
        sendJson(response, result.created ? 202 : 200, journeys.view(result.journey));
        return;
      }

      if (request.method === "POST" && journeyPlanMessagesMatch?.[1]) {
        const identifier = journeyPlanMessagesMatch[1];
        const value = await readJsonBody(request);
        const message = isRecord(value) && typeof value.message === "string" ? value.message.trim() : "";
        if (!message) throw new HttpError(400, "A revision message is required.");
        if (message.length > MAX_PLAYLIST_FEEDBACK_LENGTH) {
          throw new HttpError(400, "The revision message is too long.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        // Gate 1: claim the revision under the journey's admission gate so an
        // approval and a revision cannot both commit for the same plan.
        const claimed = await withJourney(() => decideJourney(identifier, async (journeyId) => {
          const journey = await journeys.sync(journeyId);
          const task = journey.albumTaskId ? store.get(journey.albumTaskId) : undefined;
          if (!task) throw new HttpError(404, "This journey has no album plan yet.");
          if (journey.phase !== "album-review" || task.status !== "review"
            || !task.albumPlan || !task.playlistBriefing) {
            throw new HttpError(409, "This album plan is not open for changes.");
          }
          if (planRevisions.has(task.id)) {
            throw new HttpError(409, "This album plan is already being revised.");
          }
          const discussion = task.playlistDiscussion ?? [];
          if (discussion.filter((entry) => entry.role === "user").length >= MAX_PLAYLIST_DISCUSSION_MESSAGES) {
            throw new HttpError(409, "This plan has reached its revision limit.");
          }
          const userMessage: PlaylistDiscussionMessage = {
            id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString(),
          };
          planRevisions.add(task.id);
          // A revision invalidates the previous approval before it is written.
          await journeys.notePlanRevised(task);
          return { task, discussion, userMessage };
        }));
        try {
          // The provider call runs outside the gate so other tasks stay usable.
          const refined = await refinePlaylistPlan({
            description: claimed.task.description,
            plan: claimed.task.albumPlan!,
            briefing: claimed.task.playlistBriefing!,
            references: claimed.task.playlistReferences ?? [],
            history: [...claimed.discussion, claimed.userMessage],
            feedback: message,
          }, { apiKey: config.openAiApiKey, model: claimed.task.composerModel, lyriaModel: claimed.task.lyriaModel });
          const now = new Date().toISOString();
          const assistantMessage: PlaylistDiscussionMessage = {
            id: crypto.randomUUID(), role: "assistant", content: refined.reply, createdAt: now,
          };
          // Gate 2: commit only if the plan is still awaiting a decision.
          await withJourney(() => decideTask(claimed.task.id, async (task) => {
            if (!task || task.playlistPlanApproved || task.status !== "review") {
              throw new HttpError(409, "This album plan is no longer open for changes.");
            }
            return store.update(task.id, {
              title: refined.plan.albumTitle,
              albumPlan: refined.plan,
              playlistBriefing: refined.briefing,
              playlistDiscussion: [...claimed.discussion, claimed.userMessage, assistantMessage],
              albumPlanRevision: (task.albumPlanRevision ?? 1) + 1,
              playlistPlanApproved: false,
              albumTracks: refined.plan.tracks.map((outline) => ({
                id: crypto.randomUUID(), order: outline.number, title: outline.title,
                targetDurationSeconds: outline.targetSeconds,
                admission: "candidate", status: "queued", createdAt: now, updatedAt: now,
              })),
            });
          }));
        } finally {
          planRevisions.delete(claimed.task.id);
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
        const result = await withJourney(() => decideJourney(identifier, (journeyId) =>
          journeys.approvePlan(journeyId, revision)));
        // Approval is persisted before dispatch, so a second click cannot start
        // a second billable run.
        if (result.approved) startTask(result.task, config);
        sendJson(response, result.approved ? 202 : 200, journeys.view(result.journey));
        return;
      }

      if (request.method === "POST" && journeyRetryMatch?.[1]) {
        const identifier = journeyRetryMatch[1];
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const result = await withJourney(() => decideJourney(identifier, (journeyId) =>
          journeys.retry(journeyId)));
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
        // parseTaskInput() never yields a moodChatId, so a playlist has no
        // conversation to adopt; MoodMic adoption happens on its own route.
        const task = await store.create(input, config);
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
        const taskId = playlistPlanApproveMatch[1];
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
        const queued = await decideTask(taskId, async (task) => {
          if (!task || task.workflowType !== "05-playlist" || task.compositionMode !== "album") {
            throw new HttpError(404, "Playlist task not found.");
          }
          if (!task.albumPlan || !task.playlistBriefing) {
            throw new HttpError(409, "This playlist has no plan to confirm yet.");
          }
          if (task.playlistPlanApproved || task.status !== "review" || planRevisions.has(task.id)) {
            throw new HttpError(409, "This playlist plan is not awaiting confirmation.");
          }
          // A submitted revision must describe the plan the user is looking at.
          if (revision !== undefined && revision !== (task.albumPlanRevision ?? 1)) {
            throw new HttpError(409, "The plan changed since you opened it. Review the latest revision.");
          }
          const updated = await store.update(task.id, {
            status: "queued", playlistPlanApproved: true, error: undefined,
          });
          startTask(updated, config);
          return updated;
        });
        sendJson(response, 202, queued);
        return;
      }

      if (request.method === "POST" && playlistPlanMessagesMatch?.[1]) {
        const taskId = playlistPlanMessagesMatch[1];
        const value = await readJsonBody(request);
        const message = isRecord(value) && typeof value.message === "string" ? value.message.trim() : "";
        if (!message) throw new HttpError(400, "A revision message is required.");
        if (message.length > MAX_PLAYLIST_FEEDBACK_LENGTH) {
          throw new HttpError(400, "The revision message is too long.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        // Gate 1: a short state transition that claims the revision. An approval
        // arriving now is rejected instead of confirming a plan being rewritten.
        const claimed = await decideTask(taskId, async (task) => {
          if (!task || task.workflowType !== "05-playlist" || task.compositionMode !== "album") {
            throw new HttpError(404, "Playlist task not found.");
          }
          if (!task.albumPlan || !task.playlistBriefing) {
            throw new HttpError(409, "This playlist has no plan to revise yet.");
          }
          if (task.playlistPlanApproved || task.status !== "review" || planRevisions.has(task.id)) {
            throw new HttpError(409, "This playlist plan is no longer open for changes.");
          }
          const discussion = task.playlistDiscussion ?? [];
          if (discussion.filter((entry) => entry.role === "user").length >= MAX_PLAYLIST_DISCUSSION_MESSAGES) {
            throw new HttpError(409, "This plan has reached its revision limit.");
          }
          planRevisions.add(task.id);
          return {
            task,
            discussion,
            userMessage: {
              id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString(),
            } as PlaylistDiscussionMessage,
          };
        });
        try {
          // The provider call runs outside the gate so other tasks stay usable.
          const refined = await refinePlaylistPlan({
            description: claimed.task.description,
            plan: claimed.task.albumPlan!,
            briefing: claimed.task.playlistBriefing!,
            references: claimed.task.playlistReferences ?? [],
            history: [...claimed.discussion, claimed.userMessage],
            feedback: message,
          }, { apiKey: config.openAiApiKey, model: claimed.task.composerModel, lyriaModel: claimed.task.lyriaModel });
          const now = new Date().toISOString();
          const assistantMessage: PlaylistDiscussionMessage = {
            id: crypto.randomUUID(), role: "assistant", content: refined.reply, createdAt: now,
          };
          // Gate 2: the user may have confirmed while this revision was running.
          const updated = await decideTask(taskId, async (task) => {
            if (!task || task.playlistPlanApproved || task.status !== "review") {
              throw new HttpError(409, "This playlist plan is no longer open for changes.");
            }
            return store.update(task.id, {
              title: refined.plan.albumTitle,
              albumPlan: refined.plan,
              playlistBriefing: refined.briefing,
              playlistDiscussion: [...claimed.discussion, claimed.userMessage, assistantMessage],
              albumTracks: refined.plan.tracks.map((outline) => ({
                id: crypto.randomUUID(), order: outline.number, title: outline.title,
                targetDurationSeconds: outline.targetSeconds,
                admission: "candidate", status: "queued", createdAt: now, updatedAt: now,
              })),
            });
          });
          sendJson(response, 200, updated);
        } finally {
          planRevisions.delete(claimed.task.id);
        }
        return;
      }

      if (request.method === "POST" && albumTrackRetryMatch?.[1] && albumTrackRetryMatch[2]) {
        const taskId = albumTrackRetryMatch[1];
        const trackId = albumTrackRetryMatch[2];
        const queued = await decideTask(taskId, async (task) => {
          const track = task?.albumTracks?.find((candidate) => candidate.id === trackId);
          if (!task || task.compositionMode !== "album" || !track) {
            throw new HttpError(404, "Album track not found.");
          }
          // Reread inside the gate: another retry may already own this album.
          const current = task.albumTracks?.find((candidate) => candidate.id === track.id);
          if (current?.status !== "failed" || activeTaskIds.has(task.id)) {
            throw new HttpError(409, "Only failed candidates in an idle album can be continued.");
          }
          const config = loadConfig(task.mode === "generate", await settings.runtimeEnvironment());
          const updated = await store.update(task.id, { status: "queued", error: undefined });
          startTask(updated, config, track.id);
          return updated;
        });
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

      if (request.method === "POST" && promptApproveMatch?.[1]) {
        const taskId = promptApproveMatch[1];
        // The prompt the user confirmed wins over the composed one, so an edited
        // prompt is what the very first generation receives. Input and
        // configuration are prepared before the task's admission gate.
        const editedPrompt = parseApprovedPrompt(await readOptionalJsonBody(request));
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const queued = await decideTask(taskId, async (task) => {
          if (!task || !task.moodChatId) throw new HttpError(404, "MoodMic task not found.");
          if (task.status !== "planning" || task.lyriaPromptApproved) {
            throw new HttpError(409, "This task is not awaiting prompt confirmation.");
          }
          if (activeTaskIds.has(task.id)) throw new HttpError(409, "This task is already being processed.");
          const updated = await store.update(task.id, {
            status: "queued",
            lyriaPromptApproved: true,
            ...(editedPrompt && task.musicSpec && editedPrompt !== task.musicSpec.lyriaPrompt
              ? { musicSpec: { ...task.musicSpec, lyriaPrompt: editedPrompt } }
              : {}),
            error: undefined,
          });
          // Persist, then reserve, then dispatch before the gate is released.
          startTask(updated, config);
          return updated;
        });
        sendJson(response, 202, queued);
        return;
      }

      if (request.method === "POST" && reviewDecisionMatch?.[1]) {
        const taskId = reviewDecisionMatch[1];
        const value = await readJsonBody(request);
        if (!isRecord(value) || (value.decision !== "regenerate" && value.decision !== "keep")) {
          throw new HttpError(400, "A review decision of \"regenerate\" or \"keep\" is required.");
        }
        const config = loadConfig(true, await settings.runtimeEnvironment());
        const decided = await decideTask(taskId, async (task) => {
          if (!task || !task.moodChatId) throw new HttpError(404, "MoodMic task not found.");
          // Reread inside the gate: the other decision may already have won.
          if (task.status !== "review") {
            throw new HttpError(409, "This task is not awaiting a review decision.");
          }
          if (activeTaskIds.has(task.id)) throw new HttpError(409, "This task is already being processed.");
          if (value.decision === "keep") {
            const kept = await store.update(task.id, { status: "completed", error: undefined });
            await journeySafe(() => journeys.noteSongReady(kept));
            return { task: kept, status: 200 };
          }
          const queued = await store.update(task.id, { status: "queued", error: undefined });
          await journeySafe(() => journeys.noteSongRegenerating(queued));
          startTask(queued, config);
          return { task: queued, status: 202 };
        });
        sendJson(response, decided.status, decided.task);
        return;
      }

      if (request.method === "POST" && retryMatch?.[1]) {
        const taskId = retryMatch[1];
        const queued = await decideTask(taskId, async (task) => {
          if (!task) throw new HttpError(404, "Task not found.");
          if (task.status !== "failed" || activeTaskIds.has(task.id)) {
            throw new HttpError(409, "Only failed tasks can be continued.");
          }
          const config = loadConfig(task.mode === "generate", await settings.runtimeEnvironment());
          const updated = await store.update(task.id, { status: "queued", error: undefined });
          startTask(updated, config);
          return updated;
        });
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
        sendJson(response, 200, await taskWithMusicReferences(task));
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
