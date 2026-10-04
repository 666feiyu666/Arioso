# Album prompt experiment task

## Request

{
  "theme": "late night noir jazz for relaxation",
  "candidateCount": 14,
  "vocalMode": "instrumental",
  "corpusMode": "none",
  "lyriaModel": "lyria-3.5",
  "durationRangeSeconds": [
    60,
    180
  ],
  "batchTargetMinutes": [
    30,
    40
  ],
  "admission": "Every generated piece remains a candidate; the human decides admission later."
}

## Planner instructions

You are Arioso's album planning author. Produce exactly 14 independent instrumental candidates for late night noir jazz for relaxation. Duration targets vary from 60 to 180 seconds and total 1800 to 2400 seconds; choose at least three different target lengths, not a fixed duration per track. Number candidates 1 through 14.
First develop albumMind: the author's substantive creative idea for this album, expressed as a musical listening experience serving its theme and purpose. Then develop cohesionStrategy: decide which musical and production features stay consistent, which change or form groups, and why that distribution serves late night noir and relaxation. Do not assume unified instrumentation, recording space or dynamics in advance; these are creative decisions for the album author. Connect the albumMind and strategy to audible arrangements rather than relying on generic scene adjectives.
Write a concise sharedSoundContract, preferably under 100 words, capturing the author's chosen principles and variation rules. This identical text will accompany every prompt, so express album-level rules compatible with all proposed candidates; specific track choices belong in their outlines. Instrumentation, room, texture and dynamics may differ when the plan explains their relationship to the albumMind.
Give each candidate a distinct musical role, groove, harmonic behavior and development implementing the albumMind and cohesionStrategy. Roles describe what musicians do, not only scenes or titles. Vary interaction, motivic behavior, harmonic rhythm, phrase density and texture trajectories where appropriate. Merely changing titles, keys or numerical BPM is insufficient variation. Similarity may be intentional; make its purpose and distribution clear. Differences are not automatically better. Each track must serve the relaxation purpose while retaining noir character, with its own beginning, development and ending and no dependency on another track. Avoid invented exact BPM or keys when unnecessary. Do not add instruments merely to manufacture superficial variety. Every output remains a candidate.

## Reviewer instructions

You are Arioso's album prompt editor. Inspect ALL 14 actual rendered Lyria prompts and their MusicSpecs together, not just outlines. Evaluate them against the author's albumMind, cohesionStrategy and chosen sharedSoundContract. Judge realization of that musical idea, theme fit, instrumental consistency, variation distribution, substantive duplication, deviations from the author's rules, development proportional to duration, and concise priority of instructions.
Do not impose unified instrumentation, recording space or dynamics: the author chooses whether these stay consistent, vary or form groups. Difference itself is not an error and consistency is not automatic success. Determine whether similarities and differences serve the author's plan and the requested listening purpose. Changing titles, keys or numerical BPM alone does not resolve duplication. Compare musical roles, subdivision, harmony, melodic interaction, phrase density and development.
Quote short concrete phrases or identify specific arrangements from the inspected prompts in every candidate's evidence. Do not invent problems to justify editing. Keep good candidates with verdict ready and revisionBrief null. Substantive issues warrant needs-work with a short actionable brief changing a few specific musical elements. Preserve the albumMind, chosen variation rules, duration and instrumental intent. Do not demand extra instruments merely to manufacture diversity. Do not require audio evaluation, add listening warnings or assume admission.
Return exactly one judgment for each number 1 through 14. List useful pairwise similarities with concrete evidence and explain whether they serve the author's cohesion strategy or require an edit. After one repair pass, preserve ready/needs-work honestly and leave unresolved issues visible; do not request another automatic repair round. Album verdict is needs-work if any candidate is needs-work; ready candidates have no revision brief.

## Composer task

Each call receives the entire plan and the authoritative current outline through existing composeMusic(), with instrumental/no-corpus/jazz/Lyria 3.5 options. Exact per-candidate input is saved beside its spec. Repairs receive the original spec and prompt, reviewer brief and entire original prompt batch.

## Existing composer skill used

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

# Lyria prompting reference

Model behavior checked against Google's Lyria prompt guide and music generation documentation, 2026-09-29.

## Core principle

A strong Lyria prompt communicates a coherent musical idea, not a completed checklist.

Describe the musical decisions that most strongly determine what the listener will hear. Add detail only when it meaningfully changes the result.

- Preserve the user's explicit musical choices.
- Prefer a few prioritized ideas over many equal-weight descriptors.
- Prefer audible musical behavior over abstract labels.
- Do not invent precision merely to make the prompt appear detailed.
- Omit information that does not materially affect the intended sound.
- Resolve conflicting directions before writing the final prompt.

## Musical identity

Establish the musical language using whichever cues are most informative: genre, idiom, groove, instrumentation, harmonic language, texture, era, scene, or regional context.

Genre is one descriptive tool, not a mandatory starting point.

When combining styles or influences, describe the relationship between them rather than stacking genre labels. Make clear which characteristics come from each influence when that distinction matters.

Use era or regional context only when it implies concrete musical traits.

## Arrangement and development

Describe how the music changes over time.

Think in terms of:

- entry and removal of musical layers
- changes in density and register
- shifts in rhythmic activity
- movement between foreground and background
- buildup, tension, climax, release, or dissolution
- transformation or return of important motifs
- contrast between sections or phases

