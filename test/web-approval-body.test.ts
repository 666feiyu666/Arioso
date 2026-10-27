import { request as httpRequest } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const { generateMock, composeAlbumTrackMock, reviewAlbumCandidatesMock } = vi.hoisted(() => ({
  generateMock: vi.fn(), composeAlbumTrackMock: vi.fn(), reviewAlbumCandidatesMock: vi.fn(),
}));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/moodmic/music-review.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/moodmic/music-review.js")>();
  return {
    ...actual,
    GeminiMusicReviewer: class {
      async review() {
        return { verdict: "match", summary: "Matches.", matchedPoints: [], mismatchedPoints: [] };
      }
    },
  };
});

vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: vi.fn(),
  planPlaylist: vi.fn(),
  refinePlaylistPlan: vi.fn(),
  composeAlbumTrack: composeAlbumTrackMock,
  reviewAlbumCandidates: reviewAlbumCandidatesMock,
  reviseAlbumTrack: vi.fn(),
}));

const environment = { OPENAI_API_KEY: "test-openai", GEMINI_API_KEY: "test-gemini" };
const chatId = "11111111-1111-4111-8111-111111111111";
const journeyId = "22222222-2222-4222-8222-222222222222";
const albumTaskId = "album-task";
const TRACK_COUNT = 12;
const RUNNING = new Set(["queued", "composing", "generating", "assembling", "processing"]);

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

function albumPlan() {
  return {
    schemaVersion: "1.0", albumTitle: "Night Set", albumMind: "Quiet variations.",
    cohesionStrategy: "Keep the room constant; vary density.",
    sharedSoundContract: "Warm felt piano in a small room.",
    tracks: Array.from({ length: TRACK_COUNT }, (_, index) => ({
      number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
      instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
      development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
    })),
  };
}

function playlistRecord(): Record<string, unknown> {
  const plan = albumPlan();
  return {
    id: albumTaskId, description: "A late-night instrumental set",
    workflowType: "05-playlist", compositionMode: "album", mode: "generate",
    status: "review", albumPlanRevision: 2, albumPlan: plan,
    playlistBriefing: {
      intentReading: "A quiet late-night set.",
      referenceReadings: [{ title: "Rain", understood: "Slow piano.", usedFor: "Shared tone." }],
    },
    playlistPlanApproved: false,
    albumTracks: plan.tracks.map((track) => ({
      id: `track-${track.number}`, order: track.number, title: track.title,
      targetDurationSeconds: track.targetSeconds, admission: "candidate", status: "queued",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    })),
  };
}

async function prepare(root: string, withJourney = false): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "05-playlist", albumTaskId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    composerModel: "test", lyriaModel: "lyria-3.5",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...playlistRecord(),
  }));
  if (!withJourney) return;
  const journeys = path.join(root, "outputs", "journeys");
  await mkdir(journeys, { recursive: true });
  await writeFile(path.join(journeys, `${journeyId}.json`), JSON.stringify({
    id: journeyId, moodChatId: chatId, albumTaskId, phase: "album-review",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }));
}

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({
    audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null,
  });
  composeAlbumTrackMock.mockReset().mockImplementation(async (_plan: unknown, number: number) =>
    musicSpec(`Track ${number}`));
  reviewAlbumCandidatesMock.mockReset().mockImplementation(async (plan: { tracks: Array<{ number: number }> }) => ({
    verdict: "ready", albumFindings: [], similarities: [],
    candidates: plan.tracks.map((track) => ({
      number: track.number, verdict: "ready", evidence: ["Delivers the outline."], revisionBrief: null,
    })),
  }));
});

interface TaskShape { id: string; status: string; albumPlanRevision?: number }

async function readTask(baseUrl: string): Promise<TaskShape> {
  return fetch(`${baseUrl}/api/tasks/${albumTaskId}`).then((response) => response.json() as Promise<TaskShape>);
}

async function waitForSettled(baseUrl: string): Promise<TaskShape> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const task = await readTask(baseUrl);
    if (!RUNNING.has(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("An album run did not settle.");
}

function rawPost(
  baseUrl: string,
  route: string,
  chunks: string[],
): Promise<{ status: number; body: string }> {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    // No Content-Length: node sends this request with chunked encoding.
    const request = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: route,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.on("error", reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

function post(baseUrl: string, route: string, body?: string): Promise<Response> {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body }),
  });
}

