import { LyriaClient } from "../lyria/lyria-client.js";
import type { MusicTask, TaskStore } from "./task-store.js";
import {
  classifyRequestFailure,
  requestReference,
  withDeadline,
  type FailureKind,
  type GenerationAttempt,
} from "../utils/attempts.js";

/** A provider failure together with the kind of outcome it leaves behind. */
export class GenerationFailure extends Error {
  constructor(readonly kind: FailureKind, message: string, readonly retryable = true) {
    super(kind === "unknown"
      ? `${message} The remote outcome is unknown: the audio may already have been generated. `
        + "The automatic retries stop here; start a new attempt only if you want another generation."
      : message);
    this.name = "GenerationFailure";
  }
}

export interface DispatchGenerationOptions {
  purpose: GenerationAttempt["purpose"];
  /**
   * The unit of work this dispatch renders, such as an album candidate id. One
   * task may have several dispatches in flight, and the key decides which
   * attempt owns the result. Defaults to the purpose.
   */
  attemptKey?: string;
  model: string;
  prompt: string;
  apiKey: string;
  timeoutMs: number;
  /**
   * Alternative provider call. MoodMic's generation graph supplies its own, so
   * both flows record the same attempts and share the same failure policy.
   */
  generate?: (
    prompt: string,
    options: { model: string; timeoutMs: number; signal: AbortSignal },
  ) => Promise<{ audio: Buffer; generatedText: string | null }>;
  /** Waits between dispatches; tests shorten them. */
  retryDelaysMs?: number[];
}

/** How many provider dispatches one generation may spend before it fails. */
export const MAX_GENERATION_ATTEMPTS = 3;

/** Waits between dispatches, so a transient provider fault can clear. */
const RETRY_DELAYS_MS = [1500, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rejecting the request itself cannot be fixed by sending it again. */
function isRetryable(failure: GenerationFailure): boolean {
  return failure.retryable && failure.kind !== "auth" && failure.kind !== "invalid-input";
}

/** Waits between dispatches; the environment shortens them for the test suite. */
function retryDelays(options: DispatchGenerationOptions): number[] {
  if (options.retryDelaysMs?.length) return options.retryDelaysMs;
  const configured = process.env.ARIOSO_GENERATION_RETRY_DELAYS_MS;
  if (configured !== undefined) {
    const parsed = configured.split(",").map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (parsed.length) return parsed;
  }
  return RETRY_DELAYS_MS;
}

/**
 * Dispatches a generation and, when the provider fails, tries again up to
 * `MAX_GENERATION_ATTEMPTS` times. While a retry is in flight the task carries
 * `generationRetry`, so the interface can say that the first attempt failed.
 *
 * Each dispatch is recorded separately and the newest one owns the result, so a
 * late return from a superseded attempt is discarded rather than written twice.
 */
export async function dispatchGeneration(
  store: TaskStore,
  task: MusicTask,
  options: DispatchGenerationOptions,
): Promise<{ audio: Buffer; generatedText: string | null; attemptId: string }> {
  let failure: GenerationFailure | undefined;
  for (let attemptNumber = 1; attemptNumber <= MAX_GENERATION_ATTEMPTS; attemptNumber += 1) {
    try {
      const result = await dispatchAttempt(store, task, options);
      await clearRetryNotice(store, task.id);
      return result;
    } catch (error) {
      if (!(error instanceof GenerationFailure)) throw error;
      failure = error;
      if (!isRetryable(error) || attemptNumber === MAX_GENERATION_ATTEMPTS) break;
      await store.update(task.id, {
        generationRetry: {
          failedAttempt: attemptNumber,
          maxAttempts: MAX_GENERATION_ATTEMPTS,
          reason: error.message,
          retryingAt: new Date().toISOString(),
        },
      });
      const delays = retryDelays(options);
      await sleep(delays[attemptNumber - 1] ?? delays[delays.length - 1] ?? 4000);
    }
  }
  await clearRetryNotice(store, task.id);
  throw failure ?? new GenerationFailure("rejected", "Generation failed.");
}

/** Removes the retry note once the generation has settled either way. */
async function clearRetryNotice(store: TaskStore, taskId: string): Promise<void> {
  if (!store.get(taskId)?.generationRetry) return;
  await store.update(taskId, { generationRetry: undefined });
}

/**
 * One paid dispatch under an explicit deadline, with the attempt metadata
 * recorded before the request leaves this process.
 */
async function dispatchAttempt(
  store: TaskStore,
  task: MusicTask,
  options: DispatchGenerationOptions,
): Promise<{ audio: Buffer; generatedText: string | null; attemptId: string }> {
  const key = options.attemptKey ?? options.purpose;
  const attempt: GenerationAttempt = {
    id: crypto.randomUUID(),
    purpose: options.purpose,
    model: options.model,
    requestRef: requestReference(options.purpose, options.model, options.prompt),
    startedAt: new Date().toISOString(),
    ...(options.attemptKey === undefined ? {} : { key: options.attemptKey }),
  };
  // A retry must extend the history rather than replace it, so the record is
  // read inside the store mutation instead of from the task this call was
  // handed: two candidates may be dispatching at the same moment.
  await store.beginGenerationAttempt(task.id, attempt);

  const client = options.generate ? undefined : new LyriaClient(options.apiKey);
  const generate = options.generate ?? ((prompt: string, generateOptions: {
    model: string; timeoutMs: number; signal: AbortSignal;
  }) => client!.generate(prompt, generateOptions));
  let generated: { audio: Buffer; generatedText: string | null };
  try {
    generated = await withDeadline(
      (signal) => generate(options.prompt, {
        model: options.model,
        timeoutMs: options.timeoutMs,
        signal,
      }),
      { timeoutMs: options.timeoutMs, label: `${options.purpose} generation` },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const kind = classifyRequestFailure(error);
    await store.settleGenerationAttempt(
      task.id, attempt, key, kind === "unknown" ? "unknown" : "rejected", message,
    );
    throw new GenerationFailure(kind, message);
  }

  // A late completion must not overwrite a newer attempt's record or audio.
  // Only an attempt that renders the same unit of work can supersede this one:
  // album candidates are generated concurrently and must not cancel each other.
  const verdict = await store.settleGenerationAttempt(task.id, attempt, key, "completed");
  if (verdict === "superseded") {
    throw new GenerationFailure(
      "rejected",
      "A newer attempt replaced this one; the late result was discarded.",
      false,
    );
  }
  return { ...generated, attemptId: attempt.id };
}
