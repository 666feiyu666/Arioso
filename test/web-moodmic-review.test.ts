import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const { generateMock, reviewMock } = vi.hoisted(() => ({ generateMock: vi.fn(), reviewMock: vi.fn() }));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

vi.mock("../src/moodmic/music-review.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/moodmic/music-review.js")>();
  return { ...actual, GeminiMusicReviewer: class { review = reviewMock; } };
});

beforeEach(() => {
  generateMock.mockReset().mockResolvedValue({ audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null });
  reviewMock.mockReset().mockResolvedValue({
    verdict: "match", summary: "Matches the request.", matchedPoints: [], mismatchedPoints: [],
  });
});

interface TaskShape {
  id: string;
  status: string;
  reviewAttempt?: number;
}

async function readTask(baseUrl: string, id: string): Promise<TaskShape> {
  return fetch(`${baseUrl}/api/tasks/${id}`).then((response) => response.json() as Promise<TaskShape>);
}

async function waitForTask(
  baseUrl: string,
  id: string,
  predicate: (task: TaskShape) => boolean,
): Promise<TaskShape> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const task = await readTask(baseUrl, id);
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task ${id} did not reach the expected state.`);
}

async function prepareTask(root: string, id: string, overrides: Record<string, unknown> = {}): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "01-general", id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    id, description: "A calm slow ambient piano piece", title: "Calm piece",
    mode: "generate", status: "review", workflowType: "01-general",
    moodChatId: "chat-1", reviewAttempt: 1,
    updatedAt: "2026-01-01T00:00:00.000Z", audioFile: "piece.mp3",
    composerModel: "test", lyriaModel: "lyria-3.5",
    musicSpec: {
      schemaVersion: "1.0", title: "Calm piece", intent: "A calm night piece.",
      genres: ["ambient"], moods: ["calm"],
      tempo: { bpm: 60, feel: "slow" }, tonality: { tonic: "C", mode: "major" }, meter: "4/4",
      instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
      structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
      vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
      production: "spacious", avoid: [], assumptions: [],
      lyriaPrompt: "slow calm ambient piano, instrumental only, no vocals",
    },
    musicReview: {
      verdict: "mismatch", summary: "The mood is far too aggressive.",
      matchedPoints: [], mismatchedPoints: ["fast and loud"],
      model: "test", attempt: 1, reviewedAt: "2026-01-01T00:00:00.000Z", audioFile: "piece.mp3",
    },
    ...overrides,
  }));
  await writeFile(path.join(directory, "piece.mp3"), Buffer.from([0, 1, 2, 3]));
}

function postDecision(baseUrl: string, id: string, body: unknown) {
  return fetch(`${baseUrl}/api/tasks/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const environment = { OPENAI_API_KEY: "test-local", GEMINI_API_KEY: "test-local" };

describe("MoodMic review decision endpoint", () => {
  it("delivers the current audio when the user keeps it", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await postDecision(baseUrl, "keep-task", { decision: "keep" });
      expect(response.status).toBe(200);
      const task = await response.json() as TaskShape;
      expect(task.status).toBe("completed");
      expect((await readTask(baseUrl, "keep-task")).status).toBe("completed");
    }, { prepare: (root) => prepareTask(root, "keep-task"), environment });
  });

  it("regenerates and re-reviews when the user asks for a new attempt", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await postDecision(baseUrl, "regen-task", { decision: "regenerate" });
      expect(response.status).toBe(202);
      expect((await response.json() as TaskShape).status).toBe("queued");
      const final = await waitForTask(baseUrl, "regen-task", (task) => task.status === "completed");
      expect(final.reviewAttempt).toBe(2);
      expect(generateMock).toHaveBeenCalledTimes(1);
      expect(reviewMock).toHaveBeenCalledTimes(1);
    }, { prepare: (root) => prepareTask(root, "regen-task"), environment });
  });

  it("rejects an unsupported decision", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await postDecision(baseUrl, "keep-task", { decision: "maybe" });
      expect(response.status).toBe(400);
    }, { prepare: (root) => prepareTask(root, "keep-task"), environment });
  });

  it("refuses a task that is not awaiting a decision", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await postDecision(baseUrl, "done-task", { decision: "keep" });
      expect(response.status).toBe(409);
    }, { prepare: (root) => prepareTask(root, "done-task", { status: "completed" }), environment });
  });

  it("does not expose the check for non-MoodMic tasks", async () => {
    await withWebServer(async ({ baseUrl }) => {
      const response = await postDecision(baseUrl, "studio-task", { decision: "keep" });
      expect(response.status).toBe(404);
    }, { prepare: (root) => prepareTask(root, "studio-task", { moodChatId: undefined }), environment });
  });
});
