# Arioso Current Implementation

What the repository implements today. [`abstract.md`](abstract.md) holds the
stable product model; [`nextphase-plan.md`](nextphase-plan.md) holds what remains.

## Shape

A Node.js and TypeScript application over one agentic composition pipeline, driven
by a local browser application of six pages: MoodMic (`/`), albums
(`/albums.html`), playlists (`/playlist.html`), the mood calendar
(`/calendar.html`), the workflow studio (`/workflow.html`), and help.

MoodMic is the everyday entry point: record a feeling, hold a conversation,
compose and generate one piece, have Gemini listen to it, keep or regenerate, then
continue a kept piece into an album. The studio exposes the wider surface: a
direction discussion guided by `prompt-directing-skill` through `discussion` and
`proposal` phases, followed by a standalone piece, a music-corpus piece, a
multi-movement orchestral work, or a themed album. Three composition modes
(`single`, `orchestral`, `album`) and five workflow types (`01-general` through
`05-playlist`) cover them.

## MoodMic

`outputs/moodmic/chats/<id>/session.json` holds a conversation's transcript, image
attachments, proposal, and task ids; `outputs/moodmic/entries.json` holds mood
entries (calendar date, colour group, emotion word, notes, linked task ids).
`web/mood-common.js` defines four colour groups with four emotion words each; the
colour is what the calendar reads back, the word is what the entry records. A
submitted conversation creates one `MusicTask` with `moodChatId` set.

Composition runs first. Generation waits for the user to confirm the composed
Lyria prompt, marked `planning`, and that confirmation also turns on the listening
review: a match completes the task and delivers the piece, a mismatch pauses it in
`review`, where keeping completes it and regenerating queues another take that is
reviewed again. `POST /api/tasks/<id>/prompt/approve` resumes a paused task,
optionally replacing the prompt. The review stores verdict, summary, matched and
mismatched points, model, and attempt number as `musicReview`, and a reviewer that
cannot run delivers the piece with a summary saying so; `POST
/api/tasks/<id>/review` records keep or regenerate. The calendar reads the chats
and their latest task, one piece per conversation, coloured by the recorded mood
entry.

## The journey from a piece to an album

`MusicJourney` is a record in `outputs/journeys/<id>.json` linking a conversation,
its kept song, and the album planned from it. A LangGraph state graph
(`src/journey/journey-graph.ts`) holds the transitions and human gates:

```text
mood -> song-running -> song-review -> song-ready
     -> album-planning -> album-review -> album-running -> album-curation -> completed
any active stage -> failed
```

Reading a journey derives its phase from the linked tasks, so a refresh restores
the stage. Under `GET /api/journeys/:id` sit `continue-album`,
`album-plan/messages`, `album-plan/approve`, and `retry`, and the identifier may be
the journey id, the chat id, or a linked task id. `continue-album` binds the album
to one kept song and uses its prompt and `MusicSpec` as the first reference;
approval binds to `albumPlanRevision` and a later revision invalidates it.

## Albums and playlists are two objects

An album is generated: plan, compose each candidate, generate, review, curate. A
playlist is assembled from pieces that already exist: it selects, orders, names,
plays, and exports.

The album page lists every album task (`compositionMode: "album"`) and creates one
from released MoodMic pieces. `GET /api/playlists/references` returns the
referenceable creations with their audio URL and `MusicSpec`, `POST /api/albums`
creates the task, and `/plan/approve` and `/plan/messages` confirm or revise the
plan before generation. `planPlaylist` also returns a briefing on how the author
read each reference and the theme. Both pages render the same views from
`web/album-view.js`.

A playlist lives under `outputs/playlists` and holds no audio. An entry is a
reference plus a title snapshot: either `{ kind: "task", taskId }` for a MoodMic
creation or standalone piece, or `{ kind: "album-track", taskId, trackId }` for one
candidate of an album.

`GET /api/playlists` returns entries resolved with `audioUrl`, or `missing` with
`missingReason`, plus playable and missing counts. `POST /api/playlists` creates
one from named pieces; `POST/PUT /api/playlists/<id>/items` adds and reorders;
`DELETE .../items/<itemId>` removes an entry; `POST .../export` joins what resolves
into one MP3 with per-track timestamps. `GET /api/pieces` lists everything
importable, and `POST /api/albums` with `asPlaylist: true` also opens a playlist
bound to the new album, appending tracks idempotently as they land. A playlist
survives its sources: removing an album or deleting a task leaves the entry in
place, reported as missing with its snapshotted title, and reordering, renaming,
and removal regenerate nothing.

