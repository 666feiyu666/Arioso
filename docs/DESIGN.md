---
name: Arioso
description: An agentic music workspace where a feeling becomes a song and a kept song becomes an album.
colors:
  bg: "#e8ebf1"
  surface: "#ffffff"
  surface-2: "#f2f4f8"
  surface-3: "#e7ebf2"
  ink: "#10151f"
  ink-soft: "#454d5e"
  muted: "#666f82"
  faint: "#9aa2b2"
  line: "#ccd2e0"
  line-strong: "#aeb7c8"
  brand: "#5546e0"
  brand-deep: "#3a2ec0"
  brand-soft: "#e9e6fb"
  record: "#e5484d"
  ok: "#2f9d78"
  danger: "#c8433a"
  mood-coral: "#e87575"
  mood-gold: "#e9bd46"
  mood-blue: "#779dd6"
  mood-sage: "#83b59a"
  mood-coral-ink: "#b14a4a"
  mood-gold-ink: "#8a6a12"
  mood-blue-ink: "#38628f"
  mood-sage-ink: "#37705a"
typography:
  display:
    fontFamily: "EB Garamond, Noto Serif SC, Songti SC, Georgia, serif"
    fontSize: "2.625rem"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.006em"
  body:
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: "0em"
rounded:
  lg: "15px"
  md: "11px"
  sm: "7px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page-gutter: "clamp(20px, 2.2vw, 40px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-soft}"
    rounded: "999px"
    padding: "4px 11px"
---

## Overview

Arioso is a studio, not a storefront. The surfaces are cool and neutral so the
music and the mood colours are the only things that carry hue; hierarchy comes
from lines, tone and type weight rather than from float, glow or nested cards.
The one deliberately physical object is the record: a dark disc with groove
rings, used wherever a take is being made.

Two modes live in one system. MoodMic, the calendar and the album pages are
*Operate* surfaces — the person is completing a task, so scanability and
restraint win. Help is a *Read* surface. Nothing here is a marketing page.

Single source of truth: `web/theme.css`. Every page stylesheet builds on it and
introduces no new colours or type sizes.

## Colors

- `bg` is a cool neutral, never warm paper. Surfaces lift by one step at a time
  (`surface` → `surface-2` → `surface-3`); there is no shadow-led elevation
  except on floating menus and the player bar.
- The page itself is lit, not painted: light falls from the top edge, four
  corners carry the four mood hues, and the bottom of the frame is weighted so
  the room has a floor. See `body` / `body::before` in `theme.css`. The hues
  never exceed 22% mix, so no page ever looks tinted by a single colour.
- `--bg` must be dark enough for that corner light to read. It was `#e8ebf1` and
  the light disappeared into it; `#e3e6ee` is the working value. If you change
  it, change `theme-color` in every page's `<head>` and the note fills in
  `melody.svg` with it.
- `ink` / `ink-soft` / `muted` / `faint` are a four-step text ramp. `muted` is
  the lightest step allowed for body copy and sits at 4.6:1 or better on every
  surface; `faint` is for placeholders and disabled states only.
- `brand` (indigo) means "the system is acting": focus rings, selection,
  primary hover, current tab. It is not a decorative accent.
- The four `mood-*` colours are product meaning — they mirror
  `web/mood-common.js` and must not drift. They are light hues, so they are for
  fills, dots, rings and tints. Type in a mood hue uses its `mood-*-ink` pair.
- `record` is the record button only. `ok` and `danger` are status, not decoration.

## Typography

- **Two voices.** Headings and the wordmark speak in a serif — EB Garamond
  for Latin, Noto Serif SC for Chinese — because this product is about feeling,
  not about tooling. Archivo carries body copy, controls and labels; IBM Plex
  Mono carries anything that reads as data (timecodes, durations, prompts,
  counts) and the prompt body.
- **Never let the browser fake a bold.** The serif stack tops out at 500; ask
  for 600 and the browser synthesises it, which smears the letterforms. 500 is
  also the right weight for Noto Serif SC at display sizes.
- **Not Instrument Serif.** It was the first choice and reads well, but it has
  become the default "tasteful serif" of generated interfaces — the detector
  flags it as an overused face, which is the opposite of a point of view.
- Body is 15px/1.6. Headings step up from 1.2rem to 2.625rem with weight 500 and
  `-0.006em` tracking. Serif tracking is looser than the sans it replaced: the
  old `-0.017em` pulled the strokes into each other. Line height went 1.12 → 1.18
  for the same reason — serifs have deeper descenders.
- The voice is legible, not decorative. No gradient text, no outline text, no
  per-character animation: the personality comes from the letterforms.
- **One display step for page titles:** `clamp(2rem, 3.2vw, 2.9rem)` at
  `-0.028em`, shared by the album shelf, the playlist shelf, the calendar and
  the workflow studio. The MoodMic empty state is the only title above it
  (`clamp(2.15rem, 4.6vw, 3.4rem)`) because that one is the hero. A page title
  that is smaller than a section heading is a bug.
