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

## Inspect the CLI

```powershell
pnpm dev -- --help
```

## Compose without generating audio

This path requires an OpenAI API key and prints the validated `MusicSpec`:

```powershell
pnpm dev -- compose "A quiet instrumental nocturne for piano and muted trumpet."
```

## Compose and generate audio

This path also requires a Gemini API key. It writes an MP3 and JSON metadata to
the configured output directory:

```powershell
pnpm dev -- generate "A quiet instrumental nocturne for piano and muted trumpet."
```

Use a new task or output filename for new evidence. Do not edit an earlier
generated record to represent a different model call.

## Run the browser application

```powershell
pnpm web
```

The server listens on `127.0.0.1:4173` by default. The interface can compose a
prompt without Lyria or generate audio, so only configure the providers needed
for the selected operation.

The pages are:

- `/` for MoodMic, including the album continuation after a piece is kept;
- `/calendar.html` for the mood calendar;
- `/playlist.html` for the album library built from MoodMic references;
- `/workflow.html` for the studio's four workflows; and
- `/help.html` for the short usage guide.

For a manual check, open a page, run one small operation, and reload it. MoodMic,
the calendar, the playlist page, and a journey all restore their state from the
server, so a reload is a meaningful test of persistence.

## Produce an album

The optional background-music producer generates and denoises an instrumental
album:

```powershell
pnpm dev produce-album "Instrumental background music for quiet nighttime reading"
pnpm dev produce-album --resume "<failed-task-id>"
```

It requires the installed audio pipeline. See
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

Live provider calls are not part of the default verification set. Use them only
when the change requires new external evidence, and do not mistake a technically
successful generation for proof of musical quality. The journey has only been
verified with fake providers so far; its first live run is still outstanding.

## Rebuild corpus material

The repository contains scripts for collecting Jazz genre and standards data,
plus a normalization command for the standards corpus. Corpus updates should
preserve source URLs and manifests so normalized records remain traceable.

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

## Generated and local state

The following are runtime state or evidence rather than hand-authored source:

- generated MP3 and metadata files under `outputs/`;
- browser task JSON and audio under `outputs/tasks/` by default;
- workflow discussion sessions under `outputs/discussions/`;
- MoodMic conversations under `outputs/moodmic/chats/` and mood entries in
  `outputs/moodmic/entries.json`;
- journey records under `outputs/journeys/`;
- local interface settings; and
- credentials in `.env`.

Preserve existing generation evidence unless the current task explicitly
targets it. Never include API keys in diagnostics or committed fixtures.
