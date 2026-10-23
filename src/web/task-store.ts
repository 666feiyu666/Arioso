import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { measureAudioDuration, stitchAudioFiles } from "../audio/stitch.js";
import type { AriosoConfig } from "../config/env.js";
import {
  MUSIC_TYPES,
  type MusicRetrievalTrace,
  type MusicType,
} from "../retrieval/music-retriever.js";
import { MusicSpecSchema, type MusicSpec } from "../schema/music-spec.js";
import {
  ALBUM_MAX_CANDIDATES,
  ALBUM_MAX_TOTAL_MINUTES,
  ALBUM_MIN_CANDIDATES,
  ALBUM_MIN_TOTAL_MINUTES,
  AlbumPlanSchema,
  type AlbumPlan,
  type AlbumReview,
} from "../schema/album-plan.js";
import type { OrchestralMovementPlan, OrchestralWorkPlan } from "../schema/orchestral-plan.js";
import { writeTextFileAtomic } from "../utils/files.js";
import { isRecord } from "../utils/validation.js";
import { isProductionRunId, type AlbumProduction } from "../producer/types.js";
import type { MusicReviewRecord } from "../moodmic/music-review.js";
import { isPlaylistDiscussionMessage, PlaylistBriefingSchema, type PlaylistBriefing, type PlaylistDiscussionMessage } from "../playlist/briefing.js";
import { isPlaylistReference, type PlaylistReference } from "../playlist/reference.js";

export type TaskMode = "compose" | "generate";
export type TaskStatus = "queued" | "composing" | "planning" | "generating" | "review" | "assembling" | "processing" | "completed" | "failed";
export type VocalMode = "auto" | "instrumental" | "vocals";
export type CorpusMode = "none" | "music";
export type CompositionMode = "single" | "orchestral" | "album";
export type WorkflowType = "01-general" | "02-music" | "03-orchestral" | "04-album" | "05-playlist";

const WORKFLOW_TYPES: readonly WorkflowType[] = [
  "01-general",
  "02-music",
  "03-orchestral",
  "04-album",
  "05-playlist",
];

/** Historical records keep "02-jazz"; the runtime concept is now "02-music". */
export function normalizeWorkflowType(value: unknown): WorkflowType | undefined {
  if (value === "02-jazz") return "02-music";
  return WORKFLOW_TYPES.includes(value as WorkflowType) ? value as WorkflowType : undefined;
}

function isWorkflowType(value: unknown): value is WorkflowType {
  return normalizeWorkflowType(value) !== undefined;
}

/** Stored "jazz" corpus selections are the legacy form of "music". */
export function normalizeCorpusMode(value: unknown): CorpusMode {
  return value === "music" || value === "jazz" ? "music" : "none";
}

export function isMusicType(value: unknown): value is MusicType {
  return MUSIC_TYPES.includes(value as MusicType);
}

function corpusModeForWorkflow(workflowType: WorkflowType, selection: unknown): CorpusMode {
  return workflowType === "02-music" && selection !== "none" ? "music" : "none";
}

export function inferWorkflowType(task: {
  workflowType?: unknown;
  compositionMode?: unknown;
  corpusMode?: unknown;
  retrievalQuery?: unknown;
  musicRetrieval?: unknown;
  description?: unknown;
}): WorkflowType {
  const workflowType = normalizeWorkflowType(task.workflowType);
  if (workflowType) return workflowType;
  if (task.compositionMode === "orchestral") return "03-orchestral";
  if (task.compositionMode === "album") return "04-album";
  if (
    typeof task.description === "string"
    && /(?:[二三四五六2-6]\s*(?:个)?乐章|(?:two|three|four|five|six|multi)[-\s]movement)/iu
      .test(task.description)
  ) {
    return "03-orchestral";
  }
  if (normalizeCorpusMode(task.corpusMode) === "music" || task.retrievalQuery || task.musicRetrieval) {
    return "02-music";
  }
  return "01-general";
}

interface OrchestralMovementTask {
  id: string;
  order: number;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  plan?: OrchestralMovementPlan;
  generatedText?: string | null;
  audioFile?: string;
  error?: string | undefined;
}

export type AlbumAdmission = "candidate" | "included" | "excluded";

export interface AlbumTrackTask {
  id: string;
  order: number;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  targetDurationSeconds: number;
  musicSpec?: MusicSpec;
  generatedText?: string | null;
  audioFile?: string;
  durationSeconds?: number;
  admission: AlbumAdmission;
  error?: string | undefined;
}

export interface PreparedAlbumTrack {
  order: number;
  title: string;
  targetDurationSeconds: number;
  musicSpec: MusicSpec;
}

interface OrchestralAssembly {
  format: "mp3" | "wav";
  durationSeconds: number;
  segmentDurationsSeconds: number[];
  sampleRate: number;
  channels: number;
  assembledAt: string;
}