- Sentence case everywhere. No tracked-out uppercase eyebrows, no decorative
  micro-labels. 0.75rem (12px) is the floor for anything a person reads or
  clicks — there is nothing smaller in the system on purpose.
- Long-form reading (help, poems) keeps a 680px measure.

## Layout

- One content width per page: `--page-max` 1280px with a
  `clamp(20px, 2.2vw, 40px)` gutter, shared by the tab bar and the page body so
  titles, cards and the player line up on a single left edge.
- Two-pane pages (MoodMic, workflow studio) put the list on the left and keep it
  scrollable independently of the stage on the right.
- Cards sit in a grid with 12–16px gaps. Cards never nest inside cards: a
  section is separated by a line or a tone step, not by wrapping it in another
  card.
- Breakpoints: 1180px, 980px, 700px. Below 700px the sidebar collapses into the
  tab bar and every grid becomes a single column.

## Elevation & Depth

Flat by default. Depth has exactly three uses: the floating player bar, modal
dialogs and popovers, and the toast region. These get a large soft shadow plus
`backdrop-filter: blur()`. Everything else is separated by `line`, `surface-2`
or a 6–7% tint of the accent colour.

One environmental light is allowed, and only on the MoodMic empty state: a wide,
heavily blurred radial wash behind the mood contour, mixed at under 10%. It is
room light, not a halo — it carries the colour of whatever is playing, and it
never gets an offset shadow or a border.

### The record's room

An album or playlist header is not a title block, it is the room that record is
playing in. The header carries `--cover-art` (the cover image URL) or the
fallback `--cover-from` / `--cover-to` / `--cover-angle` tones, and CSS blows
whichever it gets up to 30% beyond the header, blurs it at 64px, saturates it to
1.55 and washes it down under a white veil so type keeps its contrast.

Rules:

- The cover is the largest object on the page (`clamp(160px, 17vw, 224px)`), and
  the title sits against its baseline, not above it as a caption.
- Every record therefore arrives with its own light. No page should look like
  the same grey surface with different text in it.
- The veil is part of the component: without it the blurred artwork drops body
  text below 4.5:1. Do not "show more of the cover" by thinning it.
- A percentage on a finished record is a receipt, not a headline: muted, at
  reading size. The record's name is the thing worth looking at.

A tracklist is rows on one surface divided by a hairline — never a stack of
bordered cards. Row numbers, titles, lengths and controls align with the header
above them, and the list runs the full width of the page.

### The shelf

A library page is a shelf of records, not square images pasted on a background.

- A cover is a physical object: 10px radius, a soft offset shadow, and it lifts
  4px on hover. Never a flat square sitting directly on the page colour.
- **Every card draws its own plank** (`.lib-card::after`): 3px tall, overhanging
  the column gap by half on each side, so neighbours join into one continuous
  shelf without any script knowing how many columns the grid made. The plank is
  not a divider line — it gets its thickness from an inset top highlight and a
  shadow underneath, both of which are load-bearing.
- The row gap (46px) is larger than the column gap (26px) because the extra
  space **is** the shelf: 16px of plank clearance under the metadata, then the
  air between one shelf and the next.
- The grid uses `auto-fit` with a 380px ceiling, so a shelf of three fills the
  wall instead of hugging the left edge — but a shelf of two does not stretch
  one cover across half the screen. The browser sizes the columns from the
  ceiling, so raising it past that ceiling drops a column at 1440px.
- The plank stops at the last card of the row, per the shelf being a holder for
  records rather than a page-wide rule. Rows of different lengths therefore have
  planks of different lengths; that is intended.
- Under the cover: the name at 1.12rem with `-0.018em` tracking, then one quiet
  metadata line. The state dot stays inside the artwork's bottom corner.
- On a phone the shelf is two columns at 140px minimum, `--shelf-gap` drops to
  14px so the planks still meet, and the type steps down with it.

A card that belongs to a group (a mood example, a workflow type) is tinted with
that group's colour at low strength and carries a coloured border on hover. It
does **not** carry a thick bar down one side.

## Shapes

- Radii: 15px (large cards), 11px (button, field, small cards), 7px (inline
  blocks, code). Pills (999px) are reserved for chips and segmented controls.
- **Lines carry structure, so they are visible.** `--line` is `#ccd2e0` and
  `--line-strong` is `#aeb7c8` — one clear step below the page, not a hint. A
  boundary nobody can see is not a boundary.
- Hairlines are 1px. Where an edge must read as a physical object rather than a
  division (a shelf plank), it gets real thickness: 5px with a lit top edge and
  a shadow under it.
- Planks meet with square ends. A radius on each card's plank leaves a notch
  where two of them join, and the shelf reads as segments instead of one board.
- Circles mean the record, a mood dot, a wave line, a calendar day's record, or
  a status indicator. Nothing else is round.

### The calendar day

Each day in the mood calendar is a cell, a number and — on days that produced a
piece — one dot. The dot is the record and the number is its label:

