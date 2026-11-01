import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MAX_GENERATION_ATTEMPTS,
  GenerationFailure,
  dispatchGeneration,
} from "../src/web/generation.js";
import { TaskStore } from "../src/web/task-store.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function storeWithTask(): Promise<{ store: TaskStore; id: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "arioso-retry-"));
  roots.push(root);
  const directory = path.join(root, "tasks");
  const id = "retry-task";
  const taskDirectory = path.join(directory, "01-general", id);
  await mkdir(taskDirectory, { recursive: true });
  await writeFile(path.join(taskDirectory, "task.json"), JSON.stringify({
    id,
    description: "A quiet piece",
    mode: "compose",
    vocalMode: "instrumental",
    corpusMode: "none",
    compositionMode: "single",
    workflowType: "01-general",
    status: "generating",
    composerModel: "gpt-6-sol",
    lyriaModel: "lyria-3.5",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));
  const store = new TaskStore(directory);
  await store.initialize({ markInterrupted: false });
  return { store, id };
}

/** A provider that fails `failures` times, then returns audio. */
function provider(failures: number, status = 500) {
  let calls = 0;
  let currentTask: ReturnType<TaskStore["get"]>;
  const seenBeforeCall: Array<{ failedAttempt: number; maxAttempts: number } | undefined> = [];
  const generate = async () => {
    calls += 1;
    const attempting = currentTask?.generationRetry;
    seenBeforeCall.push(attempting ? { ...attempting } : undefined);
    if (calls <= failures) {
      const error = new Error(`provider unavailable ${calls}`) as Error & { status: number };
      error.status = status;
      throw error;
    }
    return { audio: Buffer.from("audio"), generatedText: null };
  };
  return {
    generate,
    calls: () => calls,
    seenBeforeCall,
    watch(store: TaskStore, id: string) {
      currentTask = store.get(id);
      return {
        refresh() { currentTask = store.get(id); },
      };
    },
  };
}

describe("generation retries", () => {
  it("retries a failed dispatch and records the retry while it runs", async () => {
    const { store, id } = await storeWithTask();
    const p = provider(1);
    const tracked = p.watch(store, id);

    const result = await dispatchGeneration(store, store.get(id)!, {
      purpose: "generate",
      model: "lyria-3.5",
      prompt: "a quiet piece",
      apiKey: "test",
      timeoutMs: 5000,
      retryDelaysMs: [0, 0],
      generate: async () => {
        tracked.refresh();
        return p.generate();
      },
    });

    expect(p.calls()).toBe(2);
    expect(result.audio.toString()).toBe("audio");
    expect(p.seenBeforeCall[0]).toBeUndefined();
    expect(p.seenBeforeCall[1]).toMatchObject({ failedAttempt: 1, maxAttempts: MAX_GENERATION_ATTEMPTS });
    expect(store.get(id)?.generationRetry).toBeUndefined();
    expect(store.get(id)?.generationAttempts?.map((attempt) => attempt.outcome))
      .toEqual(["unknown", "completed"]);
  });

  it("gives up after the third dispatch and clears the retry note", async () => {
    const { store, id } = await storeWithTask();
    const p = provider(Number.POSITIVE_INFINITY);

    await expect(dispatchGeneration(store, store.get(id)!, {
      purpose: "generate",
      model: "lyria-3.5",
      prompt: "a quiet piece",
      apiKey: "test",
      timeoutMs: 5000,
      retryDelaysMs: [0, 0],
      generate: p.generate,
    })).rejects.toBeInstanceOf(GenerationFailure);

    expect(p.calls()).toBe(MAX_GENERATION_ATTEMPTS);
    expect(store.get(id)?.generationRetry).toBeUndefined();
    expect(store.get(id)?.generationAttempts?.length).toBe(MAX_GENERATION_ATTEMPTS);
  });

  it("does not retry a rejected credential", async () => {
    const { store, id } = await storeWithTask();
    const p = provider(Number.POSITIVE_INFINITY, 401);

    await expect(dispatchGeneration(store, store.get(id)!, {
      purpose: "generate",
      model: "lyria-3.5",
      prompt: "a quiet piece",
      apiKey: "test",
      timeoutMs: 5000,
      retryDelaysMs: [0, 0],
      generate: p.generate,
    })).rejects.toBeInstanceOf(GenerationFailure);

    expect(p.calls()).toBe(1);
    expect(store.get(id)?.generationRetry).toBeUndefined();
  });
});
