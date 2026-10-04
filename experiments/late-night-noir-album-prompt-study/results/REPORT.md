# Late Night Noir: one-batch album prompt experiment

**14 candidates**, one batch review and at most one targeted repair pass. Status: **candidate**. Prompt verdict: **needs-work**. Human admission has not occurred.

Started: 2026-10-04T07:28:25.149Z. Finished: 2026-10-04T07:30:24.840Z. Existing composer model: **gpt-5.6-luna**. Prompt target: **Lyria 3.5**. Audio generation calls: **0**. Concurrency: **3**.

## Task and existing architecture

[Request](input.json), [planner/reviewer instructions and composer skill](TASK.md). Uses existing Arioso loadComposerSkill(), runComposerAgent() and composeMusic(). Jazz/no-corpus and explicit instrumental settings are passed to the composer. Every exact per-track composer input is saved alongside its initial or repaired spec.

## Author-selected album idea and cohesion strategy

A sequence of self-contained nocturnal jazz studies where relaxation comes from unhurried pulse, spacious voicings, and gentle repetition, while noir character emerges through unresolved color, low-register counterlines, and restrained melodic shadows. Each piece offers a different way to settle: some through drifting piano, some through brushed ensemble motion, some through bass-led stillness, yet every ending feels deliberately softened rather than abruptly concluded.

Keep a restrained late-night dynamic ceiling, instrumental-only writing, nuanced swing or slow pulse, and jazz harmony colored by extensions, suspended tones, and selective chromaticism. Vary the foreground instrument, groove density, ensemble size, room perspective, harmonic rhythm, and degree of motivic activity in small groups: intimate piano-centered tracks, bass-and-brush meditations, and darker ensemble sketches. This creates contrast without breaking the relaxation arc; noir comes from harmonic ambiguity and register, not from loud drama.

## Shared album-level principles and variation rules

Instrumental only, no vocals. Late-night noir jazz for relaxation: restrained dynamics, spacious phrasing, tactile acoustic playing, and jazz harmony with tasteful extensions, suspensions, and gentle chromatic tension. Every piece must have a clear self-contained arc, quiet entrance, gradual development, and softened ending. Vary foreground instrument, ensemble size, room intimacy, groove density, and harmonic rhythm, but avoid abrupt drops, flashy virtuosity, harsh brightness, or cinematic bombast.

## Final candidates

Targets vary within 1–3 minutes; planned batch total 31 minutes 45 seconds. These are compositional targets, not measured audio durations.

| No. | Title | Target | Original planned role | Review | Files |
| --- | --- | --- | --- | --- | --- |
| 01 | Windowlight Waltz | 150s | Piano states a simple nocturnal motif while bass and brushes provide a floating three-beat cushion; the trio gradually trades fragments before returning to the motif. | ready | [Prompt](final/01.prompt.md) · [Spec](final/01.spec.json) |
| 02 | Blue Smoke Ledger | 120s | Muted trumpet carries a sparse, descending theme while piano supplies dark intervallic punctuation and bass anchors the pauses. | needs-work | [Prompt](final/02.prompt.md) · [Spec](final/02.spec.json) |
| 03 | Rain on the Fire Escape | 135s | Electric piano creates a repeating nocturnal ostinato while vibraphone and bass paint quiet reflections above it. | ready | [Prompt](final/03.prompt.md) · [Spec](final/03.spec.json) |
| 04 | The Empty Booth | 90s | Solo piano alternates between a low walking suggestion and fragile treble commentary, making silence part of the phrasing. | ready | [Prompt](final/04.prompt.md) · [Spec](final/04.spec.json) |
| 05 | Streetlamp Half-Time | 165s | Bass and drums establish a calm half-time pocket while tenor saxophone develops a compact motif through repeated, slightly altered statements. | ready | [Prompt](final/05.prompt.md) · [Spec](final/05.spec.json) |
| 06 | Nocturne for Closed Curtains | 105s | Clarinet and piano share a breath-like melody in imitation while cello supplies sustained shadow tones. | ready | [Prompt](final/06.prompt.md) · [Spec](final/06.spec.json) |
| 07 | Last Train, Softly | 150s | A brushed quartet maintains a quiet forward motion while guitar and saxophone exchange short motifs rather than taking extended solos. | ready | [Prompt](final/07.prompt.md) · [Spec](final/07.spec.json) |
| 08 | Ashes in the Blue Hour | 120s | Baritone saxophone provides low, sustained counterlines beneath sparse piano chords, creating weight without volume. | needs-work | [Prompt](final/08.prompt.md) · [Spec](final/08.spec.json) |
| 09 | Neon Herbarium | 135s | Vibraphone carries a delicate repeating melody while flugelhorn and piano alter its contour through understated replies. | ready | [Prompt](final/09.prompt.md) · [Spec](final/09.spec.json) |
| 10 | Velvet Corridor | 105s | Piano and guitar interlock a quiet chordal pattern while a muted trumpet comments in short, nocturnal punctuation. | ready | [Prompt](final/10.prompt.md) · [Spec](final/10.spec.json) |
| 11 | A Door Left Ajar | 180s | Tenor saxophone sustains a single evolving melody over a pedal bass, with piano changing the surrounding harmonic light. | ready | [Prompt](final/11.prompt.md) · [Spec](final/11.spec.json) |
| 12 | Underpass Lullaby | 120s | A small ensemble alternates between a low, repeating bass figure and a fragile flute melody, using silence as the main transition. | ready | [Prompt](final/12.prompt.md) · [Spec](final/12.spec.json) |
| 13 | Afterimage in Brass | 150s | Muted trombone and piano trade broad phrases while bass and brushes maintain a soft, nearly motionless foundation. | needs-work | [Prompt](final/13.prompt.md) · [Spec](final/13.spec.json) |
| 14 | Dawn Without Arrival | 180s | A restrained quintet gradually transforms a simple piano motif from shadowed minor into softened, unresolved brightness. | ready | [Prompt](final/14.prompt.md) · [Spec](final/14.spec.json) |

