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
  line: "#dbdfe8"
  line-strong: "#c1c7d3"
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
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "2.625rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.017em"
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

- Archivo for everything that speaks; IBM Plex Mono for anything that reads as
  data (timecodes, durations, prompts, counts) and for the prompt body.
- Body is 15px/1.6. Headings step up from 1.2rem to 2.625rem with weight 600
  and `-0.017em` tracking; the tracking is what keeps the display sizes from
  feeling loose.
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

A card that belongs to a group (a mood example, a workflow type) is tinted with
that group's colour at low strength and carries a coloured border on hover. It
does **not** carry a thick bar down one side.

## Shapes

- Radii: 15px (large cards), 11px (button, field, small cards), 7px (inline
  blocks, code). Pills (999px) are reserved for chips and segmented controls.
- Hairlines are 1px `line`, strengthening to `line-strong` on hover. The system
  has no 2px+ accent borders.
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
data graphic, not an illustration. Its geometry is fixed by the mood model in
`web/mood-common.js`:

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
- **Fields**: 1px `line-strong`, brand border plus a 3px `brand-soft` ring on
  focus.
- **Cards**: 1px `line`, 15px radius, white surface, hover lifts 2px and colours
  the border.
- **Chips / tags**: pill, `surface-2`, `ink-soft`, 0.75rem, weight 600.
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