export interface MusicTask {
  id: string;
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  corpusMode: CorpusMode;
  compositionMode: CompositionMode;
  workflowType: WorkflowType;
  status: TaskStatus;
  composerModel: string;
  lyriaModel: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  /** Set by the Composer's bounded music retrieval for this task. */
  musicRetrieval?: MusicRetrievalTrace;
  /** The music type bound by the interface, when the user chose one. */
  musicType?: MusicType;
  /** Legacy Jazz pilot fields, read but no longer written. */
  retrievalQuery?: string;
  retrievedReferenceIds?: string[];
  musicSpec?: MusicSpec;
  /** Set once the user confirms the composed Lyria prompt; generation may proceed. */
  lyriaPromptApproved?: boolean;
  albumPlan?: AlbumPlan;
  albumTracks?: AlbumTrackTask[];
  albumReview?: AlbumReview;
  albumFinalReview?: AlbumReview;
  albumRevisedTrackNumbers?: number[];
  albumPromptsReady?: boolean;
  albumPlaylist?: string[];
  albumCandidateCount?: number;
  albumTargetTotalMinutes?: number;
  albumProduction?: AlbumProduction;
  orchestralPlan?: OrchestralWorkPlan;
  movements?: OrchestralMovementTask[];
  orchestralAssembly?: OrchestralAssembly;
  generatedText?: string | null;
  audioFile?: string;
  error?: string | undefined;
  sourceDiscussionId?: string;
  /** Set only for MoodMic creations; marks a task that runs the generation check. */
  moodChatId?: string;
  musicReview?: MusicReviewRecord;
  reviewAttempt?: number;
  /** MoodMic creations reused as references when planning a Playlist album. */
  playlistReferences?: PlaylistReference[];
  /** How the album author read the references and the user's theme, shown for confirmation. */
  playlistBriefing?: PlaylistBriefing;
  /** The confirmation conversation about the playlist plan, before audio generation. */
  playlistDiscussion?: PlaylistDiscussionMessage[];
  /** Set once the user confirms the playlist plan and generation may proceed. */
  playlistPlanApproved?: boolean;
  /** The plan revision the user is looking at; revisions invalidate an approval. */
  albumPlanRevision?: number;
  /** The journey this task belongs to, when it was started from one. */
  journeyId?: string;
  /** The task this one was derived from (for example, an album's source song). */
  parentTaskId?: string;
}

export interface CreateTaskInput {
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  corpusMode: CorpusMode;
  compositionMode: CompositionMode;
  workflowType: WorkflowType;
  lyriaModel?: string;
  musicType?: MusicType;
  candidateCount?: number;
  targetTotalMinutes?: number;
  produceAlbum?: boolean;
  sourceDiscussionId?: string;
  moodChatId?: string;
  playlistReferences?: PlaylistReference[];
  journeyId?: string;
  parentTaskId?: string;
}