[Initial plan](initial-plan.json) · [Final plan](final-plan.json) · [Initial review](initial-review.json) · [Final review](final-review.json). Final-plan summaries reflect the generated specs while preserving planned musical roles and durations.

## Concrete corrections

### Candidate 05

Initial evidence: The rendered prompt uses the same 58 BPM 4/4 slow-swing space, upright-bass foundation, breathy tenor motif, sparse brushes, and fragmentation as track 11. Its “quiet vamp and incomplete final echo” also closely matches track 11's unresolved pedal ending.

Requested correction: Retain the bass-led half-time identity, but replace the tenor-sax motif-and-fragmentation arc with a denser rhythmic bass/brush conversation and a brief electric-piano harmonic transformation; avoid a long evolving sax melody over static pedal harmony.

[Original](initial/05.prompt.md) → [Revised](final/05.prompt.md). Prompt changed: true.

Final judgment: **ready**. The prompt makes bass and brushes “the main voices” in a half-time rhythmic conversation rather than a conventional melodic quartet. Electric piano enters only for a harmonic turn and tenor saxophone is restricted to “brief breathy punctuation,” creating useful bass-led contrast.

### Candidate 11

Initial evidence: The rendered prompt centers “one long, evolving melody” over a “calm repeating two-note upright-bass pedal,” with sparse brushes and unresolved fragmentation. This closely duplicates track 5's breathy tenor motif, 58 BPM 4/4 swing, cyclical harmonic stasis, and bass-anchored recession.

Requested correction: Keep the 180-second tenor meditation, but change the development to evolving harmonic motion: let piano introduce contrasting upper-harmony phases and have the saxophone use call-and-response with piano rather than one continuous melody over an unchanged pedal; reserve the pedal for the opening and coda.

[Original](initial/11.prompt.md) → [Revised](final/11.prompt.md). Prompt changed: true.

Final judgment: **ready**. Its 180-second form explicitly releases the opening two-note pedal into “contrasting upper-harmony phases” before returning to the pedal in the coda. Long-breathed tenor/piano dialogue, fragmentation, and reserved pedal architecture provide more development than the shorter brass studies.

## Remaining decisions

- Candidate 2: The prompt uses “muted trumpet,” “hollow-body piano,” upright bass, and brushes in sparse 4/4 call-and-response with a softened unresolved ending. Its descending brass theme and oblique minor-blues harmony overlap substantially with 13’s muted-brass/piano quartet study. Remaining brief: Differentiate the arrangement from 13 by making trumpet phrases shorter and more fragmented over longer silent bass/piano punctuations, and avoid a broad phrase-trading middle; preserve the minor-blues identity and 120-second duration.
- Candidate 8: The prompt foregrounds “low sustained counterlines” from baritone sax over felt piano, bass, and brushed 12/8 triplets. Its low-register overlapping lines and unresolved sparse-piano coda are very close to 13’s broad muted-brass/piano dialogue. Remaining brief: Make the baritone a sustained pedal-shadow rather than an interwoven melodic counterline, and let the 12/8 brushes carry more of the piece’s motion; reserve the denser brass/piano exchange for 13.
- Candidate 13: The prompt is another slow 4/4 quartet built from piano, muted brass, bass, and brushes, with “broad breathy descending phrases” and an unresolved open-interval ending. That arrangement overlaps with both 2’s muted-trumpet/piano exchange and 8’s low-register brass/piano layering. Remaining brief: Recast the middle as a piano-led harmonic study with trombone sustaining occasional long tones rather than trading broad phrases; emphasize descending inner voices and stable bass as the primary development, preserving the 150-second form.

