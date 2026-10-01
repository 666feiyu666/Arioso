---
name: composer-skill
description: Create or refine production-ready prompts for Google Lyria 3 Clip and Lyria 3.5 from natural-language music ideas, including single pieces and multi-movement orchestral works. Use for musical direction, arrangement, structure, lyric integration, orchestral continuity, and Lyria prompt optimization; do not use for editing or mastering existing audio.
---

# Lyria Composer

Turn the user's intent into a coherent musical concept and a standalone Lyria prompt.

Preserve explicit choices. Treat upstream selections such as target model, duration, vocal mode, lyric language, and other provided constraints as authoritative. Make restrained musical assumptions only when they help produce a more coherent result.

For instrumental requests, make the final prompt explicitly say "instrumental only, no vocals".

## Compose the prompt

1. Identify the target model and compose at the appropriate scale:
   - `lyria-3-clip-preview`: design one clear musical idea with a compact 30-second arc.
   - `lyria-3.5`: allow broader development appropriate to the requested duration and musical form.

2. Establish the musical identity from whichever cues are most informative. These may include genre, idiom, groove, instrumentation, harmony, texture, era, scene, or regional context. Genre is a useful control, not a mandatory starting point.

3. Establish a clear arrangement trajectory. Describe how important musical elements enter, interact, develop, recede, contrast, transform, or return. Prefer musical roles and relationships over inventories of instruments or unprioritized descriptors.

4. Use a form appropriate to the music. Use section labels when the piece is genuinely section-based. Otherwise describe development through texture, energy, dynamics, motifs, orchestration, rhythm, or other musically meaningful changes. Use timestamps only when event placement matters.

5. Add rhythmic, harmonic, melodic, vocal, lyrical, and production details according to their musical relevance. Use precise controls such as BPM, meter, key, mode, chord language, register, or articulation when they help define the intended sound; otherwise describe the musical behavior more naturally.

6. Shape mood as part of the composition rather than as a list of adjectives. When emotional development matters, connect changes in mood to audible changes in harmony, rhythm, instrumentation, register, dynamics, density, or texture.

7. Resolve contradictory directions, remove redundant details, and keep the most important musical ideas clearly prioritized. Use exclusions only when they prevent a plausible unwanted result.

Use established English music terminology when it provides the clearest control vocabulary, while preserving the requested language for lyrics and user-facing text.

Describe audible musical characteristics rather than requesting imitation of a named living artist.

The final Lyria prompt should contain only information that helps determine the generated music. Do not include API parameters, JSON, implementation notes, reasoning, or commentary inside the prompt.

For detailed composition and prompting guidance, read [references/lyria-prompting.md](references/lyria-prompting.md).

For multi-movement orchestral planning or full-movement composition, also read [references/orchestral-workflow.md](references/orchestral-workflow.md). Express the result as an observable work or movement plan; do not expose private chain-of-thought or substitute hidden reasoning for musical directions.