function isSafeFileName(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && value !== ".."
    && path.basename(value) === value
    && !/[<>:"/\\|?*\u0000-\u001f]/u.test(value)
    && !/[. ]$/u.test(value)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(value);
}

const TASK_STATUSES: readonly TaskStatus[] = [
  "queued", "composing", "planning", "generating", "review", "assembling", "processing", "completed", "failed",
];
const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = [
  "queued", "composing", "generating", "assembling", "processing",
];

// Older records may omit newer settings, but must be safe to index and display.
function isTaskRecord(value: unknown): value is MusicTask {
  if (!isRecord(value)
    || !isSafeFileName(value.id)
    || typeof value.description !== "string"
    || typeof value.updatedAt !== "string"
    || !TASK_STATUSES.includes(value.status as TaskStatus)
    || (value.title !== undefined && typeof value.title !== "string")) {
    return false;
  }
  const movementsValid = value.movements === undefined || (Array.isArray(value.movements)
    && value.movements.every((movement: unknown) => isRecord(movement)
      && typeof movement.id === "string"
      && Number.isInteger(movement.order) && Number(movement.order) > 0
      && typeof movement.title === "string"
      && TASK_STATUSES.includes(movement.status as TaskStatus)));
  const tracksValid = value.albumTracks === undefined || (Array.isArray(value.albumTracks)
    && value.albumTracks.every((track: unknown) => isRecord(track)
      && isSafeFileName(track.id)
      && Number.isInteger(track.order) && Number(track.order) > 0
      && typeof track.title === "string"
      && TASK_STATUSES.includes(track.status as TaskStatus)
      && typeof track.targetDurationSeconds === "number" && track.targetDurationSeconds > 0
      && typeof track.admission === "string"
      && ["candidate", "included", "excluded"].includes(track.admission)));
  const playlistValid = value.albumPlaylist === undefined || (Array.isArray(value.albumPlaylist)
    && value.albumPlaylist.every((id: unknown) => isSafeFileName(id)));
  const albumPlanValid = value.albumPlan === undefined || AlbumPlanSchema.safeParse(value.albumPlan).success;
  const production = value.albumProduction;
  const productionProgress = isRecord(production) ? production.progress : undefined;
  const productionProgressValid = productionProgress === undefined || (isRecord(productionProgress)
    && ["checking", "denoising", "exporting", "assembling", "video"].includes(String(productionProgress.step))
    && Number.isInteger(productionProgress.completedTracks) && Number(productionProgress.completedTracks) >= 0
    && Number.isInteger(productionProgress.totalTracks) && Number(productionProgress.totalTracks) > 0
    && Number(productionProgress.completedTracks) <= Number(productionProgress.totalTracks)
    && (productionProgress.currentTrackNumber === undefined
      || (Number.isInteger(productionProgress.currentTrackNumber) && Number(productionProgress.currentTrackNumber) > 0))
    && (productionProgress.currentTrackTitle === undefined || typeof productionProgress.currentTrackTitle === "string"));
  const productionValid = production === undefined || (isRecord(production)
    && production.role === "background_music_producer"
    && ["pending", "checking", "composing", "processing", "completed", "failed"].includes(String(production.status))
    && ["runtime", "composition", "postproduction", "delivery"].includes(String(production.stage))
    && (production.runId === undefined || isProductionRunId(production.runId))
    && (production.videoCreated === undefined || typeof production.videoCreated === "boolean")
    && productionProgressValid);
  const review = value.musicReview;
  const musicReviewValid = review === undefined || (isRecord(review)
    && (review.verdict === "match" || review.verdict === "mismatch")
    && typeof review.summary === "string"
    && Array.isArray(review.matchedPoints) && review.matchedPoints.every((point: unknown) => typeof point === "string")
    && Array.isArray(review.mismatchedPoints) && review.mismatchedPoints.every((point: unknown) => typeof point === "string")
    && typeof review.model === "string"
    && Number.isInteger(review.attempt) && Number(review.attempt) >= 0
    && typeof review.reviewedAt === "string");
  const moodChatValid = value.moodChatId === undefined || isSafeFileName(value.moodChatId);
  const reviewAttemptValid = value.reviewAttempt === undefined
    || (Number.isInteger(value.reviewAttempt) && Number(value.reviewAttempt) >= 0);
  const referencesValid = value.playlistReferences === undefined
    || (Array.isArray(value.playlistReferences) && value.playlistReferences.every(isPlaylistReference));
  const briefingValid = value.playlistBriefing === undefined || PlaylistBriefingSchema.safeParse(value.playlistBriefing).success;
  const discussionValid = value.playlistDiscussion === undefined
    || (Array.isArray(value.playlistDiscussion) && value.playlistDiscussion.every(isPlaylistDiscussionMessage));
  const approvedValid = value.playlistPlanApproved === undefined || typeof value.playlistPlanApproved === "boolean";
  const lyriaPromptApprovedValid = value.lyriaPromptApproved === undefined || typeof value.lyriaPromptApproved === "boolean";
  const planRevisionValid = value.albumPlanRevision === undefined
    || (Number.isInteger(value.albumPlanRevision) && Number(value.albumPlanRevision) > 0);
  const lineageValid = (value.journeyId === undefined || isSafeFileName(value.journeyId))
    && (value.parentTaskId === undefined || isSafeFileName(value.parentTaskId));
  return movementsValid && tracksValid && playlistValid && albumPlanValid && productionValid
    && musicReviewValid && moodChatValid && reviewAttemptValid && referencesValid
    && briefingValid && discussionValid && approvedValid && lyriaPromptApprovedValid
    && planRevisionValid && lineageValid;
}

function safeAudioName(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  const name = Array.from(normalized).slice(0, 96).join("").replace(/[. ]+$/g, "") || fallback;
  return `${isSafeFileName(name) ? name : `_${name}`}.mp3`;
}

async function taskRecordPaths(directory: string): Promise<string[]> {
  const paths: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await taskRecordPaths(entryPath));
    } else if (entry.isFile() && entry.name === "task.json") {
      paths.push(entryPath);
    }
  }
  return paths;
}

async function copyVerified(source: string, destination: string): Promise<boolean> {
  try {
    const sourceStat = await stat(source);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    const destinationStat = await stat(destination);
    if (sourceStat.size !== destinationStat.size) {
      throw new Error(`Incomplete task asset copy: ${source}`);
    }
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw error;
  }
}

export interface TaskStorageMigrationResult {
  migratedTasks: number;
  migratedAudioFiles: number;
}