- **The dot grows with the pieces kept that day**, up to three, and splits into
  equal colour segments when the day holds more than one mood. That is the only
  count on screen; there is no second badge repeating it.
- **A recorded day carries a 9% wash of its first mood** behind the whole cell,
  so a month reads as a field of remembered days at a glance.
- Hover tints *over* that wash rather than replacing it, so a coloured day never
  goes grey under the cursor.


### The mood contour

The MoodMic empty state carries one drawn line through four notes, and it is a
data graphic, not an illustration. It is drawn to be **seen**: `#9a8ce4` at
3.5px, the deepest line in the system. A faint version of it was invisible
against the page, which made the four notes look like decoration.

- **Vertical position is pleasantness.** A pleasant group sits above the centre
  line, an unpleasant one below it.
- **Distance from the centre line is energy.** High-energy groups swing wide,
  low-energy groups stay near the middle.
- **Horizontal position is the group's place in the set**, and it must line up
  with the four cards below it — each note sits on its card's centre line.

So the contour reads, in order: coral low, gold high, blue low, sage high, with
the gold and coral swings wider than the blue and sage ones. Any future change
to the drawing has to keep that mapping, or it becomes decoration.

Each card repeats the same model at small scale as a five-line wave: the spread
of the five bars follows the group's energy. The wave animates only while that
mood is playing.


## Components

- **Buttons** (`web/editorial.css`): primary is ink-on-white, hovering to brand;
  secondary is white with a `line-strong` border; ghost is border-only. All share
  the 11px radius and 11×18px padding. Loading state is a centred spinner with
  the label made transparent.
- **One shape per surface.** In the album and playlist views exactly one control
  is a filled pill — the primary action (`播放全部`). Everything else is a
  `.pl-btn-quiet`: a word with 6×10px of padding, no border, no fill, gaining a
  6% ink wash on hover. A row of three outlined pills for `收录 / 排除 / 加入歌单`
  read as three equal choices and buried the track title behind them; as type
  they sit behind the content where they belong.
- **State is type, not outline.** The current state of a quiet button is said
  with `brand-deep` and weight 700, never with a border: an outlined "included"
  beside an outlined "excluded" claims both are live choices when one is
  already true. This matters doubly in Chinese, where two-character labels
  inside 12px side padding made every capsule bulge.
- **Fields**: 1px `line-strong`, brand border plus a 3px `brand-soft` ring on
  focus.
- **Cards**: 1px `line`, 15px radius, white surface, hover lifts 2px and colours
  the border.
- **Chips / tags**: pill, `surface-2`, `ink-soft`, 0.75rem, weight 600.
- **Tab bar** (`web/nav.css`): 64px, frosted at 80% surface so the page light
  shows through. The brand mark is a filled circle with the serif italic A —
  a record, not an app icon. The current tab carries a two-bar level meter
  (three gradient bars, no extra markup) instead of an underline: a flat rule
  says "tab", a lit meter says "playing". Hovering any other tab previews the
  same meter at 45%, so the bar shows where you are going before you click.
  **The bar has one button language: a word, no border.** The language switch
  and the settings entry were the last two boxed controls in a row that is
  otherwise all type — a two-letter label in a 1px frame reads like a form
  field dropped into the corner. Both are now text at `muted`, gaining a 6%
  ink wash on hover, exactly like a tab.
  **The bar is the same on all six pages:** brand mark, six tabs, then
  `设置 + 语言` on the right. The workflow page used to hide its settings in the
  sidebar and carry no language switch at all; the settings entry now lives in
  the bar everywhere and every page's script binds the same `openSettingsDialog`
  with its own language state and redraw callback. The bar's own controls are
  declared in full inside `nav.css` rather than patched onto `editorial.css`'s
  `.e-btn`: the albums, playlist and workflow pages never load that file, so the
  same two buttons came out a border-width and 2.7px taller there.
- **Player bar**: fixed to the bottom, frosted, holds the current take across
  page changes. It is the only always-on chrome besides the tab bar.
- **Progress**: a 4px rounded track that breathes in opacity while work runs. No
  sweeping highlight, no marquee.

## Do's and Don'ts

- Do let a mood colour tint a surface (5–8%) before reaching for a border.
- Do keep new colours and sizes out of page stylesheets — add a token to
  `theme.css` or reuse one.
- Do give any live indicator (typing dots, a busy badge) an actual live source;
  animation without state is decoration.
- Don't set type in a light `mood-*` hue — use its `mood-*-ink` pair.
- Don't put a thick coloured bar on one side of a card; that is the single
  strongest "generated UI" tell and it is banned here.
- Don't draw the mood contour as a decorative wave, and don't add a note that
  is not one of the four moods: its geometry is the mood model.
- Don't animate a waveform, a glow or a pulse unless the thing it stands for is
  actually happening. Motion is state, not atmosphere.
- Don't add icon tiles above headings, purple-blue gradients, or nested cards.
- Don't go below 0.75rem for text a person reads or taps.
- Don't add infinite motion that hides content or competes with reading; motion
  is for state that is genuinely changing.
