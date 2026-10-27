import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskStore } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock, refineMock, composeAlbumTrackMock, reviewAlbumCandidatesMock } = vi.hoisted(() => ({
  generateMock: vi.fn(), refineMock: vi.fn(), composeAlbumTrackMock: vi.fn(),
  reviewAlbumCandidatesMock: vi.fn(),
}));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: vi.fn(),
  planPlaylist: vi.fn(),
  refinePlaylistPlan: refineMock,
  composeAlbumTrack: composeAlbumTrackMock,
  reviewAlbumCandidates: reviewAlbumCandidatesMock,
  reviseAlbumTrack: vi.fn(),
}));

const environment = { OPENAI_API_KEY: "test-openai", GEMINI_API_KEY: "test-gemini" };
const chatId = "11111111-1111-4111-8111-111111111111";
const journeyId = "22222222-2222-4222-8222-222222222222";
const albumTaskId = "album-task";
const TRACK_COUNT = 12;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

function musicSpec(title: string) {
  return {
    schemaVersion: "1.0", title, intent: "A quiet night piece.",
    genres: ["ambient"], moods: ["calm"],
    tempo: { bpm: 60, feel: "slow" }, tonality: { tonic: "C", mode: "major" }, meter: "4/4",
    instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
    structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "spacious", avoid: [], assumptions: [],
    lyriaPrompt: "slow calm ambient piano, instrumental only, no vocals",
  };
}

function albumPlan(title: string) {
  return {
    schemaVersion: "1.0", albumTitle: title, albumMind: "Quiet variations.",
    cohesionStrategy: "Keep the room constant; vary density.",
    sharedSoundContract: "Warm felt piano in a small room.",
    tracks: Array.from({ length: TRACK_COUNT }, (_, index) => ({
      number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
      instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
      development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
    })),
  };
}

function briefing() {
  return {
    intentReading: "A quiet late-night set.",
    referenceReadings: [{ title: "Rain", understood: "Slow piano.", usedFor: "Shared tone." }],
  };
}

function refinedPlan(title: string) {
  return { plan: albumPlan(title), briefing: briefing(), reply: "Updated the plan." };
}

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({
    audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null,
  });
  refineMock.mockReset();
  composeAlbumTrackMock.mockReset().mockImplementation(async (_plan: unknown, number: number) =>
    musicSpec(`Track ${number}`));
  reviewAlbumCandidatesMock.mockReset().mockImplementation(async (plan: { tracks: Array<{ number: number }> }) => ({
    verdict: "ready", albumFindings: [], similarities: [],
    candidates: plan.tracks.map((track) => ({
      number: track.number, verdict: "ready", evidence: ["Delivers the outline."], revisionBrief: null,
    })),
  }));
});

interface TaskShape { id: string; status: string; albumPlanRevision?: number; albumPlan?: { albumTitle: string } }

async function readTask(baseUrl: string, id: string): Promise<TaskShape> {
  return fetch(`${baseUrl}/api/tasks/${id}`).then((response) => response.json() as Promise<TaskShape>);
}

async function waitForTask(
  baseUrl: string,
  id: string,
  predicate: (task: TaskShape) => boolean,
): Promise<TaskShape> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const task = await readTask(baseUrl, id);
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task ${id} did not reach the expected state.`);
}

const RUNNING = new Set(["queued", "composing", "generating", "assembling", "processing"]);

/** Waits until no runner is writing to the task, so teardown cannot race it. */
async function waitForSettled(baseUrl: string, id: string): Promise<TaskShape> {
  return waitForTask(baseUrl, id, (task) => !RUNNING.has(task.status));
}

async function waitForCall(mock: { mock: { calls: unknown[] } }): Promise<void> {
  for (let attempt = 0; attempt < 200 && mock.mock.calls.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(mock.mock.calls.length).toBeGreaterThan(0);
}

/**
 * A playlist paused for confirmation. With `albumPromptsReady`, generation can
 * start straight from the confirm endpoint, which makes one dispatch countable.
 */
function playlistRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const plan = albumPlan("Night Set");
  return {
    id: albumTaskId, description: "A late-night instrumental set",
    workflowType: "05-playlist", compositionMode: "album", mode: "generate",
    status: "review", albumPlanRevision: 2,
    albumPlan: plan,
    playlistBriefing: briefing(),
    playlistPlanApproved: false,
    albumTracks: plan.tracks.map((track) => ({
      id: `track-${track.number}`, order: track.number, title: track.title,
      targetDurationSeconds: track.targetSeconds, admission: "candidate", status: "queued",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    })),
    ...overrides,
  };
}

async function writePlaylistTask(
  root: string,
  record: Record<string, unknown> = playlistRecord(),
): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "05-playlist", albumTaskId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    composerModel: "test", lyriaModel: "lyria-3.5",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...record,
  }));
}

async function writeJourney(root: string, phase = "album-review"): Promise<void> {
  const directory = path.join(root, "outputs", "journeys");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${journeyId}.json`), JSON.stringify({
    id: journeyId, moodChatId: chatId, albumTaskId, phase,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }));
}

