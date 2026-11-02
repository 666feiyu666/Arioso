# Arioso Development

Run commands from the repository root. Arioso requires Node.js 22 or newer and
uses the pnpm version declared in `package.json`.

Before an architectural change, read `docs/abstract.md` for the target and
`docs/current.md` for the implemented starting point. Update the latter when a
change alters the current workflow, data model, persistence, or known gaps.

## Install

```powershell
pnpm install
```

Keep API credentials in the local `.env` or enter them through the browser
settings without persistent storage. Never print, document, or commit real keys.
`.env.example` is the safe configuration reference.

## Run the browser application

```powershell
pnpm web
```

Everything runs through the browser application: composing a spec, generating
audio, the album producer, and stitching orchestral movements are workflow steps
the interface drives, and each writes a task record under the output root. There
is no command-line generator. The server listens on `127.0.0.1:4173` by default,
and composing a prompt needs no Lyria credential, so configure only the providers
the selected operation uses.

The pages are `/` for MoodMic, `/albums.html`, `/playlist.html`,
`/calendar.html`, `/workflow.html`, and `/help.html`.

For a manual check, open a page, run one small operation, and reload it. MoodMic,
the calendar, the album page, the playlist page, and a journey all restore their
state from the server, so a reload is a meaningful test of persistence. Use a new
task for new evidence; do not edit an earlier generated record to represent a
different model call.

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

The optional producer generates and denoises an instrumental album from the
studio: choose the album workflow, then "Background Music Producer · generate and
denoise". It applies to studio albums (`04-album`) only, requires the installed
audio pipeline (`pipeline/setup.ps1`, `pipeline/run.ps1 doctor`, see
[`pipeline/USAGE.md`](../pipeline/USAGE.md)), and checks that runtime before making
any composition or generation request. `ARIOSO_PIPELINE_PYTHON` and
`ARIOSO_PIPELINE_CONFIG` override the interpreter and runtime configuration.

Each run writes a `production/<runId>/` directory under the task. A failed
postproduction run is retried from the task's Continue button, and completed
candidates are reused, so no new generation request is made.

## Verify a change

Run focused tests while iterating, then the complete set for a meaningful change:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

The suite uses Vitest. Add or update focused tests when changing the `MusicSpec`
contract, retrieval ranking, settings behaviour, task input, task persistence, or
web API behaviour. Web, journey, album, and playlist tests run against a real local
server with fake providers: Lyria and the Gemini reviewer are mocked, and the
composer agents are replaced where a test needs them. Follow that pattern instead
of calling live providers.

```powershell
npx vitest run test/web-journey.test.ts test/web-playlist.test.ts test/web-album.test.ts
npx vitest run test/poem-retriever.test.ts test/poem-retriever-english.test.ts
```

Live provider calls are not part of the default verification set. Use them when a
change requires new external evidence; journey verification still uses fake
providers.

## Rebuild corpus material

Retrieval reads one canonical layout, `corpus/music/<type>/`, with two normalized
collections per type (`styles.normalized.jsonl`, `standards.normalized.jsonl`) and
a manifest:

```powershell
node src/corpus/build-music-corpus.mjs
node scripts/build-jazz-genres.mjs
node scripts/build-jazz-standards.mjs
pnpm corpus:normalize:jazz
```

These may need network access or a configured model, so rerun them only when the
corpus itself changes. Updates preserve source URLs and manifests so normalized
records stay traceable. The standards corpus holds one record per tune discussion
in Ted Gioia's 2012 first edition; re-extracting it needs `pypdf` and `pdfplumber`:

```powershell
pnpm corpus:import:gioia --pdf "C:\path\to\the\2012-first-edition.pdf"
pnpm corpus:normalize:gioia
```

Extraction checks chapter titles against PDF bookmarks and keeps page provenance.
Two sources discussing one tune stay separate records, and book-derived text
carries its own copyright metadata.

## Rebuild the poetry corpora

```powershell
node scripts/import-modern-poetry.mjs
python scripts/import-english-poetry.py
```

The Chinese importer reads the pinned `sheepzh/poetry` commit and writes
`corpus/poem/Chinese/modern_poems.normalized.jsonl`; `ARIOSO_POETRY_SOURCE` points
it at an existing clone and `ARIOSO_POEM_OUTPUT` changes the output directory. The
English importer downloads the checked-in `sample.csv` of
`Wang-Haining/fine-grained-poetry-interpretation` unless `--source` names a local
copy, keeps the public-domain rows carrying full poem text, and writes
`corpus/poem/English/english_poems.normalized.jsonl`.

Both importers write a manifest with a sha256 checksum, which the retriever uses
as its corpus version. A rebuilt corpus invalidates stored traces.
`corpus/poem/mood-lexicon.json` is shared by both importers and the retriever, so a
change there must be reapplied to both corpora.

## Generated and local state

Runtime state lives under the output root (`outputs/` by default;
`ARIOSO_OUTPUT_DIR` moves the whole root):

- browser task records and their audio in `<root>/tasks/<workflowType>/<taskId>/`,
  with production runs in `<root>/tasks/04-album/<taskId>/production/<runId>/`;
- workflow discussion sessions in `<root>/discussions/`;
- MoodMic conversations in `<root>/moodmic/chats/` and mood entries in
  `<root>/moodmic/entries.json`;
- journey records in `<root>/journeys/`, playlists in `<root>/playlists/`, and
  output kept for evidence in `<root>/archive/`;
- local interface settings in `.arioso/settings.json`, credentials in `.env`.

Every runtime path is derived in `src/config/paths.ts`. Add a location there and
pass `outputPaths()` values to stores instead of joining segments at each entry
point. Settings are the exception, living outside the output root so deleting
generated output keeps the configured language.

Each store owns its directory and its stable ids. A task directory holds the
authoritative `task.json` plus the audio it references. In a production run,
`manifest.json` and the checksums it records are the completion evidence, so treat
them as one unit while the run is resumable. A `production/<runId>/` directory that
`task.json` no longer references is a superseded run: record what it held, then
remove the whole directory. Write an archive manifest with a sha256 per file before
deleting, and delete whole directories rather than individual files inside a run.

Evaluation harnesses and their evidence live under `experiments/eval/`, kept out of
git. No source file or hand-authored asset belongs in the output root. Preserve
existing generation evidence unless the current task explicitly targets it.
