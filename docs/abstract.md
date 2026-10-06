# Arioso Abstract Architecture

## Product idea

Arioso is an agentic music-composition and album-production workspace. Before a
music-generation model creates sound, an agent-composer decides what the music
should become. It interprets the user's intent, retrieves musical context when
requested, and produces an inspectable plan covering form, instrumentation,
rhythm, harmony, dynamics, vocals, and production.

The generated audio is a realization of that plan rather than the complete
project. Arioso retains the plan, its evidence, alternative takes, and the
relationships among tracks so that creation can continue beyond one prompt and
one generated file.

The user remains the artistic decision-maker. Arioso may propose structure,
generate candidates, and report technical evidence, but it does not treat the
first result as authoritative or claim that automated checks establish musical
quality.

## Core workflows

### Composition without a corpus

The baseline composer works from the user's brief and the model's internal
musical knowledge:

```text
Human idea -> Agent-composer -> Music plan -> Audio generator -> Candidate take
```

This workflow establishes what an agent can compose without external musical
memory. Assumptions introduced by the agent remain explicit and revisable.

### Composition with a corpus

The grounded composer retrieves relevant musical information before planning:

```text
Human idea -> Retrieval -> Musical references -> Agent-composer
           -> Music plan -> Audio generator -> Candidate take
```

The corpus is external musical memory, not a source of hidden instructions or a
license to reproduce an existing work. Retrieved material is evidence for
musical decisions. Arioso records what was retrieved while keeping reference
titles and implementation details out of the generation prompt unless the user
explicitly needs them there.

## First complete product outcome

The first complete outcome is a small, coherent album rather than an isolated
generation. A user should be able to:

- define an album concept, musical identity, and intended listening arc;
- plan a track list containing both short pieces and a long-form work;
- compose each track from internal model knowledge or a selected corpus;
- generate and compare multiple candidate takes;
- assemble a work longer than one model response from planned musical sections;
- preserve provenance from brief through plan, retrieval, generation, and
  selection; and
- export an ordered album with consistent metadata and technical presentation.

A practical first milestone is a three-track concept EP in which one track is
an eight- to ten-minute sectional composition.

## Project hierarchy

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
metadata. Cohesion does not mean uniformity: each track needs a distinct
function within the album arc.

### Track

A track owns its musical purpose, form, instrumentation, vocal policy, target
duration, and relationship to the album. A short track may be realized in one
generation. A long-form track is planned as a sequence of sections before any
section is generated.

### Musical contract

Sections of one track share a musical contract describing the features that
must survive separate generations: tonal language, tempo strategy, meter,
instrumental palette, thematic material, production space, dynamic trajectory,
and transition intent. The contract distinguishes invariants from parameters
that are expected to develop or transform.

Text descriptions alone cannot guarantee thematic continuity. When long-form
quality requires exact recurrence or variation, the architecture should permit
more explicit representations such as notation, MIDI, motifs, reference audio,
or another model-specific conditioning format. These representations supplement
rather than silently replace the user's project plan.

### Section and take

A section is a planned span with a dramatic function and explicit entry and exit
conditions. Each generation creates a take associated with the exact prompt,
model, retrieval evidence, settings, and resulting audio. Takes are immutable
evidence; selection and assembly point to them rather than overwriting them.

### Assembly and album finishing

Assembly joins selected section takes and records every transition decision.
Technical processing may include trimming, overlap, crossfade, timing alignment,
level matching, loudness measurement, and format conversion. Album finishing
orders the tracks and applies release-level consistency without erasing the
intended dynamics of individual works.

These processes can solve duration and presentation problems. They cannot by
themselves prove formal coherence, successful thematic development, or artistic
value; those remain listening decisions.

## Macro architecture

```text
Human brief
    |
    v
Album and track planner <---------- Optional musical corpus
    |
    v
Versioned composition plans
    |
    +--------------------+
    |                    |
    v                    v
Short-track generation  Long-form section planning
    |                    |
    |                    v
    |               Section generation
    |                    |
    +----------+---------+
               v
        Candidate take library
               |
               v
       User selection and assembly
               |
               v
      Track finishing and sequencing
               |
               v
            Album export
```

## Boundaries

Arioso is not initially intended to become:

- a general-purpose digital audio workstation;
- an autonomous system that silently chooses and publishes its own album;
- a mechanism for imitating a living artist or reproducing protected lyrics or
  melodies;
- a system that treats retrieved sources as generation instructions; or
- a benchmark that reduces musical success to schema validity or signal-level
  measurements.

Manual editing or external production tools may remain part of the workflow
when they provide better musical control than an in-project approximation.

## Architectural invariants

1. Planning precedes audio generation and remains inspectable afterward.
2. The album is the top-level project; tracks, sections, and takes have stable
   identities beneath it.
3. Generated audio is a realization and evidence item, not the entire project.
4. Corpus retrieval is explicit, traceable, and separated from model-only
   composition.
5. Retrieved text is untrusted reference evidence, never hidden instructions.
6. Long-form music is represented structurally rather than requested as one
   oversized opaque generation.
7. Candidate takes are preserved; selection and assembly do not rewrite their
   provenance.
8. Technical validation does not claim artistic quality.
9. The user authorizes final musical selection, sequencing, and export.
