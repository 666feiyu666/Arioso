# Arioso Documentation

Arioso is an agentic music-composition workspace. An agent first turns a human idea into an explicit musical plan, then a music-generation model realizes that plan as audio. MoodMic, the conversational entry point, carries one piece from a described feeling through a listening review, and can continue a kept piece into an album. This file is the documentation entry point; long-term product intent and the implemented repository state are deliberately kept separate.

## Document map

- [`abstract.md`](abstract.md) defines the stable product idea, target architecture, and long-term boundaries. Read it to understand what Arioso is intended to become.
- [`current.md`](current.md) records what the repository implements now: MoodMic, the mood calendar, the playlist library, the journey from a piece to an album, the workflow studio, and how all of it differs from the target. Read it before planning an architectural change.
- [`development.md`](development.md) contains the commands and working practices for developing and testing the current implementation.
- [`background-music-producer.md`](background-music-producer.md) documents the optional album production workflow in the studio.
- [`nextphase-plan.md`](nextphase-plan.md) records what is in place for the mood-driven product and what is still open.
- [`DH6012-Documentation/`](DH6012-Documentation/) holds the course material: the project brief, the MoodMic experience and its decisions, the finalization record of the journey round, and the audio-quality plan (what exists and what is planned).

## Maintenance rule

Change `abstract.md` only when the product model, target workflow, or architectural boundaries change. Do not fill it with temporary model names, current class names, API routes, or short-lived implementation limitations.

Update `current.md` when code changes alter the implemented workflow, data model, persistence, interfaces, or known gaps. That includes the MoodMic and mood-entry records, the journey record and its endpoints, and the shared album stage. Source code, tests, configuration, and command help remain authoritative when the snapshot is stale.

Keep this file short. It should explain the documentation structure rather than duplicate either architecture document.