A useful prompt should make the intended trajectory understandable: what establishes the piece, what develops, what becomes the focal point, and how the music resolves or ends.

For music based more on texture, groove, or gradual transformation than song form, describe that evolution directly rather than forcing verse-and-chorus terminology.

## Instrumentation and orchestration

Describe instruments by musical role and interaction rather than as an inventory.

Clarify which elements carry:

- melody or motif
- harmony
- bass movement
- rhythmic pulse or groove
- texture and atmosphere
- accents, countermelodies, or transitions

Indicate foreground and background relationships when important.

Specify playing technique, articulation, register, tone, or interaction only when these meaningfully define the sound.

Avoid listing instruments that have no clear function in the arrangement.

## Rhythm and pacing

Use exact BPM when tempo precision matters or when the user specifies it. Otherwise, describe the rhythmic feel directly.

Useful controls may include:

- pulse and perceived pace
- meter
- subdivision
- swing
- syncopation
- rhythmic density
- groove character
- changes in rhythmic intensity

Do not invent an exact BPM when a qualitative pacing instruction communicates the idea more naturally.

## Harmony and melody

Specify key, tonic, mode, chord language, harmonic rhythm, tension, or resolution when they are important to the musical character.

Do not add a key merely for completeness.

When useful, describe melodic behavior through features such as:

- contour
- range
- repetition
- motivic development
- lyrical or angular movement
- call and response
- degree of melodic activity
- relationship between melody and harmony

Favor musical function over technical terminology that does not change the intended result.

## Form and transitions

Choose structural language appropriate to the music.

Section labels such as `[Intro]`, `[Verse]`, `[Chorus]`, `[Bridge]`, `[Drop]`, and `[Outro]` are useful when those sections genuinely define the form.

For cinematic, ambient, electronic, experimental, minimalist, orchestral, or other developmental music, a progression of textures, gestures, dynamics, or energy may describe the form more accurately.

Use timestamps when exact placement within the generated duration is important. Do not add timestamps simply to make the prompt more detailed.

Transitions should describe musically meaningful events such as changes in density, instrumentation, harmony, rhythm, dynamics, or texture.

## Mood and dramatic arc

Use mood to define musical character and development rather than accumulating adjectives.

Prefer compatible emotional directions and, when appropriate, describe how the emotional state evolves through the piece.

Connect important emotional changes to musical behavior. A change in mood may correspond to a shift in harmony, register, instrumentation, rhythmic activity, density, or dynamics.

Avoid long strings of near-synonymous mood words.

## Voice and lyrics

When vocal or lyric information is supplied by the upstream request, integrate it into the musical design rather than repeating interface-level choices unnecessarily.

Describe vocal characteristics only when they affect the performance, such as:

- range or register
- timbre
- intimacy or projection
- rhythmic or legato delivery
- phrase density
- lead and backing-vocal relationships
- harmonies, echoes, or ad-libs

For generated lyrics, describe only the information needed to shape the writing: subject, perspective, emotional direction, imagery, language, narrative movement, and the musical function of recurring lines or hooks.

Treat the voice as part of the arrangement rather than as an isolated metadata field.

## Production character

Describe production in terms of audible character.

Useful controls include:

- acoustic or electronic character
- dry or reverberant space
- intimate or expansive perspective
- clean or saturated texture
- recording roughness or polish
- stereo width and spatial depth
- dynamic restraint or impact
- foreground/background separation

Production directions should reinforce the composition and arrangement.

Avoid mastering terminology, technical specifications, or studio jargon that does not meaningfully change the musical result.

## Model-aware composition

### Lyria 3 Clip

Design for a fixed 30-second duration.

Favor one clearly legible musical idea and a compact arc rather than attempting to compress an entire conventional song into the clip.

Establish the identity quickly, develop or transform it, and give the clip an intentional ending or loop-compatible resolution when appropriate.

Use timestamps only when the placement of an event is important.

### Lyria 3.5

Allow broader musical development across a multi-minute piece.

Use song sections when the music is section-based, or describe a longer developmental progression when another form is more appropriate.

When a duration is requested, treat it as a compositional target and design the amount of material, repetition, contrast, and development accordingly.

Do not introduce additional sections merely to make the structure appear complete.

## Exclusions

Use exclusions sparingly.

An exclusion is useful when it prevents a plausible but unwanted musical interpretation. Keep it concrete and audible.

Prefer positively describing the intended result when possible. Avoid long negative lists, generic prohibitions, or exclusions unrelated to likely generation errors.

## Prompt compression

Before finalizing, remove anything that does not contribute to the musical result.

Each detail should serve a clear purpose such as:

- defining musical identity
- establishing groove or harmonic language
- assigning instrumental roles
- controlling development
- shaping form
- directing performance
- defining production character
- preventing a specific unwanted interpretation

Combine redundant instructions and remove decorative terminology.

More detail is not automatically more control.

## Final pass

Before returning the Lyria prompt, verify that:

- the central musical idea is clear
- the most important elements have obvious priority
- the arrangement has a coherent trajectory
- structure matches the type of music being created
- instruments have meaningful roles rather than merely being listed
- tempo, harmony, mood, form, and production do not contradict one another
- no unnecessary precision has been invented
- exclusions are brief and actionable
- every remaining detail has a plausible audible consequence
- the prompt stands on its own without implementation notes or explanatory commentary
