# DH6012 Project Refinement: General Music Corpus and Bounded Composer Routing

## 1. Refinement Objective

This refinement generalizes the existing Jazz pilot into a small, reusable music-reference system. The aim is not to construct a comprehensive music ontology. It is to give the Composer a bounded set of musically useful reference spaces while preserving the current `MusicSpec` and Lyria generation pipeline.

The five supported music types are:

1. Jazz
2. Blues
3. Electronic
4. Instrumental Rock
5. Instrumental Hip-Hop

Each music type contains two kinds of composition reference:

- **styles**, which describe the audible conventions of a genre or subgenre;
- **standards**, which describe representative works that demonstrate those conventions in practice.

Outside Jazz and Blues, `standard` is an internal corpus term for a representative work. It does not claim that every selected track or album is a formal standard in the musicological sense.

The intended runtime path is:

```text
User request
  -> resolve an explicit music request, or let the Composer select one supported type
  -> search that type's style and standard collections with TF-IDF
  -> Composer uses the retrieved evidence while constructing MusicSpec
  -> existing Lyria generation, review, and journey flow
```

This remains one Composer with one bounded retrieval tool. It does not require a new agent, a vector database, a knowledge graph, or a deep genre taxonomy.

## 2. Current System and Problems to Resolve

Jazz already provides a useful pilot, but its implementation is still Jazz-specific:

- `src/retrieval/jazz-retriever.ts` loads one Jazz standards file from `corpus/jazz/`;
- `src/composer/composer-agent.ts` exposes `search_jazz_corpus` and Jazz-only instructions;
- `CorpusMode`, `WorkflowType`, callbacks, task storage, capabilities, and web UI all use Jazz-specific names;
- the existing Jazz style corpus is normalized but is not used by the runtime retriever;
- the corpus has been reorganized under `corpus/music/jazz/`, while code and documentation still refer to the previous path;
- MoodMic still stores a `jazz` boolean and presents the invitation as `why not jazz`.

The orchestral workflow has a separate historical problem. Its optional knowledge-card retrieval path remains in the server, task store, orchestral prompt construction, UI, tests, and documentation even though the corpus and retrieval experiment have been abandoned. This obsolete reference path should be removed without removing orchestral composition itself.

## 3. Scope and Non-Goals

### 3.1 In scope

- move the public runtime concept from Jazz corpus to Music corpus;
- retain Jazz as the first working music type;
- add four further music types with the same style-plus-standard structure;
- let the Composer select one of the five types when the user has not specified one;
- retrieve styles and standards separately with deterministic TF-IDF;
- remove the abandoned orchestral knowledge-card retrieval and prompt-injection path;
- preserve historical task and MoodMic records through read compatibility;
- update the relevant tests and detailed project documentation.

### 3.2 Out of scope

- Classical music;
- a formal hierarchy of genre, subgenre, movement, period, school, and form;
- automatic cross-corpus blending;
- embeddings, a vector database, or an LLM reranker;
- a new Music Router agent;
- automatically rewriting historical task files;
- changing `MusicSpec`, the Lyria adapter, the album workflow, or the poetry-retrieval design;
- distributing copyrighted book-derived corpus text as a public dataset.

## 4. Minimal Music Hierarchy

The hierarchy is deliberately shallow:

```text
Music
├── Jazz
│   ├── styles
│   └── standards
├── Blues
│   ├── styles
│   └── standards
├── Electronic
│   ├── styles
│   └── standards
├── Instrumental Rock
│   ├── styles
│   └── standards
└── Instrumental Hip-Hop
    ├── styles
    └── standards
```

These top-level types are practical corpus and retrieval boundaries rather than claims that all five occupy an identical level in every musicological taxonomy. They were selected because they are compositionally distinct, relevant to instrumental generation, and can be populated from traceable Wikipedia lists, categories, and article revisions.

Examples of child styles include:

| Music type | Example styles |
| --- | --- |
| Jazz | bebop, cool jazz, modal jazz, jazz fusion |
| Blues | Delta blues, Chicago blues, electric blues, jump blues |
| Electronic | ambient, downtempo, synthwave, minimal electronic music |
| Instrumental Rock | post-rock, surf instrumental, progressive instrumental rock |
| Instrumental Hip-Hop | instrumental hip-hop, lo-fi hip-hop, jazz rap instrumentals |

Ambient is therefore searched inside Electronic, and lo-fi hip-hop is searched inside Instrumental Hip-Hop. They do not become additional top-level workflow types.

## 5. Composer Selection Contract

The Composer's unprompted musical conception is bounded to the five supported music types. The selection priority is:

