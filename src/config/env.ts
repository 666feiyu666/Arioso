import { z } from "zod";

const EnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required."),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-6-sol"),
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  GEMINI_REVIEW_MODEL: z.string().trim().min(1).default("gemini-3.5-flash"),
  LYRIA_MODEL: z.string().trim().min(1).default("lyria-3-clip-preview"),
  ARIOSO_OUTPUT_DIR: z.string().trim().min(1).default("outputs"),
  // Explicit deadlines per kind of work: long audio generation is not bounded
  // like a short connection check.
  ARIOSO_COMPOSE_TIMEOUT_MS: z.string().trim().regex(/^[1-9]\d*$/u).optional(),
  ARIOSO_GENERATE_TIMEOUT_MS: z.string().trim().regex(/^[1-9]\d*$/u).optional(),
  ARIOSO_REVIEW_TIMEOUT_MS: z.string().trim().regex(/^[1-9]\d*$/u).optional(),
});

/** Deadlines in milliseconds for each kind of provider work. */
export interface AriosoTimeouts {
  composeMs: number;
  generateMs: number;
  reviewMs: number;
}

export const DEFAULT_TIMEOUTS: AriosoTimeouts = {
  composeMs: 300_000,
  generateMs: 900_000,
  reviewMs: 180_000,
};

export interface AriosoConfig {
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string | undefined;
  geminiReviewModel: string;
  lyriaModel: string;
  outputDirectory: string;
  /** Optional so existing callers and fixtures keep working; see timeoutsFor(). */
  timeouts?: AriosoTimeouts;
  pipelinePython?: string;
  pipelineConfig?: string;
}

/** Deadlines for a config, falling back to the defaults when unset. */
export function timeoutsFor(config: Pick<AriosoConfig, "timeouts">): AriosoTimeouts {
  return config.timeouts ?? DEFAULT_TIMEOUTS;
}

export function loadConfig(
  requireGemini = false,
  environment: NodeJS.ProcessEnv = process.env,
): AriosoConfig {
  const parsed = EnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new Error(`${messages} Configure it in Settings or in .env.`);
  }

  if (requireGemini && !parsed.data.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for music generation. Configure it in Settings or in .env.");
  }

  return {
    openAiApiKey: parsed.data.OPENAI_API_KEY,
    openAiModel: parsed.data.OPENAI_MODEL,
    geminiApiKey: parsed.data.GEMINI_API_KEY,
    geminiReviewModel: parsed.data.GEMINI_REVIEW_MODEL,
    lyriaModel: parsed.data.LYRIA_MODEL,
    outputDirectory: parsed.data.ARIOSO_OUTPUT_DIR,
    timeouts: {
      composeMs: Number(parsed.data.ARIOSO_COMPOSE_TIMEOUT_MS ?? DEFAULT_TIMEOUTS.composeMs),
      generateMs: Number(parsed.data.ARIOSO_GENERATE_TIMEOUT_MS ?? DEFAULT_TIMEOUTS.generateMs),
      reviewMs: Number(parsed.data.ARIOSO_REVIEW_TIMEOUT_MS ?? DEFAULT_TIMEOUTS.reviewMs),
    },
    ...(environment.ARIOSO_PIPELINE_PYTHON ? { pipelinePython: environment.ARIOSO_PIPELINE_PYTHON } : {}),
    ...(environment.ARIOSO_PIPELINE_CONFIG ? { pipelineConfig: environment.ARIOSO_PIPELINE_CONFIG } : {}),
  };
}
