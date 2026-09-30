import { z } from "zod";

const EnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required."),
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-6-sol"),
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  LYRIA_MODEL: z.string().trim().min(1).default("lyria-3-clip-preview"),
  ARIOSO_OUTPUT_DIR: z.string().trim().min(1).default("outputs"),
});

export interface AriosoConfig {
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string | undefined;
  lyriaModel: string;
  outputDirectory: string;
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
    lyriaModel: parsed.data.LYRIA_MODEL,
    outputDirectory: parsed.data.ARIOSO_OUTPUT_DIR,
  };
}