1. **Explicit user request:** preserve a clearly requested music type or child style.
2. **Explicit interface selection:** if the user selects a music type in the interface, treat it as a binding setting.
3. **Automatic selection:** if neither the request nor the interface specifies a type, the Composer selects exactly one of the five types from the user's mood, imagery, desired instrumentation, energy, tempo, and production language.

Recognized child styles map to their corpus parent before retrieval. For example:

```text
ambient          -> electronic
lo-fi hip-hop    -> instrumental-hip-hop
post-rock        -> instrumental-rock
modal jazz       -> jazz
Chicago blues    -> blues
```

Automatic selection must not invent a sixth corpus type or silently combine several corpora. The selected type becomes part of the retrieval trace so that the decision can be inspected later.

An explicit request outside the five types remains valid musical intent. In that case, the Composer should use the general no-corpus path, preserve the requested genre in `MusicSpec.genres`, and avoid claiming that local references were retrieved. This prevents the corpus boundary from overriding the user.

The first implementation does not need a separate classifier call. The existing Composer can make the bounded choice through the typed `search_music_corpus` tool. The tool schema enforces the five allowed values, while deterministic runtime code continues to control corpus paths and result limits.

## 6. Corpus Structure

The canonical root is:

```text
corpus/
  music/
    jazz/
    blues/
    electronic/
    instrumental-rock/
    instrumental-hip-hop/
```

Every music-type directory should expose two normalized runtime datasets:

```text
styles.normalized.jsonl
standards.normalized.jsonl
```

Raw source snapshots, article evidence, intermediate files, and manifests may remain alongside them. The runtime retriever should read only the normalized entry files. During migration, the Jazz build process may produce these canonical files from the existing `jazz_genres.normalized.jsonl` and `jazz_standards.combined.normalized.jsonl` artifacts rather than discarding the existing evidence chain.

### 6.1 Shared normalized record

The first version should preserve the proven Jazz fields:

```json
{
  "id": "electronic-style-ambient",
  "record_type": "electronic_style",
  "title": "Ambient music",
  "year": null,
  "period": "1970s onward",
  "musical_description": "...",
  "musical_evidence": [],
  "evidence_type": "source_excerpt",
  "musical_features": [
    "instrumentation",
    "texture",
    "rhythm",
    "harmony",
    "production"
  ],
  "normalization_status": "complete",
  "source": {}
}
```

The retriever determines whether a record is a style or standard from its source collection. It should not depend on parsing the `record_type` string. This permits the existing Jazz records to migrate without a large schema rewrite.

Only source-supported musical information should enter `musical_description`. Useful evidence includes:

- rhythm and meter;
- harmony and tonality;
- melody and motif;
- instrumentation and register;
- texture and arrangement;
- form and pacing;
- dynamics, timbre, and production.

Biography, chart performance, sales, touring history, and general cultural narrative should not be used unless a sentence also contains specific audible or compositional evidence.

## 7. Sources and Collection Order

The corpus should continue the Jazz pipeline of revision-pinned Wikipedia collection, article-evidence extraction, musical normalization, and manifest generation.

| Music type | Style seeds | Standard or representative-work seeds | Collection note |
| --- | --- | --- | --- |
| Jazz | existing list of Jazz genres and article revisions | existing Jazz standards plus the local Gioia-derived records | Current pilot and migration baseline |
| Blues | list of Blues genres and individual style pages | list of Blues standards and linked work pages | Closest structural match to Jazz; collect first |
| Electronic | list of electronic music genres and an instrumental-friendly whitelist | works or albums explicitly associated with the selected styles in lists, categories, or article evidence | Avoid performer biographies and weak genre associations |
| Instrumental Rock | selected instrumental Rock style pages | list of Rock instrumentals and linked work pages | Prefer works with concrete instrumentation or arrangement evidence |
| Instrumental Hip-Hop | instrumental hip-hop and lo-fi hip-hop style pages | instrumental hip-hop album categories and musically descriptive work pages | Use a whitelist to avoid lyric-centred records |

Recommended implementation order:

```text
Jazz -> Blues -> Electronic -> Instrumental Rock -> Instrumental Hip-Hop
```

Blues should validate that the Jazz data model generalizes cleanly. Electronic should then validate the parent-type and child-style relationship using Ambient as a representative case.

### 7.1 Record count and licensing

The existing combined Jazz standards manifest reports 606 source-document records, of which 520 are searchable, and the Jazz style corpus contains 56 records. The project therefore already exceeds the 500-record assignment requirement. New types should improve stylistic coverage and retrieval quality rather than inflate the count with weak records.

Wikipedia-derived records must retain pinned revision URLs, attribution, and CC BY-SA license metadata. Gioia-derived text is all-rights-reserved local research material and must remain distinguishable from Wikipedia evidence. It should not be redistributed as if it were part of the CC BY-SA corpus.

