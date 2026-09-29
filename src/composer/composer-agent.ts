import { Agent, run } from "@openai/agents";

import { MusicSpecSchema, type MusicSpec } from "../schema/music-spec.js";
import { loadComposerSkill } from "./composer-skill.js";

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
  lyriaModel?: string;
  vocalMode?: "auto" | "instrumental" | "vocals";
}

function vocalRule(mode: ComposeMusicOptions["vocalMode"]): string {
  if (mode === "instrumental") {
    return `Vocal rule selected by the user: instrumental only. This explicit UI setting overrides conflicting text. Set vocals.enabled to false, keep all vocal fields null, include vocals in avoid, and say "instrumental only, no vocals" in lyriaPrompt.`;
  }
  if (mode === "vocals") {
    return "Vocal rule selected by the user: vocals required. This explicit UI setting overrides conflicting text. Set vocals.enabled to true and require vocals in lyriaPrompt. Do not invent lyrics or a lyric language when the user did not provide them; leave unspecified vocal fields null.";
  }
  return "Vocal rule selected by the user: auto. Infer whether vocals are enabled only from the music description.";
}

export async function composeMusic(
  description: string,
  options: ComposeMusicOptions = {},
): Promise<MusicSpec> {
  const input = description.trim();

  if (!input) {
    throw new Error("A music description is required.");
  }

  const skill = await loadComposerSkill();
  const targetModel = options.lyriaModel ?? process.env.LYRIA_MODEL ?? "lyria-3-clip-preview";

  const agent = new Agent({
    name: "Arioso Composer",
    instructions: [
      COMPOSER_INSTRUCTIONS,
      `Target Lyria model: ${targetModel}`,
      vocalRule(options.vocalMode ?? "auto"),
      "Follow the local composer skill and its prompting reference below.",
      skill,
    ].join("\n\n"),
    model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-6-sol",
    outputType: MusicSpecSchema,
  });

  const result = await run(agent, input);

  if (!result.finalOutput) {
    throw new Error("The Composer Agent returned no MusicSpec.");
  }

  return MusicSpecSchema.parse(result.finalOutput);
}
