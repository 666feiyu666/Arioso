import { readFile } from "node:fs/promises";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type { AriosoConfig } from "../config/env.js";
import { timeoutsFor } from "../config/env.js";
import { withDeadline } from "../utils/attempts.js";
import { dispatchGeneration } from "../web/generation.js";
import { LyriaClient } from "../lyria/lyria-client.js";
import type { MusicSpec } from "../schema/music-spec.js";
import type { MusicTask, TaskStore } from "../web/task-store.js";
import {
  GeminiMusicReviewer,
  type MusicReview,
  type MusicReviewRecord,
  type MusicReviewer,
  type MusicReviewVerdict,
} from "./music-review.js";

const MoodMicReviewState = Annotation.Root({
  taskId: Annotation<string>,
  attempt: Annotation<number>,
  // The review node always runs before this channel is read; the initial
  // placeholder only keeps the channel defined for the routing edge.
  verdict: Annotation<MusicReviewVerdict>({
    reducer: (_previous, next) => next,
    default: () => "mismatch",
  }),
});

type MoodMicReviewStateValue = typeof MoodMicReviewState.State;

export interface GeneratedAudio {
  audio: Buffer;
  generatedText: string | null;
}

/** Dispatch controls the caller owns: the deadline and its cancellation signal. */
export interface GenerateDispatchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export type GraphGenerate = (
  spec: MusicSpec,
  model: string,
  options?: GenerateDispatchOptions,
) => Promise<GeneratedAudio>;

export interface MoodMicReviewGraphDeps {
  store: TaskStore;
  config: AriosoConfig;
  language?: "zh-CN" | "en";
  /**
   * Overridable for tests; defaults to the Lyria client. The optional third
   * argument carries the deadline and cancellation signal, so the default path
   * forwards them to the provider call.
   */
  generate?: GraphGenerate;
  /** Overridable for tests; defaults to the Gemini audio reviewer. */
  reviewer?: MusicReviewer;
}

