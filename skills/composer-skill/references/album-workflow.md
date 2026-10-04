# Album candidate workflow

## Author the complete listening idea

Begin with an albumMind: a concise creative intention that connects the user's theme and purpose to audible music. Decide what listeners experience over the complete batch before expanding individual outlines.

In cohesionStrategy, choose which features remain consistent, vary or form groups, and explain how that distribution serves the idea. Instrumentation, acoustic space, dynamics and production are authorial choices. A unified ensemble, multiple related ensembles, varied perspectives, or different density arcs can all work when musically motivated. Do not prescribe identical instruments or manufacture arbitrary diversity.

The initial batch has 12–15 independent instrumental candidates, usually 14. Allocate 60–180 seconds to each, with at least three different duration targets and approximately 30–40 minutes across the batch. A requested total is an approximate compositional aim, not a fixed duration for every piece. Each piece has an independent entrance, development and ending.

Give each outline a distinct musical role and concrete instrument interaction, groove, harmonic behavior and development. Titles, keys, numerical BPM and scene adjectives alone do not establish substantial variation. Intentional recurrence may support the album idea.

## Separate common music from batch decisions

sharedSoundContract contains only concise audible directions that apply to every candidate. Keep variation, grouping, ordering and distribution rules in cohesionStrategy and realize them through each candidate's arrangement. Never copy commands such as "vary instrumentation across tracks" into an individual music prompt.

Include the shared audio quality constraint in [SKILL.md](../SKILL.md) in sharedSoundContract. Each candidate and selective revision must also retain the positive quality directions in MusicSpec.production and the unwanted artifacts in MusicSpec.avoid so the actual rendered prompt carries the constraint. Preserve the album author's instrumentation, room perspective, production character and dynamic choices.

The Composer receives the entire album context and one selected outline. It implements the author's decisions through structured MusicSpec fields. Preserve the selected duration and purely instrumental setting. Use accurate instrument names, roles and compatible techniques; do not attach guitar construction terms such as hollow-body to a piano.

The application renders each final Lyria prompt from common audible directions and the candidate's genre, mood, rhythm, harmony, instrumentation, development, production and exclusions. AlbumMind, cohesionStrategy, titles, track numbers and assumptions remain composition context. Every musical field must be understandable independently of other pieces.

## Review actual candidate prompts together

Inspect all rendered prompts and structured specifications against albumMind and cohesionStrategy. Compare instrument roles and interaction, subdivision, melodic phrase density, harmonic rhythm, texture trajectory and development, including how similarities are distributed through the batch.

Verify that every rendered candidate prompt explicitly retains the shared audio quality constraint. Missing or contradictory quality directions require a concrete prompt revision; checking prompt wording does not establish that generated audio is free of artifacts.

Judge consistency and difference by the author's intention and the requested listening purpose. Do not impose a uniform ensemble, room or dynamic scheme. Do not mistake a new title, key or BPM for a resolved musical duplicate.

Verify musical terminology against the actual described instruments and techniques. Instrument families must be accurate: saxophones are reed woodwinds, including baritone saxophone. A review must cite short exact prompt phrases or concrete arrangements rather than infer undocumented sounds. Keep valid candidates; do not invent problems to force edits.

Every candidate receives a ready or needs-work prompt verdict with concrete evidence. Only needs-work candidates receive an actionable revision brief. Perform at most one selective repair pass, preserving good material, duration, independent form and instrumental intent. The final review records any unresolved issues without triggering an unbounded loop.

Prompt review never admits a track to the album. Generated tracks remain candidates; the user chooses the admitted tracks and their playlist order.