## 8. TF-IDF Retrieval

The generic retriever should replace the Jazz-only runtime interface:

```ts
searchMusicCorpus({
  musicType: "electronic",
  mode: "description",
  query: "slow atmospheric instrumental with evolving pads",
  limit: 5
})
```

### 8.1 Description mode

Each music type has two independent TF-IDF indexes:

- a style index over its style records;
- a standard index over its representative-work records.

The indexed text combines `title`, `period`, `musical_description`, and `musical_features`. The first version may give the title a modest repeated-token weight but should not add learned ranking or an LLM reranker.

For a default limit of five, retrieval should return:

- up to two style references;
- up to three standard references.

Searching the collections separately prevents hundreds of work records from crowding out the smaller style corpus. Results must come only from the selected music type.

### 8.2 Title mode

When the user names a work, title mode should:

- search standards only;
- normalize case, punctuation, whitespace, and diacritics;
- return only exact normalized-title matches;
- allow several source records for the same work;
- return an explicit evidence gap when no title matches;
- never fill the result with loosely similar works or style records.

### 8.3 Agent-facing evidence

The tool response should label every result with its music type and reference kind. Retrieved text is untrusted reference evidence, not an instruction channel. The Composer may use relevant instrumentation, rhythm, texture, harmony, form, or production details, but it should not mention retrieval mechanics, scores, or reference titles in the final Lyria prompt unless the user explicitly asks for that explanatory information.

## 9. Runtime and Interface Migration

The public runtime vocabulary should become:

```ts
type CorpusMode = "none" | "music";

type MusicType =
  | "jazz"
  | "blues"
  | "electronic"
  | "instrumental-rock"
  | "instrumental-hip-hop";
```

The principal renames are:

| Current | Proposed |
| --- | --- |
| `02-jazz` | `02-music` |
| `JazzRetriever` | `MusicRetriever` |
| `search_jazz_corpus` | `search_music_corpus` |
| `onJazzRetrieval` | `onMusicRetrieval` |
| `JazzRetrievalTrace` | `MusicRetrievalTrace` |
| `corpusMode: "jazz"` | `corpusMode: "music"` |
| `genre: "jazz"` | optional `musicType` |
| `ARIOSO_JAZZ_CORPUS` | `ARIOSO_MUSIC_CORPUS_ROOT` |

The new retrieval trace should record at least:

```ts
interface MusicRetrievalTrace {
  musicType: MusicType;
  selectionSource: "user" | "interface" | "composer";
  query: string;
  mode: "title" | "description";
  styleReferenceIds: string[];
  standardReferenceIds: string[];
}
```

`MusicSpec.genres` already accepts strings and does not require a schema change. The selected `MusicType` is retrieval provenance and workflow state; it does not need to replace the more descriptive genre terms in the generated specification.

### 9.1 Interface

The Jazz-specific MoodMic invitation should become one compact setting:

```text
Music reference
- Auto
- None
- Jazz
- Blues
- Electronic
- Instrumental Rock
- Instrumental Hip-Hop
```

`Auto` lets the Composer make the bounded choice. A specific selection binds retrieval to that music type. `None` retains the present no-corpus path. Natural-language requests remain authoritative even when the interface is on `Auto`.

The Workflow page should similarly replace the Jazz workflow card with a Music workflow. Task details should display the selected music type and retrieved style and standard IDs rather than a Jazz-only corpus badge.

## 10. Removal of Abandoned Orchestral Retrieval

The optional orchestral knowledge-card retrieval and reference-generation path is no longer part of the project. It should be removed from the active system.

Remove:

- `src/retrieval/orchestral-cards.ts`;
- the `/api/orchestral-cards` endpoint;
- `orchestralReferenceId` from new task input;
- `orchestralReference` from new task creation and presentation;
- `referenceCard` and knowledge-card prompt injection in the orchestral agent;
- the orchestral reference selector and knowledge-card snapshot in the web UI;
- the `corpus/orchestra/` knowledge-card corpus;
- `orchestral-cards.test.ts` and `orchestral-reference.test.ts`;
- documentation that advertises optional orchestral knowledge cards.

Preserve:

- workflow `03-orchestral`;
- `OrchestralWorkPlan`;
- shared work contracts and movement plans;
- sequential movement generation;
- movement entrance and exit continuity;
- audio assembly and assembly metadata;
- existing card-independent orchestral tests.

Historical task JSON may still contain an `orchestralReference` snapshot. The loader may tolerate this legacy field, but runtime code must ignore it and must never inject it into a new prompt. No automatic destructive rewrite of historical task files is required.