function post(baseUrl: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("plan revision owns the plan while it runs", () => {
  it("rejects both approval routes while a Journey revision is in flight", async () => {
    const pending = deferred<ReturnType<typeof refinedPlan>>();
    refineMock.mockImplementation(() => pending.promise);
    await withWebServer(async ({ baseUrl }) => {
      const revising = post(baseUrl, `/api/journeys/${chatId}/album-plan/messages`, { message: "Make it slower" });
      await waitForCall(refineMock);

      // The revision is pending: nothing may approve the plan it will replace.
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 2 })).status).toBe(409);
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/approve`, { revision: 2 })).status).toBe(409);
      expect((await readTask(baseUrl, albumTaskId)).status).toBe("review");
      expect(generateMock).not.toHaveBeenCalled();
      expect(composeAlbumTrackMock).not.toHaveBeenCalled();

      pending.resolve(refinedPlan("Night Set (revised)"));
      expect((await revising).status).toBe(200);

      // The committed revision is a new version, so the old page is stale.
      const revised = await readTask(baseUrl, albumTaskId);
      expect(revised.albumPlanRevision).toBe(3);
      expect(revised.albumPlan?.albumTitle).toBe("Night Set (revised)");
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 2 })).status).toBe(409);
      expect(generateMock).not.toHaveBeenCalled();

      // Exactly one run starts for the current version; a repeat returns the
      // existing approval instead of paying for a second one.
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 3 })).status).toBe(202);
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 3 })).status).toBe(200);
      await waitForTask(baseUrl, albumTaskId, (task) => task.status === "completed");
      expect(composeAlbumTrackMock).toHaveBeenCalledTimes(TRACK_COUNT);
      expect(generateMock).toHaveBeenCalledTimes(TRACK_COUNT);
    }, {
      environment,
      prepare: async (root) => {
        await writePlaylistTask(root);
        await writeJourney(root);
      },
    });
  });

  it("rejects a revision once an approval has committed, without calling the provider", async () => {
    await withWebServer(async ({ baseUrl }) => {
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 2 })).status).toBe(202);

      const rejected = await post(baseUrl, `/api/journeys/${chatId}/album-plan/messages`, { message: "Make it slower" });
      expect(rejected.status).toBe(409);
      expect(refineMock).not.toHaveBeenCalled();
      const direct = await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Make it slower" });
      expect(direct.status).toBe(409);
      expect(refineMock).not.toHaveBeenCalled();
      await waitForSettled(baseUrl, albumTaskId);
    }, {
      environment,
      prepare: async (root) => {
        await writePlaylistTask(root);
        await writeJourney(root);
      },
    });
  });

  it("keeps the direct route and the journey route on one plan gate", async () => {
    const pending = deferred<ReturnType<typeof refinedPlan>>();
    refineMock.mockImplementation(() => pending.promise);
    await withWebServer(async ({ baseUrl }) => {
      // Revision claimed through the direct task route …
      const revising = post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" });
      await waitForCall(refineMock);
      // … blocks the Journey route for the same plan.
      expect((await post(baseUrl, `/api/journeys/${chatId}/album-plan/approve`, { revision: 2 })).status).toBe(409);
      pending.resolve(refinedPlan("Night Set (warm)"));
      expect((await revising).status).toBe(200);
      expect((await readTask(baseUrl, albumTaskId)).albumPlanRevision).toBe(3);
    }, {
      environment,
      prepare: async (root) => {
        await writePlaylistTask(root);
        await writeJourney(root);
      },
    });
  });

  it("releases the revision claim after a provider failure", async () => {
    refineMock.mockRejectedValueOnce(Object.assign(new Error("Composer unavailable."), { status: 503 }));
    await withWebServer(async ({ baseUrl }) => {
      const failed = await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" });
      expect(failed.status).toBeGreaterThanOrEqual(400);
      // The previous plan and version are untouched, and the gate is usable.
      const task = await readTask(baseUrl, albumTaskId);
      expect(task.status).toBe("review");
      expect(task.albumPlanRevision).toBe(2);

      refineMock.mockResolvedValueOnce(refinedPlan("Night Set (warm)"));
      const retried = await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" });
      expect(retried.status).toBe(200);
      expect((await readTask(baseUrl, albumTaskId)).albumPlanRevision).toBe(3);
    }, {
      environment,
      prepare: async (root) => writePlaylistTask(root),
    });
  });
});

describe("committed plan revisions advance the version", () => {
  it("moves a standalone plan from 2 to 3 and rejects the stale approval", async () => {
    refineMock.mockResolvedValueOnce(refinedPlan("Night Set (revised)"));
    await withWebServer(async ({ baseUrl }) => {
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" })).status).toBe(200);
      expect((await readTask(baseUrl, albumTaskId)).albumPlanRevision).toBe(3);

      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/approve`, { revision: 2 })).status).toBe(409);
      expect(generateMock).not.toHaveBeenCalled();

      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/approve`, { revision: 3 })).status).toBe(202);
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/approve`, { revision: 3 })).status).toBe(409);
      await waitForTask(baseUrl, albumTaskId, (task) => task.status === "completed");
      expect(composeAlbumTrackMock).toHaveBeenCalledTimes(TRACK_COUNT);
      expect(generateMock).toHaveBeenCalledTimes(TRACK_COUNT);
    }, {
      environment,
      prepare: async (root) => writePlaylistTask(root),
    });
  });

  it("increments once per committed edit and keeps failed edits from publishing", async () => {
    refineMock.mockResolvedValueOnce(refinedPlan("Night Set v3"));
    await withWebServer(async ({ baseUrl }) => {
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" })).status).toBe(200);
      expect((await readTask(baseUrl, albumTaskId)).albumPlanRevision).toBe(3);

      refineMock.mockResolvedValueOnce(refinedPlan("Night Set v4"));
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Brighter" })).status).toBe(200);
      expect((await readTask(baseUrl, albumTaskId)).albumPlanRevision).toBe(4);

      refineMock.mockRejectedValueOnce(new Error("Composer unavailable."));
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Louder" })).status)
        .toBeGreaterThanOrEqual(400);
      const afterFailure = await readTask(baseUrl, albumTaskId);
      expect(afterFailure.albumPlanRevision).toBe(4);
      expect(afterFailure.albumPlan?.albumTitle).toBe("Night Set v4");
      expect(afterFailure.status).toBe("review");
    }, {
      environment,
      prepare: async (root) => writePlaylistTask(root),
    });
  });

  it("treats a legacy plan without a version as revision 1", async () => {
    refineMock.mockResolvedValueOnce(refinedPlan("Night Set v2"));
    await withWebServer(async ({ baseUrl, root }) => {
      expect((await post(baseUrl, `/api/tasks/${albumTaskId}/plan/messages`, { message: "Warmer" })).status).toBe(200);
      const task = await readTask(baseUrl, albumTaskId);
      expect(task.albumPlanRevision).toBe(2);

      // Reloading the store from disk agrees with what the server published.
      const store = new TaskStore(path.join(root, "outputs", "tasks"));
      await store.initialize({ markInterrupted: false });
      const reloaded = store.get(albumTaskId);
      expect(reloaded?.albumPlanRevision).toBe(2);
      expect(reloaded?.albumPlan?.albumTitle).toBe("Night Set v2");
    }, {
      environment,
      prepare: async (root) => writePlaylistTask(root, playlistRecord({ albumPlanRevision: undefined })),
    });
  });
});
