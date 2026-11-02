# Arioso Development

Run commands from the repository root. Arioso requires Node.js 22 or newer and
uses the pnpm version declared in `package.json`.

Before an architectural change, read `docs/abstract.md` for the target and
`docs/current.md` for the implemented starting point. Update the latter when a
change alters the current workflow, data model, persistence, or known gaps.

## Install dependencies

```powershell
pnpm install
```

Keep API credentials in the local `.env` or enter them through the browser
settings without selecting persistent storage. Never print, document, or commit
real keys. `.env.example` is the safe configuration reference.

## Generating audio

Everything runs through the browser application (`pnpm web`): composing a spec,
generating audio, the album producer, and stitching orchestral movements are
workflow steps the interface drives, and each writes a task record under the
output root. There is no command-line generator.

Use a new task for new evidence. Do not edit an earlier generated record to
represent a different model call.

## Run the browser application

```powershell
pnpm web
```

The server listens on `127.0.0.1:4173` by default. The interface can compose a
prompt without Lyria or generate audio, so only configure the providers needed
for the selected operation.

The pages are:

- `/` for MoodMic, including the poem references, the confirmed Lyria prompt, and the album continuation after a piece is kept;
- `/albums.html` for the album library, including album creation from MoodMic references;
- `/playlist.html` for playlists: assembled lists of pieces that already exist;
- `/calendar.html` for the mood calendar;
- `/workflow.html` for the studio's four workflows; and
- `/help.html` for the short usage guide.

For a manual check, open a page, run one small operation, and reload it. MoodMic,
the calendar, the album page, the playlist page, and a journey all restore their
state from the server, so a reload is a meaningful test of persistence.

## Keep albums and playlists apart

An album is generated; a playlist is assembled. When touching either:

- audio generation belongs to album and single-piece tasks; playlist code reads,
  orders, references, and exports pieces that already exist;
- a playlist entry stores a source reference plus a title snapshot, so a playlist
  survives its album being deleted;
