import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyRequestFailure,
  recordGenerationAttempt,
  type GenerationAttempt,
} from "../src/utils/attempts.js";
import { dispatchGeneration, GenerationFailure } from "../src/web/generation.js";
import { TaskStore } from "../src/web/task-store.js";
import { withWebServer } from "./helpers/web-server.js";

const { generateMock } = vi.hoisted(() => ({ generateMock: vi.fn() }));

vi.mock("../src/lyria/lyria-client.js", () => ({
  LyriaClient: class { generate = generateMock; },
}));

const roots: string[] = [];

beforeEach(() => {
  generateMock.mockReset();
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryStore(): Promise<{ store: InstanceType<typeof TaskStore>; task: { id: string } }> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-generation-policy-"));
  roots.push(root);
  const store = new TaskStore(path.join(root, "tasks"));
  await store.initialize();
  const task = await store.create({
    description: "A calm piano piece",
    mode: "generate",
    vocalMode: "instrumental",
    corpusMode: "none",
    compositionMode: "single",
    workflowType: "01-general",
  }, { openAiModel: "composer", lyriaModel: "lyria-3.5" } as never);
  return { store, task };
}

function dispatch(
  store: InstanceType<typeof TaskStore>,
  task: { id: string },
  timeoutMs = 2_000,
) {
  return dispatchGeneration(store, store.get(task.id)!, {
    purpose: "generate",
    model: "lyria-3.5",
    prompt: "slow calm piano",
    apiKey: "test-key",
    timeoutMs,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveFn) => { resolve = resolveFn; });
  return { promise, resolve };
}

describe("request failure classification", () => {
  it("separates invalid input, authentication, storage, rejection, and unknown outcomes", () => {
    expect(classifyRequestFailure({ status: 400 })).toBe("invalid-input");
    expect(classifyRequestFailure({ status: 401 })).toBe("auth");
    expect(classifyRequestFailure(Object.assign(new Error("disk"), { code: "ENOSPC" }))).toBe("storage");
    expect(classifyRequestFailure({ status: 404 })).toBe("rejected");
    // A timeout or a dropped connection may have reached the model.
    expect(classifyRequestFailure(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }))).toBe("unknown");
    expect(classifyRequestFailure({ status: 503 })).toBe("unknown");
    expect(classifyRequestFailure(new Error("socket hang up"))).toBe("unknown");
  });

  it("keeps only the newest attempt records", () => {
    const attempts: GenerationAttempt[] = Array.from({ length: 11 }, (_, index) => ({
      id: String(index), purpose: "generate", model: "lyria-3.5",
      requestRef: String(index), startedAt: "2026-01-01T00:00:00.000Z",
    }));
    expect(recordGenerationAttempt(attempts, attempts[0]!).length).toBeLessThanOrEqual(10);
  });
});