export async function organizeTaskStorage(
  directory: string,
): Promise<TaskStorageMigrationResult> {
  await mkdir(directory, { recursive: true });
  await Promise.all(WORKFLOW_TYPES.map((workflowType) =>
    mkdir(path.join(directory, workflowType), { recursive: true })
  ));

  let migratedTasks = 0;
  let migratedAudioFiles = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  const legacyRecords = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json"),
  );
  const backupRoot = path.join(path.dirname(directory), `${path.basename(directory)}-legacy-backup`);

  for (const entry of legacyRecords) {
    const legacyRecordPath = path.join(directory, entry.name);
    let task: MusicTask;
    try {
      const value: unknown = JSON.parse(await readFile(legacyRecordPath, "utf8"));
      if (!isTaskRecord(value)) continue;
      task = value;
    } catch (error) {
      if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
    task.workflowType = inferWorkflowType(task);
    task.compositionMode = task.workflowType === "03-orchestral" ? "orchestral"
      : ["04-album", "05-playlist"].includes(task.workflowType) ? "album" : "single";
    task.corpusMode = corpusModeForWorkflow(task.workflowType, task.corpusMode);
    const taskDirectory = path.join(directory, task.workflowType, task.id);
    const recordPath = path.join(taskDirectory, "task.json");
    try {
      await stat(recordPath);
      // Retain both records when a legacy ID already has a current destination.
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(taskDirectory, { recursive: true });

    const copiedSources = new Set<string>();
    if (isSafeFileName(task.audioFile)) {
      const source = path.join(directory, task.audioFile);
      const audioFile = safeAudioName(task.title, task.id);
      if (await copyVerified(source, path.join(taskDirectory, audioFile))) {
        task.audioFile = audioFile;
        copiedSources.add(source);
        migratedAudioFiles += 1;
      }
    }

    if (task.movements) {
      for (const movement of task.movements) {
        if (!isSafeFileName(movement.audioFile)) {
          continue;
        }
        const source = path.join(directory, movement.audioFile);
        const audioFile = safeAudioName(
          `${String(movement.order).padStart(2, "0")} - ${movement.title}`,
          `movement-${movement.order}`,
        );
        if (await copyVerified(source, path.join(taskDirectory, "movements", audioFile))) {
          movement.audioFile = audioFile;
          copiedSources.add(source);
          migratedAudioFiles += 1;
        }
      }
    }

    await writeTextFileAtomic(recordPath, `${JSON.stringify(task, null, 2)}\n`);

    const taskBackupDirectory = path.join(backupRoot, task.id);
    await mkdir(taskBackupDirectory, { recursive: true });
    for (const source of copiedSources) {
      await rename(source, path.join(taskBackupDirectory, path.basename(source)));
    }
    await rename(legacyRecordPath, path.join(taskBackupDirectory, entry.name));
    migratedTasks += 1;
  }

  return { migratedTasks, migratedAudioFiles };
}

function validatePreparedAlbum(plan: AlbumPlan, tracks: PreparedAlbumTrack[]): void {
  AlbumPlanSchema.parse(plan);
  if (tracks.length !== plan.tracks.length
    || new Set(tracks.map((track) => track.order)).size !== tracks.length) {
    throw new Error("Prepared candidates must match the album plan exactly once.");
  }
  for (const track of tracks) {
    const outline = plan.tracks.find((candidate) => candidate.number === track.order);
    if (!outline || track.targetDurationSeconds !== outline.targetSeconds) {
      throw new Error("Prepared candidate timing must match its album outline.");
    }
    const spec = MusicSpecSchema.parse(track.musicSpec);
    if (spec.vocals.enabled) throw new Error("Album candidates must be instrumental.");
    if (!track.title.trim() || !spec.lyriaPrompt.trim()) throw new Error("A candidate title and prompt are required.");
  }
}

export interface AlbumAudioExport {
  exportId: string;
  outputPath: string;
  chapters: Array<{ title: string; startSeconds: number; time: string }>;
  timestampsText: string;
  fileName: string;
  trackCount: number;
  durationSeconds: number;
}

function albumTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (hours ? pad(hours) + ":" + pad(minutes % 60) : pad(minutes)) + ":" + pad(total % 60);
}

export class TaskStore {
  readonly #directory: string;
  readonly #tasks = new Map<string, MusicTask>();
  readonly #taskDirectories = new Map<string, string>();
  readonly #albumExports = new Map<string, Promise<AlbumAudioExport>>();

  constructor(directory: string) {
    this.#directory = directory;
  }

