# Arioso Abstract Architecture

## Product idea

Arioso is an agentic music-composition and album-production workspace. Before a
music-generation model creates sound, an agent-composer decides what the music
should become. It interprets the user's intent, retrieves musical context when
requested, and produces an inspectable plan covering form, instrumentation,
rhythm, harmony, dynamics, vocals, and production.

The generated audio realizes that plan. Arioso also keeps the plan, its evidence,
alternative takes, and the relationships among tracks, so creation continues
beyond one prompt and one file.

The user remains the artistic decision-maker: Arioso proposes structure,
generates candidates, and reports technical evidence, while musical quality stays
a listening decision.

## Core workflows

### Shaping the direction before composition

Every workflow begins by listening. The user states a rough intention; the agent
turns it into a production-useful direction, which the user confirms before any
plan is written. Direction is a distinct, revisable stage.

Listening may draw on reference material. The direction agent can read retrieved
poetry as evidence for imagery, atmosphere, movement, and emotional development,
while the user's own words stay authoritative: reference text informs an
interpretation and becomes neither quotation nor attribution. Reference material
belongs to the direction stage; the composer receives the confirmed direction,
not the sources behind it.

Arioso supports three scopes (a standalone piece, one multi-movement orchestral
work, and a themed album of related pieces) and three ways in: a conversation that
yields one piece, a studio workflow chosen up front, or an existing piece kept and
carried into an album.

### From one kept piece to an album

A piece carries the agreed direction that produced it, and it can become the first
reference for an album. The listener keeps the piece, states a theme, and confirms
how that theme was read before any track is generated. Tracks arrive as they
finish, and the listener curates the set: include, exclude, reorder, export.
Automated review reports resemblance to the brief; selection and sequencing stay
with the listener.

### Composition without a corpus

The baseline composer works from the user's brief and the model's internal
musical knowledge:

```text
Human idea -> Agent-composer -> Music plan -> Audio generator -> Candidate take
```

Assumptions introduced by the agent remain explicit and revisable.

### Composition with a corpus

The grounded composer retrieves relevant musical information before planning:

```text
Human idea -> Retrieval -> Musical references -> Agent-composer
           -> Music plan -> Audio generator -> Candidate take
```

The corpus is external musical memory, and retrieved material is evidence for
musical decisions. Arioso records what was retrieved and keeps reference titles
and implementation details out of the generation prompt unless the user asks for
them.

## First complete product outcome

A small, coherent album reached from one piece the listener kept. A user should
be able to:

- describe a feeling and settle a musical direction in conversation;
- listen to the piece that comes back and read how it was checked against the
  request;
- keep the piece or ask for another attempt;
- continue from a kept piece into an album, with its material as the first
  reference;
- confirm how the album author read the theme before any track is generated;
- hear tracks as they finish and keep listening while the rest are made;
- curate the result by including, excluding, ordering, and exporting tracks;
- add any finished piece to a playlist, sequence it across albums and
  conversations, and export it without generating anything.

## Project hierarchy

This hierarchy describes what Arioso generates. A playlist is not part of it; see
[Playlist](#playlist) below.

```text
Album
|- album brief and narrative arc
|- musical identity and production constraints
|- ordered tracks
|  `- Track
|     |- track brief and form
|     |- shared musical contract
|     |- ordered sections
|     |  `- Section
|     |     `- candidate takes
|     `- selected assembly and final mix
`- sequencing, metadata, and album export
```

### Album

The album is the top-level creative project. It owns the concept, track order,
shared sound world, recurring ideas, production constraints, and release-level
metadata. Cohesion allows variety: each track holds a distinct function within the
album arc.

### Track

A track owns its musical purpose, form, instrumentation, vocal policy, target
duration, and relationship to the album. A short track may be realized in one
generation. A long-form track is planned as a sequence of sections before any
section is generated.

### Musical contract

Sections of one track share a musical contract describing the features that must
survive separate generations: tonal language, tempo strategy, meter, instrumental
palette, thematic material, production space, dynamic trajectory, and transition
intent. The contract distinguishes invariants from parameters that are expected to
develop or transform.

Text descriptions cannot guarantee thematic continuity. Where exact recurrence
matters, the architecture permits explicit representations (notation, MIDI,
motifs, reference audio, or another model-specific conditioning format) alongside
the project plan.

### Section and take

A section is a planned span with a dramatic function and explicit entry and exit
conditions. Each generation creates a take associated with the exact prompt,
model, retrieval evidence, settings, and resulting audio. Takes are immutable
evidence; selection and assembly reference them by identity.

### Assembly and album finishing

Assembly joins selected section takes and records every transition decision.
Technical processing may include trimming, overlap, crossfade, timing alignment,
level matching, loudness measurement, and format conversion. Album finishing
orders the tracks and applies release-level consistency without erasing the
intended dynamics of individual works.

### Playlist

A playlist sits outside this hierarchy. It is the listener's own sequencing of
pieces that already exist, from one album, from several, or from single
conversations, and it owns only their order, their name, and its cover. Nothing in
a playlist is generated, and an album never depends on one existing. Because it
references rather than copies, a playlist outlives an album it drew from: the
pieces that no longer resolve are reported as missing instead of disappearing.

## Boundaries

Out of scope:

- a general-purpose digital audio workstation;
- an autonomous system that chooses and publishes its own album;
- a mechanism for imitating a living artist or reproducing protected lyrics or
  melodies;
- a system that treats retrieved sources as generation instructions;
- a benchmark that reduces musical success to schema validity or signal-level
  measurements.

Manual editing and external production tools remain part of the workflow where
they give better musical control than an in-project approximation.

## Architectural invariants

1. A confirmed creative direction precedes planning, and planning precedes audio
   generation; both remain inspectable afterward.
2. The album is the top-level project; tracks, sections, and takes have stable
   identities beneath it.
3. Generated audio is a realization and an evidence item; the project also holds
   the plan, the takes, and their relationships.
4. Corpus retrieval is explicit, traceable, and separated from model-only
   composition.
5. Retrieved text is untrusted reference evidence, never hidden instructions.
6. Long-form music is planned as sections, then generated and assembled.
7. Candidate takes are preserved; selection and assembly do not rewrite their
   provenance.
8. Validation reports technical evidence; artistic judgement belongs to the
   listener.
9. The user authorizes final musical selection, sequencing, and export.
10. Audio is generated only for an album or a single piece. A playlist sequences
    what exists and never generates, so its lifecycle is independent of the
    albums and conversations it draws from.
