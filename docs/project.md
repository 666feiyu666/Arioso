# Arioso Documentation

Arioso is an agentic music-composition workspace. An agent first turns a human
idea into an explicit musical plan, then a music-generation model realizes that
plan as audio. MoodMic, the conversational entry point, carries one piece from a
described feeling through a listening review, and can continue a kept piece into
an album.

## Document map

- [`abstract.md`](abstract.md): the stable product idea, target architecture, and
  long-term boundaries.
- [`current.md`](current.md): what the repository implements now, including the
  MoodMic and mood-entry records, the journey and its endpoints, the album and
  playlist objects, the workflow studio, the optional album producer, and the gaps
  against the target.
- [`development.md`](development.md): commands and working practices for
  developing, testing, and rebuilding corpus material.
- [`nextphase-plan.md`](nextphase-plan.md): what remains to deliver, and in what
  order.

## Maintenance rule

Change `abstract.md` only when the product model, target workflow, or architectural
boundaries change. Do not fill it with temporary model names, current class names,
API routes, or short-lived limitations.

Update `current.md` when code changes alter the implemented workflow, data model,
persistence, interfaces, or known gaps. Source code, tests, configuration, and
command help remain authoritative when the snapshot is stale.

Keep this file to the document map; the architecture documents carry the detail.
