import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AlbumPlanSchema } from "../src/schema/album-plan.js";
import type { MusicSpec } from "../src/schema/music-spec.js";
import { runAlbumTask } from "../src/web/server.js";
import { TaskStore, type MusicTask } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock, planMock, composeMock, reviewMock, reviseMock } = vi.hoisted(() => ({
  generateMock: vi.fn(), planMock: vi.fn(), composeMock: vi.fn(), reviewMock: vi.fn(), reviseMock: vi.fn(),
}));
vi.mock("../src/composer/album-agent.js", () => ({
  planAlbum: planMock, composeAlbumTrack: composeMock,
  reviewAlbumCandidates: reviewMock, reviseAlbumTrack: reviseMock,
}));
vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));
beforeEach(() => {
  for (const mock of [generateMock, planMock, composeMock, reviewMock, reviseMock]) mock.mockReset();
});

const plan = AlbumPlanSchema.parse({
  albumTitle: "Late Night Noir", albumMind: "Quiet nighttime jazz with open space.",
  cohesionStrategy: "Rotate ensemble and rhythmic feel across independent pieces.",
  sharedSoundContract: "Instrumental, restrained dynamics and a close acoustic recording.",
  tracks: Array.from({ length: 14 }, (_, index) => ({
    number: index + 1, title: `Candidate ${index + 1}`, musicalRole: "A quiet nocturne.",
    instruments: ["piano", "double bass"], groove: "Gentle slow swing",
    harmony: "Extended minor harmony", development: "Introduction, theme, variation, quiet ending.",
    targetSeconds: 140 + (index % 3) * 10,
  })),
});