describe("paid generation dispatch", () => {
  it("bounds a hung provider and records the unknown outcome", async () => {
    const { store, task } = await temporaryStore();
    generateMock.mockImplementation(() => new Promise(() => undefined));

    await expect(dispatch(store, task, 120)).rejects.toBeInstanceOf(GenerationFailure);
    expect(generateMock).toHaveBeenCalledTimes(1);

    const record = store.get(task.id);
    expect(record?.generationAttempts).toHaveLength(1);
    expect(record?.generationAttempts?.[0]).toMatchObject({
      purpose: "generate", model: "lyria-3.5", outcome: "unknown",
    });
    expect(record?.generationAttempts?.[0]?.requestRef).toMatch(/^[a-f0-9]{16}$/u);
    expect(record?.generationAttemptId).toBe(record?.generationAttempts?.[0]?.id);
  });

  it("never repeats a generation whose remote outcome is unknown", async () => {
    const { store, task } = await temporaryStore();
    generateMock.mockImplementation(() => Promise.reject(
      Object.assign(new Error("socket hang up after upload"), { code: "ECONNRESET" }),
    ));

    const failure = await dispatch(store, task).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GenerationFailure);
    expect((failure as GenerationFailure).kind).toBe("unknown");
    expect((failure as Error).message).toContain("remote outcome is unknown");
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(store.get(task.id)?.generationAttempts?.[0]?.outcome).toBe("unknown");
  });

  it("reports a definite rejection without claiming an unknown outcome", async () => {
    const { store, task } = await temporaryStore();
    generateMock.mockImplementation(() => Promise.reject(
      Object.assign(new Error("Unsupported prompt field."), { status: 400 }),
    ));

    const failure = await dispatch(store, task).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GenerationFailure);
    expect((failure as GenerationFailure).kind).toBe("invalid-input");
    expect((failure as Error).message).not.toContain("remote outcome is unknown");
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(store.get(task.id)?.generationAttempts?.[0]?.outcome).toBe("rejected");
  });

  it("discards a late result that a newer attempt replaced", async () => {
    const { store, task } = await temporaryStore();
    const first = deferred<{ audio: Buffer; generatedText: string | null }>();
    const second = deferred<{ audio: Buffer; generatedText: string | null }>();
    generateMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const firstRun = dispatch(store, task);
    const secondRun = dispatch(store, task);
    second.resolve({ audio: Buffer.from([2]), generatedText: "second" });
    const secondResult = await secondRun;
    first.resolve({ audio: Buffer.from([1]), generatedText: "first" });

    const failure = await firstRun.catch((error: unknown) => error);
    expect((failure as Error).message).toContain("replaced this one");
    const record = store.get(task.id);
    expect(record?.generationAttemptId).toBe(secondResult.attemptId);
    expect(record?.generationAttempts?.find((attempt) => attempt.id === secondResult.attemptId)?.outcome)
      .toBe("completed");
    expect(record?.generationAttempts?.find((attempt) => attempt.id !== secondResult.attemptId)?.outcome)
      .toBe("cancelled");
  });

  it("leaves the store usable after a deadline failure", async () => {
    const { store, task } = await temporaryStore();
    generateMock.mockImplementationOnce(() => new Promise(() => undefined));
    await expect(dispatch(store, task, 100)).rejects.toBeInstanceOf(GenerationFailure);

    generateMock.mockImplementationOnce(async () => ({ audio: Buffer.from([9]), generatedText: null }));
    await expect(dispatch(store, task)).resolves.toMatchObject({ generatedText: null });
    expect(store.get(task.id)?.generationAttempts?.at(-1)?.outcome).toBe("completed");
  });
});

describe("generation deadlines in the web flow", () => {
  it("fails a hung generation within its deadline and releases the task", async () => {
    await withWebServer(async ({ baseUrl }) => {
      generateMock.mockImplementation(() => new Promise(() => undefined));
      const approved = await fetch(`${baseUrl}/api/tasks/hung-task/prompt/approve`, { method: "POST" });
      expect(approved.status).toBe(202);

      let failed: { status: string; error?: string; generationAttempts?: GenerationAttempt[] } | undefined;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        failed = await fetch(`${baseUrl}/api/tasks/hung-task`)
          .then((response) => response.json()) as typeof failed;
        if (failed?.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(failed?.status).toBe("failed");
      expect(failed?.error).toMatch(/deadline/u);
      expect(failed?.error).toContain("remote outcome is unknown");
      expect(failed?.generationAttempts?.[0]?.outcome).toBe("unknown");

      // The reservation is released, so an explicit retry is admitted.
      const retried = await fetch(`${baseUrl}/api/tasks/hung-task/retry`, { method: "POST" });
      expect(retried.status).toBe(202);
    }, {
      environment: {
        OPENAI_API_KEY: "test-openai",
        GEMINI_API_KEY: "test-gemini",
        ARIOSO_GENERATE_TIMEOUT_MS: "150",
      },
      prepare: async (root) => {
        const directory = path.join(root, "outputs", "tasks", "01-general", "hung-task");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "task.json"), JSON.stringify({
          id: "hung-task", description: "A calm slow ambient piano piece", title: "Calm piece",
          mode: "generate", status: "planning", workflowType: "01-general",
          moodChatId: "chat-1", composerModel: "test", lyriaModel: "lyria-3.5",
          updatedAt: "2026-01-02T00:00:00.000Z",
          musicSpec: {
            schemaVersion: "1.0", title: "Calm piece", intent: "A quiet night piece.",
            genres: ["ambient"], moods: ["calm"],
            tempo: { bpm: 60, feel: "slow" }, tonality: { tonic: "C", mode: "major" }, meter: "4/4",
            instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
            structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
            vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
            production: "spacious", avoid: [], assumptions: [],
            lyriaPrompt: "slow calm ambient piano, instrumental only, no vocals",
          },
        }));
      },
    });
  });
});
