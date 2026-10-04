import { createServer } from "node:http";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { composeMusic } from "../composer/composer-agent.js";
import { composeOrchestralMovement, planOrchestralWork } from "../composer/orchestral-agent.js";
import { loadConfig, type AriosoConfig } from "../config/env.js";
import { SettingsStore, SUPPORTED_LANGUAGES, type ApiProvider, type InterfaceLanguage } from "../config/settings.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import { listOrchestralKnowledgeCards } from "../retrieval/orchestral-cards.js";
import { TaskStore, parseTaskInput, type MusicTask } from "./task-store.js";
import { HttpError, readJsonBody, sendAudio, sendJson, serveStatic } from "./http.js";
import { isRecord } from "../utils/validation.js";

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
        ...(task.workflowType === "02-jazz" ? { genre: "jazz" as const } : {}),
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
      ...(currentTask.orchestralReference ? { referenceCard: currentTask.orchestralReference } : {}),
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
          ...(currentTask.orchestralReference ? { referenceCard: currentTask.orchestralReference } : {}),
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
  const activeTaskIds = new Set<string>();
  const startTask = (task: MusicTask, config: AriosoConfig): void => {
    activeTaskIds.add(task.id);
    void runTask(store, task, config)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to persist task ${task.id}: ${message}`);
      })
      .finally(() => activeTaskIds.delete(task.id));
  };

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(url.pathname);
      const audioMatch = /^\/api\/tasks\/([^/]+)\/audio$/.exec(url.pathname);
      const movementAudioMatch = /^\/api\/tasks\/([^/]+)\/movements\/([^/]+)\/audio$/
        .exec(url.pathname);
      const retryMatch = /^\/api\/tasks\/([^/]+)\/retry$/.exec(url.pathname);
      const credentialMatch = /^\/api\/settings\/credentials\/(openai|gemini)$/.exec(url.pathname);
      if (request.method === "GET" && url.pathname === "/api/capabilities") {
        sendJson(response, 200, {
          apiVersion: 4,
          workflows: ["01-general", "02-jazz", "03-orchestral"],
          jazzCorpusToggle: true,
          orchestralAssembly: true,
          orchestralPromptFormat: "orchestral-v1",
          orchestralKnowledgeCards: true,
          orchestralDuration: {
            minimumTotalMinutes: 5,
            maximumTotalMinutes: 11,
            maximumMovementMinutes: 3,
          },
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/orchestral-cards") {
        sendJson(response, 200, await listOrchestralKnowledgeCards());
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

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const input = parseTaskInput(await readJsonBody(request));
        const config = loadConfig(
          input.mode === "generate",
          await settings.runtimeEnvironment(),
        );
        const task = await store.create(input, config);
        startTask(task, config);
        sendJson(response, 202, task);
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
        const queued = await store.update(task.id, { status: "queued", error: undefined });
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
