import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { composeMusic } from "../composer/composer-agent.js";
import {
  composeOrchestralMovement,
  planOrchestralWork,
} from "../composer/orchestral-agent.js";
import { loadConfig, type AriosoConfig } from "../config/env.js";
import {
  SettingsStore,
  SUPPORTED_LANGUAGES,
  type ApiProvider,
  type InterfaceLanguage,
} from "../config/settings.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import type { MusicSpec } from "../schema/music-spec.js";
import type {
  OrchestralMovementPlan,
  OrchestralWorkPlan,
} from "../schema/orchestral-plan.js";

type TaskMode = "compose" | "generate";
type TaskStatus = "queued" | "composing" | "generating" | "completed" | "failed";
type VocalMode = "auto" | "instrumental" | "vocals";
type CorpusMode = "none" | "jazz";
type CompositionMode = "single" | "orchestral";

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

interface MusicTask {
  id: string;
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  corpusMode: CorpusMode;
  compositionMode: CompositionMode;
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
  movements?: OrchestralMovementTask[];
  generatedText?: string | null;
  audioFile?: string;
  error?: string | undefined;
}

interface CreateTaskInput {
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  corpusMode: CorpusMode;
  compositionMode: CompositionMode;
  lyriaModel?: string;
}

const WEB_ROOT = path.resolve("web");
const MAX_BODY_BYTES = 64 * 1024;
const REQUEST_RETRY_DELAYS_MS = [750, 1_500];
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

class TaskStore {
  readonly #directory: string;
  readonly #tasks = new Map<string, MusicTask>();

  constructor(directory: string) {
    this.#directory = directory;
  }

