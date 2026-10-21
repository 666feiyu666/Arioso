# Arioso Current Implementation

This document describes the repository as it exists now. It is an evolving snapshot, not the target architecture. See [`abstract.md`](abstract.md) for the stable product model.

## Current shape

Arioso is a Node.js and TypeScript application with two interfaces over one agentic composition pipeline:

- a command-line interface for composing a validated prompt or composing and generating one audio file; and
- a local browser application with five pages: MoodMic (`/`), the mood calendar (`/calendar.html`), the playlist library (`/playlist.html`), the workflow studio (`/workflow.html`), and help (`/help.html`).

MoodMic is the everyday entry point. It records a feeling, holds a creative conversation, composes and generates one piece, has Gemini listen to it, and lets the user keep or regenerate the result. A kept piece can continue into an album without leaving the conversation.

The workflow studio exposes the older, wider surface: a direction discussion followed by a standalone piece, a music-corpus piece, a multi-movement orchestral work, or a themed album of candidates. The playlist page builds an album from released MoodMic pieces. All of these share the composer agents, the Lyria adapter, and the task store.

The pipeline covers three composition modes: `single`, `orchestral`, and `album`, across five workflow types: `01-general`, `02-music`, `03-orchestral`, `04-album`, and `05-playlist`. Historical records that stored `02-jazz` are read as `02-music`.

## MoodMic

A MoodMic conversation keeps its own record, separate from the workflow studio's discussion sessions:

- `outputs/moodmic/chats/<id>/session.json` holds the transcript, image attachments, the proposal, and the task ids the conversation produced;
- `outputs/moodmic/entries.json` holds mood entries: a calendar date, a colour group, an emotion word, an optional note, an optional "how I want the music to feel" note, and the task ids linked to that entry.

The interface shows four colour groups (red, yellow, blue, green) with four emotion words each, from `web/mood-common.js`. The colour is what the calendar reads back; the word is what the entry records.

Submitting a conversation creates one `MusicTask` with `moodChatId` set. That flag makes the task run the listening review instead of a plain generation:

```text
prompt + music specification
        |
        v
   Lyria generation
        |
        v
 Gemini listening review
        |
   match|mismatch
        |
        +--> match: task completed, piece delivered
        |
        +--> mismatch: task paused in "review"
                          |
                          +--> keep: completed
                          +--> regenerate: queued, generate and review again
```

The review compares the audio with the approved request, using the task description and the `MusicSpec`. It returns a verdict, a summary, matched and mismatched points, the model name, and the attempt number, all stored on the task as `musicReview`. When the reviewer cannot run, the piece is delivered with a summary saying so. `POST /api/tasks/<id>/review` records the user's keep or regenerate decision.

The mood calendar reads the MoodMic chats and their latest task, so each conversation contributes one piece. Each day shows the pieces made that day, coloured by the recorded mood entry (the brand colour when no entry exists), with equal colour segments when a day has several pieces. The detail panel plays finished audio, downloads it, retries a failed attempt, opens the originating conversation, and edits the recorded mood colour.

## The journey from a piece to an album

`MusicJourney` is a small persistent record in `outputs/journeys/<id>.json` that links a mood conversation, its kept song, and the album planned from it. It stores only identifiers and a phase:

```text
mood -> song-running -> song-review -> song-ready
     -> album-planning -> album-review -> album-running -> album-curation -> completed
any active stage -> failed
```

A LangGraph state graph in `src/journey/journey-graph.ts` holds the legal transitions and the human gates. Each phase is a node; events such as `song-reviewing`, `song-kept`, `continue-album`, `plan-ready`, `plan-revised`, `plan-approved`, `album-complete`, and `retry` are the edges. The runtime derives the phase from the linked tasks when a journey is read, so a refresh restores the stage and the available actions.

Journey operations:

```text
GET  /api/journeys/:id
POST /api/journeys/:id/continue-album
POST /api/journeys/:id/album-plan/messages
POST /api/journeys/:id/album-plan/approve
POST /api/journeys/:id/retry
```

The identifier can be the journey id, the mood chat id, or either linked task id. `continue-album` binds the album to one exact, finished, kept song from that conversation and uses its prompt and `MusicSpec` as the first playlist reference. It refuses an unfinished song, a song from another conversation, or a missing theme, and repeated calls return the existing album.

Planning pauses before any audio exists. Approval is bound to `albumPlanRevision` on the album task and is persisted before generation is dispatched; a later revision increments the revision number and clears `playlistPlanApproved`, invalidating the earlier approval. Generation runs in the background, each track is saved as it finishes, and the interface adds it to the curation list immediately.

