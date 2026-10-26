# DH6012 MoodMic: detailed experience

## Purpose

This document records the behaviour and visual direction of the MoodMic interface as it is built, and the reasons behind the decisions that are visible to a user. It covers the mood language, the conversation, the generation review, the album continuation, and the calendar page. Implementation details live in the code and in DH6012-Finalization.md.

## Mood language and colours

The colour coding follows [How We Feel](https://howwefeel.org/), whose colour-coded emotion selection is also described in [Apple's illustrated overview](https://apps.apple.com/ca/iphone/story/id1638393948). MoodMic uses the same energy-and-pleasantness idea with its own shades and its own interactions; it does not reproduce that interface.

The four groups appear in the mood picker of the prompt card, in the order red, yellow, blue, green. Each group name carries both axes in plain language ("High energy · unpleasant"), and the calendar legend repeats them in the same order.

| Colour | Meaning | Emotion words |
| --- | --- | --- |
| Coral red, #E87575 | High energy, unpleasant | Anxious, angry, frustrated, overwhelmed |
| Golden yellow, #E9BD46 | High energy, pleasant | Excited, joyful, energised, enthusiastic |
| Soft blue, #779DD6 | Low energy, unpleasant | Sad, lonely, drained, discouraged |
| Sage green, #83B59A | Low energy, pleasant | Calm, content, relaxed, peaceful |

Choosing a group shows its four words as rounded buttons. The word is what gets recorded; the colour is how the calendar reads it back. One colour per group, no extra shades for intensity, so the same red always means the same kind of feeling.

The four words are a starting vocabulary, not a closed list. A word typed into the picker replaces the choice and is stored as written, up to 64 characters, so "restless", "homesick" or "振奋" do not need to be one of the built-in sixteen. The calendar's colour editor offers the same field, and a typed word is displayed exactly as recorded.

Colour never carries the meaning alone. Every swatch sits next to an emotion word, text uses dark ink on pale surfaces, focus rings are visible from the keyboard, and a day with no music stays unfilled. Grey is not used for sadness.

The feeling a user records and the feeling they want the music to have are separate values. Someone can mark a red, restless day and still ask for something quiet. The calendar keeps the recorded colour; the requested musical mood lives in the prompt and in the generated specification, where words such as "nocturnal" describe sound rather than an emotion category.

## The conversation

MoodMic opens on a conversation, not a form. The first screen shows the heading, one line of guidance, four example mood cards, and the composer. Each example card carries a sentence in one feeling colour, plays a short audio example, and fills the composer with its text when the sentence is clicked. Nothing needs to be read before typing.

The user's message goes to the discussion agent, which replies in the same tone as the conversation. Before each reply the server retrieves up to three poems that match what the user has written, and the conversation names their titles and authors as inspiration for the piece. The poems are reference material for the agent; they are never quoted at the user and never reach the composer, which reads only the approved brief. Once a direction exists, MoodMic offers one action: turn the current agreement into a prompt. The prompt card then shows the editable text alongside the mood picker, so the recorded feeling and the requested music are visible at the same time and can still be changed.

Images can be attached to a message when a reference helps describe the sound. The transcript keeps them with the message they belong to.

## Confirming the Lyria prompt

Composing and generating are two decisions. The Composer first writes the music specification and its Lyria prompt, and the piece pauses there: the prompt is shown as editable text with a line saying that generation will follow the wording as confirmed. Editing it replaces the composed prompt before any audio exists; confirming without an edit generates from the composed text. No audio generation is requested before that confirmation, and the pause survives a refresh.

## Generation and review

Creation has no numbered steps. The interface shows the running state in plain words ("Shaping the arrangement", "Generating audio", "Post-processing") and never names the model in routine feedback.

Every MoodMic creation that generates audio runs a listening review. After Lyria returns audio, Gemini listens to it and compares it with the request. If the two broadly agree, the piece is delivered. If they clearly disagree, the piece is held and the interface asks "Does this music match what you asked for?", with the checkpoints that disagreed, the generated audio, and two choices: regenerate, or keep this one. Regenerating runs the same check again on the new attempt; keeping accepts the piece as it is. When the review itself cannot run, the piece is delivered unchanged and the result says so. A compose-only run stops after the arrangement text and skips the review.

The result card shows the title, the prompt as written, a player, a collapsible Lyria prompt, a download link, and the starting point for a new conversation. Earlier conversations stay in the left rail, titled by time and song title, and reopen with their audio after a refresh.

## The music reference setting

The prompt card carries one compact setting, "Music reference", with these choices: Auto, None, and every music type whose local corpus is available (Jazz today, plus Blues, Electronic, Instrumental Rock and Instrumental Hip-Hop once collected). Auto is the default: the Composer chooses exactly one supported type from the conversation's mood, imagery, instrumentation, energy, tempo or production language and records that choice in the retrieval trace. Choosing a specific type binds retrieval to it; None keeps the no-corpus path.

Natural-language requests remain authoritative. A clearly named type or child style (ambient, lo-fi hip-hop, post-rock, modal jazz, Chicago blues) selects that parent type; a genre outside the five supported types keeps the request as written and composes without corpus evidence. The interface names the retrieved poems, never the retrieved corpus text, and the setting can be changed before creation starts.

The option applies to the piece being made. An album inherits the music evidence through the music specification of the piece it grew from, and does not carry a second switch of its own.

## The album continuation

Keeping a piece adds a section to the result: "Turn this piece into an album". The source piece is fixed and shown by title and prompt, so the album cannot be planned from a different take. The user writes a theme, chooses 12 to 28 candidates and a target length of 30 to 70 minutes, and asks for a plan.

Planning pauses before any audio is generated. The album author presents how it read the source piece, the album idea, the shared sound, and the plan for each candidate, with a conversation for revisions. The user confirms a specific revision, and only then does generation start. Tracks appear as they finish and can be played while the rest are still being made. The same panel that shows progress also handles curation: include or exclude candidates, reorder the included set, retry a failed track, and export the album or its timestamps.

Refreshing the page returns to the same stage with the same actions. If the server stops, the interface offers to continue the album from the stage that failed, and finished tracks are not generated again.

## The mood calendar

The calendar is its own page (`/calendar.html`) reached from the main navigation; MoodMic's home stays a conversation. The month grid has weekday headings, previous and next month controls, and an outline around today, with the four-colour legend underneath.

A day's marker comes from the MoodMic pieces made that day. The marker is one colour when the day has one piece and equal colour segments, clockwise from the top, when it has several; the segments count pieces, never duration or intensity, and are never blended into a new colour. The day also shows how many pieces it holds and a music note when at least one has audio.

Choosing a day lists its pieces with the time they were created and their current status, plus the conversation each piece came from. A finished piece plays in the panel and can be downloaded; a failed one can be tried again as a new attempt, and the recorded mood colour can be edited from the same panel. Days without pieces carry no marker, and editing a colour changes the calendar without changing the music.

## Acceptance

The course demonstration shows the four-colour mood picker with a free-text emotion word, the editable brief and its named poem references, the editable Lyria prompt confirmed before generation, playback of generated pieces, the listening review with both keep and regenerate, the album continuation from a kept piece through plan confirmation, background generation, curation and export, and the calendar reading back the recorded colours with playable music. No numbered step indicator appears in either language.
