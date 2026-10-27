import { GoogleGenAI } from "@google/genai";

export interface GenerateMusicOptions {
  model?: string;
  /** Deadline for this dispatch; the client does not retry on its own. */
  timeoutMs?: number;
  /** Cancellation from the caller; cancelling may not cancel remote work. */
  signal?: AbortSignal;
}

export interface GeneratedMusic {
  audio: Buffer;
  generatedText: string | null;
}

export class LyriaClient {
  readonly #client: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error("A Gemini API key is required.");
    }

    this.#client = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string, options: GenerateMusicOptions = {}): Promise<GeneratedMusic> {
    const input = prompt.trim();

    if (!input) {
      throw new Error("A Lyria prompt is required.");
    }

    const interaction = await this.#client.interactions.create({
      model: options.model ?? "lyria-3-clip-preview",
      input,
    }, {
      // A paid generation is dispatched exactly once: the SDK must not repeat it
      // behind our back, and the deadline is explicit rather than a default.
      maxRetries: 0,
      ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
      ...(options.signal ? { fetchOptions: { signal: options.signal } } : {}),
    });

    const encodedAudio = interaction.output_audio?.data;

    if (!encodedAudio) {
      throw new Error("Lyria returned no audio data.");
    }

    return {
      audio: Buffer.from(encodedAudio, "base64"),
      generatedText: interaction.output_text ?? null,
    };
  }
}