  async initialize(options: { markInterrupted?: boolean } = {}): Promise<void> {
    await organizeTaskStorage(this.#directory);
    const recordPaths = await taskRecordPaths(this.#directory);

    for (const recordPath of recordPaths) {
      let value: unknown;
      try {
        value = JSON.parse(await readFile(recordPath, "utf8"));
      } catch (error) {
        // Preserve malformed records, while reporting actual storage failures.
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
        throw error;
      }
      if (!isTaskRecord(value)) continue;
      const task = value;
      task.workflowType = inferWorkflowType(task);
      task.compositionMode = task.workflowType === "03-orchestral" ? "orchestral"
      : ["04-album", "05-playlist"].includes(task.workflowType) ? "album" : "single";
      task.corpusMode = corpusModeForWorkflow(task.workflowType, task.corpusMode);

      let interrupted = false;
      if (options.markInterrupted !== false) {
        if (ACTIVE_TASK_STATUSES.includes(task.status)) {
          task.status = "failed";
          task.error = "The local server stopped before this task finished.";
          task.updatedAt = new Date().toISOString();
          interrupted = true;
        }
        if (task.movements) {
          task.movements = task.movements.map((movement) => {
            if (!ACTIVE_TASK_STATUSES.includes(movement.status)) return movement;
            interrupted = true;
            return {
              ...movement,
              status: "failed",
              error: "The local server stopped before this movement finished.",
              updatedAt: new Date().toISOString(),
            };
          });
        }
      }
      // A playlist paused for confirmation is idle by design: its track outlines
      // are still "queued" but no work is in flight, so a restart must not kill it.
      const pausedPlaylist = task.workflowType === "05-playlist" && task.status === "review";
      if (options.markInterrupted !== false && task.albumTracks && !pausedPlaylist) {
        task.albumTracks = task.albumTracks.map((track) => {
          if (!ACTIVE_TASK_STATUSES.includes(track.status)) return track;
          interrupted = true;
          task.status = "failed";
          task.error = "The local server stopped before this album finished.";
          return {
            ...track,
            status: "failed",
            error: "The local server stopped before this candidate finished.",
            updatedAt: new Date().toISOString(),
          };
        });
      }
      if (interrupted && task.albumProduction && task.albumProduction.status !== "completed") {
        task.albumProduction = { ...task.albumProduction, status: "failed", error: task.error };
      }
      this.#tasks.set(task.id, task);
      this.#taskDirectories.set(task.id, path.dirname(recordPath));
      if (interrupted) await this.save(task);
    }
  }

  list(): MusicTask[] {
    return [...this.#tasks.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  get(id: string): MusicTask | undefined {
    return this.#tasks.get(id);
  }

  async create(input: CreateTaskInput, config: AriosoConfig): Promise<MusicTask> {
    const now = new Date().toISOString();
    const task: MusicTask = {
      id: crypto.randomUUID(),
      description: input.description,
      mode: input.mode,
      vocalMode: input.vocalMode,
      corpusMode: input.corpusMode,
      compositionMode: input.compositionMode,
      workflowType: input.workflowType,
      ...(input.compositionMode === "album" ? {
        albumCandidateCount: input.candidateCount ?? 14,
        albumTargetTotalMinutes: input.targetTotalMinutes ?? 35,
        albumPlaylist: [],
      } : {}),
      ...(input.musicType ? { musicType: input.musicType } : {}),
      ...(input.produceAlbum ? { albumProduction: {
        role: "background_music_producer" as const, status: "pending" as const,
        stage: "runtime" as const, listeningReview: "pending" as const,
      } } : {}),
      status: "queued",
      composerModel: config.openAiModel,
      lyriaModel: input.lyriaModel ?? config.lyriaModel,
      createdAt: now,
      updatedAt: now,
      ...(input.sourceDiscussionId ? { sourceDiscussionId: input.sourceDiscussionId } : {}),
      ...(input.moodChatId ? { moodChatId: input.moodChatId } : {}),
      ...(input.playlistReferences?.length ? { playlistReferences: input.playlistReferences } : {}),
      ...(input.journeyId ? { journeyId: input.journeyId } : {}),
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
    };
    this.#tasks.set(task.id, task);
    this.#taskDirectories.set(task.id, this.taskDirectory(task));
    await this.save(task);
    return task;
  }

  async createPreparedAlbum(
    input: { description: string; plan: AlbumPlan; tracks: PreparedAlbumTrack[] },
    config: AriosoConfig,
  ): Promise<MusicTask> {
    validatePreparedAlbum(input.plan, input.tracks);
    const task = await this.create({
      description: input.description,
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "none",
      compositionMode: "album",
      workflowType: "04-album",
      lyriaModel: "lyria-3.5",
      candidateCount: input.tracks.length,
    }, config);
    return this.setPreparedAlbum(task.id, input.plan, input.tracks);
  }

  async setPreparedAlbum(
    id: string,
    plan: AlbumPlan,
    tracks: PreparedAlbumTrack[],
  ): Promise<MusicTask> {
    validatePreparedAlbum(plan, tracks);
    const task = this.get(id);
    if (!task || task.compositionMode !== "album") throw new Error("Album task not found.");
    if (task.albumTracks?.some((track) => track.audioFile)) {
      throw new Error("Cannot replace an album plan after audio generation.");
    }
    const now = new Date().toISOString();
    return this.update(id, {
      title: plan.albumTitle,
      albumPlan: plan,
      albumPromptsReady: true,
      albumPlaylist: [],
      albumTracks: tracks.map((track) => ({
        ...track, id: crypto.randomUUID(), admission: "candidate",
        status: task.mode === "compose" ? "completed" : "queued",
        createdAt: now, updatedAt: now,
      })),
    });
  }

  async updateAlbumTrack(
    taskId: string,
    trackId: string,
    changes: Partial<AlbumTrackTask>,
  ): Promise<MusicTask> {
    const task = this.#tasks.get(taskId);
    if (!task?.albumTracks?.some((track) => track.id === trackId)) {
      throw new Error(`Unknown album track: ${trackId}`);
    }
    return this.update(taskId, {
      albumTracks: task.albumTracks.map((track) => track.id === trackId
        ? { ...track, ...changes, id: trackId, updatedAt: new Date().toISOString() }
        : track),
    });
  }

  async setAlbumAdmission(taskId: string, trackId: string, admission: AlbumAdmission): Promise<MusicTask> {
    const task = this.#tasks.get(taskId);
    const track = task?.albumTracks?.find((candidate) => candidate.id === trackId);
    if (!task || !track) throw new Error("Album track not found.");
    if (admission === "included" && (track.status !== "completed" || !track.audioFile)) {
      throw new Error("Only completed audio candidates can be included.");
    }
    const albumPlaylist = (task.albumPlaylist ?? []).filter((id) => id !== trackId);
    if (admission === "included") {
      // Repeating an inclusion keeps its existing place in the playlist.
      const currentIndex = task.albumPlaylist?.indexOf(trackId) ?? -1;
      albumPlaylist.splice(currentIndex < 0 ? albumPlaylist.length : currentIndex, 0, trackId);
    }
    return this.update(taskId, {
      albumTracks: task.albumTracks!.map((candidate) => candidate.id === trackId
        ? { ...candidate, admission, updatedAt: new Date().toISOString() } : candidate),
      albumPlaylist,
    });
  }

  async setAlbumPlaylist(taskId: string, trackIds: string[]): Promise<MusicTask> {
    const task = this.#tasks.get(taskId);
    if (!task || task.compositionMode !== "album") throw new Error("Album task not found.");
    const included = task.albumTracks?.filter((track) => track.admission === "included") ?? [];
    if (new Set(trackIds).size !== trackIds.length
      || trackIds.length !== included.length
      || trackIds.some((id) => !included.some((track) => track.id === id))) {
      throw new Error("Playlist must contain every included track exactly once.");
    }
    return this.update(taskId, { albumPlaylist: [...trackIds] });
  }

  albumTrackAudioPath(task: MusicTask, track: AlbumTrackTask): string | undefined {
    return isSafeFileName(track.audioFile)
      ? path.join(this.taskDirectory(task), "tracks", track.audioFile) : undefined;
  }

  async exportAlbumAudio(
    task: MusicTask,
    scope: "included" | "candidate" = "included",
  ): Promise<AlbumAudioExport> {
    if (task.compositionMode !== "album") throw new Error("Album task not found.");
    const all = task.albumTracks ?? [];
    const selected = scope === "included"
      ? (task.albumPlaylist ?? []).map((id) => all.find((track) => track.id === id))
      : [...all].filter((track) => track.admission !== "excluded").sort((a, b) => a.order - b.order);
    if (!selected.length) throw new Error("The selected album list is empty.");
    const tracks = selected.map((track) => {
      if (!track || (scope === "included" && track.admission !== "included")
        || track.status !== "completed" || !track.audioFile) {
        throw new Error("Every selected track must have completed audio before export.");
      }
      return track;
    });
    if (scope === "included" && tracks.length !== all.filter((track) => track.admission === "included").length) {
      throw new Error("The album playlist must contain every included track exactly once.");
    }
    if (new Set(tracks.map((track) => track.id)).size !== tracks.length) {
      throw new Error("The album list must not contain duplicate tracks.");
    }
    const inputFiles = tracks.map((track) => {
      const audioPath = this.albumTrackAudioPath(task, track);
      if (!audioPath || path.extname(audioPath).toLowerCase() !== ".mp3") {
        throw new Error("Every selected track must have a safe MP3 audio file.");
      }
      return audioPath;
    });
    const sources = await Promise.all(inputFiles.map(async (file) => {
      let info;
      try {
        info = await stat(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new Error("A selected track's audio file is missing.");
        }
        throw error;
      }
      if (!info.isFile()) throw new Error("A selected track's audio file is not available.");
      return { file, size: info.size, modified: info.mtimeMs, changed: info.ctimeMs };
    }));
    const title = task.albumPlan?.albumTitle || task.title || task.id;
    const fileName = safeAudioName(scope === "candidate" ? title + " - Candidates" : title, task.id);
    const signature = createHash("sha256")
      .update(JSON.stringify(["album-mp3-v1", task.id, scope, fileName, sources]))
      .digest("hex");
    const cached = this.#albumExports.get(signature);
    if (cached) return cached;
    const exporting = (async (): Promise<AlbumAudioExport> => {
      const outputPath = path.join(this.taskDirectory(task), "exports", signature + ".mp3");
      let durationSeconds: number;
      let segmentDurationsSeconds: number[];
      if (inputFiles.length === 1) {
        const audio = await readFile(inputFiles[0]!);
        durationSeconds = measureAudioDuration(audio);
        segmentDurationsSeconds = [durationSeconds];
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, audio);
      } else {
        const assembled = await stitchAudioFiles(outputPath, inputFiles);
        durationSeconds = assembled.durationSeconds;
        segmentDurationsSeconds = assembled.segmentDurationsSeconds;
      }
      let elapsed = 0;
      const chapters = tracks.map((track, index) => {
        const chapter = { title: track.title.replace(/[\r\n]+/g, " ").trim(), startSeconds: elapsed, time: albumTimestamp(elapsed) };
        elapsed += segmentDurationsSeconds[index]!;
        return chapter;
      });
      const timestampsText = chapters.map((chapter) => chapter.time + " " + chapter.title).join("\n") + "\n";
      return { exportId: signature, outputPath, fileName, trackCount: tracks.length, durationSeconds, chapters, timestampsText };
    })();
    // Share pending writes so concurrent downloads cannot observe a partial export.
    this.#albumExports.set(signature, exporting);
    try {
      return await exporting;
    } catch (error) {
      this.#albumExports.delete(signature);
      throw error;
    }
  }

  async albumAudioExport(task: MusicTask, exportId: string): Promise<AlbumAudioExport | undefined> {
    const exported = await this.#albumExports.get(exportId);
    return exported && path.dirname(exported.outputPath) === path.join(this.taskDirectory(task), "exports")
      ? exported : undefined;
  }

  async writeAlbumTrackAudio(
    task: MusicTask,
    track: Pick<AlbumTrackTask, "order" | "title">,
    audio: Uint8Array,
  ): Promise<string> {
    const audioFile = safeAudioName(
      `${String(track.order).padStart(2, "0")} - ${track.title}`, `track-${track.order}`,
    );
    const directory = path.join(this.taskDirectory(task), "tracks");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, audioFile), audio);
    return audioFile;
  }

