import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const { generateMock, reviewMock, composeMock, planPlaylistMock } = vi.hoisted(() => ({
  generateMock: vi.fn(), reviewMock: vi.fn(), composeMock: vi.fn(), planPlaylistMock: vi.fn(),
}));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/moodmic/music-review.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/moodmic/music-review.js")>();
  return { ...actual, GeminiMusicReviewer: class { review = reviewMock; } };
});

vi.mock("../src/composer/composer-agent.js", () => ({ composeMusic: composeMock }));

vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: vi.fn(),
  planPlaylist: planPlaylistMock,
  refinePlaylistPlan: vi.fn(),
  composeAlbumTrack: vi.fn(),
  reviewAlbumCandidates: vi.fn(),
  reviseAlbumTrack: vi.fn(),
}));

const environment = { OPENAI_API_KEY: "test-openai", GEMINI_API_KEY: "test-gemini" };
const chatId = "11111111-1111-4111-8111-111111111111";
const journeyId = "22222222-2222-4222-8222-222222222222";
const songTaskId = "song-task";

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({
    audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null,
  });
  reviewMock.mockReset().mockResolvedValue({
    verdict: "match", summary: "Matches the request.", matchedPoints: [], mismatchedPoints: [],
  });
  composeMock.mockReset();
  planPlaylistMock.mockReset().mockImplementation(async () => {
    throw new Error("Planning is not part of this test.");
  });
});

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

interface TaskShape { id: string; status: string; albumTracks?: Array<{ id: string; status: string }> }

async function readTask(baseUrl: string, id: string): Promise<TaskShape> {
  return fetch(`${baseUrl}/api/tasks/${id}`).then((response) => response.json() as Promise<TaskShape>);
}

async function waitForTask(
  baseUrl: string,
  id: string,
  predicate: (task: TaskShape) => boolean,
): Promise<TaskShape> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const task = await readTask(baseUrl, id);
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task ${id} did not reach the expected state.`);
}

async function writeTask(root: string, id: string, record: Record<string, unknown>): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "01-general", id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    id, description: "A calm slow ambient piano piece", title: "Calm piece",
    mode: "generate", workflowType: "01-general", moodChatId: chatId,
    composerModel: "test", lyriaModel: "lyria-3.5",
    updatedAt: "2026-01-02T00:00:00.000Z", musicSpec: musicSpec("Calm piece"),
    ...record,
  }));
  await writeFile(path.join(directory, "piece.mp3"), Buffer.from([0, 1, 2, 3]));
}

async function writeSongAndJourney(root: string): Promise<void> {
  await writeTask(root, songTaskId, {
    status: "completed", audioFile: "piece.mp3", moodChatId: chatId,
  });
  const directory = path.join(root, "outputs", "journeys");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${journeyId}.json`), JSON.stringify({
    id: journeyId, moodChatId: chatId, songTaskId, phase: "song-ready",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }));
}

/** A playlist paused for confirmation at revision two. */
function playlistReviewTask(): Record<string, unknown> {
  const tracks = Array.from({ length: 12 }, (_, index) => ({
    number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
    instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
    development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
  }));
  return {
    workflowType: "05-playlist", compositionMode: "album", mode: "generate",
    status: "review", albumPlanRevision: 2,
    albumPlan: {
      schemaVersion: "1.0", albumTitle: "Night Set", albumMind: "Quiet variations.",
      cohesionStrategy: "Keep the room constant; vary density.",
      sharedSoundContract: "Warm felt piano in a small room.", tracks,
    },
    playlistBriefing: {
      intentReading: "A quiet late-night set.",
      referenceReadings: [{ title: "Rain", understood: "Slow piano.", usedFor: "Shared tone." }],
    },
    albumTracks: tracks.map((track) => ({
      id: `track-${track.number}`, order: track.number, title: track.title,
      targetDurationSeconds: track.targetSeconds, admission: "candidate", status: "queued",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    })),
  };
}

