# Arioso Current Implementation

This document describes the repository as it exists now. It is an evolving
snapshot, not the target architecture. See [`abstract.md`](abstract.md) for the
stable product model.

## Current shape

Arioso is a Node.js and TypeScript application with two interfaces over one
agentic composition pipeline:

- a command-line interface for composing a validated prompt or composing and
  generating one audio file; and
- a local browser interface for choosing a workflow, discussing creative
  direction, managing generation tasks, inspecting composition details, and
  playing completed audio.

One pipeline covers three scopes — a standalone piece (`compositionMode:
"single"`), a multi-movement orchestral work (`"orchestral"`), and a themed
album of candidates (`"album"`) — with an optional direction conversation before
composition. It produces a structured plan, sends its final prompt to Lyria, and
retains the audio and task metadata. Albums add candidates, an inclusion record,
a playlist, and an optional denoising step; orchestral works add movements, a
shared contract, and assembled audio.

## Implemented flow

```text
Human intention
        |
        v
Direction discussion (prompt director)          <- optional, browser
        |
        v
Confirmed request and explicit UI settings
        |
        +---------------------+----------------------+
        |                     |                      |
        v                     v                      v
Single, no corpus      Single, Jazz corpus    Orchestral / Album
        |                     |                      |
        |             Local corpus retrieval   Plan + shared contract
        |                     |                      |
        +----------+----------+                      |
                   v                                 v
          OpenAI Composer Agent              Multiple generation units
                   |                       (movements or candidate tracks)
                   v                                 |
         Validated MusicSpec 1.0                     |
                   |                                 |
        +----------+----------+                      |
        |                     |                      |
        v                     v                      v
  Compose-only result   Lyria generation   Orchestral assembly /
                              |             album playlist and export
                              v
                       MP3 and task record
```

Before composition, an optional direction conversation (the
`prompt-directing-skill`) turns the user's intent into a concise request; a
LangGraph state graph tracks its `discussion`, `proposal`, and `execution`
phases. The composer combines a local skill, the Lyria prompting reference, host
instructions, and the selected vocal and corpus modes, and requests a
schema-constrained result through the OpenAI Agents SDK. The final `lyriaPrompt`
stands alone.

## Creative direction

Before any task exists, the browser can hold a direction conversation. A
`CreativeSession` records messages, image attachments, the requested scope, and a
proposal. The `prompt-directing-skill` guides two phases — `discussion` and
`proposal` — and outputs a concise request the user may edit and approve. Only
approval creates a `MusicTask`, which records the originating
`sourceDiscussionId`. Sessions and tasks persist separately; a LangGraph state
graph (`src/discussion/session-graph.ts`) resolves the visible phase across
`discussion`, `proposal-ready`, and the task's own status.

## Music specification

`MusicSpec` schema version `1.0` contains:

- a working title and creative intent;
- ordered genre and mood descriptions;
- tempo, rhythmic feel, tonality, and meter;
- instruments with their musical roles and timbres;
- an ordered structure with approximate section durations and directions;
- vocal enablement, language, style, and lyrical theme;
- production direction and excluded elements;
- explicit assumptions introduced by the composer; and
- one production-ready Lyria prompt.

The schema describes one piece. Its sections are prompt-planning records, not
independently generated objects, and the current pipeline does not calculate or
enforce their combined duration.

## Composition modes

### Without a corpus

The default workflow relies on the model's musical knowledge. The composer is
instructed not to claim that external references were retrieved.

### Jazz corpus

The Jazz workflow exposes one local retrieval tool to the composer. The agent
must call it once with a concise English query and request three to five
references. The current retriever:

- reads `corpus/jazz/jazz_standards.combined.normalized.jsonl` by default;
- excludes records without sufficient musical evidence;
- tokenizes English musical descriptions and removes a fixed stop-word set;
- builds in-memory TF-IDF-style weights; and
- ranks results by cosine similarity, returning at most five records.

The task record retains the retrieval query and selected reference identifiers.
The composer is instructed to use relevant musical evidence without placing
retrieval mechanics, source titles, or scores in the Lyria prompt.

