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
- `/calendar.html` for the mood calendar;
- `/playlist.html` for the album library built from MoodMic references;
- `/workflow.html` for the studio's four workflows; and
- `/help.html` for the short usage guide.

For a manual check, open a page, run one small operation, and reload it. MoodMic,
the calendar, the playlist page, and a journey all restore their state from the
server, so a reload is a meaningful test of persistence.

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
npx vitest run test/web-journey.test.ts test/web-playlist.test.ts test/web-moodmic-review.test.ts test/web-mood-chats.test.ts
```

Poetry retrieval has its own focused set:

```powershell
npx vitest run test/poem-retriever.test.ts test/poem-retriever-english.test.ts test/discussion-poem-references.test.ts
```

Live provider calls are not part of the default verification set. Use them only
when the change requires new external evidence, and do not mistake a technically
successful generation for proof of musical quality. The journey has only been
verified with fake providers so far; its first live run is still outstanding.

## Rebuild corpus material

The runtime reads one canonical layout, `corpus/music/<type>/`, with two
normalized collections per music type: `styles.normalized.jsonl` and
`standards.normalized.jsonl`. Jazz is populated; Blues, Electronic, Instrumental
Rock and Instrumental Hip-Hop stay unavailable until their collections exist.
The migration step rewrites the canonical files from the existing Jazz
artifacts without collecting new data:

```powershell
node src/corpus/build-music-corpus.mjs
```

The repository also contains scripts for collecting Jazz genre and standards
data, plus a normalization command for the standards corpus. Corpus updates
should preserve source URLs and manifests so normalized records remain
traceable.

```powershell
node scripts/build-jazz-genres.mjs
node scripts/build-jazz-standards.mjs
pnpm corpus:normalize:jazz
```

These commands may require network access or a configured model depending on
the script. Do not rerun them merely to verify unrelated application changes.

The combined standards corpus includes one record per tune discussion in Ted
Gioia's 2012 first edition. To re-extract it from the existing local Zotero PDF,
use Python with `pypdf` and `pdfplumber` installed:

```powershell
pnpm corpus:import:gioia --pdf "C:\path\to\the\2012-first-edition.pdf"
pnpm corpus:normalize:gioia
```

Extraction checks all 252 chapter titles against PDF bookmarks and preserves
page provenance. Normalization retains music-specific source excerpts, then
rebuilds the combined file and its count manifest. `corpus:normalize:jazz` also
rebuilds both normalized standards sources and their combination. The count
unit is a source document about a tune, so different sources discussing the
same tune remain separate records. Book-derived text retains its own copyright
metadata rather than inheriting Wikipedia's license.

## Rebuild the poetry corpora

Poetry retrieval reads `corpus/poem/`, one directory per language, plus the
shared bilingual lexicon:

```powershell
node scripts/import-modern-poetry.mjs
python scripts/import-english-poetry.py
```

The Chinese importer reads the pinned `sheepzh/poetry` commit and writes
`corpus/poem/Chinese/modern_poems.normalized.jsonl`; `ARIOSO_POETRY_SOURCE`
points it at an existing clone and `ARIOSO_POEM_OUTPUT` changes the output
directory. The English importer downloads the checked-in `sample.csv` of
`Wang-Haining/fine-grained-poetry-interpretation` unless `--source` names a
local copy, keeps only the public-domain rows that carry full poem text, and
writes `corpus/poem/English/english_poems.normalized.jsonl`. It needs Python 3;
no other dependency is required.

Both importers write a manifest with a sha256 checksum, and the retriever uses
that checksum as its corpus version while refusing a mismatched file. A rebuilt
corpus therefore invalidates previously stored traces instead of silently
reusing old reference ids. The mood vocabulary in
`corpus/poem/mood-lexicon.json` is shared by both importers and the retriever,
so a change there must be reapplied to both corpora.

## Generated and local state

The following are runtime state or evidence rather than hand-authored source:

- generated MP3 and metadata files under the output root (`outputs/` by default;
  `ARIOSO_OUTPUT_DIR` moves the whole root);
- browser task records and their audio under `<root>/tasks/<workflowType>/<taskId>/`;
- album production runs under `<root>/tasks/04-album/<taskId>/production/<runId>/`;
- workflow discussion sessions under `<root>/discussions/`;
- MoodMic conversations under `<root>/moodmic/chats/` and mood entries in
  `<root>/moodmic/entries.json`; the session file carries the bounded poem
  retrieval trace, not the poem texts;
- journey records under `<root>/journeys/`;
- output kept for evidence but no longer written under `<root>/archive/`;
- local interface settings in `.arioso/settings.json`; and
- credentials in `.env`.

## Output layout and retention

Every runtime path is derived in `src/config/paths.ts`. Add a location there and
pass `outputPaths()` values to stores instead of joining segments at each entry
point, so changing `ARIOSO_OUTPUT_DIR` moves writers and readers together.
Settings are the exception: they live outside the output root, because deleting
generated output must not discard the configured language. `.arioso/settings.json`
is authoritative; when only the older `<root>/settings.json` exists, the next
read adopts it at the new path.

Each store owns its directory and its stable ids. A task directory holds the
authoritative `task.json` plus the audio it references; an album task adds one
`production/<runId>/` directory per production attempt. Inside a production run:

- `manifest.json` and the checksums it records are the completion evidence.
  `verifyProductionResult` re-reads them against `album-denoised.wav` and the
  `tracks/<NN>/` fragments, so treat them as one unit while a run is resumable.
- `album-denoised.wav`, `video.mp4`, `tracklist.txt`, `run-state.json`, and the
  logs are deliverables or evidence and stay.
- A `production/<runId>/` directory that `task.json` no longer references is a
  superseded run. Nothing reads it, so it can be removed; record what was
  removed before deleting.
- `tracks/<NN>/*.wav` fragments are re-derivable intermediates. They are only
  kept for the checksum chain, so pruning them trades resume verification for
  disk space: the run then fails verification and a later production starts a
  fresh run.

Pruning and archiving leave a manifest under `<root>/archive/`
(`legacy.manifest.json`, `pruned-production-runs.json`) with a sha256 per file.
Write one before deleting, and delete whole directories rather than individual
files inside a run. The output root is disposable: clearing it loses task
records and generated audio, nothing else.

Evaluation harnesses and their evidence live under `experiments/eval/`, beside
the prompt studies in `experiments/` and kept out of git. No source file or
hand-authored asset belongs in the output root.

Preserve existing generation evidence unless the current task explicitly
targets it. Never include API keys in diagnostics or committed fixtures.
