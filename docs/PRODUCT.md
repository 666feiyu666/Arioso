# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vanilla HTML + CSS + ES modules served by a Node server (`src/web/server.ts`,
`npm run web`). No frontend framework, no bundler step for `web/`. Written and
tested in TypeScript elsewhere (`src/**` → `dist/`).

## Users

People who want to turn a feeling into music without learning a DAW: they can
name a colour, a word and a sentence, but not a chord progression. They are
willing to hold a short conversation and to approve a plan before anything is
generated. The interface is bilingual (Chinese and English) and is used both in
a browser and from a terminal.

## Product Purpose

Arioso turns a feeling into music. A check-in opens a conversation; the
conversation settles a creative brief and a musical plan; the plan is confirmed
before a take is generated; the take is compared against what was asked for; and
the piece is kept or asked for again. A kept song can grow into an album.

Success is that the result sounds like the feeling the person described — and
that they can say why, because the brief, the plan, the prompt and the
references that shaped it all stay visible next to the music.

## Positioning

The product is not a prompt-to-audio box. Nothing is generated until the person
confirms an editable plan, and every kept piece carries the evidence of how it
was made: the brief, the plan, the poems and references that informed it, and
the prompt that produced it. The conversation is the interface; the music is the
outcome.

## Operating Context

- Runs locally on the person's machine with their own API credentials (`.env`,
  never committed). Generation goes through Google Lyria.
- A local corpus (jazz standards, genres, orchestral references) can be brought
  in as musical reference; the model's own knowledge is the alternative.
- Long-running work: a single take, a playlist of tracks, or an album of many
  tracks. Progress, partial results and failure recovery are normal states, not
  edge cases.
- Sessions persist as tasks in a local creative workspace, addressed by
  timestamp and mood.

## Capabilities and Constraints

- MoodMic: colour + word + sentence check-in, conversation with poems, an
  editable brief, a musical plan, one take, a listening check, keep-or-retry.
- Mood calendar: a month view where each day's circle is built from the pieces
  actually made that day, coloured by the recorded mood.
- Albums and playlists: an album author reads the references and the theme, sets
  out a shared sound and per-track outlines, and waits for confirmation; kept
  tracks can be played in order, exported as one file, or downloaded with
  timestamps.
- Workflow studio: four entry points (single piece, single with musical
  references, orchestral work, themed album), plus prompt-level controls
  (duration, vocal mode, lyric language, model).
- All interface copy exists in Chinese and English; the language switch is
  available on every page.
- Constraint: the frontend is hand-written CSS and DOM, so a change to a token
  in `web/theme.css` is felt on every page.

## Brand Commitments

- Name: Arioso. Product voice: plain, warm, unhurried; it describes what will
  happen and what it heard, and never oversells.
- The mood palette is meaning, not decoration: coral, gold, blue and sage are
  the four mood groups and must stay consistent with `web/mood-common.js`.
- The studio reads as a workshop, not a storefront: cool neutral surfaces, the
  record as the one physical object.

## Evidence on Hand

`README.md` (product narrative and screenshots), `Assets/figure/`,
`docs/` (architecture and phase notes), `experiments/`, `outputs/`. Screenshots
in `Assets/figure/` are generated from the real interface.