## The playlist library

The playlist page lists every `05-playlist` task, and its creation flow picks released MoodMic pieces as references:

- `GET /api/playlists/references` returns the MoodMic creations that can be referenced, with their audio URL and `MusicSpec`;
- `POST /api/playlists` creates the album task with those references;
- `POST /api/tasks/<id>/plan/approve` and `POST /api/tasks/<id>/plan/messages` confirm or revise the plan before generation.

The plan itself comes from `planPlaylist`, which also returns a briefing: how the author read each reference and the user's theme. The playlist page and MoodMic render the same plan, progress, player, and curation views from `web/album-view.js`.

## Workflow studio and creative direction

Before any task exists, the workflow studio can hold a direction conversation. A `CreativeSession` records messages, image attachments, the requested scope, and a proposal. The `prompt-directing-skill` guides two phases, `discussion` and `proposal`, and outputs a concise request the user may edit and approve. Only approval creates a `MusicTask`, which records the originating `sourceDiscussionId`. Sessions and tasks persist separately; a LangGraph state graph (`src/discussion/session-graph.ts`) resolves the visible phase across `discussion`, `proposal-ready`, and the task's own status.

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

The schema describes one piece. Its sections are prompt-planning records, not independently generated objects, and the pipeline does not calculate or enforce their combined duration.

## Composition modes

### Without a corpus

The default workflow relies on the model's musical knowledge. The composer is instructed not to claim that external references were retrieved.

### Music corpus

One bounded retrieval tool serves five music types: `jazz`, `blues`, `electronic`, `instrumental-rock`, and `instrumental-hip-hop`. The Composer calls `search_music_corpus` once, names exactly one type, and records whether the user, the interface, or the Composer chose it. Recognized child styles map to their parent type before retrieval (ambient to electronic, lo-fi hip-hop to instrumental-hip-hop, post-rock to instrumental-rock, modal jazz to jazz, Chicago blues to blues). A request outside the five types stays valid: the Composer uses the no-corpus path and does not claim retrieval.

Each type keeps two independent TF-IDF indexes:

- `styles.normalized.jsonl` describes the audible conventions of a genre or subgenre;
- `standards.normalized.jsonl` describes representative works that demonstrate them.

The runtime reads `corpus/music/<type>/` (override with `ARIOSO_MUSIC_CORPUS_ROOT`). A description search returns up to two styles and up to three standards, five references in total. A title search reads standards only, normalizes case, punctuation, whitespace and diacritics, and returns exact matches; no match is reported as an evidence gap rather than filled with a similar work. Retrieved text is reference evidence: the Composer may use instrumentation, rhythm, texture, harmony, form, or production details, but must not mention retrieval, scores, or reference titles in the Lyria prompt. A missing or malformed collection makes that music type explicitly unavailable instead of failing the run.

Only types with both normalized collections are offered by the capabilities endpoint, the workflow selector, and MoodMic. Jazz is the populated type today; the other four await source collection, so the generic interfaces stay bounded to what the corpus actually supports. Each task stores a `musicRetrieval` trace: music type, selection source, query, mode, style reference IDs, and standard reference IDs. Historical tasks that stored `corpusMode: "jazz"` and a `retrievalQuery` remain readable.

The Jazz collection was migrated from `corpus/jazz/` to `corpus/music/jazz/`; `src/corpus/build-music-corpus.mjs` writes the canonical `styles.normalized.jsonl` and `standards.normalized.jsonl` from the existing normalized artifacts. This supersedes the earlier poetry refinement's note that the music corpus reorganization was deferred. `ARIOSO_JAZZ_CORPUS` remains a temporary fallback for a Jazz-only corpus directory.

The repository also contains raw and manifest data for Jazz genres and standards plus normalization tooling. The standards collection contains 354 Wikipedia source records and 252 tune discussions from Ted Gioia's *The Jazz Standards: A Guide to the Repertoire* (2012), for 606 source records. Of these, 520 have musical evidence and are searchable. One tune discussed in two sources counts as two text records; this total does not mean 606 different compositions.

The book's raw and normalized data are stored separately as `corpus/music/jazz/gioia_2012.*`. Every chapter retains Zotero item and attachment keys, the PDF fingerprint, printed and PDF page ranges, and an author citation. Recommended-recording lists are preserved in the raw data but excluded from musical retrieval evidence. Retrieved references retain their source metadata. Book-derived text is marked all rights reserved, separately from Wikipedia's license.