function defaultGenerate(config: AriosoConfig): GraphGenerate {
  return async (spec: MusicSpec, model: string, options: GenerateDispatchOptions = {}): Promise<GeneratedAudio> => {
    const client = new LyriaClient(config.geminiApiKey ?? "");
    return client.generate(spec.lyriaPrompt, {
      model,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  };
}

function defaultReviewer(config: AriosoConfig): MusicReviewer {
  return new GeminiMusicReviewer(config.geminiApiKey ?? "", config.geminiReviewModel);
}

function requireTask(store: TaskStore, taskId: string): MusicTask {
  const task = store.get(taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  return task;
}

function unavailableReview(language: "zh-CN" | "en" | undefined): MusicReview {
  return {
    verdict: "match",
    summary: language === "en"
      ? "The automatic check could not run, so this piece was delivered as-is."
      : "自动检查未能完成，已按原样交付这首音乐。",
    matchedPoints: [],
    mismatchedPoints: [],
  };
}

/**
 * A LangGraph generation check for MoodMic: generate the audio, let Gemini
 * listen and compare it with the request, then either deliver it or pause the
 * task in the `review` state so the user can regenerate or keep the result.
 */
export function buildMoodMicReviewGraph(deps: MoodMicReviewGraphDeps) {
  const { store, config } = deps;
  const generate = deps.generate ?? defaultGenerate(config);
  const reviewer = deps.reviewer ?? defaultReviewer(config);
  const model = config.geminiReviewModel;
  const language = deps.language;

  const generateNode = async (state: MoodMicReviewStateValue) => {
    const task = requireTask(store, state.taskId);
    const spec = task.musicSpec;
    if (!spec) throw new Error("A composed music spec is required before generation.");
    await store.update(task.id, { status: "generating", error: undefined });
    // MoodMic dispatches through its own graph, so it records the same attempt
    // metadata and applies the same deadline and no-retry policy as Web/CLI.
    const generated = await dispatchGeneration(store, task, {
      purpose: "generate",
      model: task.lyriaModel,
      prompt: spec.lyriaPrompt,
      apiKey: config.geminiApiKey ?? "",
      timeoutMs: timeoutsFor(config).generateMs,
      generate: (_prompt, generateOptions) => generate(spec, task.lyriaModel, generateOptions),
    });
    const audioFile = await store.writeAudio(task, generated.audio);
    await store.update(task.id, {
      audioFile,
      generatedText: generated.generatedText,
      error: undefined,
    });
    return {};
  };

  const reviewNode = async (state: MoodMicReviewStateValue) => {
    const task = requireTask(store, state.taskId);
    const attempt = (task.reviewAttempt ?? 0) + 1;
    // Generation always receives the spec's prompt; once the user confirmed it,
    // that is the exact request the reviewer must judge the audio against.
    const confirmedPrompt = task.lyriaPromptApproved ? task.musicSpec?.lyriaPrompt : undefined;
    let review: MusicReview;
    try {
      const audioPath = store.audioPath(task);
      if (!audioPath) throw new Error("Generated audio is not available for review.");
      const audio = await readFile(audioPath);
      review = await withDeadline(
        () => reviewer.review({
          audio,
          description: task.description,
          ...(task.musicSpec ? { spec: task.musicSpec } : {}),
          ...(confirmedPrompt?.trim() ? { confirmedPrompt } : {}),
          ...(language ? { language } : {}),
        }),
        // A stalled review falls back to the documented as-is delivery rather
        // than holding the task open indefinitely.
        { timeoutMs: timeoutsFor(config).reviewMs, label: "music review" },
      );
    } catch (error) {
      console.error(`Music review unavailable for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      review = unavailableReview(language);
    }
    const record: MusicReviewRecord = {
      ...review,
      model,
      attempt,
      reviewedAt: new Date().toISOString(),
      ...(task.audioFile ? { audioFile: task.audioFile } : {}),
    };
    await store.update(task.id, { musicReview: record, reviewAttempt: attempt });
    return { attempt, verdict: review.verdict };
  };

  const deliverNode = async (state: MoodMicReviewStateValue) => {
    await store.update(state.taskId, { status: "completed", error: undefined });
    return {};
  };

  const holdNode = async (state: MoodMicReviewStateValue) => {
    await store.update(state.taskId, { status: "review", error: undefined });
    return {};
  };

  return new StateGraph(MoodMicReviewState)
    .addNode("generate", generateNode)
    .addNode("review", reviewNode)
    .addNode("deliver", deliverNode)
    .addNode("hold", holdNode)
    .addEdge(START, "generate")
    .addEdge("generate", "review")
    .addConditionalEdges("review", (state: MoodMicReviewStateValue) =>
      state.verdict === "match" ? "deliver" : "hold", {
      deliver: "deliver",
      hold: "hold",
    })
    .addEdge("deliver", END)
    .addEdge("hold", END)
    .compile();
}

export interface MoodMicGenerationResult {
  verdict: MusicReviewVerdict;
  attempt: number;
}

/** Run one MoodMic generation attempt: compose is already done, so generate then review. */
export async function runMoodMicGeneration(
  store: TaskStore,
  task: MusicTask,
  config: AriosoConfig,
  options: { language?: "zh-CN" | "en"; generate?: MoodMicReviewGraphDeps["generate"]; reviewer?: MusicReviewer } = {},
): Promise<MoodMicGenerationResult> {
  const graph = buildMoodMicReviewGraph({
    store,
    config,
    ...(options.language ? { language: options.language } : {}),
    ...(options.generate ? { generate: options.generate } : {}),
    ...(options.reviewer ? { reviewer: options.reviewer } : {}),
  });
  const result = await graph.invoke({
    taskId: task.id,
    attempt: task.reviewAttempt ?? 0,
    verdict: "mismatch",
  });
  return { verdict: result.verdict, attempt: result.attempt };
}