The repository also contains raw and manifest data for Jazz genres and
standards plus normalization tooling. The runtime retriever currently searches
the combined normalized standards corpus only. It contains 354 Wikipedia source
records and 252 tune discussions from Ted Gioia's *The Jazz Standards: A Guide
to the Repertoire* (2012), for 606 source records. Of these, 520 have musical
evidence and are searchable. One tune discussed in two sources counts as two
text records; this total does not mean 606 different compositions.

The book's raw and normalized data are stored separately as
`corpus/jazz/gioia_2012.*`. Every chapter retains Zotero item and attachment keys,
the PDF fingerprint, printed and PDF page ranges, and an author citation.
Recommended-recording lists are preserved in the raw data but excluded from
musical retrieval evidence. Retrieved references retain their source metadata.
Book-derived text is marked all rights reserved, separately from Wikipedia's
license. Both source corpora remain available for comparison; set
`ARIOSO_JAZZ_CORPUS` to either normalized source file to use it independently.

### Orchestral works

The `orchestral` scope plans one multi-movement work first. `OrchestralWorkPlan`
(1.0) fixes a shared contract (tonal world, identity motif, orchestra, acoustic
space, dynamic language, exclusions) and two to six movements, each with a
dramatic role, tempo and meter, motif development, orchestration arc, and
entrance/exit contracts. Each movement fits one Lyria 3.5 generation, and the
planned total is five to eleven minutes. Movements are generated in order and
assembled; the task records the plan, movement status, and assembly metadata.
Optional knowledge cards (`src/retrieval/orchestral-cards.ts`) can seed it.

### Themed albums

The `album` scope plans a cohesive set of candidates rather than one work. The
album agent produces an `AlbumPlan` (1.0): a shared sound contract, a cohesion
strategy, and 12–28 consecutively numbered outlines of 60–180 seconds each, with
at least three distinct durations. A reviewer pass (`AlbumReview`) records
similarities and per-candidate verdicts. Each candidate is composed and
generated into an `AlbumTrackTask`; the task tracks admissions (`candidate`,
`included`, `excluded`), revisions, and an ordered `albumPlaylist` that can be
reordered and retried.

### Album production and export

An album exports as a merged MP3 with per-track timestamps
(`/api/tasks/<id>/album/export`). Optionally the Background Music Producer
(`produceAlbum: true`) denoises all non-excluded candidates into a single-channel
44.1 kHz 24-bit WAV album plus an MP4 and a manifest, stored under the task's
`production/` directory and served from `/api/tasks/<id>/production/...`; see
[`background-music-producer.md`](background-music-producer.md).

## Lyria integration

`LyriaClient` uses the Google Gen AI Interactions API. It sends one text prompt
to a selected model and expects base64-encoded audio, which it saves as MP3.
The current interfaces expose:

- `lyria-3-clip-preview` for a 30-second clip; and
- `lyria-3.5` for a complete song.

A single piece is one request per task; orchestral works and albums issue one
request per movement or candidate, then assemble or export. Arioso does not
submit reference audio, continue a previous result, generate multiple takes of a
target, join sections, or master; the optional producer denoises only.

## Command-line interface

The CLI provides several commands:

- `compose` prints a validated `MusicSpec` without calling Lyria;
- `generate` composes a `MusicSpec`, calls Lyria, and writes a timestamped MP3
  plus JSON metadata under the configured output directory;
- `stitch` joins existing audio files; and
- `produce-album` plans, reviews, generates, denoises, and exports an
  instrumental album (`--resume` continues a failed production task).

The JSON metadata records the original description, model names, generated
text when present, audio filename, creation time, and complete `MusicSpec`.

## Browser interface and local server

The local web application provides:

- four workflows (no-corpus single, Jazz-corpus single, orchestral
  multi-movement, themed album);
- a direction conversation with text and image input, an editable proposal, and
  explicit approval before handoff;
- compose-only and compose-and-generate modes;
- Lyria, vocal-policy, corpus, album, and production-workflow settings, plus
  optional orchestral knowledge cards;
- status and detail views for all three scopes, including movements and album
  candidates;
- album candidate listening, inclusion controls, playlist ordering, MP3 export,
  and producer artifacts;
