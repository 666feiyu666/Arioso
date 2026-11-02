import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AriosoConfig } from "../src/config/env.js";
import { AlbumPlanSchema } from "../src/schema/album-plan.js";
import type { MusicSpec } from "../src/schema/music-spec.js";
import {
  MAX_GENERATION_ATTEMPTS,
  attemptKey,
  latestAttemptIdFor,
  recordGenerationAttempt,
  type GenerationAttempt,
} from "../src/utils/attempts.js";
import { runAlbumTask } from "../src/web/task-runtime.js";
import { TaskStore, type MusicTask } from "../src/web/task-store.js";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));
vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));
beforeEach(() => {
  generateMock.mockReset();
});

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const CANDIDATES = 12;

const plan = AlbumPlanSchema.parse({
  albumTitle: "Parallel Windows",
  albumMind: "Twelve quiet pieces that never wait for one another.",
  cohesionStrategy: "Independent pieces sharing one close acoustic perspective.",
  sharedSoundContract: "Instrumental, restrained dynamics, close acoustic recording.",
  tracks: Array.from({ length: CANDIDATES }, (_, index) => ({
    number: index + 1,
    title: `Candidate ${index + 1}`,
    musicalRole: "A quiet nocturne.",
    instruments: ["piano", "double bass"],
    groove: "Gentle slow swing",
    harmony: "Extended minor harmony",
    development: "Introduction, theme, variation, quiet ending.",
    targetSeconds: [120, 135, 150][index % 3],
  })),
});