  /**
   * Removes a finished task together with its directory: audio, movements,
   * album tracks, and exported files. Running tasks must not be deleted.
   */
  async delete(id: string): Promise<MusicTask | undefined> {
    const task = this.#tasks.get(id);
    if (!task) return undefined;
    if (ACTIVE_TASK_STATUSES.includes(task.status)) {
      throw new Error("A task that is still running cannot be deleted.");
    }
    if (task.albumProduction && ["pending", "running"].includes(task.albumProduction.status)) {
      throw new Error("A task that is still running cannot be deleted.");
    }
    const directory = this.#taskDirectories.get(id) ?? this.taskDirectory(task);
    this.#tasks.delete(id);
    this.#taskDirectories.delete(id);
    // Cached exports may point at the directory that is about to disappear.
    this.#albumExports.clear();
    await rm(directory, { recursive: true, force: true });
    return task;
  }

  async update(id: string, changes: Partial<MusicTask>): Promise<MusicTask> {
    const current = this.#tasks.get(id);
    if (!current) {
      throw new Error(`Unknown task: ${id}`);
    }
    const task = { ...current, ...changes, id, updatedAt: new Date().toISOString() };
    this.#tasks.set(id, task);
    await this.save(task);
    return task;
  }

  async updateMovement(
    taskId: string,
    movementId: string,
    changes: Partial<OrchestralMovementTask>,
  ): Promise<MusicTask> {
    const task = this.#tasks.get(taskId);
    const movement = task?.movements?.find((candidate) => candidate.id === movementId);
    if (!task || !movement) {
      throw new Error(`Unknown orchestral movement: ${movementId}`);
    }
    const updatedAt = new Date().toISOString();
    const movements = task.movements!.map((candidate) => candidate.id === movementId
      ? { ...candidate, ...changes, id: movementId, updatedAt }
      : candidate);
    return this.update(taskId, { movements });
  }