  async initialize(): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    const entries = await readdir(this.#directory, { withFileTypes: true });

    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          try {
            const task = JSON.parse(
              await readFile(path.join(this.#directory, entry.name), "utf8"),
            ) as MusicTask;
            if (task.id) {
              task.compositionMode = task.compositionMode === "orchestral"
                ? "orchestral"
                : "single";
              task.corpusMode = task.corpusMode === "jazz" || task.retrievalQuery
                ? "jazz"
                : "none";
              let interrupted = false;
              if (["queued", "composing", "generating"].includes(task.status)) {
                task.status = "failed";
                task.error = "The local server stopped before this task finished.";
                task.updatedAt = new Date().toISOString();
                interrupted = true;
              }
              if (task.movements) {
                task.movements = task.movements.map((movement) => {
                  if (!["queued", "composing", "generating"].includes(movement.status)) {
                    return movement;
                  }
                  interrupted = true;
                  return {
                    ...movement,
                    status: "failed",
                    error: "The local server stopped before this movement finished.",
                    updatedAt: new Date().toISOString(),
                  };
                });
              }
              this.#tasks.set(task.id, task);
              if (interrupted) {
                await this.save(task);
              }
            }
          } catch {
            // Ignore malformed task records rather than blocking the whole UI.
          }
        }),
    );
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
      status: "queued",
      composerModel: config.openAiModel,
      lyriaModel: input.lyriaModel ?? config.lyriaModel,
      createdAt: now,
      updatedAt: now,
    };
    this.#tasks.set(task.id, task);
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
    if (!task.audioFile || path.basename(task.audioFile) !== task.audioFile) {
      return undefined;
    }
    return path.join(this.#directory, task.audioFile);
  }

  movementAudioPath(movement: OrchestralMovementTask): string | undefined {
    if (!movement.audioFile || path.basename(movement.audioFile) !== movement.audioFile) {
      return undefined;
    }
    return path.join(this.#directory, movement.audioFile);
  }

  async save(task: MusicTask): Promise<void> {
    await writeFile(
      path.join(this.#directory, `${task.id}.json`),
      `${JSON.stringify(task, null, 2)}\n`,
      "utf8",
    );
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

interface ByteRange {
  start: number;
  end: number;
}

function parseByteRange(value: string, fileSize: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || fileSize <= 0 || (!match[1] && !match[2])) {
    return null;
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || start >= fileSize
    || requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}

async function sendAudio(
  request: IncomingMessage,
  response: ServerResponse,
  filePath: string,
): Promise<void> {
  const file = await stat(filePath);
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "Content-Type": "audio/mpeg",
  };

  if (request.method === "HEAD") {
    response.writeHead(200, {
      ...baseHeaders,
      "Content-Length": file.size,
    });
    response.end();
    return;
  }

  const rangeHeader = request.headers.range;
  if (!rangeHeader) {
    response.writeHead(200, {
      ...baseHeaders,
      "Content-Length": file.size,
    });
    createReadStream(filePath).pipe(response);
    return;
  }

  const range = parseByteRange(rangeHeader, file.size);
  if (!range) {
    response.writeHead(416, {
      ...baseHeaders,
      "Content-Length": 0,
      "Content-Range": `bytes */${file.size}`,
    });
    response.end();
    return;
  }

  response.writeHead(206, {
    ...baseHeaders,
    "Content-Length": range.end - range.start + 1,
    "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
  });
  createReadStream(filePath, range).pipe(response);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function parseTaskInput(value: unknown): CreateTaskInput {
  if (!value || typeof value !== "object") {
    throw new Error("A task request is required.");
  }
  const candidate = value as Record<string, unknown>;
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const mode = candidate.mode === "compose" ? "compose" : "generate";
  const vocalMode: VocalMode =
    candidate.vocalMode === "instrumental" || candidate.vocalMode === "vocals"
      ? candidate.vocalMode
      : "auto";
  if (candidate.corpusMode !== undefined
    && candidate.corpusMode !== "none"
    && candidate.corpusMode !== "jazz") {
    throw new Error("Unsupported corpus mode.");
  }
  const corpusMode: CorpusMode = candidate.corpusMode === "jazz" ? "jazz" : "none";
  if (candidate.compositionMode !== undefined
    && candidate.compositionMode !== "single"
    && candidate.compositionMode !== "orchestral") {
    throw new Error("Unsupported composition mode.");
  }
  const compositionMode: CompositionMode = candidate.compositionMode === "orchestral"
    ? "orchestral"
    : "single";
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

  return lyriaModel
    ? { description, mode, vocalMode, corpusMode, compositionMode, lyriaModel }
    : { description, mode, vocalMode, corpusMode, compositionMode };
}

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
): Promise<void> {
  try {
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
        onJazzRetrieval: async ({ query, referenceIds }) => {
          await store.update(task.id, {
            retrievalQuery: query,
            retrievedReferenceIds: referenceIds,
          });
        },
      });
      await store.update(task.id, { musicSpec: spec, title: spec.title });
    }

    if (task.mode === "compose") {
      await store.update(task.id, { status: "completed", error: undefined });
      return;
    }

    await store.update(task.id, { status: "generating", error: undefined });
    const client = new LyriaClient(config.geminiApiKey!);
    const generated = await withRequestRetry(() => client.generate(spec.lyriaPrompt, {
      model: task.lyriaModel,
    }));
    const audioFile = `${task.id}.mp3`;
    await writeFile(path.join(path.resolve(config.outputDirectory, "tasks"), audioFile), generated.audio);
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
      const audioFile = `${currentTask.id}-movement-${movement.order}.mp3`;
      await writeFile(
        path.join(path.resolve(config.outputDirectory, "tasks"), audioFile),
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

  await store.update(currentTask.id, { status: "completed", error: undefined });
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

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(WEB_ROOT, relative);
  const relativePath = path.relative(WEB_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    await access(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

export interface AriosoServerOptions {
  environment?: NodeJS.ProcessEnv;
  envPath?: string;
  preferencesPath?: string;
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
  await store.initialize();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname);
    const audioMatch = /^\/api\/tasks\/([^/]+)\/audio$/.exec(url.pathname);
    const movementAudioMatch = /^\/api\/tasks\/([^/]+)\/movements\/([^/]+)\/audio$/
      .exec(url.pathname);
    const retryMatch = /^\/api\/tasks\/([^/]+)\/retry$/.exec(url.pathname);
    const credentialMatch = /^\/api\/settings\/credentials\/(openai|gemini)$/.exec(
      url.pathname,
    );

    try {
      if (request.method === "GET" && url.pathname === "/api/settings") {
        sendJson(response, 200, await settings.snapshot());
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/settings") {
        const value = await readJsonBody(request);
        if (!value || typeof value !== "object") {
          throw new Error("A settings request is required.");
        }
        const candidate = value as Record<string, unknown>;

        if (candidate.language !== undefined) {
          if (!isInterfaceLanguage(candidate.language)) {
            throw new Error("Unsupported interface language.");
          }
          await settings.saveLanguage(candidate.language);
        }

        const credentials = candidate.credentials;
        if (credentials !== undefined) {
          if (!credentials || typeof credentials !== "object") {
            throw new Error("Invalid API configuration.");
          }
          const credentialValues = credentials as Record<string, unknown>;
          const remember = candidate.remember === true;
          for (const provider of ["openai", "gemini"] as const) {
            const apiKey = credentialValues[provider];
            if (apiKey !== undefined) {
              if (typeof apiKey !== "string" || !apiKey.trim()) {
                throw new Error("API key is required.");
              }
              await settings.saveCredential(provider, apiKey, remember);
            }
          }
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
        if (!value || typeof value !== "object") {
          throw new Error("A connection test request is required.");
        }
        const candidate = value as Record<string, unknown>;
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

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const input = parseTaskInput(await readJsonBody(request));
        const config = loadConfig(
          input.mode === "generate",
          await settings.runtimeEnvironment(),
        );
        const task = await store.create(input, config);
        void runTask(store, task, config);
        sendJson(response, 202, task);
        return;
      }

      if (request.method === "POST" && retryMatch?.[1]) {
        const task = store.get(retryMatch[1]);
        if (!task) {
          sendJson(response, 404, { error: "Task not found." });
          return;
        }
        if (task.status !== "failed") {
          sendJson(response, 409, { error: "Only failed tasks can be continued." });
          return;
        }

        const config = loadConfig(
          task.mode === "generate",
          await settings.runtimeEnvironment(),
        );
        const queued = await store.update(task.id, { status: "queued", error: undefined });
        void runTask(store, queued, config);
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
        const audioPath = movement ? store.movementAudioPath(movement) : undefined;
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

      await serveStatic(url.pathname, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 400, { error: message });
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