### Orchestral works

The `orchestral` scope plans one multi-movement work first. `OrchestralWorkPlan` (1.0) fixes a shared contract (tonal world, identity motif, orchestra, acoustic space, dynamic language, exclusions) and two to six movements, each with a dramatic role, tempo and meter, motif development, orchestration arc, and entrance/exit contracts. Each movement fits one Lyria 3.5 generation, and the planned total is five to twelve minutes. Movements are generated in order and assembled; the task records the plan, movement status, and assembly metadata. The optional knowledge-card retrieval path has been removed; historical task records that still contain an `orchestralReference` snapshot load safely and the field is ignored.

### Themed albums

The `album` scope plans a cohesive set of candidates rather than one work. The album agent produces an `AlbumPlan` (1.0): a shared sound contract, a cohesion strategy, and 12 to 28 consecutively numbered outlines of 60 to 180 seconds each, with at least three distinct durations. A reviewer pass (`AlbumReview`) records similarities and per-candidate verdicts. Each candidate is composed and generated into an `AlbumTrackTask`; the task tracks admissions (`candidate`, `included`, `excluded`), revisions, and an ordered `albumPlaylist` that can be reordered and retried.

The workflow studio's album page uses these same records through the `04-album` workflow, which starts generating after planning. The `05-playlist` variant is created by the playlist page and by a journey; it adds references and pauses for plan confirmation.

### Album production and export

An album exports as a merged MP3 with per-track timestamps (`/api/tasks/<id>/album/export`). Optionally the Background Music Producer (`produceAlbum: true`) denoises all non-excluded candidates into a single-channel 44.1 kHz 24-bit WAV album plus an MP4 and a manifest, stored under the task's `production/` directory and served from `/api/tasks/<id>/production/...`; see [`background-music-producer.md`](background-music-producer.md). Albums created by the playlist page or a journey do not run the producer; they keep the candidate MP3s and the merged export.

## Lyria integration

`LyriaClient` uses the Google Gen AI Interactions API. It sends one text prompt to a selected model and expects base64-encoded audio, which it saves as MP3. The current interfaces expose:

- `lyria-3-clip-preview` for a 30-second clip; and
- `lyria-3.5` for a complete song.

A single piece is one request per task; orchestral works and albums issue one request per movement or candidate, then assemble or export. Arioso does not submit reference audio, continue a previous result, generate multiple takes of a target, join sections, or master; the optional producer denoises only.

## Command-line interface

The CLI provides several commands:

- `compose` prints a validated `MusicSpec` without calling Lyria;
- `generate` composes a `MusicSpec`, calls Lyria, and writes a timestamped MP3 plus JSON metadata under the configured output directory;
- `stitch` joins existing audio files; and
- `produce-album` plans, reviews, generates, denoises, and exports an instrumental album (`--resume` continues a failed production task).

The JSON metadata records the original description, model names, generated text when present, audio filename, creation time, and complete `MusicSpec`.

## Browser interface and local server

The local web application provides:

- MoodMic: a conversation, four mood examples, an editable proposal, generation, the listening review, the kept-piece result, and the album continuation;
- the mood calendar: a month grid of made pieces, day detail, playback, retry, and mood-colour editing;
- the playlist page: references, album planning, plan confirmation and revision, candidate listening, inclusion, ordering, MP3 export, and timestamps;
- the workflow studio: four workflows (no-corpus single, music-corpus single, orchestral multi-movement, themed album), a direction conversation with text and image input, an editable proposal, explicit approval before handoff, compose-only and compose-and-generate modes, Lyria and vocal settings, a music-reference selector, and optional Background Music Producer;
- status and detail views for all three scopes, including movements and album candidates;
- retrieval query and reference display;
- bilingual (Chinese and English) text with per-workflow examples;
- MP3 playback with HTTP byte-range support;
- retry of failed tasks; and
- local API-key and language settings.

`GET /api/capabilities` reports `apiVersion: 11`, the five workflow types, the album candidate range (12 to 28, default 14), the orchestral duration limits (5 to 12 minutes in total, 3 minutes per movement), the supported music types with their availability, and feature flags for discussions, mood entries, playlist references, plan confirmation, album playlist and export, orchestral assembly, and the producer.

Other route families: `/api/tasks` and `/api/tasks/<id>` with audio, movements, album tracks, album playlist, album export, review, retry, and production artifacts; `/api/discussions/...`; `/api/mood-chats/...`; `/api/mood-entries/...` and `/api/mood-entries/classify`; `/api/playlists/...`; `/api/journeys/...`; and `/api/settings/...`.