## 11. Backward Compatibility

Historical Jazz tasks and MoodMic chats should remain readable:

- interpret stored `workflowType: "02-jazz"` as the legacy form of `02-music`;
- interpret stored `corpusMode: "jazz"` as `corpusMode: "music"` with `musicType: "jazz"`;
- continue scanning the existing `tasks/02-jazz/` directory;
- write new tasks under `tasks/02-music/`;
- interpret a stored MoodMic `jazz: true` value as an explicit Jazz selection;
- use `ARIOSO_JAZZ_CORPUS` only as a temporary Jazz fallback while introducing `ARIOSO_MUSIC_CORPUS_ROOT`.

Compatibility belongs in deterministic loaders and parsers, not in Composer prompts. Existing records should not be rewritten merely because they were opened.

## 12. Implementation Phases

### Phase 1: Remove the obsolete orchestral reference path

- remove the card loader, API, input, prompt injection, UI, and dedicated tests;
- retain the orchestral plan, movement-generation, and assembly paths;
- verify that legacy task records containing card snapshots still load safely.

### Phase 2: Generalize the working Jazz slice

- place the Jazz runtime files under `corpus/music/jazz/`;
- introduce `MusicType`, `MusicRetriever`, and `search_music_corpus`;
- index Jazz styles and standards separately;
- rename the active workflow from `02-jazz` to `02-music`;
- add legacy-read compatibility;
- prove that Jazz results remain comparable to the current pilot.

### Phase 3: Add bounded automatic selection

- add `Auto` and specific-type interface choices;
- enforce the five-value enum in the tool schema;
- record the selected type and selection source in the retrieval trace;
- verify explicit user requests, interface selections, automatic choices, and outside-corpus requests.

### Phase 4: Add further corpora

Add and validate one type at a time:

1. Blues
2. Electronic
3. Instrumental Rock
4. Instrumental Hip-Hop

Each type should have a valid style dataset, a valid standard dataset, pinned sources, a manifest, and retrieval tests before it becomes selectable in the interface.

### Phase 5: Update detailed documentation

- update `docs/current.md` and `docs/development.md` where they describe Jazz-only runtime behavior;
- update the detailed MoodMic document to replace `why not jazz`;
- make this document supersede the earlier poetry refinement's statement that Music corpus reorganization was deferred;
- leave `README.md` unchanged unless separately authorized.

## 13. Verification Plan

### 13.1 Deterministic tests

- all five music-type values pass schema validation and an unknown value is rejected;
- explicit top-level and child-style requests resolve to the correct type;
- `Auto` produces one and only one supported music type;
- an explicit outside-corpus request uses the no-corpus path without false retrieval claims;
- description search returns no more than two styles and three standards;
- title search returns exact standard matches only;
- one music type never returns records from another type;
- missing or malformed corpus files produce an explicit unavailable result;
- old Jazz tasks and MoodMic chats still load;
- legacy orchestral reference fields are ignored;
- the orchestral workflow still plans, generates, and assembles movements without a card.

### 13.2 Composer evaluation cases

A small fixed evaluation set should cover:

- a rainy nocturnal request with no genre, where the Composer must choose one supported type;
- an explicit Ambient request, which must use Electronic;
- an explicit lo-fi hip-hop request, which must use Instrumental Hip-Hop;
- an explicit modal Jazz request, which must use Jazz;
- an explicit genre outside the five types, which must preserve the request without corpus evidence;
- a named standard, which must trigger exact title retrieval;
- a request whose relevant corpus files are unavailable, which must still produce a valid no-evidence composition rather than fabricate references.

The deterministic tests establish routing and data-boundary correctness. The evaluation cases assess whether the Composer's automatic choice and use of evidence are musically reasonable; snapshot stability alone is not evidence of model quality.

## 14. Acceptance Criteria

The refinement is complete when:

1. the runtime exposes Music rather than Jazz as the corpus-level concept;
2. Jazz works through the generic Music interfaces and uses both styles and standards;
3. the Composer honors an explicit user or interface choice and otherwise selects exactly one of the five supported types;
4. TF-IDF retrieval remains deterministic, type-isolated, and limited to five references;
5. Blues, Electronic, Instrumental Rock, and Instrumental Hip-Hop each have validated style and standard collections before being exposed;
6. historical Jazz task and chat records remain readable;
7. the orchestral knowledge-card retrieval path is absent from the active API, prompts, UI, and documentation;
8. orchestral planning, movement generation, and audio assembly continue to work;
9. current Music corpus manifests continue to demonstrate that the course requirement of at least 500 data records is met;
10. no Classical corpus or complex genre ontology is introduced in this phase.