function spec(number: number): MusicSpec {
  return {
    schemaVersion: "1.0", title: `Candidate ${number}`, intent: "Quiet evening jazz",
    genres: ["jazz"], moods: ["relaxed"], tempo: { bpm: 70, feel: "Gentle swing" },
    tonality: { tonic: null, mode: "minor" }, meter: "4/4",
    instrumentation: [{ name: "piano", role: "Melody", timbre: "Warm acoustic tone" }],
    structure: [{ section: "Theme", durationSeconds: 150, direction: "Spacious phrasing" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "Close and warm", avoid: ["vocals"], assumptions: [], lyriaPrompt: `prompt ${number}`,
  };
}

function album(overrides: Partial<MusicTask> = {}): MusicTask {
  const now = "2026-10-04T00:00:00.000Z";
  return {
    id: "album-task", description: "Late night noir jazz for relaxation, instrumental.",
    title: plan.albumTitle, mode: "generate", vocalMode: "instrumental", corpusMode: "none",
    compositionMode: "album", workflowType: "04-album", status: "completed",
    composerModel: "test", lyriaModel: "lyria-3.5", createdAt: now, updatedAt: now,
    albumPlan: plan, albumPromptsReady: true, albumPlaylist: [],
    albumTracks: plan.tracks.map((outline) => ({
      id: `track-${outline.number}`, order: outline.number, title: outline.title,
      targetDurationSeconds: outline.targetSeconds, musicSpec: spec(outline.number),
      status: "completed", admission: "candidate", createdAt: now, updatedAt: now,
      audioFile: `track-${outline.number}.mp3`, durationSeconds: outline.targetSeconds,
    })),
    ...overrides,
  };
}

async function prepareAlbum(root: string, task = album()): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "04-album", task.id);
  await mkdir(path.join(directory, "tracks"), { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify(task));
  for (const track of task.albumTracks ?? []) {
    if (!track.audioFile || track.audioFile.includes("/")) continue;
    await writeFile(path.join(directory, "tracks", track.audioFile), Buffer.from([0, 1, 2, 3, 4, 5]));
  }
}

async function taskResponse(response: Response): Promise<MusicTask> {
  return await response.json() as MusicTask;
}

describe("album selection and playback persistence", () => {
  it("keeps candidates separate, persists inclusion and playlist order, and rejects invalid orders", async () => {
    await withWebServer(async ({ root, baseUrl }) => {
      const patch = (id: number, admission: string) => fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-${id}`, {
        method: "PATCH", body: JSON.stringify({ admission }),
      });
      expect((await fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse)).albumPlaylist).toEqual([]);
      for (const number of [1, 2]) expect((await patch(number, "included")).status).toBe(200);
      const url = `${baseUrl}/api/tasks/album-task/album/playlist`;
      for (const trackIds of [["track-1"], ["track-1", "track-1"], ["track-1", "track-3"]]) {
        expect((await fetch(url, { method: "PUT", body: JSON.stringify({ trackIds }) })).status).toBe(400);
      }
      const ordered = await fetch(url, { method: "PUT", body: JSON.stringify({ trackIds: ["track-2", "track-1"] }) });
      expect(ordered.status).toBe(200);
      expect((await taskResponse(ordered)).albumPlaylist).toEqual(["track-2", "track-1"]);
      expect((await patch(2, "included")).status).toBe(200);
      const store = new TaskStore(path.join(root, "outputs", "tasks"));
      await store.initialize();
      expect(store.get("album-task")?.compositionMode).toBe("album");
      expect(store.get("album-task")?.albumPlaylist).toEqual(["track-2", "track-1"]);
      expect((await patch(2, "excluded")).status).toBe(200);
      const saved = JSON.parse(await readFile(path.join(root, "outputs", "tasks", "04-album", "album-task", "task.json"), "utf8"));
      expect(saved.albumPlaylist).toEqual(["track-1"]);
      expect(saved.albumTracks[1].admission).toBe("excluded");
      expect((await patch(3, "automatic")).status).toBe(400);
    }, { prepare: prepareAlbum });
  });

  it("rejects inclusion before a candidate has completed audio", async () => {
    const task = album();
    task.albumTracks![0]!.status = "failed";
    delete task.albumTracks![0]!.audioFile;
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-1`, {
        method: "PATCH", body: JSON.stringify({ admission: "included" }),
      });
      expect(response.status).toBe(400);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });

  it("streams candidate audio with ranges and HEAD and refuses a path outside its task", async () => {
    const task = album();
    task.albumTracks![1]!.audioFile = "../settings.json";
    await withWebServer(async ({ baseUrl }) => {
      const url = `${baseUrl}/api/tasks/album-task/album/tracks/track-1/audio`;
      const range = await fetch(url, { headers: { Range: "bytes=2-4" } });
      expect(range.status).toBe(206);
      expect(range.headers.get("content-range")).toBe("bytes 2-4/6");
      expect(Buffer.from(await range.arrayBuffer())).toEqual(Buffer.from([2, 3, 4]));
      const head = await fetch(url, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(head.headers.get("content-length")).toBe("6");
      expect(await head.text()).toBe("");
      expect((await fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-2/audio`)).status).toBe(404);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });
});

describe("album generation continuation", () => {
  it("continues the entire batch when a single candidate is retried before prompt preparation finishes", async () => {
    const task = album({ status: "failed", albumPromptsReady: false });
    for (const track of task.albumTracks!) {
      track.status = "failed";
      delete track.audioFile;
    }
    delete task.albumTracks![3]!.musicSpec;
    composeMock.mockResolvedValue(spec(4));
    reviewMock.mockResolvedValue({
      verdict: "ready", albumFindings: [], similarities: [],
      candidates: plan.tracks.map((track) => ({
        number: track.number, verdict: "ready", evidence: ["Independent design"], revisionBrief: null,
      })),
    });
    generateMock.mockResolvedValue({ audio: Buffer.from([1, 2, 3]), generatedText: null });
    await withWebServer(async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-4/retry`, { method: "POST" });
      expect(response.status).toBe(202);
      await response.json();
      await vi.waitFor(async () => {
        const latest = await fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse);
        expect(latest.status).toBe("completed");
        expect(latest.albumTracks?.every((track) => track.status === "completed" && track.audioFile)).toBe(true);
      });
      expect(composeMock).toHaveBeenCalledTimes(1);
      expect(reviewMock).toHaveBeenCalledTimes(2);
      expect(generateMock).toHaveBeenCalledTimes(14);
    }, {
      prepare: (root) => prepareAlbum(root, task),
      environment: { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" },
    });
  });

  it("makes no model requests when a prepared album is already complete", async () => {
    await withWebServer(async ({ root }) => {
      const store = new TaskStore(path.join(root, "outputs", "tasks"));
      await store.initialize({ markInterrupted: false });
      const task = store.get("album-task")!;
      await runAlbumTask(store, task, {
        openAiApiKey: "test-local", openAiModel: "test", geminiApiKey: "test-local",
        lyriaModel: "lyria-3.5", outputDirectory: path.join(root, "outputs"),
      });
      for (const mock of [generateMock, planMock, composeMock, reviewMock, reviseMock]) {
        expect(mock).not.toHaveBeenCalled();
      }
      expect(store.get(task.id)?.updatedAt).toBe(task.updatedAt);
    }, { prepare: prepareAlbum });
  });

  it("resumes saved prompt revisions without repeating them and preserves concurrent human exclusion", async () => {
    const task = album({ mode: "compose", status: "failed", albumPromptsReady: false });
    for (const track of task.albumTracks!) {
      track.status = "failed";
      delete track.audioFile;
    }
    delete task.albumTracks![3]!.musicSpec;
    const readyReview = {
      verdict: "ready", albumFindings: [], similarities: [],
      candidates: plan.tracks.map((track) => ({ number: track.number, verdict: "ready", evidence: ["Independent design"], revisionBrief: null })),
    };
    const initialReview = {
      ...readyReview, verdict: "needs-work",
      candidates: readyReview.candidates.map((candidate) => candidate.number === 5
        ? { ...candidate, verdict: "needs-work", revisionBrief: "Give the bass a distinct lead role." } : candidate),
    };
    composeMock.mockResolvedValue(spec(4));
    reviewMock.mockResolvedValueOnce(initialReview)
      .mockRejectedValueOnce(new Error("Final review temporarily unavailable"))
      .mockResolvedValue(readyReview);
    let finishRevision: (() => void) | undefined;
    reviseMock.mockImplementation(() => new Promise((resolve) => {
      finishRevision = () => resolve({ ...spec(5), title: "Revised bass lead", lyriaPrompt: "Revised prompt" });
    }));
    await withWebServer(async ({ baseUrl }) => {
      const getTask = () => fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse);
      const retryUrl = `${baseUrl}/api/tasks/album-task/retry`;
      const first = await fetch(retryUrl, { method: "POST" });
      expect(first.status).toBe(202);
      await first.json();
      await vi.waitFor(() => expect(reviseMock).toHaveBeenCalledTimes(1));
      const exclusion = await fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-5`, {
        method: "PATCH", body: JSON.stringify({ admission: "excluded" }),
      });
      expect(exclusion.status).toBe(200);
      await exclusion.json();
      finishRevision!();
      await vi.waitFor(async () => expect((await getTask()).status).toBe("failed"));
      const checkpoint = await getTask();
      expect(checkpoint.albumRevisedTrackNumbers).toEqual([5]);
      expect(checkpoint.albumTracks![4]).toMatchObject({ admission: "excluded", title: "Revised bass lead" });
      const second = await fetch(retryUrl, { method: "POST" });
      expect(second.status).toBe(202);
      await second.json();
      await vi.waitFor(async () => expect((await getTask()).status).toBe("completed"));
      expect(planMock).not.toHaveBeenCalled();
      expect(composeMock).toHaveBeenCalledTimes(1);
      expect(reviseMock).toHaveBeenCalledTimes(1);
      expect(reviewMock).toHaveBeenCalledTimes(3);
      expect(generateMock).not.toHaveBeenCalled();
      expect((await getTask()).albumTracks![4]!.admission).toBe("excluded");
    }, {
      prepare: (root) => prepareAlbum(root, task),
      environment: { OPENAI_API_KEY: "test-local" },
    });
  });


  it("continues after a failed track, skips completed audio, then retries only the selected failure", async () => {
    const task = album({ status: "failed" });
    for (const index of [0, 1]) {
      task.albumTracks![index]!.status = "failed";
      delete task.albumTracks![index]!.audioFile;
    }
    generateMock.mockRejectedValueOnce(new Error("Invalid candidate request"))
      .mockResolvedValue({ audio: Buffer.from([1, 2, 3]), generatedText: null });
    await withWebServer(async ({ baseUrl }) => {
      const getTask = () => fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse);
      const response = await fetch(`${baseUrl}/api/tasks/album-task/retry`, { method: "POST" });
      expect(response.status).toBe(202);
      await response.json();
      await vi.waitFor(async () => {
        const latest = await getTask();
        expect(latest.status).toBe("failed");
        expect(latest.albumTracks!.slice(0, 2).map((track) => track.status)).toEqual(["failed", "completed"]);
      });
      expect(generateMock.mock.calls).toEqual([
        ["prompt 1", { model: "lyria-3.5" }], ["prompt 2", { model: "lyria-3.5" }],
      ]);
      const retry = await fetch(`${baseUrl}/api/tasks/album-task/album/tracks/track-1/retry`, { method: "POST" });
      expect(retry.status).toBe(202);
      await retry.json();
      await vi.waitFor(async () => expect((await getTask()).status).toBe("completed"));
      expect(generateMock).toHaveBeenCalledTimes(3);
      expect(generateMock.mock.calls[2]).toEqual(["prompt 1", { model: "lyria-3.5" }]);
      expect((await getTask()).albumPlaylist).toEqual([]);
    }, {
      prepare: (root) => prepareAlbum(root, task),
      environment: { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" },
    });
  });

  it("starts one generation for simultaneous candidate retries", async () => {
    const task = album({ status: "failed" });
    task.albumTracks![0]!.status = "failed";
    delete task.albumTracks![0]!.audioFile;
    let finish: (() => void) | undefined;
    generateMock.mockImplementation(() => new Promise((resolve) => {
      finish = () => resolve({ audio: Buffer.from([1, 2, 3]), generatedText: null });
    }));
    await withWebServer(async ({ baseUrl }) => {
      const url = `${baseUrl}/api/tasks/album-task/album/tracks/track-1/retry`;
      const replies = await Promise.all([fetch(url, { method: "POST" }), fetch(url, { method: "POST" })]);
      expect(replies.map((response) => response.status).sort()).toEqual([202, 409]);
      await Promise.all(replies.map((response) => response.json()));
      await vi.waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
      finish!();
      await vi.waitFor(async () => {
        const latest = await fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse);
        expect(latest.status).toBe("completed");
      });
    }, {
      prepare: (root) => prepareAlbum(root, task),
      environment: { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" },
    });
  });

  it("marks interrupted candidates failed on restart while retaining completed audio and inclusion", async () => {
    const task = album({ status: "generating", albumPlaylist: ["track-1"] });
    task.albumTracks![0]!.admission = "included";
    task.albumTracks![1]!.status = "generating";
    await withWebServer(async ({ baseUrl }) => {
      const latest = await fetch(`${baseUrl}/api/tasks/album-task`).then(taskResponse);
      expect(latest.status).toBe("failed");
      expect(latest.albumTracks![0]).toMatchObject({ status: "completed", audioFile: "track-1.mp3", admission: "included" });
      expect(latest.albumTracks![1]!.status).toBe("failed");
      expect(latest.albumPlaylist).toEqual(["track-1"]);
    }, { prepare: (root) => prepareAlbum(root, task) });
  });
});
