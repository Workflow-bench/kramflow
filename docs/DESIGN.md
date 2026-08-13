---
version: "kramflow-console-v1"
name: "KramFlow Console"
description: "Operator-console design system for a live-event run-of-show tool. Dense, dark, instrument-grade. Chrome is achromatic so that every hue in the interface carries meaning; time is set in tabular mono because time is the primary data. Covers the operator dashboard, cue sheet, section navigation, and dynamic Add Item form. TV/display surfaces run the separate Stage scale and are out of this system's scope."
mode: "dark only"

colors:
  # Chrome — achromatic, cool-slate bias. Carries no meaning.
  background:      "#08090C"
  surface:         "#101318"
  surface-2:       "#171B22"
  raised:          "#1E232C"
  border:          "#262C37"
  border-soft:     "#1A1F27"
  text-primary:    "#F3F5F9"
  text-secondary:  "#9BA4B4"
  text-tertiary:   "#6C7585"

  # Show state — preserved from the incumbent system. Operators are trained on these.
  live:            "#2ED573"
  standby:         "#FFA724"
  alert:           "#FF4D4F"
  info:            "#4A9EFF"

  # Interface state — never means show status.
  accent:          "#7C6BFF"
  accent-dim:      "#7C6BFF26"

typography:
  display-lg:  { font: "Inter",          size: "24px", weight: 600, tracking: "-0.02em" }
  title-md:    { font: "Inter",          size: "19px", weight: 600, tracking: "-0.01em" }
  body-md:     { font: "Inter",          size: "14px", weight: 400 }
  row-md:      { font: "Inter",          size: "13px", weight: 400 }
  meta-sm:     { font: "Inter",          size: "12px", weight: 400 }
  label-md:    { font: "JetBrains Mono", size: "11px", weight: 600, tracking: "0.1em", transform: "uppercase" }
  time-md:     { font: "JetBrains Mono", size: "12px", weight: 400, numeric: "tabular-nums" }

spacing:
  base:          "4px"
  gap:           "8px"
  card-padding:  "16px"
  section-gap:   "24px"
  row-height:    "44px"

rounded:
  panel:   "8px"
  control: "6px"
  chip:    "4px"
  pill:    "9999px"

motion:
  state:   "140ms"
  panel:   "200ms"
  easing:  "ease-out"
  level:   "restrained"

components:
  - button
  - input
  - select
  - queue-row
  - color-tag
  - badge
  - panel
  - modal
  - toast
  - empty-state
  - skeleton
---

# KramFlow Console

## Overview

KramFlow is a live-event run-of-show console. During a show an operator is
driving the queue in real time while displays around the venue read from the
same data. The console is an **instrument**, not a document: it is scanned and
operated, never read top-to-bottom.

Source of the system: Aura's DESIGN.md schema and token discipline, adapted.
Everything about density, scale, and semantics below is KramFlow-specific.

## The central rule: two viewing distances

KramFlow has two audiences at two distances and they cannot share a type scale.

| Scale | Surfaces | Distance | Base |
|---|---|---|---|
| **Console** | `/operator`, `/operator/cue-sheet` | 18–24 in | 13–14px |
| **Stage** | `/green-room`, `/av`, `/general`, `/presenter`, `/broadcast` | 5–15 ft | 20px body / 84px hero |

The incumbent `docs/DESIGN_SYSTEM.md` mandates "No tables", "No tiny text",
"Cards should breathe", a 20px body and an 84px hero. Those rules are correct
for Stage and were then applied to Console, where they are wrong — the cue
sheet is a 244-row instrument, not a card grid. **This file governs Console
only. Stage keeps its existing scale untouched.**

## Colors

Anchor the chrome in `background #08090C`, `surface #101318`, `border #262C37`,
`text-primary #F3F5F9`. The chrome ramp is deliberately achromatic.

**Hue is reserved for meaning.** Nothing decorative may wear a color:

- `live #2ED573` — on air, ready, go
- `standby #FFA724` — prepare, warning, running long
- `alert #FF4D4F` — not ready, error, destructive
- `info #4A9EFF` — next, informational
- `accent #7C6BFF` — **interface** state only: selection, focus ring, drop target

The accent exists to close a real gap. Today selection borrows white or blue,
so "I selected this row" renders like "this row is next". Keeping interface
state on a hue no show-state uses removes that ambiguity permanently.

Color never carries meaning alone. Every status pairs a hue with a dot, an
icon, or a label so it survives colorblindness and a washed-out venue monitor.

## Typography

**Inter for language, JetBrains Mono for time.**

Mono is scoped to timecodes, durations, sort indices, and uppercase labels —
never to titles. KramFlow's item titles are transliterated Gujarati and
Sanskrit with diacritics ("Akshar-Purushottamno Jay-jaykār", "Mahant Swami
Maharaj Āshirvād"). Mono sets these ~40% wider, wraps them badly inside a 44px
row, and renders their diacritics less well. Inter handles extended Latin
properly and stays narrow.

Time uses `font-variant-numeric: tabular-nums` so `5:00 PM` and `11:41 AM`
align on the colon down a forty-row section. That alignment is the whole reason
the mono face earns its place.

## Layout

4px base with an 8px rhythm above it — the 4px sub-step exists for dense rows
and did not exist in the incumbent 8px-only grid. Row height is 44px, which
meets the touch minimum exactly and is the tightest a draggable row may go.

Panels are flat: one border, no shadow stack, no glass. Depth comes from the
`surface → surface-2 → raised` ramp, not from blur.

## Components

**Queue row** is the app's smallest and most-used unit. A 2px left stripe
encodes state without stealing horizontal space from the title. States:
default, hover, selected (accent stripe), live (live stripe, title 600),
dragging (raised + 55% opacity, accent stripe).

**Color tag** renders a dot plus a label, never a bare swatch.

**Buttons**: primary (inverted — light on ink), secondary (raised + border),
ghost, danger (alert-tinted, never solid red). One primary action per surface.

**Add Item form** renders from per-event config, so it must survive an
arbitrary field list. Group by the config's own `group` key, never by a
hardcoded section order.

## Motion

140ms for state change, 200ms for panel transition, both ease-out. Drag
feedback tracks the pointer in real time. Nothing ambient, nothing decorative —
an operator watching this screen during a live show must never be drawn to
motion that does not mean something. `prefers-reduced-motion` is honored
globally.

## Guardrails

- Do not apply the Stage type scale to Console surfaces, or the reverse.
- Do not use a show-state hue for interface state, or the accent for status.
- Do not put decorative imagery, gradients, glass, or ambient effects anywhere
  in the console. This is an instrument used under pressure.
- Do not let a row grow past 44px or the section stops being scannable.
- Do not convey any status by color alone.
- Do not reintroduce card radius above 8px in the console; 20px reads consumer
  and costs vertical space in a list that scrolls past forty rows.