const journeyApprove = `/api/journeys/${chatId}/album-plan/approve`;
const taskApprove = `/api/tasks/${albumTaskId}/plan/approve`;

describe("approval bodies: absent, valid and malformed", () => {
  it.each([
    ["an absent body", undefined],
    ["an empty object", "{}"],
    ["the current revision", JSON.stringify({ revision: 2 })],
  ])("accepts %s on both routes", async (_label, body) => {
    await withWebServer(async ({ baseUrl }) => {
      const direct = await post(baseUrl, taskApprove, body);
      expect(direct.status).toBe(202);
      await waitForSettled(baseUrl);
    }, { environment, prepare: (root) => prepare(root) });

    await withWebServer(async ({ baseUrl }) => {
      const viaJourney = await post(baseUrl, journeyApprove, body);
      expect(viaJourney.status).toBe(202);
      await waitForSettled(baseUrl);
    }, { environment, prepare: (root) => prepare(root, true) });
  });

  it("rejects malformed and non-object bodies without approving anything", async () => {
    const rejected = ["{", "   ", "null", "[]", "\"approve\"", "12"];
    await withWebServer(async ({ baseUrl }) => {
      for (const body of rejected) {
        for (const route of [taskApprove, journeyApprove]) {
          const response = await post(baseUrl, route, body);
          expect(response.status, `${route} with ${JSON.stringify(body)}`).toBe(400);
        }
      }
      const before = await readTask(baseUrl);
      expect(before.status).toBe("review");
      expect(before.albumPlanRevision).toBe(2);
      expect(composeAlbumTrackMock).not.toHaveBeenCalled();
      expect(generateMock).not.toHaveBeenCalled();
      // A later valid request still works.
      expect((await post(baseUrl, taskApprove, JSON.stringify({ revision: 2 }))).status).toBe(202);
      await waitForSettled(baseUrl);
    }, { environment, prepare: (root) => prepare(root, true) });
  });

  it("returns 413 for an oversized body and changes nothing", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const oversized = JSON.stringify({ revision: 2, padding: "x".repeat(70_000) });
      expect((await post(baseUrl, taskApprove, oversized)).status).toBe(413);
      expect((await post(baseUrl, journeyApprove, oversized)).status).toBe(413);
      expect((await readTask(baseUrl)).status).toBe("review");
      expect(generateMock).not.toHaveBeenCalled();
    }, { environment, prepare: (root) => prepare(root, true) });
  });

  it("rejects malformed chunked JSON", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const malformed = await rawPost(baseUrl, taskApprove, ["{", "\"revision\": "]);
      expect(malformed.status).toBe(400);
      expect((await readTask(baseUrl)).status).toBe("review");
      expect(generateMock).not.toHaveBeenCalled();
    }, { environment, prepare: (root) => prepare(root) });
  });

  it("honours a valid chunked body instead of assuming it is absent", async () => {
    await withWebServer(async ({ baseUrl }) => {
      // The plan is paused at revision 2, so a chunked revision 1 must be seen.
      const stale = await rawPost(baseUrl, taskApprove, [JSON.stringify({ revision: 1 })]);
      expect(stale.status).toBe(409);
      expect(generateMock).not.toHaveBeenCalled();

      const current = await rawPost(baseUrl, taskApprove, [JSON.stringify({ revision: 2 })]);
      expect(current.status).toBe(202);
      await waitForSettled(baseUrl);
    }, { environment, prepare: (root) => prepare(root) });
  });

  it("keeps the MoodMic empty-body prompt approval working", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const approved = await post(baseUrl, "/api/tasks/planning-task/prompt/approve", undefined);
      expect(approved.status).toBe(202);
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const task = await fetch(`${baseUrl}/api/tasks/planning-task`)
          .then((response) => response.json()) as TaskShape;
        if (!RUNNING.has(task.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(generateMock).toHaveBeenCalledTimes(1);
    }, {
      environment,
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "tasks", "01-general", "planning-task");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "task.json"), JSON.stringify({
          id: "planning-task", description: "A calm slow ambient piano piece", title: "Calm piece",
          mode: "generate", status: "planning", workflowType: "01-general",
          moodChatId: chatId, composerModel: "test", lyriaModel: "lyria-3.5",
          updatedAt: "2026-01-02T00:00:00.000Z", musicSpec: musicSpec("Calm piece"),
        }));
      },
    });
  });
});
