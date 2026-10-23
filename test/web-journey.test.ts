import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlbumPlan } from "../src/schema/album-plan.js";
import type { MusicJourney } from "../src/journey/types.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock, reviewMock, composeMock } = vi.hoisted(() => ({
  generateMock: vi.fn(), reviewMock: vi.fn(), composeMock: vi.fn(),
}));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/moodmic/music-review.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/moodmic/music-review.js")>();
  return { ...actual, GeminiMusicReviewer: class { review = reviewMock; } };
});

vi.mock("../src/composer/composer-agent.js", () => ({ composeMusic: composeMock }));

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

function albumPlan(title = "Night Set"): AlbumPlan {
  return {
    schemaVersion: "1.0", albumTitle: title, albumMind: "Quiet variations.",
    cohesionStrategy: "Keep the room constant; vary density.",
    sharedSoundContract: "Warm felt piano in a small room.",
    tracks: Array.from({ length: 12 }, (_, index) => ({
      number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
      instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
      development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
    })),
  } as AlbumPlan;
}

vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: vi.fn(async () => albumPlan()),
  planPlaylist: vi.fn(async () => ({
    plan: albumPlan(),
    briefing: {
      intentReading: "Late-night instrumental focus built on the kept rain-night piano.",
      referenceReadings: [{
        title: "雨夜", understood: "Slow minor piano with generous silence.",
        usedFor: "The album's shared warm, low-light tone.",
      }],
    },
  })),
  refinePlaylistPlan: vi.fn(async () => ({
    plan: albumPlan("Night Set (revised)"),
    briefing: { intentReading: "Calmer late-night focus.", referenceReadings: [] },
    reply: "I softened the dynamics and removed the drums from track 4.",
  })),
  composeAlbumTrack: vi.fn(async () => musicSpec("Track")),
  reviewAlbumCandidates: vi.fn(async (plan: AlbumPlan) => ({
    verdict: "ready", albumFindings: [], similarities: [],
    candidates: plan.tracks.map((track) => ({ number: track.number, verdict: "ready", evidence: ["ok"], revisionBrief: null })),
  })),
  reviseAlbumTrack: vi.fn(async () => musicSpec("Track")),
}));

const FRAME_LENGTH = 626;
const MP3_HEADER = Buffer.from([0xff, 0xfb, 0xb0, 0x44]);

/** A single, measurable MP3 frame, so album exports work with fake providers. */
function mp3Frame(): Buffer {
  const frame = Buffer.alloc(FRAME_LENGTH);
  MP3_HEADER.copy(frame);
  return frame;
}

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({ audio: mp3Frame(), generatedText: null });
  reviewMock.mockReset().mockResolvedValue({
    verdict: "mismatch", summary: "The mood is far too aggressive.",
    matchedPoints: [], mismatchedPoints: ["fast and loud"],
  });
  composeMock.mockReset().mockResolvedValue(musicSpec("雨夜"));
});