"Add to playlist" appears on the MoodMic result card, the calendar day detail, an
album candidate row, and the album toolbar, all through `web/add-to-playlist.js`.
The panel lists existing playlists and names a new one inline. The album toolbar
offers the whole album: the included tracks when there are any, every finished
candidate otherwise. The album's own order is `albumTrackOrder` (`PUT
/api/tasks/<id>/album/track-order`); records written before the split stored it as
`albumPlaylist`, which the loader migrates on read.

## Composition modes

`MusicSpec` 1.0 describes one piece: title, intent, genre, mood, tempo, tonality,
meter, instruments, ordered sections, vocal settings, production direction and
exclusions, assumptions, and one production-ready Lyria prompt. A section list
plans a single prompt; their combined duration is neither summed nor enforced.

**Without a corpus**, the composer works from the brief and the model's musical
knowledge and claims no retrieval it did not perform. **Music corpus** adds one
bounded retrieval tool over five types: `jazz`, `blues`,
`electronic`, `instrumental-rock`, `instrumental-hip-hop`. The Composer calls
`search_music_corpus` once and records whether the user, the interface, or the
Composer chose the type; child styles map to their parent first. Each type keeps
`styles.normalized.jsonl` and `standards.normalized.jsonl` under
`corpus/music/<type>/` (override with `ARIOSO_MUSIC_CORPUS_ROOT`), searched by
description or by exact title, with a miss reported as an evidence gap. Each task
stores a `musicRetrieval` trace of type, selection source, query, mode, and
reference ids. Jazz holds 606 source records (354 from Wikipedia, 252 tune
discussions from Ted Gioia's *The Jazz Standards*, 2012), 520 carrying musical
evidence, with Zotero keys and a PDF fingerprint in `corpus/music/jazz/gioia_2012.*`.

**Orchestral works** plan one multi-movement piece first: `OrchestralWorkPlan`
(1.0) fixes a shared contract and two to six movements, each with a dramatic role,
tempo and meter, motif development, orchestration arc, and entrance/exit
contracts. Each movement fits one Lyria generation over five to twelve minutes of
planned total, and movements generate in order and are assembled.

**Themed albums** plan a cohesive candidate set. `AlbumPlan` (1.0) holds a shared
sound contract, a cohesion strategy, and 12 to 28 numbered outlines of 60 to 180
seconds with at least three distinct durations. A reviewer pass (`AlbumReview`)
records similarities and per-candidate verdicts, and each candidate becomes an
`AlbumTrackTask` with admissions, revisions, and the ordered `albumTrackOrder`.
Candidates generate concurrently under a bounded pool
(`ARIOSO_GENERATION_CONCURRENCY`, default 4, at most 16), each dispatch recording
its own attempt under the candidate's id. `05-playlist` is the referenced-album
variant, adding references and pausing for plan confirmation before any audio.

**Production and generation.** An album exports as a merged MP3 with per-track
timestamps (`/api/tasks/<id>/album/export`). The optional producer (`produceAlbum:
true`, studio `04-album` only) denoises non-excluded candidates into a mono
44.1 kHz 24-bit WAV album plus an MP4 and a manifest under `production/<runId>/`;
a failed run retries from the task's Continue button and reuses completed
candidates, so no new generation request is made. `LyriaClient` uses the Google
Gen AI Interactions API: one prompt to a selected model, base64-encoded audio
back, saved as MP3, through `lyria-3-clip-preview` for a 30-second clip or
`lyria-3.5` for a complete song. Each dispatch is recorded with a request hash and
an outcome, and a late result from a superseded attempt is discarded.

## Poetry references

Before the Director replies to a MoodMic message, and again before it writes the
proposal, the server retrieves at most three complete poems from
`corpus/poem/<language>/`, using every user-authored message plus the latest
structured mood as the query, expanded through a shared bilingual mood lexicon.
The corpus language follows what the user wrote: CJK characters against Latin
letters. The Chinese corpus holds 630 modern poems from the pinned `sheepzh/poetry`
commit, the English corpus 356 poems by 148 authors with Plutchik-derived mood
cues, and `corpus/poem/mood-lexicon.json` the mood categories and stop-word lists.
Ranking is TF-IDF over character bigrams and trigrams for Chinese and lightly
stemmed words for English, weighted towards mood cues and titles; a relevance
floor keeps a generic phrase such as `感到` from supplying a poem, results cap at
three with at most one poem per author, and ties break on record id.

The conversation stores a bounded `poem_retrieval` trace (query, hash, corpus
version, reference ids with titles, authors, scores, matched terms, and an
unavailable reason) while full poem text stays out of the saved session. An
unchanged query and corpus version reuse the stored references, and retrieval
fails open. The Director receives poems as delimited, untrusted reference data,
and the Composer never sees poem text.

## Server, state and configuration

`GET /api/capabilities` reports `apiVersion: 12`, the workflow types, the album
candidate range (12 to 28, default 14), the orchestral duration limits, and a
feature flag for each implemented surface. Route families: `/api/tasks` and
`/api/tasks/<id>`, `/api/albums`, `/api/pieces`, `/api/playlists/…`,
`/api/discussions/…`, `/api/mood-chats/…`, `/api/mood-entries/…`, `/api/journeys/…`,
`/api/settings/…`.

Tasks move through `queued`, `composing`, `planning`, `generating`, `review`,
`assembling`, `processing`, `completed`, or `failed`, each as JSON under
`outputs/tasks` with its audio; interrupted tasks are marked failed on startup, and
retrying reuses an existing `MusicSpec`.

The runtime reads `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-6-sol`) for
composition, `GEMINI_API_KEY` and `GEMINI_REVIEW_MODEL` for generation and the
review, `LYRIA_MODEL`, `ARIOSO_GENERATION_CONCURRENCY`, `ARIOSO_OUTPUT_DIR`, the
optional corpus, poetry, and producer paths, and `ARIOSO_WEB_HOST` /
`ARIOSO_WEB_PORT` (default `127.0.0.1:4173`). Credentials live in the server
session or the local `.env`.

## Implementation limits

Against [`abstract.md`](abstract.md): an album is one task holding `AlbumTrackTask`
records, so the `Album -> Track -> Section -> Take` hierarchy and release-level
metadata remain target shapes, and a section list produces one prompt; orchestral
assembly joins whole movements without transitions, alignment, crossfade, or
loudness matching, and movements generate one after another; poetry retrieval runs
in MoodMic only; and no live text evaluation, listening-coherence measurement, or
live end-to-end journey run is recorded.