Tasks move through `queued`, `composing`, `generating`, `review`, `assembling`, `processing`, `completed`, or `failed`. `review` is used by the MoodMic listening review and by a playlist plan waiting for confirmation. Each task is saved as JSON under `outputs/tasks` with its audio; interrupted active tasks are marked failed on startup rather than resumed. Retrying reuses an existing `MusicSpec` when present. A task carries `workflowType`, `compositionMode`, and its scope-specific records (`albumPlan`, `albumTracks`, `orchestralPlan`, `movements`, `albumProduction`), plus optional journey lineage (`journeyId`, `parentTaskId`) and the playlist plan revision (`albumPlanRevision`).

Credentials may be held for the current server session or, with explicit user selection, written to the local `.env`. The settings API returns only masked credential summaries and never the complete stored value.

Creative discussions persist separately under `outputs/discussions`; uploaded JPEG, PNG, and WebP references are stored as attachment files rather than embedded in session JSON. Discussion turns do not create tasks.

The browser presents the discussion and its linked task as one continuous creative-session timeline. A LangGraph state graph resolves the visible phase from discussion state and the latest task state, covering discussion, prompt approval, queueing, composition, generation, assembly, processing, completion, and failure. `MusicTask` remains a separate execution record for recovery and retry, while the sidebar and workspace use the parent creative session whenever one exists. Legacy tasks without a session remain available.

## Configuration

The runtime reads:

- `OPENAI_API_KEY` for composition;
- `OPENAI_MODEL`, defaulting to `gpt-6-sol`;
- `GEMINI_API_KEY` when audio generation or the listening review is requested;
- `GEMINI_REVIEW_MODEL`, defaulting to `gemini-3.5-flash`;
- `LYRIA_MODEL`, defaulting to `lyria-3-clip-preview`;
- `ARIOSO_OUTPUT_DIR`, defaulting to `outputs`;
- optional paths for the composer skill, the prompt-directing skill, the music corpus root (`ARIOSO_MUSIC_CORPUS_ROOT`, with `ARIOSO_JAZZ_CORPUS` as a temporary Jazz fallback), settings, and `.env`;
- `ARIOSO_WEB_HOST` and `ARIOSO_WEB_PORT` for the local server, defaulting to `127.0.0.1:4173`; and
- optional producer pipeline paths (`ARIOSO_PIPELINE_PYTHON`, `ARIOSO_PIPELINE_CONFIG`).

Secrets belong in the local `.env` or the in-memory settings session. They must not be written into project documentation, task metadata, or source control.

## Differences from the abstract architecture

The implementation covers the three composition modes, the MoodMic journey, and an album candidate flow, but parts of the abstract architecture remain unimplemented:

- no persistent `Album -> Track -> Section -> Take` hierarchy; an album is one task with `AlbumTrackTask` records, not nested projects;
- candidates share only the plan's sound contract and the playlist, not a stable album identity;
- a section list still produces one prompt, not separately generated and assembled takes;
- orchestral assembly joins whole movements; no section-level continuation, transition generation, beat or key alignment, crossfade, or loudness matching;
- no take-level comparison or retention of superseded generations;
- no release-level metadata;
- only Jazz has validated style and standard collections; the other four music types are coded but stay unavailable until their corpora exist;
- evaluation covers schemas and behavior, not listening coherence or album diversity; and
- the journey has only been exercised with fake providers, so its end-to-end behavior against live Lyria and Gemini is still unverified.

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
- music retrieval: `src/retrieval/music-retriever.ts`
- music corpus migration: `src/corpus/build-music-corpus.mjs`
- Lyria adapter: `src/lyria/lyria-client.ts`
- MoodMic listening review: `src/moodmic/music-review.ts`
- MoodMic generation check graph: `src/moodmic/moodmic-graph.ts`
- journey record, graph, runtime: `src/journey/`
- settings and credential storage: `src/config/settings.ts`
- local server and task persistence: `src/web/server.ts`, `src/web/task-store.ts`
- MoodMic conversations and mood entries: `src/web/mood-chat-store.ts`, `src/web/mood-store.ts`
- creative discussion sessions: `src/discussion/`
- local prompt-directing instructions: `skills/prompt-directing-skill/`
- creative-session state graph: `src/discussion/session-graph.ts`
- background music producer: `src/producer/`
- browser client: `web/` (shared album stage in `web/album-view.js`)
- regression behavior: `test/`

When exact behavior matters, inspect these sources and the current command help rather than relying on this snapshot alone.
