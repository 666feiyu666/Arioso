# DH6012 Finalization

## What this document is

The delivery record for the final development round: one continuous journey from a mood conversation to a reviewed song and then to a finished album. It describes what was built, how the pieces fit, and what was verified. Earlier plans for the same round are superseded by this text.

## The journey

```text
Mood conversation
→ song direction
→ song generation
→ Gemini listening review
→ user keeps the song
→ album planning from that song
→ user confirms the album plan
→ background track generation
→ candidate curation, playback, and export
```

The existing MoodMic, Workflow, and Playlist features still work on their own. The journey connects them so the user does not have to leave MoodMic and restart in the Playlist tab. Generation time is not treated as a design constraint: after the plan is approved, generation runs in the server and the interface shows each track as it finishes.

## Runtime design

### Journey record

`MusicJourney` links existing artifacts and holds no copies of them. The record is stored as one small JSON file per journey in `outputs/journeys/`:

```ts
interface MusicJourney {
  id: string;
  moodChatId: string;
  moodEntryId?: string;
  songTaskId?: string;
  albumTaskId?: string;
  phase:
    | "mood"
    | "song-running"
    | "song-review"
    | "song-ready"
    | "album-planning"
    | "album-review"
    | "album-running"
    | "album-curation"
    | "completed"
    | "failed";
  approvedPlanRevision?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

`MusicTask` gained three optional fields: `journeyId`, `parentTaskId`, and `albumPlanRevision`. Records written before this round remain valid; `TaskStore` accepts them unchanged and no migration is required.

A journey is created when a MoodMic conversation is submitted, and its identifier can be resolved from the journey id, the mood chat id, or either task id. `GET /api/journeys/:id` accepts any of them and returns the journey with the song and album tasks it points at.

### Journey graph

The graph is a bounded state machine, not a coordinator. Its nodes are the ten phases above plus one routing node that reads the current phase; its edges are events such as `song-reviewing`, `song-kept`, `continue-album`, `plan-ready`, `plan-revised`, `plan-approved`, `album-complete`, and `retry`. A transition the graph does not draw throws, and the runtime turns that into an HTTP 409.

Human gates are events with no automatic successor:

```text
song-running  -> song-review       (song-reviewing)
song-review   -> song-ready        (song-kept)
song-review   -> song-running      (song-regenerating)
song-ready    -> album-planning    (continue-album)
song-ready    -> completed         (finish)
album-planning -> album-review     (plan-ready)
album-review  -> album-planning    (plan-revised)
album-review  -> album-running     (plan-approved)
album-running -> album-curation    (album-complete)
```

The graph validates transitions and holds the phase. It does not compose, plan, or generate anything. The runtime and the server hold the side effects: `journey-runtime.ts` creates the album task, records approvals, and resumes failed work; `server.ts` dispatches the existing runner. Song review stays in `src/moodmic/moodmic-graph.ts`, album planning and execution stay in `runAlbumTask`, and `TaskStore` keeps ownership of status, audio, album tracks, and exports.

Each `journeyStore.update` writes one file atomically, so a phase and its approval or error are persisted together.

### Deriving the phase from the tasks

Reading a journey derives its phase from the tasks it links, which is what makes a refresh work:

| Journey phase | Derived from the linked task |
| --- | --- |
| `song-running`, `song-review` | song task `review`, `completed`, or `failed` |
| `album-planning` | album task `review` (plan ready) or `failed` |
| `album-review` | album task completed, failed, or approved but not yet dispatched |
| `album-running` | album task completed or failed |
| `album-curation` | album task failed |

A derived event the graph does not allow stops the walk instead of failing the request, so a stale or out-of-order record still answers `GET /api/journeys/:id`.

## Background album generation

Approval writes `playlistPlanApproved` and `status: "queued"` to the album task before the journey records `approvedPlanRevision`. Only then does the server dispatch the runner, and the HTTP request returns without waiting for it. A second approval request finds the journey already approved and returns the current state with status 200, so duplicate clicks cannot pay for a second album.

The runner keeps the existing album rules: 12 to 28 candidates, per-track prompts, candidate review, and revision. Each completed track is persisted before the next one starts, so finished tracks can be played while the rest are still generating. The journey moves to `album-curation` when generation finishes, and exporting the album from that stage moves it to `completed`.

A song that is still composing or generating leaves the journey in `song-running`; the phase only changes when the task reaches a state the interface can act on.

## Application API

```text
GET  /api/journeys/:id
POST /api/journeys/:id/continue-album
POST /api/journeys/:id/album-plan/messages
POST /api/journeys/:id/album-plan/approve
POST /api/journeys/:id/retry
```

`continue-album` takes `{ theme, candidateCount?, targetTotalMinutes?, songTaskId? }` and binds the album to one exact song. It rejects a song from another conversation, a song that is not finished, a mood chat without a kept song, and a missing theme. It never infers the source from the newest audio file. The song's approved prompt and `MusicSpec` become the initial `PlaylistReference`, and the new album task carries `journeyId` and `parentTaskId`. Calling it again returns the album that already exists with status 200.

`album-plan/messages` takes `{ message }` and is accepted only while the plan is open for changes. A revision increments `albumPlanRevision`, clears `playlistPlanApproved`, and rebuilds the candidate outlines, so any earlier approval is invalid.

`album-plan/approve` takes `{ revision? }`. A revision that no longer matches the plan is refused, and a plan that has already been approved returns the current state without starting anything.

`retry` is accepted only in the `failed` phase. It resumes the stage that failed: the song task when no album exists, planning when the plan was never approved, and generation (skipping completed tracks) once it was.

All existing MoodMic and Playlist endpoints behave as before, and legacy tasks without a journey are untouched.

## Interface changes

MoodMic's result view gained the continuation section: a "Turn this piece into an album" panel with the kept song fixed, a theme field, candidate count, target length, and a planning action. After that it shows the album plan with its revision conversation, an explicit confirmation button, background progress, and curation.

The album views themselves live in `web/album-view.js` and are shared with the Playlist page: plan reading, progress, player, candidate lists, inclusion, ordering, retry, and export. MoodMic imports the same module, so the two pages cannot drift apart. The Playlist tab remains the library of all albums and works as before, including its reference picking and its own plan approval.

Refreshing the page reads the journey by chat id and restores the stage, including a pending review, a plan awaiting confirmation, an album still generating, and a finished album. A failed stage shows a continue action instead of a dead end.

## Implementation

- `src/journey/types.ts`: journey phases, the record, and validation.
- `src/journey/journey-store.ts`: one JSON file per journey, lookup by chat or task id.
- `src/journey/journey-graph.ts`: the LangGraph transition table and its compiled graph.
- `src/journey/journey-runtime.ts`: phase derivation, album creation, approval, retry, and stage notifications.
- `src/web/task-store.ts`: `journeyId`, `parentTaskId`, and `albumPlanRevision` on tasks.
- `src/web/server.ts`: the five journey endpoints, journey creation on MoodMic submit, and hooks that advance the journey when a song, plan, album, or export settles.
- `web/album-view.js`: the shared album stage.
- `web/moodmic.js`, `web/playlist.js`, `web/moodmic.css`, `web/index.html`: the continuation panel, the shared module, and its styling.
- `test/web-journey.test.ts`: the journey integration tests.

## Verification

`npm run typecheck` passes. `npx vitest run` passes all 39 test files and 266 tests, including the existing playlist, MoodMic review, and album suites.

`test/web-journey.test.ts` covers, with fake providers:

- a MoodMic submit that creates a journey and follows it through `song-review` to `song-ready`;
- background planning that pauses at `album-review` without generating audio;
- a revision that invalidates the previous approval, and an approval bound to a stale revision;
- approval followed by generation to `album-curation`, then curation and export to `completed`;
- duplicate continue and approve requests that reuse the existing album and generate each candidate once;
- rejection of an unfinished song and of a song from another conversation;
- refresh restoring the stage from a journey read, and a 404 for an unknown identifier.

The pages were also checked by hand against a running server: the Playlist detail renders through the shared stage, and MoodMic shows the continuation panel, the plan review, and the finished album with its player.

One item from the earlier plan was not done: a bounded end-to-end evaluation with real providers. All verification above uses fake audio and model responses, so the journey has not been exercised against live Lyria and Gemini in this round.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| One MoodMic journey reaches a reviewed song and a generated album without restarting elsewhere | Verified with fake providers |
| The album has traceable links to its mood conversation and source song | Verified: `journeyId`, `parentTaskId`, `PlaylistReference` |
| No album audio is generated before explicit plan approval | Verified: the runner pauses at `review` |
| Generation continues in the background and exposes incremental results | Verified: tracks are persisted and played per track |
| Refresh restores the state and the available actions | Verified: phase derived from linked tasks |
| Duplicate actions do not duplicate billable generation | Verified: idempotent continue and approve |
| The user can curate, reorder, play, and export the album | Verified through the shared album stage |
| Standalone workflows and regression tests still pass | Verified: full suite green |

## Deferred work

- Automatic noise cancellation and mastering remain future production stages.
- This round does not optimize total generation time or reduce album size.
- It does not introduce a general multi-agent platform or replace the Composer and Album Author.
- The real-provider journey evaluation listed above is still open.
