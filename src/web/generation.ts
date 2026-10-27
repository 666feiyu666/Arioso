import { LyriaClient } from "../lyria/lyria-client.js";
import type { MusicTask, TaskStore } from "./task-store.js";
import {
  classifyRequestFailure,
  completeGenerationAttempt,
  ensureGenerationAttempt,
  recordGenerationAttempt,
  requestReference,
  withDeadline,
  type FailureKind,
  type GenerationAttempt,
} from "../utils/attempts.js";

/** A provider failure together with the kind of outcome it leaves behind. */
export class GenerationFailure extends Error {
  constructor(readonly kind: FailureKind, message: string) {
    super(kind === "unknown"
      ? `${message} The remote outcome is unknown: the audio may already have been generated. `
        + "Nothing was retried automatically; start a new attempt only if you want another generation."
      : message);
    this.name = "GenerationFailure";
  }
}

export interface DispatchGenerationOptions {
  purpose: GenerationAttempt["purpose"];
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
}

/**
 * Dispatches one paid generation under an explicit deadline and records bounded
 * attempt metadata before the request leaves this process. There is no automatic
 * retry: repeating a request whose outcome is unknown could pay for the same
 * audio twice, so the task fails and the user decides whether to try again. A
 * result that arrives after a newer attempt replaced this one is discarded.
 */
export async function dispatchGeneration(
  store: TaskStore,
  task: MusicTask,
  options: DispatchGenerationOptions,
): Promise<{ audio: Buffer; generatedText: string | null; attemptId: string }> {
  const attempt: GenerationAttempt = {
    id: crypto.randomUUID(),
    purpose: options.purpose,
    model: options.model,
    requestRef: requestReference(options.purpose, options.model, options.prompt),
    startedAt: new Date().toISOString(),
  };
  await store.update(task.id, {
    generationAttemptId: attempt.id,
    generationAttempts: recordGenerationAttempt(task.generationAttempts, attempt),
  });

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
    const current = store.get(task.id);
    await store.update(task.id, {
      generationAttempts: completeGenerationAttempt(
        ensureGenerationAttempt(current?.generationAttempts ?? task.generationAttempts, attempt),
        attempt.id,
        kind === "unknown" ? "unknown" : "rejected",
        message,
      ),
    });
    throw new GenerationFailure(kind, message);
  }

  // A late completion must not overwrite a newer attempt's record or audio.
  const current = store.get(task.id);
  if (current?.generationAttemptId !== attempt.id) {
    await store.update(task.id, {
      generationAttempts: completeGenerationAttempt(
        ensureGenerationAttempt(current?.generationAttempts ?? task.generationAttempts, attempt),
        attempt.id,
        "cancelled",
        "A newer attempt replaced this one.",
      ),
    });
    throw new GenerationFailure("rejected", "A newer attempt replaced this one; the late result was discarded.");
  }
  await store.update(task.id, {
    generationAttempts: completeGenerationAttempt(
      ensureGenerationAttempt(current?.generationAttempts ?? task.generationAttempts, attempt),
      attempt.id,
      "completed",
    ),
  });
  return { ...generated, attemptId: attempt.id };
}