- The album strongly realizes its late-night relaxation/noir concept: all rendered prompts are instrumental, restrained, spacious, and shaped toward softened endings. The shared preamble is repeated verbatim in every prompt, making each render less concise and adding generic variation instructions that are not track-specific.
- The main cohesion risk is substantive overlap among several slow 4/4 piano-plus-muted/low-brass quartet studies, especially 2, 8, 11, and 13. Most other differences—waltz, free-time solo piano, 6/8 ostinato, half-time bass study, straight-eighth vibraphone, bossa pulse, 5/4 lullaby, and quintet transformation—serve the stated variation plan.

## Validation

[Machine validation](validation.json): 14 numbered candidates; 60–180s individual targets and 30–40-minute batch target; varied durations; instrumental specs; identical renderer-inserted shared contract; no detected explicit cross-track dependency in prompts. Supplied section timings are checked against the target.

No section-timing discrepancy exceeded the tolerance (15 seconds or 10%). Untimed sections remain flexible.

Qualitative review examines the actual final prompts for theme, consistency and substantive duplication with concrete evidence. Similarities and differences are judged against the author-chosen albumMind and cohesionStrategy, without pre-imposing identical instrumentation, space or dynamics. No audio evaluation or automatic admission is part of this experiment.

## Independent Codex assessment after the run

The planner formed a substantive album idea, rather than merely naming 14 scenes. It chose harmonic ambiguity, lower-register color, spacious phrasing and restrained dynamics as its connecting features, and permitted different ensembles, meters and textures. This was an author-selected strategy, not a pre-imposed requirement for one instrumental lineup. All 14 pieces remain candidates for later human admission.

The batch contains seven different duration targets from 90 to 180 seconds, totaling 1905 seconds (31:45). All stored MusicSpecs are instrumental. The existing Arioso composer, composer skill loader, agent runner and MusicSpec validation were used in real API calls. This experiment adds only isolated planning, review and rendering tasks; it does not implement the production album interface.

### What the revision step achieved

Candidate 05 changed from a tenor-motif study to a bass-and-brush rhythmic conversation, with electric piano supplying a brief harmonic turn and tenor limited to short punctuation. Candidate 11 changed from a continuously static pedal foundation to tenor/piano dialogue over evolving upper-harmony phases, with the pedal reserved for opening and coda. These are substantive musical changes, not title or wording changes. The table's role column preserves the original planned roles; the linked final prompts and specs contain the actual revisions.

### Confirmed task defects to address before the next run

1. Candidate 02 preserves the planner's ambiguous, invalid term `hollow-body piano`. The task must require valid instrument names and coherent playing/role directions. A hollow-body guitar and an acoustic piano imply different choices; the author must select the intended instrument. The first automated review marked this candidate ready without correcting the term.
2. The renderer repeats the author's batch-wide rule `Vary foreground instrument, ensemble size, room intimacy, groove density, and harmonic rhythm` inside each individual generation prompt. Album-wide variation decisions belong in the planner and composer context. The final Lyria prompt should carry the selected track's concrete arrangement and only the common musical directions that apply to it. The repeated theme, instrumental instruction and development/ending directions also need compression.

### Review suggestions are not established defects

The final API review flags candidates 02, 08 and 13 for additional differentiation. These are useful editorial suggestions, not a reason to reject all similarities. Independent inspection finds meaningful existing distinctions: minor-blues muted-trumpet punctuation in 02, a baritone-saxophone 12/8 low-register study in 08, and descending harmonic inner voices with muted trombone in 13. The reviewer also incorrectly calls the baritone saxophone a low-brass voice. Its instrument classification and similarity judgments need stronger grounding in the actual roles, groove and harmonic development.

Most tracks use a quiet entry, mild thickening and gradual recession. This serves the chosen strategy, but the album author may choose a few other forms of development, such as maintaining sparse texture or shifting roles through pauses. The plan permits different room perspectives, while the prompts mostly choose intimate spaces; this can be an intentional shared choice rather than an obligation to manufacture contrast.

### Proposed task adjustment

Keep the tested planning -> existing per-track composer -> batch review -> targeted revision architecture. Separate the album author's internal variation strategy from track-ready generation directions, check instrument terminology explicitly, and ask the reviewer to distinguish intentional family resemblance from redundant musical function. Inspect the final rendered prompt, give concrete evidence, and revise only the necessary member of a similarity cluster. These are proposed changes for the next trial, not changes silently applied to this run's evidence.

Assessment: the pipeline is worth continuing, and its review step made observable improvements. The current prompt task still needs the two concrete corrections above before treating the batch as ready for music generation. The saved initial/final prompts and raw reviews preserve this first trial exactly; no additional generation round was performed.