  audioPath(task: MusicTask): string | undefined {
    if (!isSafeFileName(task.audioFile)) {
      return undefined;
    }
    return path.join(this.taskDirectory(task), task.audioFile);
  }

  movementAudioPath(
    task: MusicTask,
    movement: OrchestralMovementTask,
  ): string | undefined {
    if (!isSafeFileName(movement.audioFile)) {
      return undefined;
    }
    return path.join(this.taskDirectory(task), "movements", movement.audioFile);
  }

  async writeAudio(task: MusicTask, audio: Uint8Array): Promise<string> {
    const audioFile = safeAudioName(task.title, task.id);
    const taskDirectory = this.taskDirectory(task);
    await mkdir(taskDirectory, { recursive: true });
    await writeFile(path.join(taskDirectory, audioFile), audio);
    return audioFile;
  }

  async writeMovementAudio(
    task: MusicTask,
    movement: Pick<OrchestralMovementTask, "order" | "title">,
    audio: Uint8Array,
  ): Promise<string> {
    const audioFile = safeAudioName(
      `${String(movement.order).padStart(2, "0")} - ${movement.title}`,
      `movement-${movement.order}`,
    );
    const movementDirectory = path.join(this.taskDirectory(task), "movements");
    await mkdir(movementDirectory, { recursive: true });
    await writeFile(path.join(movementDirectory, audioFile), audio);
    return audioFile;
  }

  async assembleOrchestralAudio(
    task: MusicTask,
  ): Promise<{ audioFile: string; assembly: OrchestralAssembly }> {
    const movements = [...(task.movements ?? [])].sort((left, right) => left.order - right.order);
    if (movements.length < 2) {
      throw new Error("At least two orchestral movements are required for assembly.");
    }

    const inputFiles = movements.map((movement) => {
      if (movement.status !== "completed" || !movement.audioFile) {
        throw new Error(`Movement ${movement.order} is not ready for assembly.`);
      }
      const audioPath = this.movementAudioPath(task, movement);
      if (!audioPath) throw new Error(`Movement ${movement.order} has no safe audio path.`);
      return audioPath;
    });
    const extensions = new Set(inputFiles.map((file) => path.extname(file).toLowerCase()));
    if (extensions.size !== 1 || !extensions.has(".mp3")) {
      throw new Error("Orchestral assembly currently requires compatible MP3 movement files.");
    }

    const audioFile = safeAudioName(task.title, task.id);
    const result = await stitchAudioFiles(
      path.join(this.taskDirectory(task), audioFile),
      inputFiles,
    );
    return {
      audioFile,
      assembly: {
        format: "mp3",
        durationSeconds: result.durationSeconds,
        segmentDurationsSeconds: result.segmentDurationsSeconds,
        sampleRate: result.sampleRate,
        channels: result.channels,
        assembledAt: new Date().toISOString(),
      },
    };
  }

  async save(task: MusicTask): Promise<void> {
    const taskDirectory = this.taskDirectory(task);
    await writeTextFileAtomic(
      path.join(taskDirectory, "task.json"),
      `${JSON.stringify(task, null, 2)}\n`,
    );
  }