- retrieval query and reference display;
- bilingual (Chinese and English) text with per-workflow examples;
- MP3 playback with HTTP byte-range support;
- retry of failed tasks; and
- local API-key and language settings.

Tasks move through `queued`, `composing`, `generating`, `assembling`,
`processing`, `completed`, or `failed`. Each is saved as JSON under
`outputs/tasks` with its audio; interrupted active tasks are marked failed on
startup rather than resumed. Retrying reuses an existing `MusicSpec` when
present. A task carries a `workflowType`, a `compositionMode`, and its
scope-specific records (`albumPlan`, `albumTracks`, `orchestralPlan`,
`movements`, `albumProduction`).

Credentials may be held for the current server session or, with explicit user
selection, written to the local `.env`. The settings API returns only masked
credential summaries and never the complete stored value.

Creative discussions persist separately under `outputs/discussions`; uploaded
JPEG, PNG, and WebP references are stored as attachment files rather than
embedded in session JSON. Discussion turns do not create tasks.

The browser presents the discussion and its linked task as one continuous
creative-session timeline. A LangGraph state graph resolves the visible phase
from discussion state and the latest task state, covering discussion, prompt
approval, queueing, composition, generation, assembly, processing, completion,
and failure. `MusicTask` remains a separate execution record for recovery and
retry, while the sidebar and workspace use the parent creative session whenever
one exists. Legacy tasks without a session remain available.

## Configuration

The runtime reads:

- `OPENAI_API_KEY` for composition;
- `OPENAI_MODEL`, defaulting to `gpt-6-sol`;
- `GEMINI_API_KEY` when audio generation is requested;
- `LYRIA_MODEL`, defaulting to `lyria-3-clip-preview`;
- `ARIOSO_OUTPUT_DIR`, defaulting to `outputs`;
- optional paths for the composer skill, the prompt-directing skill, Jazz corpus,
  settings, and `.env`;
- optional web host and port settings; and
- optional producer pipeline paths (`ARIOSO_PIPELINE_PYTHON`,
  `ARIOSO_PIPELINE_CONFIG`).

Secrets belong in the local `.env` or the in-memory settings session. They must
not be written into project documentation, task metadata, or source control.

## Differences from the abstract architecture

The implementation now covers the three scopes and an album candidate flow, but
parts of the abstract architecture remain unimplemented:

- no persistent `Album -> Track -> Section -> Take` hierarchy; an album is one
  task with `AlbumTrackTask` records, not nested projects;
- candidates share only the plan's sound contract and the playlist, not a stable
  album identity;
- a section list still produces one prompt, not separately generated and
  assembled takes;
- orchestral assembly joins whole movements; no section-level continuation,
  transition generation, beat or key alignment, crossfade, or loudness matching;
- no take-level comparison or retention of superseded generations;
- no release-level metadata;
- corpus selection is none or Jazz only; and
- evaluation covers schemas and behavior, not listening coherence or album
  diversity.

The next step is persistent album and track plans before extending assembly, so
long-form generation does not become isolated file-stitching.

## Authoritative implementation references

- CLI: `src/cli.ts`
- public exports: `src/index.ts`
- composer agent and retrieval tool: `src/composer/composer-agent.ts`
- orchestral composer agent: `src/composer/orchestral-agent.ts`
- album composer agent: `src/composer/album-agent.ts`
- local composer instructions: `skills/composer-skill/`
- `MusicSpec` schema: `src/schema/music-spec.ts`
- orchestral plan schema: `src/schema/orchestral-plan.ts`
- album plan schema: `src/schema/album-plan.ts`
- Jazz retrieval: `src/retrieval/jazz-retriever.ts`
- orchestral knowledge cards: `src/retrieval/orchestral-cards.ts`
- Lyria adapter: `src/lyria/lyria-client.ts`
- settings and credential storage: `src/config/settings.ts`
- local server and task persistence: `src/web/server.ts`
- creative discussion sessions: `src/discussion/`
- local prompt-directing instructions: `skills/prompt-directing-skill/`
- creative-session state graph: `src/discussion/session-graph.ts`
- background music producer: `src/producer/`
- browser client: `web/`
- regression behavior: `test/`

When exact behavior matters, inspect these sources and the current command help
rather than relying on this snapshot alone.
