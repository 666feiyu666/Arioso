import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { stitchAudioFiles } from "../audio/stitch.js";
import type { AriosoConfig } from "../config/env.js";
import { isOrchestralCardId, loadOrchestralKnowledgeCard, type OrchestralKnowledgeCard } from "../retrieval/orchestral-cards.js";
import type { MusicSpec } from "../schema/music-spec.js";
import type { OrchestralMovementPlan, OrchestralWorkPlan } from "../schema/orchestral-plan.js";
import { writeTextFileAtomic } from "../utils/files.js";
import { isRecord } from "../utils/validation.js";

export type TaskMode = "compose" | "generate";
export type TaskStatus = "queued" | "composing" | "generating" | "assembling" | "completed" | "failed";
export type VocalMode = "auto" | "instrumental" | "vocals";
export type CorpusMode = "none" | "jazz";
export type CompositionMode = "single" | "orchestral";
export type WorkflowType = "01-general" | "02-jazz" | "03-orchestral" | "04-album";

const WORKFLOW_TYPES: readonly WorkflowType[] = [
  "01-general",
  "02-jazz",
  "03-orchestral",
  "04-album",
];

function isWorkflowType(value: unknown): value is WorkflowType {
  return WORKFLOW_TYPES.includes(value as WorkflowType);
}

function corpusModeForWorkflow(workflowType: WorkflowType, selection: unknown): CorpusMode {
  return workflowType === "02-jazz" && selection !== "none" ? "jazz" : "none";
}

export function inferWorkflowType(task: {
  workflowType?: unknown;
  compositionMode?: unknown;
  corpusMode?: unknown;
  retrievalQuery?: unknown;
  description?: unknown;
}): WorkflowType {
  if (isWorkflowType(task.workflowType)) return task.workflowType;
  if (task.compositionMode === "orchestral") return "03-orchestral";
  if (
    typeof task.description === "string"
    && /(?:[二三四五六2-6]\s*(?:个)?乐章|(?:two|three|four|five|six|multi)[-\s]movement)/iu
      .test(task.description)
  ) {
    return "03-orchestral";
  }
  if (task.corpusMode === "jazz" || task.retrievalQuery) return "02-jazz";
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
  retrievalQuery?: string;
  retrievedReferenceIds?: string[];
  musicSpec?: MusicSpec;
  orchestralPlan?: OrchestralWorkPlan;
  orchestralReference?: OrchestralKnowledgeCard;
  movements?: OrchestralMovementTask[];
  orchestralAssembly?: OrchestralAssembly;
  generatedText?: string | null;
  audioFile?: string;
  error?: string | undefined;
}

export interface CreateTaskInput {
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  corpusMode: CorpusMode;
  compositionMode: CompositionMode;
  workflowType: WorkflowType;
  lyriaModel?: string;
  orchestralReferenceId?: string;
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
  "queued", "composing", "generating", "assembling", "completed", "failed",
];
const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = [
  "queued", "composing", "generating", "assembling",
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
  return value.movements === undefined || (Array.isArray(value.movements)
    && value.movements.every((movement: unknown) => isRecord(movement)
      && typeof movement.id === "string"
      && Number.isInteger(movement.order) && Number(movement.order) > 0
      && typeof movement.title === "string"
      && TASK_STATUSES.includes(movement.status as TaskStatus)));
}

function safeAudioName(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 96)
    .replace(/[. ]+$/g, "");
  const name = normalized || fallback;
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
    task.compositionMode = task.workflowType === "03-orchestral" ? "orchestral" : "single";
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

export class TaskStore {
  readonly #directory: string;
  readonly #tasks = new Map<string, MusicTask>();
  readonly #taskDirectories = new Map<string, string>();

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
      task.compositionMode = task.workflowType === "03-orchestral" ? "orchestral" : "single";
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
    const orchestralReference = input.orchestralReferenceId
      ? await loadOrchestralKnowledgeCard(input.orchestralReferenceId)
      : undefined;
    const now = new Date().toISOString();
    const task: MusicTask = {
      id: crypto.randomUUID(),
      description: input.description,
      mode: input.mode,
      vocalMode: input.vocalMode,
      corpusMode: input.corpusMode,
      compositionMode: input.compositionMode,
      workflowType: input.workflowType,
      ...(orchestralReference ? { orchestralReference } : {}),
      status: "queued",
      composerModel: config.openAiModel,
      lyriaModel: input.lyriaModel ?? config.lyriaModel,
      createdAt: now,
      updatedAt: now,
    };
    this.#tasks.set(task.id, task);
    this.#taskDirectories.set(task.id, this.taskDirectory(task));
    await this.save(task);
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

  private taskDirectory(task: MusicTask): string {
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
    && candidate.corpusMode !== "jazz") {
    throw new Error("Unsupported corpus mode.");
  }
  if (candidate.compositionMode !== undefined
    && candidate.compositionMode !== "single"
    && candidate.compositionMode !== "orchestral") {
    throw new Error("Unsupported composition mode.");
  }
  const workflowType = inferWorkflowType(candidate);
  if (workflowType === "04-album") {
    throw new Error("Album composition is still in development.");
  }
  const corpusMode = corpusModeForWorkflow(workflowType, candidate.corpusMode);
  const compositionMode: CompositionMode = workflowType === "03-orchestral"
    ? "orchestral"
    : "single";
  const orchestralReferenceId = candidate.orchestralReferenceId;
  if (orchestralReferenceId !== undefined) {
    if (compositionMode !== "orchestral") {
      throw new Error("Knowledge cards are supported only for orchestral composition.");
    }
    if (!isOrchestralCardId(orchestralReferenceId)) {
      throw new Error("Invalid orchestral knowledge card ID.");
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
    description, mode, vocalMode, corpusMode, compositionMode, workflowType,
    ...(lyriaModel ? { lyriaModel } : {}),
    ...(orchestralReferenceId ? { orchestralReferenceId } : {}),
  };
}
