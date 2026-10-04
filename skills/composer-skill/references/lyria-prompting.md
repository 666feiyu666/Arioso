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

Apply the shared audio quality constraint in [SKILL.md](../SKILL.md) to every final prompt. In MusicSpec, express the positive quality directions in production and the unwanted artifacts in avoid so structured rendering retains both. Preserve intentional instrumental timbres and production effects while excluding accidental clipping, crackling and digital distortion.

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
- the shared audio quality constraint is explicit in the final prompt and retained in the structured fields used to render it
- every remaining detail has a plausible audible consequence
- the prompt stands on its own without implementation notes or explanatory commentary