- keep the album's own track order (`albumTrackOrder`, `PUT
  /api/tasks/<id>/album/track-order`) distinct from a playlist's order; the
  historical `albumPlaylist` name survives only in the loader's migration;
- route new "add to playlist" entries through `web/add-to-playlist.js` so every
  entry point behaves the same.

## Produce an album

The optional background-music producer generates and denoises an instrumental
album. It runs from the studio: choose the album workflow, then the
"Background Music Producer · generate and denoise" production mode. It requires
the installed audio pipeline. See
[`background-music-producer.md`](background-music-producer.md) and
[`pipeline/USAGE.md`](../pipeline/USAGE.md).

## Verify a change

Run focused tests while iterating, then the complete local verification set for
a meaningful change:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

The test suite uses Vitest. Add or update focused tests when changing the
`MusicSpec` contract, retrieval ranking, settings behavior, task input, task
persistence, or web API behavior.

Web and journey tests live in `test/` and run against a real local server with
fake providers: Lyria and the Gemini reviewer are mocked, and the album, orchestral
and composer agents are replaced where a test needs them. Follow that pattern
instead of calling live providers. A focused run for the newer features:

```powershell
npx vitest run test/web-journey.test.ts test/web-playlist.test.ts test/web-playlist-api.test.ts test/playlist-store.test.ts test/web-moodmic-review.test.ts test/web-mood-chats.test.ts
```

Poetry retrieval has its own focused set:

```powershell
npx vitest run test/poem-retriever.test.ts test/poem-retriever-english.test.ts test/discussion-poem-references.test.ts
```

Live provider calls are not part of the default verification set. Use them when
the change requires new external evidence. Journey verification uses fake
providers; its first live run is outstanding.

## Rebuild corpus material

Retrieval reads one canonical layout, `corpus/music/<type>/`, with two normalized
collections per type — `styles.normalized.jsonl` and `standards.normalized.jsonl` —
plus a manifest. Rewriting the canonical Jazz files from the existing artifacts
collects no new data:

```powershell
node src/corpus/build-music-corpus.mjs
```

Collecting and normalizing Jazz data uses:

```powershell
node scripts/build-jazz-genres.mjs
node scripts/build-jazz-standards.mjs
pnpm corpus:normalize:jazz
```

These may need network access or a configured model, so rerun them only when the
corpus itself changes. Corpus updates preserve source URLs and manifests so
normalized records stay traceable.

The standards corpus holds one record per tune discussion in Ted Gioia's 2012 first
edition. Re-extracting it from the local Zotero PDF needs `pypdf` and `pdfplumber`:

```powershell
pnpm corpus:import:gioia --pdf "C:\path\to\the\2012-first-edition.pdf"
pnpm corpus:normalize:gioia
```

Extraction checks the chapter titles against PDF bookmarks and keeps page
provenance. The count unit is a source document about a tune, so two sources
discussing one tune stay separate records, and book-derived text carries its own
copyright metadata and licence.

## Rebuild the poetry corpora

Poetry retrieval reads `corpus/poem/`, one directory per language, plus the shared
bilingual lexicon:

```powershell
node scripts/import-modern-poetry.mjs
python scripts/import-english-poetry.py
```

The Chinese importer reads the pinned `sheepzh/poetry` commit and writes
`corpus/poem/Chinese/modern_poems.normalized.jsonl`; `ARIOSO_POETRY_SOURCE` points it
at an existing clone and `ARIOSO_POEM_OUTPUT` changes the output directory. The
English importer downloads the checked-in `sample.csv` of
`Wang-Haining/fine-grained-poetry-interpretation` unless `--source` names a local
copy, keeps the public-domain rows carrying full poem text, and writes
`corpus/poem/English/english_poems.normalized.jsonl`; it needs Python 3 and no other
dependency.

Both importers write a manifest with a sha256 checksum, which the retriever uses as
its corpus version while refusing a mismatched file. A rebuilt corpus invalidates
stored traces. `corpus/poem/mood-lexicon.json` is shared by both importers and the
retriever, so a change there must be reapplied to both corpora.

## Generated and local state

Runtime state and evidence live under the output root (`outputs/` by default;
`ARIOSO_OUTPUT_DIR` moves the whole root):

- browser task records and their audio in `<root>/tasks/<workflowType>/<taskId>/`;
- album production runs in `<root>/tasks/04-album/<taskId>/production/<runId>/`;
- workflow discussion sessions in `<root>/discussions/`;
- MoodMic conversations in `<root>/moodmic/chats/` and mood entries in
  `<root>/moodmic/entries.json`, the session carrying the bounded poem retrieval
  trace rather than the poem texts;
- journey records in `<root>/journeys/`, playlists in `<root>/playlists/`, and
  output kept for evidence in `<root>/archive/`;
- local interface settings in `.arioso/settings.json`; and
- credentials in `.env`.

Every runtime path is derived in `src/config/paths.ts`. Add a location there and
pass `outputPaths()` values to stores instead of joining segments at each entry
point, so changing `ARIOSO_OUTPUT_DIR` moves writers and readers together. Settings
are the exception, living outside the output root so deleting generated output
keeps the configured language: `.arioso/settings.json` is authoritative, and the
next read adopts the older `<root>/settings.json` when that is all there is.

Each store owns its directory and its stable ids. A task directory holds the
authoritative `task.json` plus the audio it references, and an album task adds one
`production/<runId>/` per production attempt. Inside a run, `manifest.json` and the
checksums it records are the completion evidence — `verifyProductionResult`
re-reads them against `album-denoised.wav` and the `tracks/<NN>/` fragments, so
treat them as one unit while the run is resumable. `album-denoised.wav`,
`video.mp4`, `tracklist.txt`, `run-state.json`, and the logs are deliverables and
stay. A `production/<runId>/` directory that `task.json` no longer references is a
superseded run that nothing reads; record what it held, then remove the whole
directory. The `tracks/<NN>/*.wav` fragments are re-derivable intermediates kept
for the checksum chain, so pruning them trades resume verification for disk space.

Pruning and archiving leave a manifest under `<root>/archive/`
(`legacy.manifest.json`, `pruned-production-runs.json`) with a sha256 per file.
Write one before deleting, and delete whole directories rather than individual
files inside a run. Clearing the output root loses task records and generated
audio, and nothing else.

Evaluation harnesses and their evidence live under `experiments/eval/`, beside
the prompt studies in `experiments/` and kept out of git. No source file or
hand-authored asset belongs in the output root.

Preserve existing generation evidence unless the current task explicitly
targets it. Never include API keys in diagnostics or committed fixtures.
