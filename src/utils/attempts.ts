import { createHash } from "node:crypto";

/**
 * How a provider failure should be treated. The classification uses typed
 * status/code information only: message fragments are not a reliable signal and
 * they vary between providers.
 */
export type FailureKind =
  /** The request was malformed or rejected before any work could start. */
  | "invalid-input"
  /** Missing or rejected credentials. */
  | "auth"
  /** A local storage failure, not a provider outcome. */
  | "storage"
  /** The provider definitely refused the request; nothing was generated. */
  | "rejected"
  /** The remote outcome cannot be determined from the failure alone. */
  | "unknown";

const STORAGE_CODES = new Set([
  "EACCES", "EBUSY", "EDQUOT", "EEXIST", "EIO", "EISDIR", "EMFILE", "ENFILE",
  "ENOENT", "ENOSPC", "ENOTDIR", "EPERM", "EROFS",
]);

const UNKNOWN_CODES = new Set([
  "ABORT_ERR", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETDOWN",
  "ENETUNREACH", "ENOTFOUND", "EPIPE", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
]);

function numericStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown } | null;
  const value = Number(candidate?.status ?? candidate?.statusCode);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function errorCode(error: unknown): string | undefined {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = candidate?.code ?? candidate?.cause?.code;
  return typeof code === "string" ? code.toUpperCase() : undefined;
}

/**
 * Separates invalid input, authentication, storage failure, a definite rejection,
 * and an unknown outcome. A timeout or a dropped response is "unknown": the
 * remote side may already have generated the audio.
 */
export function classifyRequestFailure(error: unknown): FailureKind {
  const code = errorCode(error);
  if (code && STORAGE_CODES.has(code)) return "storage";
  if (code && UNKNOWN_CODES.has(code)) return "unknown";

  const status = numericStatus(error);
  if (status !== undefined) {
    if (status === 400 || status === 422) return "invalid-input";
    if (status === 401 || status === 403) return "auth";
    if (status === 404 || status === 405 || status === 410 || status === 412) return "rejected";
    // 408/409/429 and 5xx may have reached the model: treat them as unknown.
    return "unknown";
  }

  if (error instanceof SyntaxError) return "invalid-input";
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "unknown";
  }
  return "unknown";
}

/** A paid generation is dispatched once; repeating it could pay twice. */
export function attemptsForPaidGeneration(): number {
  return 1;
}

/**
 * Runs `operation` with an explicit deadline. The abort signal is passed to
 * clients that support cancellation; the deadline still bounds the wait when a
 * client ignores it. Cancelling a local request does not cancel remote work, so
 * a timed-out paid request is recorded as an unknown outcome.
 */
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { timeoutMs: number; label: string },
): Promise<T> {
  const controller = new AbortController();
  const timeout = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(
        new Error(`${options.label} passed its ${options.timeoutMs} ms deadline.`),
        { code: "ETIMEDOUT" },
      ));
    }, options.timeoutMs);
    // The rejection is observed by the race below; never keep the process alive.
    timer.unref?.();
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    controller.abort();
  }
}

/** Identity of an approved request: enough to compare attempts, no secrets. */
export function requestReference(...parts: string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

export type AttemptOutcome = "completed" | "rejected" | "unknown" | "cancelled";

/** One bounded record of a provider dispatch; secrets are never stored here. */
export interface GenerationAttempt {
  id: string;
  purpose: "generate" | "movement" | "album-track";
  model: string;
  /** Hash of the exact approved input. */
  requestRef: string;
  startedAt: string;
  endedAt?: string;
  outcome?: AttemptOutcome;
  error?: string;
}

/** Keeps only the newest attempt records so a record cannot grow without bound. */
export const MAX_GENERATION_ATTEMPTS = 10;

export function recordGenerationAttempt(
  existing: GenerationAttempt[] | undefined,
  attempt: GenerationAttempt,
): GenerationAttempt[] {
  return [...(existing ?? []), attempt].slice(-MAX_GENERATION_ATTEMPTS);
}

export function completeGenerationAttempt(
  existing: GenerationAttempt[] | undefined,
  attemptId: string,
  outcome: AttemptOutcome,
  error?: string,
): GenerationAttempt[] {
  return (existing ?? []).map((attempt) => attempt.id === attemptId
    ? {
      ...attempt,
      endedAt: new Date().toISOString(),
      outcome,
      ...(error === undefined ? {} : { error }),
    }
    : attempt);
}

/**
 * Adds an attempt record if a concurrent dispatch already replaced the list.
 * Attempt records are evidence, so a run must never silently drop its own.
 */
export function ensureGenerationAttempt(
  existing: GenerationAttempt[] | undefined,
  attempt: GenerationAttempt,
): GenerationAttempt[] {
  return (existing ?? []).some((candidate) => candidate.id === attempt.id)
    ? existing ?? []
    : recordGenerationAttempt(existing, attempt);
}