function post(baseUrl: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("admission of overlapping user decisions", () => {
  it("starts exactly one generation for two overlapping prompt approvals", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const responses = await Promise.all([
        post(baseUrl, "/api/tasks/planning-task/prompt/approve"),
        post(baseUrl, "/api/tasks/planning-task/prompt/approve"),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);

      const settled = await waitForTask(baseUrl, "planning-task", (task) => task.status === "completed");
      expect(settled.status).toBe("completed");
      expect(generateMock).toHaveBeenCalledTimes(1);
    }, {
      environment,
      prepare: async (root) => writeTask(root, "planning-task", { status: "planning" }),
    });
  });

  it("cannot keep and regenerate the same paused review at once", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const responses = await Promise.all([
        post(baseUrl, "/api/tasks/review-task/review", { decision: "keep" }),
        post(baseUrl, "/api/tasks/review-task/review", { decision: "regenerate" }),
      ]);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses.filter((status) => status < 300)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);
      // A kept review must not start generation; a regenerated one may run once.
      expect(generateMock.mock.calls.length).toBeLessThanOrEqual(1);
    }, {
      environment,
      prepare: async (root) => writeTask(root, "review-task", { status: "review", audioFile: "piece.mp3" }),
    });
  });

  it("admits one retry of a failed task", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const responses = await Promise.all([
        post(baseUrl, "/api/tasks/failed-task/retry"),
        post(baseUrl, "/api/tasks/failed-task/retry"),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
      await waitForTask(baseUrl, "failed-task", (task) => task.status !== "queued");
      expect(generateMock.mock.calls.length).toBeLessThanOrEqual(1);
    }, {
      environment,
      prepare: async (root) => writeTask(root, "failed-task", {
        status: "failed", error: "Provider rejected the request.",
      }),
    });
  });

  it("honours a submitted playlist plan revision and stays usable after a rejection", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const stale = await post(baseUrl, "/api/tasks/playlist-task/plan/approve", { revision: 1 });
      expect(stale.status).toBe(409);
      const accepted = await post(baseUrl, "/api/tasks/playlist-task/plan/approve", { revision: 2 });
      expect(accepted.status).toBe(202);
      // The rejected revision must not strand the gate or the reservation.
      const repeated = await post(baseUrl, "/api/tasks/playlist-task/plan/approve", { revision: 2 });
      expect(repeated.status).toBe(409);
      // Let the accepted run settle so it cannot write into a removed directory.
      await waitForTask(baseUrl, "playlist-task", (task) => task.status !== "queued");
    }, {
      environment,
      prepare: async (root) => writeTask(root, "playlist-task", playlistReviewTask()),
    });
  });

  it("opens one album for two overlapping journey continuations", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const responses = await Promise.all([
        post(baseUrl, `/api/journeys/${journeyId}/continue-album`, { theme: "A late-night instrumental set", candidateCount: 12, targetTotalMinutes: 30 }),
        post(baseUrl, `/api/journeys/${journeyId}/continue-album`, { theme: "A late-night instrumental set", candidateCount: 12, targetTotalMinutes: 30 }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 202]);

      const journeys = await fetch(`${baseUrl}/api/journeys/${journeyId}`).then((response) => response.json()) as {
        journey: { albumTaskId?: string };
      };
      const albumId = journeys.journey.albumTaskId;
      expect(albumId).toBeDefined();
      const tasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json()) as TaskShape[];
      expect(tasks.filter((task) => task.id === albumId)).toHaveLength(1);
      expect(tasks.filter((task) => task.id !== songTaskId)).toHaveLength(1);
      // Let the planning run settle so it cannot write into a removed directory.
      await waitForTask(baseUrl, albumId!, (task) => task.status !== "queued");
    }, {
      environment,
      prepare: async (root) => writeSongAndJourney(root),
    });
  });

  it("resolves an alias to the same journey gate as the journey id", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const responses = await Promise.all([
        post(baseUrl, `/api/journeys/${journeyId}/continue-album`, { theme: "A late-night instrumental set" }),
        post(baseUrl, `/api/journeys/${chatId}/continue-album`, { theme: "A late-night instrumental set" }),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 202]);
      const tasks = await fetch(`${baseUrl}/api/tasks`).then((response) => response.json()) as TaskShape[];
      expect(tasks).toHaveLength(2);
      const album = tasks.find((task) => task.id !== songTaskId);
      await waitForTask(baseUrl, album!.id, (task) => task.status !== "queued");
    }, {
      environment,
      prepare: async (root) => writeSongAndJourney(root),
    });
  });

  it("keeps idle planning and review gates across a restart without generating", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const planning = await readTask(baseUrl, "planning-task");
      const reviewing = await readTask(baseUrl, "review-task");
      expect(planning.status).toBe("planning");
      expect(reviewing.status).toBe("review");
      expect(generateMock).not.toHaveBeenCalled();
    }, {
      environment,
      prepare: async (root) => {
        await writeTask(root, "planning-task", { status: "planning" });
        await writeTask(root, "review-task", { status: "review", audioFile: "piece.mp3" });
      },
    });
  });
});
