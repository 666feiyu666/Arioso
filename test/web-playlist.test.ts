import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlbumPlan } from "../src/schema/album-plan.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

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

vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: vi.fn(async (): Promise<AlbumPlan> => ({
    schemaVersion: "1.0", albumTitle: "Night Set", albumMind: "Quiet variations.",
    cohesionStrategy: "Keep the room constant; vary density.",
    sharedSoundContract: "Warm felt piano in a small room.",
    tracks: Array.from({ length: 14 }, (_, index) => ({
      number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
      instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
      development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
    })),
  })),
  planPlaylist: vi.fn(async () => ({
    plan: {
      schemaVersion: "1.0", albumTitle: "Night Set", albumMind: "Quiet variations.",
      cohesionStrategy: "Keep the room constant; vary density.",
      sharedSoundContract: "Warm felt piano in a small room.",
      tracks: Array.from({ length: 14 }, (_, index) => ({
        number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
        instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
        development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
      })),
    },
    briefing: {
      intentReading: "Late-night instrumental focus rooted in the reference's warm night piano.",
      referenceReadings: [{
        title: "雨夜", understood: "Slow minor piano with generous silence.",
        usedFor: "The album's shared warm, low-light tone.",
      }],
    },
  })),
  refinePlaylistPlan: vi.fn(async () => ({
    plan: {
      schemaVersion: "1.0", albumTitle: "Night Set (revised)", albumMind: "Calmer still.",
      cohesionStrategy: "Softer dynamics throughout.", sharedSoundContract: "Warm felt piano.",
      tracks: Array.from({ length: 14 }, (_, index) => ({
        number: index + 1, title: `Track ${index + 1}`, musicalRole: "Interlude",
        instruments: ["Piano"], groove: "Slow", harmony: "Diatonic",
        development: "Begins, develops, ends.", targetSeconds: 90 + (index % 3) * 20,
      })),
    },
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

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({ audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null });
});

const chatId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

async function prepareMoodMic(root: string): Promise<void> {
  const chatDirectory = path.join(root, "outputs", "moodmic", "chats", chatId);
  await mkdir(chatDirectory, { recursive: true });
  await writeFile(path.join(chatDirectory, "session.json"), JSON.stringify({
    id: chatId, status: "submitted", jazz: false,
    messages: [{ id: "m1", role: "user", content: "雨夜的钢琴", attachmentIds: [], createdAt: "2026-01-01T00:00:00.000Z" }],
    attachments: [], proposal: "安静的雨夜钢琴，慢速，纯器乐", taskIds: [taskId],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  }));
  const taskDirectory = path.join(root, "outputs", "tasks", "01-general", taskId);
  await mkdir(taskDirectory, { recursive: true });
  await writeFile(path.join(taskDirectory, "task.json"), JSON.stringify({
    id: taskId, description: "雨夜的钢琴", title: "雨夜", mode: "generate", status: "completed",
    workflowType: "01-general", moodChatId: chatId, audioFile: "rain.mp3",
    composerModel: "test", lyriaModel: "lyria-3.5", updatedAt: "2026-01-02T00:00:00.000Z",
    musicSpec: musicSpec("雨夜"),
  }));
  await writeFile(path.join(taskDirectory, "rain.mp3"), Buffer.from([0, 1, 2, 3]));
}

const environment = { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" };

async function waitForTask(baseUrl: string, id: string, predicate: (task: { status: string }) => boolean) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const task = await fetch(`${baseUrl}/api/tasks/${id}`).then((response) => response.json()) as { status: string };
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Task did not reach the expected state.");
}

describe("Playlist references and creation", () => {
  it("lists MoodMic creations that can back a playlist", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const body = await fetch(`${baseUrl}/api/playlists/references`).then((response) => response.json()) as {
        references: Array<{ chatId: string; title: string; prompt: string; audioUrl?: string; musicSpec: { genres: string[] } }>;
      };
      expect(body.references).toHaveLength(1);
      expect(body.references[0]).toMatchObject({ chatId, title: "雨夜" });
      expect(body.references[0]!.prompt).toContain("雨夜");
      expect(body.references[0]!.audioUrl).toBe(`/api/tasks/${taskId}/audio`);
      expect(body.references[0]!.musicSpec.genres).toContain("ambient");
    }, { prepare: prepareMoodMic, environment });
  });

  it("plans a 05-playlist album, pauses for confirmation, then generates on approval", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "深夜专注的器乐歌单，延续雨夜钢琴的质感", candidateCount: 14,
          targetTotalMinutes: 35, referenceChatIds: [chatId],
        }),
      });
      expect(response.status).toBe(202);
      const task = await response.json() as {
        id: string; status: string; workflowType: string; compositionMode: string;
        albumCandidateCount: number; playlistReferences: Array<{ chatId: string; prompt: string }>;
      };
      expect(task.workflowType).toBe("05-playlist");
      expect(task.compositionMode).toBe("album");
      expect(task.albumCandidateCount).toBe(14);
      expect(task.playlistReferences).toHaveLength(1);
      expect(task.playlistReferences[0]?.chatId).toBe(chatId);

      // Planning stops at "review": the author's reading is shown before any audio.
      const paused = await waitForTask(baseUrl, task.id, (candidate) => candidate.status === "review") as {
        status: string; playlistPlanApproved: boolean; albumTracks: unknown[];
        albumPlan: { albumTitle: string };
        playlistBriefing: { intentReading: string; referenceReadings: Array<{ title: string }> };
      };
      expect(paused.playlistPlanApproved).toBe(false);
      expect(paused.albumPlan.albumTitle).toBe("Night Set");
      expect(paused.albumTracks).toHaveLength(14);
      expect(paused.playlistBriefing.intentReading).toContain("Late-night");
      expect(paused.playlistBriefing.referenceReadings).toHaveLength(1);

      const approve = await fetch(`${baseUrl}/api/tasks/${task.id}/plan/approve`, { method: "POST" });
      expect(approve.status).toBe(202);
      expect((await approve.json() as { playlistPlanApproved: boolean }).playlistPlanApproved).toBe(true);

      const finished = await waitForTask(baseUrl, task.id, (candidate) => candidate.status === "completed");
      expect(finished.status).toBe("completed");
    }, { prepare: prepareMoodMic, environment });
  });

  it("revises a paused playlist plan from a follow-up message", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const created = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "深夜专注", candidateCount: 14, targetTotalMinutes: 35, referenceChatIds: [chatId] }),
      }).then((response) => response.json()) as { id: string };
      await waitForTask(baseUrl, created.id, (candidate) => candidate.status === "review");

      const response = await fetch(`${baseUrl}/api/tasks/${created.id}/plan/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "整体再安静一点" }),
      });
      expect(response.status).toBe(200);
      const updated = await response.json() as {
        status: string; playlistPlanApproved: boolean;
        albumPlan: { albumTitle: string };
        playlistDiscussion: Array<{ role: string; content: string }>;
      };
      expect(updated.status).toBe("review");
      expect(updated.playlistPlanApproved).toBe(false);
      expect(updated.albumPlan.albumTitle).toBe("Night Set (revised)");
      expect(updated.playlistDiscussion).toHaveLength(2);
      expect(updated.playlistDiscussion[0]?.role).toBe("user");
      expect(updated.playlistDiscussion[1]?.content).toContain("softened");

      // The plan can no longer be revised once confirmed.
      await fetch(`${baseUrl}/api/tasks/${created.id}/plan/approve`, { method: "POST" });
      const afterApprove = await fetch(`${baseUrl}/api/tasks/${created.id}/plan/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "再改一次" }),
      });
      expect(afterApprove.status).toBe(409);
      // Confirming starts generation in the background; let it settle so the
      // server and its output directory are not torn down mid-write.
      await waitForTask(baseUrl, created.id, (candidate) => candidate.status === "completed" || candidate.status === "failed");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }, { prepare: prepareMoodMic, environment });
  });

  it("rejects a request without a theme or with an unknown reference", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const noTheme = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "  ", referenceChatIds: [chatId] }),
      });
      expect(noTheme.status).toBe(400);

      const badReference = await fetch(`${baseUrl}/api/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "A playlist", referenceChatIds: ["99999999-9999-4999-8999-999999999999"] }),
      });
      expect(badReference.status).toBe(400);
    }, { prepare: prepareMoodMic, environment });
  });
});