  taskDirectory(task: MusicTask): string {
    return this.#taskDirectories.get(task.id)
      ?? path.join(this.#directory, task.workflowType, task.id);
  }
}

export interface AssembleCompletedOrchestralTasksResult {
  assembledTasks: number;
  skippedTasks: number;
  failures: Array<{ taskId: string; error: string }>;
}

export async function assembleCompletedOrchestralTasks(
  directory: string,
): Promise<AssembleCompletedOrchestralTasksResult> {
  const store = new TaskStore(directory);
  await store.initialize({ markInterrupted: false });
  let assembledTasks = 0;
  let skippedTasks = 0;
  const failures: Array<{ taskId: string; error: string }> = [];

  for (const task of store.list()) {
    if (task.workflowType !== "03-orchestral") continue;
    const eligible = task.mode === "generate"
      && task.status === "completed"
      && !task.audioFile
      && (task.movements?.length ?? 0) >= 2
      && task.movements?.every((movement) => movement.status === "completed" && movement.audioFile);
    if (!eligible) {
      skippedTasks += 1;
      continue;
    }

    try {
      const assembled = await store.assembleOrchestralAudio(task);
      await store.update(task.id, {
        audioFile: assembled.audioFile,
        orchestralAssembly: assembled.assembly,
        error: undefined,
      });
      assembledTasks += 1;
    } catch (error) {
      failures.push({
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { assembledTasks, skippedTasks, failures };
}

export function parseTaskInput(value: unknown): CreateTaskInput {
  if (!isRecord(value)) {
    throw new Error("A task request is required.");
  }
  const candidate = value;
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const mode = candidate.mode === "compose" ? "compose" : "generate";
  const vocalMode: VocalMode =
    candidate.vocalMode === "instrumental" || candidate.vocalMode === "vocals"
      ? candidate.vocalMode
      : "auto";
  if (candidate.mode !== undefined && candidate.mode !== "compose" && candidate.mode !== "generate") {
    throw new Error("Unsupported task mode.");
  }
  if (candidate.vocalMode !== undefined
    && candidate.vocalMode !== "auto"
    && candidate.vocalMode !== "instrumental"
    && candidate.vocalMode !== "vocals") {
    throw new Error("Unsupported vocal mode.");
  }
  if (candidate.lyriaModel !== undefined
    && candidate.lyriaModel !== "lyria-3.5"
    && candidate.lyriaModel !== "lyria-3-clip-preview") {
    throw new Error("Unsupported Lyria model.");
  }
  if (candidate.workflowType !== undefined && !isWorkflowType(candidate.workflowType)) {
    throw new Error("Unsupported workflow type.");
  }
  if (candidate.corpusMode !== undefined
    && candidate.corpusMode !== "none"
    && candidate.corpusMode !== "music"
    && candidate.corpusMode !== "jazz") {
    throw new Error("Unsupported corpus mode.");
  }
  if (candidate.musicType !== undefined && !isMusicType(candidate.musicType)) {
    throw new Error("Unsupported music type.");
  }
  if (candidate.compositionMode !== undefined
    && candidate.compositionMode !== "single"
    && candidate.compositionMode !== "orchestral"
    && candidate.compositionMode !== "album") {
    throw new Error("Unsupported composition mode.");
  }
  const workflowType = inferWorkflowType(candidate);
  const corpusMode = corpusModeForWorkflow(workflowType, candidate.corpusMode);
  const compositionMode: CompositionMode = workflowType === "03-orchestral"
    ? "orchestral"
    : ["04-album", "05-playlist"].includes(workflowType) ? "album" : "single";
  const candidateCount = candidate.candidateCount ?? 14;
  const targetTotalMinutes = candidate.targetTotalMinutes ?? 35;
  if (candidate.produceAlbum !== undefined && typeof candidate.produceAlbum !== "boolean") {
    throw new Error("produceAlbum must be a boolean.");
  }
  if (candidate.produceAlbum === true && (compositionMode !== "album" || mode !== "generate")) {
    throw new Error("Background Music Producer requires album generation mode.");
  }
  if (compositionMode === "album") {
    if (!Number.isInteger(candidateCount)
      || Number(candidateCount) < ALBUM_MIN_CANDIDATES || Number(candidateCount) > ALBUM_MAX_CANDIDATES) {
      throw new Error(`Album candidate count must be an integer from ${ALBUM_MIN_CANDIDATES} to ${ALBUM_MAX_CANDIDATES}.`);
    }
    if (typeof targetTotalMinutes !== "number" || !Number.isFinite(targetTotalMinutes)
      || targetTotalMinutes < ALBUM_MIN_TOTAL_MINUTES || targetTotalMinutes > ALBUM_MAX_TOTAL_MINUTES) {
      throw new Error(`Album target duration must be between ${ALBUM_MIN_TOTAL_MINUTES} and ${ALBUM_MAX_TOTAL_MINUTES} minutes.`);
    }
    if (candidate.lyriaModel === "lyria-3-clip-preview") {
      throw new Error("Album generation requires lyria-3.5.");
    }
  }
  const lyriaModel =
    candidate.lyriaModel === "lyria-3.5" || candidate.lyriaModel === "lyria-3-clip-preview"
      ? candidate.lyriaModel
      : undefined;

  if (!description) {
    throw new Error("Please describe the music you want to create.");
  }
  if (description.length > 8_000) {
    throw new Error("The music description must be 8,000 characters or fewer.");
  }

  return {
    description, mode,
    vocalMode: compositionMode === "album" ? "instrumental" : vocalMode,
    corpusMode, compositionMode, workflowType,
    ...(candidate.produceAlbum === true ? { produceAlbum: true } : {}),
    ...(compositionMode === "album" ? {
      candidateCount: Number(candidateCount), targetTotalMinutes: Number(targetTotalMinutes),
      lyriaModel: "lyria-3.5",
    } : lyriaModel ? { lyriaModel } : {}),
    ...(candidate.musicType !== undefined && corpusMode === "music"
      ? { musicType: candidate.musicType as MusicType } : {}),
  };
}
