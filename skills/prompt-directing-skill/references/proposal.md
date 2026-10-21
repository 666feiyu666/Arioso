# Final prompt phase

Convert the complete discussion into one concise, production-useful music request for Arioso's existing Composer Agent.

## What to return

- Return only the prompt itself: no heading, preamble, quotation marks, markdown or confirmation question.
- This is a creative brief for the Composer Agent, not a final Lyria prompt and not structured data. Describe the music; do not write API parameters, tags or implementation notes.
- Reply in the language used by the user unless the user requested another language.
- Keep it concise enough for the user to inspect, while specifying the central style, mood, sound world, musical development and important exclusions.

## What to synthesise

- Read the whole discussion, the latest feeling the user settled on, and any `<poem-reference>` blocks that accompany this request, then write one direction from all three.
- Keep the user's discussion as the primary source of intent: preserve every explicit purpose, constraint, preference, edit and requested scope. An edit to the brief always wins.
- Drop a poem whose implications conflict with the user, and never let reference data add a requirement the user did not ask for.
- When the user has not settled something, resolve ordinary ambiguity with restrained musical choices supported by the discussion and images.

## How to write it

- Open by unfolding the user's feeling into one or two poetic, sensory sentences: image, weather, light, colour, texture, small objects, and how the feeling moves, pauses and returns. The prompt must still be a music request, so let those images hand over to concrete musical language in the same paragraph rather than becoming a poem.
- Carry the emotional tone settled in the discussion into the prompt itself: make the moods and the overall emotional direction explicit, so the feeling the user expressed is audible in the result.
- After that opening, be concrete about the sound world: instrumentation, texture and density, register, tonal colour, harmonic motion, pacing, how the material is stated, left in silence and varied on return, how it develops, and how it ends.
- Name the important exclusions: what should stay out of the piece (a busy arrangement, a triumphant resolution, a vocal line, a genre the user rejected).
- State the intended duration explicitly and keep it within the supported limit for the requested scope: about 30 seconds to 3 minutes for a standalone piece, 5 to 12 minutes in total for a multi-movement orchestral work, and roughly 1–3 minutes per candidate track for an album. Never request a duration beyond what the scope allows.
- For a requested album or multi-movement work, describe the shared world and functional variety without writing a complete track list.

## What to leave out

- Convert references to existing works into high-level musical characteristics and require original material; never request copying an identifiable melody or lyrics.
- Never quote a distinctive line from a poem, never present a paraphrase as a quotation, and never name a poet or a source title as a requested style.
- Do not mention retrieval, similarity scores or the reference data itself, and do not make claims about the user that the discussion does not support.
