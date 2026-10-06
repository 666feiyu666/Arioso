# Arioso Current Implementation

This document describes the repository as it exists now. It is an evolving
snapshot, not the target architecture. See [`abstract.md`](abstract.md) for the
stable product model.

## Current shape

Arioso is a Node.js and TypeScript application with two interfaces over one
composition pipeline:

- a command-line interface for composing a validated prompt or composing and
  generating one audio file; and
- a local browser interface for selecting a workflow, managing generation
  tasks, viewing composition details, and playing completed audio.

The system currently treats each request as an independent music task. It can
produce a structured `MusicSpec`, send its final prompt to Google Lyria, and
retain the resulting MP3 and task metadata. It does not yet have album, track,
section, take-selection, or assembly entities.

## Implemented flow

```text
User description and explicit UI settings
        |
        +------------------------------+
        |                              |
        v                              v
No-corpus workflow             Jazz corpus workflow
                                       |
                                       v
                              Local corpus retrieval
        |                              |
        +---------------+--------------+
                        v
               OpenAI Composer Agent
                        |
                        v
              Validated MusicSpec 1.0
                        |
             +----------+----------+
             |                     |
             v                     v
       Compose-only result    Lyria generation
                                     |
                                     v
                              MP3 and task record
```

The composer loads a local skill and Lyria prompting reference, combines them
with host instructions and user-selected vocal and corpus modes, and requests a
schema-constrained result through the OpenAI Agents SDK. The final
`lyriaPrompt` is intended to stand alone.

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

## Lyria integration

`LyriaClient` uses the Google Gen AI Interactions API. It sends one text prompt
to a selected model and expects base64-encoded audio, which it saves as MP3.
The current interfaces expose:

- `lyria-3-clip-preview` for a 30-second clip; and
- `lyria-3.5` for a complete song.

Generation is one request per task. Arioso does not currently submit reference
audio, continue from a previous result, generate multiple takes, join sections,
or perform post-generation audio analysis and mastering.

## Command-line interface

The CLI provides two commands:

- `compose` prints a validated `MusicSpec` without calling Lyria; and
- `generate` composes a `MusicSpec`, calls Lyria, and writes a timestamped MP3
  plus JSON metadata under the configured output directory.

The JSON metadata records the original description, model names, generated
text when present, audio filename, creation time, and complete `MusicSpec`.

## Browser interface and local server

The local web application provides:

- a choice between no-corpus and Jazz-corpus workflows;
- compose-only and compose-and-generate task modes;
- Lyria model and vocal-policy controls;
- Chinese and English interface text;
- example briefs for the available workflows;
- task status and detail views;
- retrieval query and reference-identifier display;
- MP3 playback with HTTP byte-range support;
- retry of failed tasks; and
- local API-key and language settings.

Tasks move through `queued`, `composing`, `generating`, `completed`, or `failed`
states. Each task is saved as JSON under `outputs/tasks` by default; its audio is
stored in the same directory. When the server starts, interrupted active tasks
are marked failed rather than resumed automatically. Retrying reuses an existing
`MusicSpec` when one was already produced.

Credentials may be held for the current server session or, with explicit user
selection, written to the local `.env`. The settings API returns only masked
credential summaries and never the complete stored value.

## Configuration

The runtime reads:

- `OPENAI_API_KEY` for composition;
- `OPENAI_MODEL`, defaulting to `gpt-6-sol`;
- `GEMINI_API_KEY` when audio generation is requested;
- `LYRIA_MODEL`, defaulting to `lyria-3-clip-preview`;
- `ARIOSO_OUTPUT_DIR`, defaulting to `outputs`;
- optional paths for the composer skill, Jazz corpus, settings, and `.env`; and
- optional web host and port settings.

Secrets belong in the local `.env` or the in-memory settings session. They must
not be written into project documentation, task metadata, or source control.

## Differences from the abstract architecture

The current implementation establishes the single-piece planning and generation
baseline, but the album-oriented architecture has not yet been implemented:

- there is no `Album -> Track -> Section -> Take` project hierarchy;
- tasks are independent and cannot share an album identity or musical contract;
- a structured section list produces one prompt rather than separately
  generated and assembled section takes;
- there is no long-form continuation, transition generation, beat or key
  alignment, crossfade, loudness matching, or final assembly;
- there is no candidate comparison or explicit user selection record;
- there is no album sequencing, release metadata, or album-level export;
- corpus selection is fixed to either none or the local Jazz workflow; and
- evaluation covers schemas and application behavior, not listening-based
  coherence or album-level diversity.

The next architectural step should introduce persistent album and track plans
before adding audio assembly. This prevents long-form generation from becoming
an isolated file-stitching feature with no stable musical context.

## Authoritative implementation references

- CLI: `src/cli.ts`
- public exports: `src/index.ts`
- composer agent and retrieval tool: `src/composer/composer-agent.ts`
- local composer instructions: `skills/composer-skill/`
- `MusicSpec` schema: `src/schema/music-spec.ts`
- Jazz retrieval: `src/retrieval/jazz-retriever.ts`
- Lyria adapter: `src/lyria/lyria-client.ts`
- settings and credential storage: `src/config/settings.ts`
- local server and task persistence: `src/web/server.ts`
- browser client: `web/`
- regression behavior: `test/`

When exact behavior matters, inspect these sources and the current command help
rather than relying on this snapshot alone.
