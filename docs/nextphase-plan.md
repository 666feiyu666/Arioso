# Next phase plan

## Goal

A background-music generator that responds to the listener's mood: describe how the day feels, and get instrumental music that fits it, then a longer set built from what worked.

## Already in place

- Mood direction prompting. MoodMic holds a conversation, turns the agreement into an editable brief and then an editable Lyria prompt it confirms before generating, and records the chosen mood colour and word. A classifier reads a feeling from free text.
- A listening review. Gemini compares each generated piece with the request before the listener keeps it.
- A continuous journey. A kept piece becomes the first reference for an album, with plan confirmation, background generation, curation, and export.
- Retrieval. The jazz corpus is searchable and feeds composition as evidence, with the query and reference ids kept on the task. MoodMic also retrieves poems before each reply from a bilingual corpus, names them as inspiration, and keeps a bounded trace instead of the poem text.
- LangGraph coordination. Separate bounded graphs cover the discussion phases, the MoodMic generation check, and the journey stages.
- Two pages beyond MoodMic. The mood calendar reads back recorded colours and playable pieces, and the playlist page plans albums from released pieces.

## Next

- One coordinating agent across inputs. Today the user describes the mood in words and can attach reference images; nothing coordinates an image, a style, and a requirement in one pass, and image generation is not planned.
- A mood language and imagery corpus. The picker still offers four colour groups with four words each, but any word the listener types is recorded as written and the classifier lexicon is bilingual. The larger vocabulary of places, weather, bodily sensation, and movement has not been built.
- A live evaluation of poetry-informed direction. Deterministic tests cover retrieval, reuse, fail-open, and the prompt handoff; whether the poems make the Director's creative description more specific, and whether the two-paragraph brief helps the Composer, still needs a fixed comparison with and without retrieval.
- Standalone audio defect assessment. The current review judges whether the music matches the request; finding clicks, dropouts, and damaged audio is separate work, described in `DH6012-Documentation/DH6012-Audio-Quality-Workflow.md`.
- A real-provider end-to-end run of the journey. All journey verification so far uses fake audio and model responses.
- Section-and-take structure for long-form music, so a long track can be generated in planned sections and assembled rather than requested as one opaque generation.
- Concurrent candidate generation, if waiting time becomes the limiting factor for curation.

## Open questions

- Whether the review should block delivery or only inform the listener.
- How much of the album plan the listener should be asked to confirm before paying for generation.
- Whether the mood vocabulary should stay four colours or grow into the larger imagery corpus above.

## Not planned

- A general multi-agent platform. The existing graphs are bounded on purpose.
- Automatic mastering or noise cancellation inside the generation flow; that remains a separate production step.
