import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { withWebServer } from "./helpers/web-server.js";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

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

const environment = {
  OPENAI_API_KEY: "test-openai",
  GEMINI_API_KEY: "test-gemini",
  ARIOSO_GENERATE_TIMEOUT_MS: "150",
};
const chatId = "11111111-1111-4111-8111-111111111111";
const taskId = "moodmic-task";
const RUNNING = new Set(["queued", "composing", "generating", "assembling", "processing"]);

interface TaskShape {
  id: string;
  status: string;
  error?: string;
  audioFile?: string;
  generationAttemptId?: string;
  generationAttempts?: Array<{ id: string; outcome?: string }>;
}

interface GenerateOptions {
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => { resolve = resolveFn; });
  return { promise, resolve };
}

function musicSpec() {
  return {
    schemaVersion: "1.0", title: "Calm piece", intent: "A quiet night piece.",
    genres: ["ambient"], moods: ["calm"],
    tempo: { bpm: 60, feel: "slow" }, tonality: { tonic: "C", mode: "major" }, meter: "4/4",
    instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
    structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
    vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
    production: "spacious", avoid: [], assumptions: [],
    lyriaPrompt: "slow calm ambient piano, instrumental only, no vocals",
  };
}

async function prepare(root: string): Promise<void> {
  const directory = path.join(root, "outputs", "tasks", "01-general", taskId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "task.json"), JSON.stringify({
    id: taskId, description: "A calm slow ambient piano piece", title: "Calm piece",
    mode: "generate", status: "planning", workflowType: "01-general",
    moodChatId: chatId, composerModel: "test", lyriaModel: "lyria-3.5",
    updatedAt: "2026-01-02T00:00:00.000Z", musicSpec: musicSpec(),
  }));
}

async function readTask(baseUrl: string): Promise<TaskShape> {
  return fetch(`${baseUrl}/api/tasks/${taskId}`).then((response) => response.json() as Promise<TaskShape>);
}

async function waitForTask(
  baseUrl: string,
  predicate: (task: TaskShape) => boolean,
): Promise<TaskShape> {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const task = await readTask(baseUrl);
    if (predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The MoodMic task did not reach the expected state.");
}

async function waitForCalls(count: number): Promise<void> {
  for (let attempt = 0; attempt < 240 && generateMock.mock.calls.length < count; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(generateMock.mock.calls.length).toBe(count);
}

function approve(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/api/tasks/${taskId}/prompt/approve`, { method: "POST" });
}

beforeEach(() => {
  generateMock.mockReset();
});

describe("MoodMic generation dispatch options", () => {
  it("forwards the configured deadline and a live signal to the default client", async () => {
    const pending = deferred<{ audio: Buffer; generatedText: string | null }>();
    generateMock.mockImplementation(() => pending.promise);
    await withWebServer(async ({ baseUrl }) => {
      expect((await approve(baseUrl)).status).toBe(202);
      await waitForCalls(1);

      const options = generateMock.mock.calls[0]?.[1] as GenerateOptions;
      expect(generateMock.mock.calls[0]?.[0]).toBe("slow calm ambient piano, instrumental only, no vocals");
      expect(options.model).toBe("lyria-3.5");
      expect(options.timeoutMs).toBe(150);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      // The signal is active while the request is in flight…
      expect(options.signal?.aborted).toBe(false);

      // …and the deadline both ends the local wait and signals cancellation.
      const failed = await waitForTask(baseUrl, (task) => task.status === "failed");
      expect(options.signal?.aborted).toBe(true);
      expect(failed.error).toMatch(/deadline/u);
      expect(failed.generationAttempts?.[0]?.outcome).toBe("unknown");
      expect(generateMock).toHaveBeenCalledTimes(1);

      // The task is recoverable: the reservation was released.
      expect((await fetch(`${baseUrl}/api/tasks/${taskId}/retry`, { method: "POST" })).status).toBe(202);
      await waitForCalls(2);
      for (let attempt = 0; attempt < 240; attempt += 1) {
        const task = await readTask(baseUrl);
        if (!RUNNING.has(task.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }, { environment, prepare });
  });

  it("cannot let a late result replace a newer attempt or its audio", async () => {
    const first = deferred<{ audio: Buffer; generatedText: string | null }>();
    const second = deferred<{ audio: Buffer; generatedText: string | null }>();
    generateMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    await withWebServer(async ({ baseUrl }) => {
      expect((await approve(baseUrl)).status).toBe(202);
      await waitForCalls(1);

      // The first attempt times out and leaves an unknown outcome.
      const failed = await waitForTask(baseUrl, (task) => task.status === "failed");
      const firstAttemptId = failed.generationAttempts?.[0]?.id;
      expect(firstAttemptId).toBeDefined();

      // An explicit retry starts the replacement attempt.
      expect((await fetch(`${baseUrl}/api/tasks/${taskId}/retry`, { method: "POST" })).status).toBe(202);
      await waitForCalls(2);
      const secondAttemptId = (await readTask(baseUrl)).generationAttemptId;
      expect(secondAttemptId).not.toBe(firstAttemptId);

      // The old request finally answers: its result must be discarded.
      first.resolve({ audio: Buffer.from([1, 2, 3]), generatedText: "stale" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const afterLate = await readTask(baseUrl);
      expect(afterLate.audioFile).toBeUndefined();
      expect(afterLate.generationAttemptId).toBe(secondAttemptId);

      // The current attempt still completes normally.
      second.resolve({ audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: "current" });
      const completed = await waitForTask(baseUrl, (task) => task.status !== "failed" && !RUNNING.has(task.status));
      expect(completed.status).toBe("completed");
      expect(completed.audioFile).toBeDefined();
    }, { environment, prepare });
  });
});
