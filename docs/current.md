# Arioso Current Implementation

What the repository implements today. [`abstract.md`](abstract.md) holds the
stable product model.

## Current shape

A Node.js and TypeScript application over one agentic composition pipeline, driven
by a local browser application of six pages: MoodMic (`/`), albums
(`/albums.html`), playlists (`/playlist.html`), the mood calendar
(`/calendar.html`), the workflow studio (`/workflow.html`), and help
(`/help.html`). Two maintenance scripts run from the command line.

MoodMic is the everyday entry point: record a feeling, hold a creative
conversation, compose and generate one piece, have Gemini listen to it, keep or
regenerate. A kept piece continues into an album without leaving the conversation.
The studio exposes the wider surface — a direction discussion followed by a
standalone piece, a music-corpus piece, a multi-movement orchestral work, or a
themed album — across three composition modes (`single`, `orchestral`, `album`) and
five workflow types (`01-general`, `02-music`, `03-orchestral`, `04-album`,
`05-playlist`), with records written as `02-jazz` reading as `02-music`.

## MoodMic

A MoodMic conversation keeps its own record, separate from the studio's discussion
sessions: `outputs/moodmic/chats/<id>/session.json` holds the transcript, image
attachments, the proposal, and the task ids the conversation produced, while
`outputs/moodmic/entries.json` holds mood entries — a calendar date, a colour group,
an emotion word, optional notes on the moment and on how the music should feel, and
the linked task ids.