function spec(number: number): MusicSpec {
  return {
    schemaVersion: "1.0", title: `Candidate ${number}`, intent: "Quiet evening jazz",
    genres: ["jazz"], moods: ["relaxed"], tempo: { bpm: 70, feel: "Gentle swing" },
    tonality: { tonic: null, mode: "minor" }, meter: "4/4",
    instrumentation: [{ name: "piano", role: "Melody", timbre: "Warm acoustic tone" }],
    structure: [{ section: "Theme", durationSeconds: 120, direction: "Spacious phrasing" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "Close and warm", avoid: ["vocals"], assumptions: [], lyriaPrompt: `prompt ${number}`,
  };
}

function albumTask(): MusicTask {
  const now = "2026-11-02T00:00:00.000Z";
  return {
    id: "album-concurrent", description: "Independent nocturnes, instrumental.",
    title: plan.albumTitle, mode: "generate", vocalMode: "instrumental", corpusMode: "none",
    compositionMode: "album", workflowType: "04-album", status: "generating",
    composerModel: "test", lyriaModel: "lyria-3.5", createdAt: now, updatedAt: now,
    albumPlan: plan, albumPromptsReady: true, albumTrackOrder: [],
    albumTracks: plan.tracks.map((outline) => ({
      id: `track-${outline.number}`, order: outline.number, title: outline.title,
      targetDurationSeconds: outline.targetSeconds, musicSpec: spec(outline.number),
      status: "queued", admission: "candidate", createdAt: now, updatedAt: now,
    })),
  };
}

async function storeWithAlbum(): Promise<{ store: TaskStore; task: MusicTask; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-concurrent-"));
  roots.push(root);
  const directory = path.join(root, "tasks");
  const taskDirectory = path.join(directory, "04-album", "album-concurrent");
  await mkdir(taskDirectory, { recursive: true });
  const task = albumTask();
  await writeFile(path.join(taskDirectory, "task.json"), JSON.stringify(task));
  const store = new TaskStore(directory);
  await store.initialize({ markInterrupted: false });
  return { store, task: store.get(task.id)!, root };
}

function config(root: string, generationConcurrency: number): AriosoConfig {
  return {
    openAiApiKey: "test-local", openAiModel: "test", geminiApiKey: "test-local",
    geminiReviewModel: "test", lyriaModel: "lyria-3.5",
    outputDirectory: path.join(root, "outputs"), generationConcurrency,
    timeouts: { composeMs: 30_000, generateMs: 30_000, reviewMs: 30_000 },
  };
}

/**
 * A provider that holds every dispatch until the test lets it go, so the pool's
 * concurrency can be observed exactly and completion order can be chosen.
 */
function gatedProvider() {
  const gates: Array<{ released: boolean; resolve: () => void }> = [];
  let inFlight = 0;
  let peak = 0;
  generateMock.mockImplementation(async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise<void>((resolve) => gates.push({ released: false, resolve }));
    inFlight -= 1;
    return { audio: Buffer.from([0xff, 0xfb, 0x90, 0x00]), generatedText: null };
  });
  const release = (gate: { released: boolean; resolve: () => void } | undefined) => {
    if (!gate || gate.released) return;
    gate.released = true;
    gate.resolve();
  };
  return {
    /** Dispatches that are still waiting for the test. */
    pending: () => gates.filter((gate) => !gate.released).length,
    /** Releases the oldest waiting dispatch. */
    releaseOldest() {
      release(gates.find((gate) => !gate.released));
    },
    /** Releases one dispatch by the order it was dispatched in. */
    releaseAt(index: number) {
      release(gates[index]);
    },
    releaseAll() {
      for (const gate of gates) release(gate);
    },
    peak: () => peak,
  };
}

describe("concurrent album generation", () => {
  it("generates candidates together and never exceeds the configured bound", async () => {
    const { store, task, root } = await storeWithAlbum();
    const provider = gatedProvider();

    const running = runAlbumTask(store, task, config(root, 2));
    await vi.waitFor(() => expect(provider.pending()).toBe(2), { timeout: 15_000 });
    expect(generateMock).toHaveBeenCalledTimes(2);

    // Each release frees one slot, and only then may the next candidate be
    // dispatched: a third dispatch never appears while two are held.
    for (let dispatched = 2; dispatched < CANDIDATES; dispatched += 1) {
      provider.releaseOldest();
      await vi.waitFor(
        () => expect(generateMock).toHaveBeenCalledTimes(dispatched + 1),
        { timeout: 15_000 },
      );
      expect(provider.pending()).toBe(2);
    }
    provider.releaseAll();
    await running;

    expect(provider.peak()).toBe(2);
    expect(generateMock).toHaveBeenCalledTimes(CANDIDATES);
    expect(store.get(task.id)?.status).toBe("completed");
    expect(store.get(task.id)?.albumTracks?.every(
      (track) => track.status === "completed" && Boolean(track.audioFile),
    )).toBe(true);
  });

  it("keeps a candidate whose dispatch finishes after a newer one started", async () => {
    const { store, task, root } = await storeWithAlbum();
    const provider = gatedProvider();

    const running = runAlbumTask(store, task, config(root, CANDIDATES));
    await vi.waitFor(() => expect(provider.pending()).toBe(CANDIDATES), { timeout: 15_000 });

    // Eleven candidates finish first, then the one dispatched first finishes
    // last: a newer dispatch for other work must not discard its result.
    for (let index = 1; index < CANDIDATES; index += 1) provider.releaseAt(index);
    await vi.waitFor(() => expect(store.get(task.id)?.albumTracks?.filter(
      (track) => track.status === "completed",
    )).toHaveLength(CANDIDATES - 1), { timeout: 15_000 });
    provider.releaseAt(0);
    await running;

    const saved = store.get(task.id)!;
    expect(saved.status).toBe("completed");
    expect(saved.albumTracks?.map((track) => track.status)).toEqual(
      Array.from({ length: CANDIDATES }, () => "completed"),
    );
    for (const track of saved.albumTracks ?? []) {
      expect(track.audioFile).toBeTruthy();
      const audio = await readFile(path.join(
        root, "tasks", "04-album", "album-concurrent", "tracks", track.audioFile!,
      ));
      expect(audio.length).toBeGreaterThan(0);
    }

    // Concurrent finishes must not be recorded as superseded attempts: a newer
    // dispatch for another candidate used to discard this candidate's result.
    const attempts = saved.generationAttempts ?? [];
    expect(attempts.filter((attempt) => attempt.outcome === "cancelled")).toHaveLength(0);
    expect(attempts.filter((attempt) => attempt.outcome === "completed")).toHaveLength(CANDIDATES);
    expect(new Set(attempts.map(attemptKey)).size).toBe(CANDIDATES);
    for (const track of saved.albumTracks ?? []) {
      expect(latestAttemptIdFor(attempts, track.id)).toBeTruthy();
    }
  });
});

describe("attempt records for concurrent work", () => {
  it("keeps the newest records per candidate instead of evicting other candidates", () => {
    let attempts: GenerationAttempt[] = [];
    for (let round = 0; round < MAX_GENERATION_ATTEMPTS + 2; round += 1) {
      for (const key of ["candidate-a", "candidate-b"]) {
        attempts = recordGenerationAttempt(attempts, {
          id: `${key}-${round}`, purpose: "album-track", key, model: "lyria-3.5",
          requestRef: "reference", startedAt: "2026-11-02T00:00:00.000Z",
        });
      }
    }
    expect(attempts.filter((attempt) => attempt.key === "candidate-a")).toHaveLength(MAX_GENERATION_ATTEMPTS);
    expect(attempts.filter((attempt) => attempt.key === "candidate-b")).toHaveLength(MAX_GENERATION_ATTEMPTS);
    expect(latestAttemptIdFor(attempts, "candidate-a")).toBe(`candidate-a-${MAX_GENERATION_ATTEMPTS + 1}`);
    expect(latestAttemptIdFor(attempts, "candidate-b")).toBe(`candidate-b-${MAX_GENERATION_ATTEMPTS + 1}`);
  });

  it("falls back to the purpose for dispatches that name no unit of work", () => {
    const attempt: GenerationAttempt = {
      id: "single", purpose: "generate", model: "lyria-3.5",
      requestRef: "reference", startedAt: "2026-11-02T00:00:00.000Z",
    };
    expect(attemptKey(attempt)).toBe("generate");
    expect(latestAttemptIdFor([attempt], "generate")).toBe("single");
  });
});