const chatId = "33333333-3333-4333-8333-333333333333";
const journeyId = "44444444-4444-4444-8444-444444444444";
const songTaskId = "55555555-5555-4555-8555-555555555555";
const environment = { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" };

const stubAgent = {
  respond: async () => ({ content: "A quiet piano direction." }),
  propose: async () => "安静的雨夜钢琴，慢速，纯器乐",
};

interface JourneyResponse {
  journey: MusicJourney;
  songTask: { id: string; status: string } | null;
  albumTask: {
    id: string; status: string; workflowType: string; compositionMode: string;
    journeyId?: string; parentTaskId?: string; playlistPlanApproved?: boolean;
    albumPlanRevision?: number; albumPlan?: { albumTitle: string };
    albumTracks?: Array<{ id: string; status: string; admission: string; audioFile?: string }>;
    playlistReferences?: Array<{ chatId: string; taskId?: string }>;
  } | null;
}

async function readJourney(baseUrl: string, id: string): Promise<{ status: number; body: JourneyResponse }> {
  const response = await fetch(`${baseUrl}/api/journeys/${id}`);
  return { status: response.status, body: await response.json() as JourneyResponse };
}

async function waitForJourney(
  baseUrl: string,
  id: string,
  predicate: (body: JourneyResponse) => boolean,
): Promise<JourneyResponse> {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const body = (await readJourney(baseUrl, id)).body;
    if (predicate(body)) return body;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Journey did not reach the expected phase.");
}

async function writeJourney(root: string, journey: Partial<MusicJourney> = {}): Promise<void> {
  const directory = path.join(root, "outputs", "journeys");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${journeyId}.json`), JSON.stringify({
    id: journeyId, moodChatId: chatId, songTaskId, phase: "song-running",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    ...journey,
  }));
}

async function prepareMoodMic(root: string, taskOverrides: Record<string, unknown> = {}): Promise<void> {
  const chatDirectory = path.join(root, "outputs", "moodmic", "chats", chatId);
  await mkdir(chatDirectory, { recursive: true });
  await writeFile(path.join(chatDirectory, "session.json"), JSON.stringify({
    id: chatId, status: "submitted", jazz: false,
    messages: [{ id: "m1", role: "user", content: "雨夜的钢琴", attachmentIds: [], createdAt: "2026-01-01T00:00:00.000Z" }],
    attachments: [], proposal: "安静的雨夜钢琴，慢速，纯器乐", taskIds: [songTaskId],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }));
  const taskDirectory = path.join(root, "outputs", "tasks", "01-general", songTaskId);
  await mkdir(taskDirectory, { recursive: true });
  await writeFile(path.join(taskDirectory, "task.json"), JSON.stringify({
    id: songTaskId, description: "安静的雨夜钢琴，慢速，纯器乐", title: "雨夜",
    mode: "generate", status: "completed", workflowType: "01-general",
    moodChatId: chatId, audioFile: "rain.mp3",
    composerModel: "test", lyriaModel: "lyria-3.5", updatedAt: "2026-01-02T00:00:00.000Z",
    musicSpec: musicSpec("雨夜"),
    ...taskOverrides,
  }));
  await writeFile(path.join(taskDirectory, "rain.mp3"), Buffer.from([0, 1, 2, 3]));
}

describe("Journey: mood to song to album", () => {
  it("starts a journey with the MoodMic song and follows it through review", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const chat = await fetch(`${baseUrl}/api/mood-chats`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).then((response) => response.json()) as { id: string };
      await fetch(`${baseUrl}/api/mood-chats/${chat.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "雨夜的钢琴", attachmentIds: [] }),
      });
      const submitted = await fetch(`${baseUrl}/api/mood-chats/${chat.id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "安静的雨夜钢琴，慢速，纯器乐" }),
      }).then((response) => response.json()) as { task: { id: string } };

      // The composed Lyria prompt pauses first for confirmation.
      const paused = await waitForJourney(baseUrl, chat.id, (body) => body.songTask?.status === "planning");
      expect(paused.songTask?.status).toBe("planning");
      const approved = await fetch(`${baseUrl}/api/tasks/${submitted.task.id}/prompt/approve`, { method: "POST" });
      expect(approved.status).toBe(202);

      // The review check pauses the song, and the journey follows the pause.
      const reviewing = await waitForJourney(baseUrl, chat.id, (body) => body.journey.phase === "song-review");
      expect(reviewing.journey.songTaskId).toBe(submitted.task.id);
      expect(reviewing.songTask?.status).toBe("review");

      const kept = await fetch(`${baseUrl}/api/tasks/${submitted.task.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "keep" }),
      });
      expect(kept.status).toBe(200);
      const ready = await readJourney(baseUrl, chat.id);
      expect(ready.body.journey.phase).toBe("song-ready");
    }, { discussionAgent: stubAgent, environment });
  });

  it("plans in the background, waits for an approved revision, then curates the album", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const started = await fetch(`${baseUrl}/api/journeys/${chatId}/continue-album`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "深夜专注的器乐专辑，延续雨夜钢琴", candidateCount: 12, targetTotalMinutes: 30 }),
      });
      expect(started.status).toBe(202);
      const created = await started.json() as JourneyResponse;
      expect(created.journey.phase).toBe("album-planning");
      // The album is bound to the exact kept song, not to whatever audio exists.
      expect(created.albumTask?.parentTaskId).toBe(songTaskId);
      expect(created.albumTask?.journeyId).toBe(journeyId);
      expect(created.albumTask?.playlistReferences?.[0]).toMatchObject({ chatId, taskId: songTaskId });
      expect(created.albumTask?.workflowType).toBe("05-playlist");

      const reviewing = await waitForJourney(baseUrl, chatId, (body) => body.journey.phase === "album-review");
      expect(reviewing.albumTask?.status).toBe("review");
      expect(reviewing.albumTask?.playlistPlanApproved).toBe(false);
      const revision = reviewing.albumTask?.albumPlanRevision;
      expect(revision).toBe(1);

      // A revision invalidates the previous approval and pauses again.
      const revised = await fetch(`${baseUrl}/api/journeys/${chatId}/album-plan/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "整体再安静一点" }),
      });
      expect(revised.status).toBe(200);
      const revisedBody = await revised.json() as JourneyResponse;
      expect(revisedBody.journey.phase).toBe("album-review");
      expect(revisedBody.journey.approvedPlanRevision).toBeUndefined();
      expect(revisedBody.albumTask?.albumPlan?.albumTitle).toBe("Night Set (revised)");
      expect(revisedBody.albumTask?.albumPlanRevision).toBe(2);

      // An approval bound to the stale revision is refused.
      const stale = await fetch(`${baseUrl}/api/journeys/${chatId}/album-plan/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 1 }),
      });
      expect(stale.status).toBe(409);

      const approved = await fetch(`${baseUrl}/api/journeys/${chatId}/album-plan/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 2 }),
      });
      expect(approved.status).toBe(202);
      const approvedBody = await approved.json() as JourneyResponse;
      expect(approvedBody.journey.phase).toBe("album-running");
      expect(approvedBody.journey.approvedPlanRevision).toBe(2);

      const curating = await waitForJourney(baseUrl, chatId, (body) => body.journey.phase === "album-curation");
      expect(curating.albumTask?.status).toBe("completed");
      expect(curating.albumTask?.albumTracks?.every((track) => track.status === "completed")).toBe(true);

      // Curation happens through the existing album endpoints, and the journey
      // records the album it produced.
      const track = curating.albumTask!.albumTracks![0]!;
      const admitted = await fetch(`${baseUrl}/api/tasks/${curating.albumTask!.id}/album/tracks/${track.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admission: "included" }),
      });
      expect(admitted.status).toBe(200);
      const exported = await fetch(`${baseUrl}/api/tasks/${curating.albumTask!.id}/album/export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "included", format: "manifest" }),
      });
      expect(exported.status).toBe(200);
      const finished = await readJourney(baseUrl, chatId);
      expect(finished.body.journey.phase).toBe("completed");
    }, { prepare: (root) => prepareMoodMic(root).then(() => writeJourney(root)), environment });
  });

  it("does not start a second album or a second generation for repeated clicks", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const first = await fetch(`${baseUrl}/api/journeys/${chatId}/continue-album`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "深夜专注的器乐专辑" }),
      });
      const firstBody = await first.json() as JourneyResponse;
      const second = await fetch(`${baseUrl}/api/journeys/${chatId}/continue-album`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "深夜专注的器乐专辑" }),
      });
      expect(second.status).toBe(200);
      const secondBody = await second.json() as JourneyResponse;
      expect(secondBody.albumTask?.id).toBe(firstBody.albumTask?.id);

      await waitForJourney(baseUrl, chatId, (body) => body.journey.phase === "album-review");
      const generateCalls = generateMock.mock.calls.length;
      const approve = await fetch(`${baseUrl}/api/journeys/${chatId}/album-plan/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 1 }),
      });
      expect(approve.status).toBe(202);
      const duplicate = await fetch(`${baseUrl}/api/journeys/${chatId}/album-plan/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 1 }),
      });
      expect(duplicate.status).toBe(200);

      const curating = await waitForJourney(baseUrl, chatId, (body) => body.journey.phase === "album-curation");
      const albumTask = curating.albumTask!;
      expect(albumTask.albumTracks).toHaveLength(12);
      // Exactly one generation per candidate.
      expect(generateMock.mock.calls.length - generateCalls).toBe(12);
    }, { prepare: (root) => prepareMoodMic(root).then(() => writeJourney(root)), environment });
  });

  it("rejects an unfinished song and a song from another conversation", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const unfinished = await fetch(`${baseUrl}/api/journeys/${chatId}/continue-album`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "深夜专注的器乐专辑" }),
      });
      expect(unfinished.status).toBe(409);
      expect((await readJourney(baseUrl, chatId)).body.journey.phase).toBe("song-review");
    }, {
      prepare: (root) => prepareMoodMic(root, { status: "review" }).then(() => writeJourney(root)),
      environment,
    });

    await withWebServer(async ({ baseUrl }) => {
      const rejected = await fetch(`${baseUrl}/api/journeys/${chatId}/continue-album`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // A completed song from a different conversation cannot be the source.
        body: JSON.stringify({ theme: "深夜专注的器乐专辑", songTaskId: songTaskId }),
      });
      expect(rejected.status).toBe(409);
    }, {
      prepare: async (root) => {
        await prepareMoodMic(root, { moodChatId: "99999999-9999-4999-8999-999999999999" });
        await writeJourney(root);
      },
      environment,
    });
  });

  it("restores the journey stage after a refresh", async () => {
    await withWebServer(async ({ baseUrl }) => {
      // The song is finished and kept, so the derived phase is "song-ready"
      // without any client-side memory.
      const ready = await readJourney(baseUrl, chatId);
      expect(ready.status).toBe(200);
      expect(ready.body.journey.phase).toBe("song-ready");
      expect(ready.body.journey.id).toBe(journeyId);

      // A review that is already pending restores as a review.
      const reviewing = await readJourney(baseUrl, songTaskId);
      expect(reviewing.body.journey.id).toBe(journeyId);
      expect(reviewing.body.songTask?.id).toBe(songTaskId);

      const unknown = await readJourney(baseUrl, "88888888-8888-4888-8888-888888888888");
      expect(unknown.status).toBe(404);
    }, { prepare: (root) => prepareMoodMic(root).then(() => writeJourney(root)), environment });
  });
});
