import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMoodMicGeneration } from "../src/moodmic/moodmic-graph.js";
import type { MusicReview, MusicReviewer } from "../src/moodmic/music-review.js";
import { MusicSpecSchema, type MusicSpec } from "../src/schema/music-spec.js";
import { TaskStore, type MusicTask } from "../src/web/task-store.js";

const config = {
  openAiApiKey: "test",
  openAiModel: "test",
  geminiApiKey: "test",
  geminiReviewModel: "test-review-model",
  lyriaModel: "lyria-3.5",
  outputDirectory: "unused",
};

const spec: MusicSpec = MusicSpecSchema.parse({
  schemaVersion: "1.0",
  title: "Quiet Night",
  intent: "A calm night piece.",
  genres: ["ambient"],
  moods: ["calm"],
  tempo: { bpm: 60, feel: "slow" },
  tonality: { tonic: "C", mode: "major" },
  meter: "4/4",
  instrumentation: [{ name: "Piano", role: "lead", timbre: "warm" }],
  structure: [{ section: "Intro", durationSeconds: 20, direction: "soft" }],
  vocals: { enabled: false, language: null, style: null, lyricalTheme: null },
  production: "spacious",
  avoid: [],
  assumptions: [],
  lyriaPrompt: "slow calm ambient piano, instrumental only, no vocals",
});

const matchReview: MusicReview = {
  verdict: "match",
  summary: "Broadly delivers the calm instrumental request.",
  matchedPoints: ["calm", "instrumental"],
  mismatchedPoints: [],
};

const mismatchReview: MusicReview = {
  verdict: "mismatch",
  summary: "The mood is far too aggressive.",
  matchedPoints: [],
  mismatchedPoints: ["fast and loud", "adds vocals"],
};

function reviewerReturning(review: MusicReview): MusicReviewer {
  return { review: vi.fn(async () => review) };
}

describe("MoodMic generation check graph", () => {
  let directory: string;
  let store: TaskStore;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "arioso-moodmic-review-"));
    store = new TaskStore(path.join(directory, "tasks"));
    await store.initialize();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function createMoodMicTask(): Promise<MusicTask> {
    const task = await store.create({
      description: "A calm slow ambient piano piece, instrumental",
      mode: "generate",
      vocalMode: "instrumental",
      corpusMode: "none",
      compositionMode: "single",
      workflowType: "01-general",
      moodChatId: "chat-1",
    }, config);
    return store.update(task.id, { musicSpec: spec });
  }

  function generateStub() {
    return vi.fn(async () => ({ audio: Buffer.from([0xff, 0xfb, 0x00, 0x10]), generatedText: null }));
  }

  it("delivers the piece when the reviewer reports a match", async () => {
    const task = await createMoodMicTask();
    const generate = generateStub();

    const result = await runMoodMicGeneration(store, task, config, {
      generate,
      reviewer: reviewerReturning(matchReview),
    });

    const saved = store.get(task.id)!;
    expect(result.verdict).toBe("match");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(saved.status).toBe("completed");
    expect(saved.audioFile).toBeTruthy();
    expect(saved.musicReview).toMatchObject({
      verdict: "match",
      model: "test-review-model",
      attempt: 1,
    });
  });

  it("holds the piece in the review state when the reviewer reports a mismatch", async () => {
    const task = await createMoodMicTask();

    const result = await runMoodMicGeneration(store, task, config, {
      generate: generateStub(),
      reviewer: reviewerReturning(mismatchReview),
    });

    const saved = store.get(task.id)!;
    expect(result.verdict).toBe("mismatch");
    expect(saved.status).toBe("review");
    expect(saved.audioFile).toBeTruthy();
    expect(saved.reviewAttempt).toBe(1);
    expect(saved.musicReview?.mismatchedPoints).toEqual(["fast and loud", "adds vocals"]);
  });

  it("regenerates and re-reviews when a later attempt matches", async () => {
    const task = await createMoodMicTask();
    const generate = generateStub();

    await runMoodMicGeneration(store, task, config, {
      generate,
      reviewer: reviewerReturning(mismatchReview),
    });
    expect(store.get(task.id)!.status).toBe("review");

    const second = await runMoodMicGeneration(store, store.get(task.id)!, config, {
      generate,
      reviewer: reviewerReturning(matchReview),
    });

    const saved = store.get(task.id)!;
    expect(second.attempt).toBe(2);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(saved.status).toBe("completed");
    expect(saved.reviewAttempt).toBe(2);
    expect(saved.musicReview?.verdict).toBe("match");
  });

  it("delivers the piece when the reviewer is unavailable", async () => {
    const task = await createMoodMicTask();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await runMoodMicGeneration(store, task, config, {
        generate: generateStub(),
        reviewer: { review: vi.fn(async () => { throw new Error("reviewer offline"); }) },
      });
      const saved = store.get(task.id)!;
      expect(result.verdict).toBe("match");
      expect(saved.status).toBe("completed");
      expect(saved.musicReview?.summary).toContain("自动检查未能完成");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
