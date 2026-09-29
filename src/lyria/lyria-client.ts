import { GoogleGenAI } from "@google/genai";

export interface GenerateMusicOptions {
  model?: string;
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
