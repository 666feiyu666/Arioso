import { createServer } from "node:http";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { measureAudioDuration } from "../audio/stitch.js";
import { planAlbum, composeAlbumTrack, reviewAlbumCandidates, reviseAlbumTrack } from "../composer/album-agent.js";
import { composeMusic } from "../composer/composer-agent.js";
import { composeOrchestralMovement, planOrchestralWork } from "../composer/orchestral-agent.js";
import { loadConfig, type AriosoConfig } from "../config/env.js";
import { SettingsStore, SUPPORTED_LANGUAGES, type ApiProvider, type InterfaceLanguage } from "../config/settings.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import { listOrchestralKnowledgeCards } from "../retrieval/orchestral-cards.js";
import { TaskStore, parseTaskInput, type AlbumAdmission, type MusicTask } from "./task-store.js";
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
  albumTrackId?: string,
): Promise<void> {
  try {
    if (task.compositionMode === "album") {
      await runAlbumTask(store, task, config, albumTrackId);
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
    const plan = await planAlbum(current.description, {
      ...options,
      candidateCount: current.albumCandidateCount ?? 14,
      targetTotalMinutes: current.albumTargetTotalMinutes ?? 35,
    });
    const now = new Date().toISOString();
    current = await store.update(task.id, {
      title: plan.albumTitle, albumPlan: plan, albumPlaylist: [],
      albumTracks: plan.tracks.map((outline) => ({
        id: crypto.randomUUID(), order: outline.number, title: outline.title,
        targetDurationSeconds: outline.targetSeconds,
        admission: "candidate", status: "queued", createdAt: now, updatedAt: now,
      })),
    });
  }
  const plan = current.albumPlan!;
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
  const startTask = (task: MusicTask, config: AriosoConfig, albumTrackId?: string): void => {
    activeTaskIds.add(task.id);
    void runTask(store, task, config, albumTrackId)
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
      const albumTrackMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)$/.exec(url.pathname);
      const albumTrackAudioMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)\/audio$/.exec(url.pathname);
      const albumTrackRetryMatch = /^\/api\/tasks\/([^/]+)\/album\/tracks\/([^/]+)\/retry$/.exec(url.pathname);
      const albumPlaylistMatch = /^\/api\/tasks\/([^/]+)\/album\/playlist$/.exec(url.pathname);
      const retryMatch = /^\/api\/tasks\/([^/]+)\/retry$/.exec(url.pathname);
      const credentialMatch = /^\/api\/settings\/credentials\/(openai|gemini)$/.exec(url.pathname);
      if (request.method === "GET" && url.pathname === "/api/capabilities") {
        sendJson(response, 200, {
          apiVersion: 5,
          workflows: ["01-general", "02-jazz", "03-orchestral", "04-album"],
          albumPlaylist: true,
          albumCandidates: { minimum: 12, maximum: 15, default: 14 },
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
