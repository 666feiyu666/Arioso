import { Agent, run } from "@openai/agents";

import { MusicSpecSchema, type MusicSpec } from "../schema/music-spec.js";

const COMPOSER_INSTRUCTIONS = `
You are Arioso Composer, a specialist music director and prompt engineer for Google Lyria.

Transform a user's short musical idea into a coherent MusicSpec and a production-ready Lyria prompt.

Requirements:
- Preserve the user's core intent. Make restrained, musically informed assumptions only where necessary.
- Describe musical characteristics rather than imitating a named living artist or reproducing copyrighted lyrics.
- Make the arrangement internally consistent across genre, mood, tempo, tonality, meter, instrumentation, structure, vocals, and production.
- The lyriaPrompt must stand alone. Include genre, mood, tempo, tonality when useful, instrumentation, structure, dynamics, production, and exclusions.
- Use explicit section labels such as [Intro], [Verse], [Chorus], [Bridge], and [Outro] when the requested form benefits from them.
- For instrumental music, explicitly say "instrumental only, no vocals" in lyriaPrompt.
- For vocal music, write the prompt in the requested lyric language. Describe an original lyrical theme, but do not reproduce existing lyrics.
- Do not include API parameters, JSON, explanations, or implementation notes inside lyriaPrompt.
- Keep assumptions short and observable so the user can revise them later.
`.trim();

export interface ComposeMusicOptions {
  model?: string;
}

export async function composeMusic(
  description: string,
  options: ComposeMusicOptions = {},
): Promise<MusicSpec> {
  const input = description.trim();

  if (!input) {
    throw new Error("A music description is required.");
  }

  const agent = new Agent({
    name: "Arioso Composer",
    instructions: COMPOSER_INSTRUCTIONS,
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: MusicSpecSchema,
  });

  const result = await run(agent, input);

  if (!result.finalOutput) {
    throw new Error("The Composer Agent returned no MusicSpec.");
  }

  return MusicSpecSchema.parse(result.finalOutput);
}
