import "dotenv/config";

import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { composeMusic } from "../composer/composer-agent.js";
import { loadConfig } from "../config/env.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import type { MusicSpec } from "../schema/music-spec.js";

type TaskMode = "compose" | "generate";
type TaskStatus = "queued" | "composing" | "generating" | "completed" | "failed";
type VocalMode = "auto" | "instrumental" | "vocals";

interface MusicTask {
  id: string;
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  status: TaskStatus;
  composerModel: string;
  lyriaModel: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  musicSpec?: MusicSpec;
  generatedText?: string | null;
  audioFile?: string;
  error?: string;
}

interface CreateTaskInput {
  description: string;
  mode: TaskMode;
  vocalMode: VocalMode;
  lyriaModel?: string;
}

const WEB_ROOT = path.resolve("web");
const MAX_BODY_BYTES = 64 * 1024;
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
              if (["queued", "composing", "generating"].includes(task.status)) {
                task.status = "failed";
                task.error = "The local server stopped before this task finished.";
              }
              this.#tasks.set(task.id, task);
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

  async create(input: CreateTaskInput): Promise<MusicTask> {
    const config = loadConfig(input.mode === "generate");
    const now = new Date().toISOString();
    const task: MusicTask = {
      id: crypto.randomUUID(),
      description: input.description,
      mode: input.mode,
      vocalMode: input.vocalMode,
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

  audioPath(task: MusicTask): string | undefined {
    if (!task.audioFile || path.basename(task.audioFile) !== task.audioFile) {
      return undefined;
    }
    return path.join(this.#directory, task.audioFile);
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

function parseTaskInput(value: unknown): CreateTaskInput {
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
    ? { description, mode, vocalMode, lyriaModel }
    : { description, mode, vocalMode };
}

async function runTask(store: TaskStore, task: MusicTask): Promise<void> {
  try {
    await store.update(task.id, { status: "composing" });
    const spec = await composeMusic(task.description, {
      model: task.composerModel,
      lyriaModel: task.lyriaModel,
      vocalMode: task.vocalMode ?? "auto",
    });
    await store.update(task.id, { musicSpec: spec, title: spec.title });

    if (task.mode === "compose") {
      await store.update(task.id, { status: "completed" });
      return;
    }

    await store.update(task.id, { status: "generating" });
    const config = loadConfig(true);
    const generated = await new LyriaClient(config.geminiApiKey!).generate(spec.lyriaPrompt, {
      model: task.lyriaModel,
    });
    const audioFile = `${task.id}.mp3`;
    await writeFile(path.join(path.resolve(config.outputDirectory, "tasks"), audioFile), generated.audio);
    await store.update(task.id, {
      status: "completed",
      audioFile,
      generatedText: generated.generatedText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.update(task.id, { status: "failed", error: message });
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

export async function createAriosoServer() {
  const config = loadConfig(false);
  const store = new TaskStore(path.resolve(config.outputDirectory, "tasks"));
  await store.initialize();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname);
    const audioMatch = /^\/api\/tasks\/([^/]+)\/audio$/.exec(url.pathname);

    try {
      if (request.method === "GET" && url.pathname === "/api/tasks") {
        sendJson(response, 200, store.list());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const task = await store.create(parseTaskInput(await readJsonBody(request)));
        void runTask(store, task);
        sendJson(response, 202, task);
        return;
      }

      if (request.method === "GET" && audioMatch?.[1]) {
        const task = store.get(audioMatch[1]);
        const audioPath = task ? store.audioPath(task) : undefined;
        if (!task || !audioPath) {
          sendJson(response, 404, { error: "Audio is not available." });
          return;
        }
        await access(audioPath);
        response.writeHead(200, { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" });
        createReadStream(audioPath).pipe(response);
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