`web/mood-common.js` defines four colour groups (red, yellow, blue, green) with four
emotion words each. The colour is what the calendar reads back; the word is what the
entry records. A typed word is stored as written, up to 64 characters, and needs no
built-in id. Every substantive user turn retrieves poems before the Director
replies, and the proposal step retrieves again; see
[Poetry references](#poetry-references).

Submitting a conversation creates one `MusicTask` with `moodChatId` set. Composition
runs first; generation waits for the user to confirm the composed Lyria prompt, and
that confirmation also turns on the listening review:

```text
spec + prompt -> composed Lyria prompt, editable, task "planning"
              -> user confirms -> Lyria generation -> Gemini listening review
              -> match:      task completed, piece delivered
              -> mismatch:   task "review" -> keep: completed
                                            -> regenerate: queued, review again
```

`POST /api/tasks/<id>/prompt/approve` resumes a paused task: a `{ "prompt": "…" }`
body replaces the composed Lyria prompt before the first generation, an absent body
uses the composed text.

The review compares the audio with the approved request using the task description
and the `MusicSpec`, storing a verdict, summary, matched and mismatched points,
model, and attempt number as `musicReview`; a reviewer that cannot run delivers the
piece with a summary saying so. `POST /api/tasks/<id>/review` records the keep or
regenerate decision.

The mood calendar reads the MoodMic chats and their latest task, one piece per
conversation. Each day shows that day's pieces, coloured by the recorded mood entry
(brand colour when none exists), split into equal segments when a day holds several.
The detail panel plays and downloads finished audio, retries a failed attempt, opens
the originating conversation, and edits the recorded mood colour.

## The journey from a piece to an album

`MusicJourney` is a small record in `outputs/journeys/<id>.json` linking a mood
conversation, its kept song, and the album planned from it. It stores identifiers
and a phase:

```text
mood -> song-running -> song-review -> song-ready
     -> album-planning -> album-review -> album-running -> album-curation -> completed
any active stage -> failed
```

A LangGraph state graph (`src/journey/journey-graph.ts`) holds the legal transitions
and human gates: phases are nodes and the events between them are the edges. Reading
a journey derives its phase from the linked tasks, so a refresh restores the stage
and its available actions. Under `GET /api/journeys/:id` sit `continue-album`,
`album-plan/messages`, `album-plan/approve`, and `retry`, and the identifier may be
the journey id, the mood chat id, or either linked task id.

`continue-album` binds the album to one finished, kept song from that conversation
and uses its prompt and `MusicSpec` as the first album reference; repeated calls
return the existing album. Planning pauses before any audio exists: approval binds
to `albumPlanRevision` and is persisted before generation is dispatched, and a later
revision increments the number and clears `playlistPlanApproved`, invalidating the
earlier approval. Generation runs in the background, each track is saved as it
finishes, and the interface adds it to the curation list.

## Albums and playlists are two objects

An **album** is generated: plan, compose each candidate, generate, review, curate.
A **playlist** is assembled from pieces that already exist: it selects, orders,
names, plays, and exports.

The album page (`/albums.html`) lists every album task
(`compositionMode: "album"`) and creates one from released MoodMic pieces:
`GET /api/playlists/references` returns the referenceable creations with their
audio URL and `MusicSpec`, `POST /api/albums` creates the task with them, and
`POST /api/tasks/<id>/plan/approve` or `/plan/messages` confirms or revises the
plan before generation. The plan comes from `planPlaylist`, which also returns a
briefing — how the author read each reference and the user's theme — and the album
page and MoodMic render the same plan, progress, player, and curation views from
`web/album-view.js`.

A playlist lives in its own store under `outputs/playlists` and holds no audio. An
entry is a reference plus a title snapshot:

```text
{ kind: "task", taskId }                      a MoodMic creation or standalone piece
{ kind: "album-track", taskId, trackId }      one candidate of an album
```

`GET /api/playlists` returns playlists with entries resolved — each item carries
`audioUrl`, or `missing` with `missingReason` — plus `playableSeconds`,
`playableCount`, and `missingCount`; `POST /api/playlists` creates one from named
pieces in a step. `GET/PATCH/DELETE /api/playlists/<id>` reads, renames, and
removes; `POST/PUT /api/playlists/<id>/items` adds and reorders; `DELETE
/api/playlists/<id>/items/<itemId>` removes one entry. `POST
/api/playlists/<id>/export` joins the resolvable entries into one MP3 with
per-track timestamps and reports the rest in `skipped`. `GET /api/pieces` lists
everything importable: finished MoodMic creations, standalone pieces, and every
album's finished candidates.

`POST /api/albums` with `asPlaylist: true` also opens a playlist bound to the new
album (`fromAlbumTaskId`), appending its tracks as they land; a later `GET
/api/albums` fills in any that finished unobserved, and the append is idempotent
across retries and restarts.

A playlist survives its sources: removing an album, excluding a candidate, or
deleting a task leaves the entry in place, reported as missing with its
snapshotted title, and reordering, renaming, and removal regenerate nothing.
Deleting a playlist removes its own record and cover and leaves the pieces in
their albums and conversations.

"Add to playlist" appears on the MoodMic result card, the calendar day detail, an
album candidate row, and the playlist page, all through `web/add-to-playlist.js`,
which lists existing playlists or creates one by name. The playlist page shows a
library and a track sheet: name and description edit in place (Enter saves, Escape
cancels), entries show number, title, source album, length, and low-contrast controls
that surface on hover or focus, one audio element backs "play all" and the row
buttons with the current entry marked in the brand colour, and deletion asks once in
a small dialog from either the library card or the playlist.

The album's own ordered track list is `albumTrackOrder` (`PUT
/api/tasks/<id>/album/track-order`), ordering the album's included candidates.
Records written before the split stored it as `albumPlaylist`, which the task
loader migrates on read.

## Workflow studio and creative direction

Before any task exists, the studio can hold a direction conversation. A
`CreativeSession` records messages, image attachments, the requested scope, and a
proposal; the `prompt-directing-skill` guides two phases, `discussion` and
`proposal`, and outputs a concise request the user may edit and approve. Only
approval creates a `MusicTask`, which records the originating `sourceDiscussionId`.
Sessions and tasks persist separately, and a LangGraph state graph
(`src/discussion/session-graph.ts`) resolves the visible phase across `discussion`,
`proposal-ready`, and the task's own status.

## Music specification

`MusicSpec` schema version `1.0` describes one piece: a working title and creative
intent; ordered genre and mood descriptions; tempo, rhythmic feel, tonality, and
meter; instruments with their roles and timbres; an ordered structure of
prompt-planning sections with approximate durations and directions; vocal
enablement, language, style, and lyrical theme; production direction and excluded
elements; the composer's explicit assumptions; and one production-ready Lyria
prompt. Its sections plan a single prompt, and the pipeline neither sums nor
enforces their combined duration.

## Composition modes

### Without a corpus

The default workflow relies on the model's musical knowledge, and the composer
claims no retrieval it did not perform.

### Music corpus

One bounded retrieval tool serves five music types: `jazz`, `blues`, `electronic`,
`instrumental-rock`, `instrumental-hip-hop`. The Composer calls
`search_music_corpus` once, names exactly one type, and records whether the user,
the interface, or the Composer chose it. Recognized child styles map to their
parent first (ambient → electronic, lo-fi hip-hop → instrumental-hip-hop,
post-rock → instrumental-rock, modal jazz → jazz, Chicago blues → blues); a request
outside the five takes the no-corpus path.

Each type keeps two TF-IDF indexes under `corpus/music/<type>/` (override with
`ARIOSO_MUSIC_CORPUS_ROOT`): `styles.normalized.jsonl` for the audible conventions
of a genre, `standards.normalized.jsonl` for representative works. A description
search returns up to two styles and three standards; a title search reads standards
only, normalizes case, punctuation, whitespace and diacritics, and returns exact
matches with a miss reported as an evidence gap. Retrieved text shapes
instrumentation, rhythm, texture, harmony, form, and production, while the Lyria
prompt names no retrieval, score, or reference title. A type whose collections fail
to load leaves the selector.

Capabilities, the workflow selector, and MoodMic offer a type once both collections
load, and all five load today. Each task stores a `musicRetrieval` trace of type,
selection source, query, mode, and the style and standard reference ids.
`src/corpus/build-music-corpus.mjs` writes the canonical files, and
`ARIOSO_JAZZ_CORPUS` remains a fallback for a Jazz-only directory.

Jazz holds the largest collection: 606 source records — 354 from Wikipedia and 252
tune discussions from Ted Gioia's *The Jazz Standards* (2012) — of which 520 carry
musical evidence, with a tune discussed twice counting twice. The book's data sits
in `corpus/music/jazz/gioia_2012.*` with its Zotero keys, PDF fingerprint, page
ranges, and citation; recommended recordings stay outside retrieval evidence, and
book-derived text is marked all rights reserved.

### Orchestral works

The `orchestral` scope plans one multi-movement work first. `OrchestralWorkPlan`
(1.0) fixes a shared contract — tonal world, identity motif, orchestra, acoustic
space, dynamic language, exclusions — and two to six movements, each with a
dramatic role, tempo and meter, motif development, orchestration arc, and
entrance/exit contracts. Each movement fits one Lyria 3.5 generation and the
planned total is five to twelve minutes; movements generate in order and are
assembled, with plan, movement status, and assembly metadata on the task. Older
records carrying an `orchestralReference` snapshot load with that field ignored.

### Themed albums

The `album` scope plans a cohesive set of candidates. The album agent produces an
`AlbumPlan` (1.0): a shared sound contract, a cohesion strategy, and 12 to 28
consecutively numbered outlines of 60 to 180 seconds with at least three distinct
durations. A reviewer pass (`AlbumReview`) records similarities and per-candidate
verdicts. Each candidate is composed and generated into an `AlbumTrackTask`; the
task tracks admissions (`candidate`, `included`, `excluded`), revisions, and an
ordered `albumTrackOrder` that can be reordered and retried. The studio's album page
uses these records through the `04-album` workflow, which starts generating after
planning. `05-playlist` is the referenced-album variant — created by the album page
and by a journey, adding references, and pausing for plan confirmation before any
audio — and keeps its historical workflow name.

### Album production and export

An album exports as a merged MP3 with per-track timestamps
(`/api/tasks/<id>/album/export`). The optional Background Music Producer
(`produceAlbum: true`) denoises non-excluded candidates into a single-channel
44.1 kHz 24-bit WAV album plus an MP4 and a manifest under the task's
`production/` directory, served from `/api/tasks/<id>/production/…`; see
[`background-music-producer.md`](background-music-producer.md). Albums created by
the album page or a journey keep their candidate MP3s and the merged export, and
run the producer when it is selected.

## Poetry references

Poetry retrieval supports the direction stage: before the Director replies to a
MoodMic message, and again before it writes the proposal, the server retrieves at
most three complete poems. The query is every user-authored message plus the latest
structured mood — Director prose, earlier poem text, system instructions, and
interface copy stay out — expanded through a shared bilingual mood lexicon so a
phrase reaches the same terms in Chinese and English.

Three files drive it: `corpus/poem/Chinese/` holds 630 modern Chinese poems from
the pinned `sheepzh/poetry` commit; `corpus/poem/English/` holds 356 English poems
by 148 authors, tagged with Plutchik-derived mood cues; and
`corpus/poem/mood-lexicon.json` (1.0.2) holds the bilingual mood categories, the
single-character allowlist, and both stop-word lists.

The corpus language follows what the user wrote: CJK characters against Latin
letters. Ranking is TF-IDF over character bigrams and trigrams for Chinese and
lightly stemmed words for English, weighted towards mood cues and titles; a
calibrated relevance floor keeps a generic phrase such as `感到` from supplying a
poem, results cap at three with at most one poem per author, and ties break on
record id.

The conversation stores a bounded `poem_retrieval` trace — query, hash, corpus
version, reference ids with titles, authors, scores, matched terms, retrieval time,
and an unavailable reason — while full poem text stays out of the saved session. An
unchanged query and corpus version reuse the stored references; a new message
changes the hash and retrieves again; a corpus version change re-retrieves.
Retrieval fails open: a missing corpus, unreadable manifest, bad record, or empty
query leaves the set empty and the conversation continues.

The Director receives the poems as delimited, untrusted reference data, and the
Composer never sees poem text. The interface shows titles and authors as
inspiration; the intended Director behaviour and the outstanding evaluation live in
the course material kept outside this repository.

## Lyria integration

`LyriaClient` uses the Google Gen AI Interactions API: one text prompt to a
selected model, base64-encoded audio back, saved as MP3. The interfaces are
`lyria-3-clip-preview` for a 30-second clip and `lyria-3.5` for a complete song. A
single piece is one request per task; orchestral works and albums issue one
request per movement or candidate, then assemble or export. Generation is one
prompt to one take, and the optional producer denoises it.

## Maintenance scripts

Two command-line scripts work on existing task records, and both run with `tsx`
through pnpm scripts:

- `pnpm orchestral:assemble` joins recorded orchestral movements
  (`src/tools/assemble-orchestral-tasks.ts`);
- `pnpm storage:organize` moves task records into the current directory layout
  (`src/tools/organize-task-storage.ts`).

Composing and generating run through the browser application. Each task stores its
own record with the original description, model names, generated text when
present, audio filename, creation time, and complete `MusicSpec`.

## Browser interface and local server

The six pages carry the behaviour described above. Across them, the interface also
offers status and detail views for all three scopes, retrieval query and reference
display, bilingual (Chinese and English) text with per-workflow examples, MP3
playback with HTTP byte-range support, retry of failed tasks, and local API-key and
language settings.

`GET /api/capabilities` reports `apiVersion: 12`, the five workflow types, the album
candidate range (12 to 28, default 14), the orchestral duration limits (5 to 12
minutes total, 3 per movement), music-type availability, and feature flags for
discussions, mood entries, playlist references, plan confirmation, `albums` and
`playlists`, album track order and export, orchestral assembly, and the producer.

Route families: `/api/tasks` and `/api/tasks/<id>` with audio, movements, album
tracks, album track order, album export, prompt confirmation, review, retry, and
production artifacts; `/api/albums`; `/api/pieces`; `/api/playlists/…`;
`/api/discussions/…`; `/api/mood-chats/…`; `/api/mood-entries/…` and
`/api/mood-entries/classify`; `/api/journeys/…`; `/api/settings/…`.

Tasks move through `queued`, `composing`, `planning`, `generating`, `review`,
`assembling`, `processing`, `completed`, or `failed`. `planning` is a MoodMic piece
awaiting prompt confirmation; `review` marks the MoodMic listening review and a plan
awaiting confirmation. Each task is JSON under `outputs/tasks` with its audio, and
interrupted active tasks are marked failed on startup; retrying reuses an existing
`MusicSpec`. A task carries `workflowType`, `compositionMode`, its scope records
(`albumPlan`, `albumTracks`, `orchestralPlan`, `movements`, `albumProduction`),
optional journey lineage (`journeyId`, `parentTaskId`), the plan revision
(`albumPlanRevision`), and the Lyria prompt confirmation (`lyriaPromptApproved`).

Credentials live in the current server session or, when the user selects persistent
storage, in the local `.env`; the settings API returns masked summaries. Creative
discussions persist under `outputs/discussions`, with uploaded JPEG, PNG, and WebP
references stored as attachment files outside session JSON. The browser presents a
discussion and its linked task as one creative-session timeline: a LangGraph state
graph resolves the visible phase from discussion state and the latest task state
across discussion, prompt approval, queueing, composition, generation, assembly,
processing, completion, and failure. `MusicTask` remains the execution record for
recovery and retry, while the sidebar and workspace use the parent creative session
when one exists.

## Configuration

The runtime reads `OPENAI_API_KEY` for composition, `OPENAI_MODEL` (default
`gpt-6-sol`), `GEMINI_API_KEY` for generation and the listening review,
`GEMINI_REVIEW_MODEL` (default `gemini-3.5-flash`), `LYRIA_MODEL` (default
`lyria-3-clip-preview`), and `ARIOSO_OUTPUT_DIR` (default `outputs`). Optional
paths cover the two skills, the music corpus root (`ARIOSO_MUSIC_CORPUS_ROOT`,
with `ARIOSO_JAZZ_CORPUS` as a Jazz-only fallback), the poetry corpus and lexicon
(`ARIOSO_POEM_CORPUS`, `ARIOSO_POEM_LEXICON`), settings, `.env`, and the producer
pipeline (`ARIOSO_PIPELINE_PYTHON`, `ARIOSO_PIPELINE_CONFIG`). `ARIOSO_WEB_HOST`
and `ARIOSO_WEB_PORT` set the local server address, defaulting to
`127.0.0.1:4173`.

Secrets belong in the local `.env` or the in-memory settings session, and stay
out of documentation, task metadata, and source control.

## Implementation limits

The three composition modes, the MoodMic journey, the album and playlist objects,
and the workflow studio are in place. Beyond them, the implementation differs from
[`abstract.md`](abstract.md) here:

- an album is one task holding `AlbumTrackTask` records; the `Album → Track →
  Section → Take` hierarchy, stable album identity, and release-level metadata
  remain target shapes, and a section list produces one prompt rather than separate
  section generations;
- orchestral assembly joins whole movements, without section-level continuation,
  transitions, key or beat alignment, crossfade, or loudness matching;
- poetry retrieval runs in MoodMic, and the studio's direction conversation reads no
  poems;
- evaluation covers schemas and behaviour: no live text evaluation,
  listening-coherence or album-diversity measurement, or live end-to-end journey run
  is recorded.

## Authoritative implementation references

- server, task persistence, album and playlist routes: `src/web/server.ts`,
  `src/web/task-store.ts`
- composer agents and instructions: `src/composer/`, `skills/composer-skill/`;
  schemas: `src/schema/`
- retrieval: `src/retrieval/`; corpora: `corpus/`, built by
  `src/corpus/build-music-corpus.mjs` and `scripts/`
- Lyria adapter: `src/lyria/lyria-client.ts`; MoodMic review and generation graph:
  `src/moodmic/`
- journey record, graph, runtime: `src/journey/`
- playlist record, store, resolution, export: `src/playlist/`,
  `src/web/playlist-pieces.ts`, `src/web/playlist-export.ts`; shared panel:
  `web/add-to-playlist.js`
- MoodMic conversations and mood entries: `src/web/mood-chat-store.ts`,
  `src/web/mood-store.ts`
- discussions and their state graph: `src/discussion/`,
  `skills/prompt-directing-skill/`
- settings and credentials: `src/config/settings.ts`; producer: `src/producer/`
- browser client: `web/` (shared album stage `web/album-view.js`, playlist page
  `web/playlist.js`); regression behaviour: `test/`

When exact behaviour matters, inspect these sources and the current command help.
