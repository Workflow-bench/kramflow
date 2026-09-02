---
version: "kramflow-v2"
name: "Kramflow"
description: "Live-event operations console. Two audiences at two viewing distances share one visual language: Console (operator surfaces, 18-24in, dense instrument) and Stage (TV/display surfaces, 5-15ft, hero typography). Dark-mode only — the use scene is a darkened venue and a production gallery, not an office."
mode: "dark only"
supersedes: ["docs/DESIGN.md", "docs/DESIGN_SYSTEM.md"]
source_of_truth: "app/globals.css (@theme inline block) — this file documents it, it does not define it. If the two ever disagree, the CSS wins."
---

# Kramflow

## Why this file exists, and why the other two don't

Two prior design-system docs exist in this repo (`docs/DESIGN.md`,
`docs/DESIGN_SYSTEM.md`). Neither is authoritative. Both were superseded by
work already done directly in `app/globals.css` — a full, independently
re-derived and re-verified token replacement (see that file's own header
comment), not a re-tint of either prior doc. This file documents *that*
system, the one actually shipping, so a future session doesn't reach for
`docs/DESIGN.md`'s violet accent (`#7C6BFF`) or cool-slate chrome
(`#08090C`) and reintroduce something that was deliberately removed.

Do not delete the two old docs — they're useful history of what was tried
and rejected (see their own text) — but do not treat them as current.

## The central rule: two viewing distances

- **Console** — `/e/[id]/operator`, `/operator/cue-sheet`, `/e/[id]/remote`, `/e/[id]/broadcast`, `/e/[id]/displays`, `/e/[id]/settings`, dashboard, auth. Read at 18–24in, scanned and operated, not read top-to-bottom. Dense: 13–15px body text, 44px rows, sharp 2–4px radii.
- **Stage** — `/general`, `/av`, `/green-room`, `/presenter`. Read at 5–15ft. Hero typography (92px), full-bleed, zero controls (Presenter is the one exception — a light physical-proximity control bar).

Never apply one scale's type/density rules to the other surface. This has already caused a real regression once (Console inheriting Stage's "no tiny text, cards breathe" rules and reading as bloated) — see `docs/DESIGN_SYSTEM.md`'s own note.

## Colors

Chrome is warm graphite, not cool slate — the use scene is warm-black hardware under practical stage light, not an office screen. Achromatic; carries no meaning.

| Token | Value | Role |
|---|---|---|
| `background` | `#0c0b09` | App background |
| `card` | `#17140f` | Card / panel surface |
| `card-hover` | `#201c15` | Hover state |
| `raised` | `#2a251c` | Secondary buttons, inputs |
| `line` / `line-soft` | `#3a3327` / `#211d16` | Borders |
| `primary` | `#f4efe5` | Primary text |
| `muted` | `#a79d8b` | Secondary text (7.1–7.6:1) |
| `muted-2` | `#8a8070` | Tertiary text (4.5–5.2:1) |

Show state — the same four roles operators are trained on, retuned for the warm ground:

| Token | Value | Role |
|---|---|---|
| `status-green` | `#2bb673` | live / go / ready |
| `status-orange` | `#e8a33d` | standby / warning |
| `status-red` | `#e5484d` | alert / not ready |
| `status-blue` | `#4b8fe3` | next / informational |

**Interface state (`accent`) is not a fifth hue.** It equals `primary`
(`#f4efe5`) exactly — selection, focus rings, and the primary button fill
all read as "the same off-white the UI's text already uses." Confirmed
against StageTimer.io's own UI: selection is a plain white ring, primary
action is a light fill, pressed states go to a light fill, never a colored
one. A dedicated violet interface accent existed once; it was this
project's own invention (not drawn from any reference) and was removed —
do not reintroduce it.

Color never carries meaning alone — every status pairs a hue with an icon, dot, or label.

## Typography

**Console scale** (`--text-console-*`, defined in `app/globals.css`):

| Token | Size | Use |
|---|---|---|
| `console-lg` | 22px | Page title |
| `console-md` | 18px | Panel heading |
| `console-sm` | 14px | Body, form fields |
| `console-row` | 15px | Queue row title |
| `console-meta` | 12px | Timestamps, secondary |
| `console-label` | 11px | Uppercase tracked labels |

**Stage scale** (`--text-hero`/`--text-title`/`--text-subtitle`/`--text-body`/`--text-caption`): 92 / 42 / 30 / 23 / 17px.

Font: Inter for language, JetBrains Mono (`--font-mono`, via the `.tnum` utility class) for anything where digits stack in a column — start times, durations, countdowns, sort indices — set with `font-variant-numeric: tabular-nums` so times align on the colon down a forty-row section. Mono never sets titles: Kramflow's item titles are transliterated Gujarati/Sanskrit with diacritics, which mono renders ~40% wider and worse.

## Layout, radius, elevation

- Console radius is sharp, closer to rack-hardware panelling than a soft SaaS card: `radius-panel` 4px, `radius-control` 3px, `radius-chip` 2px. Stage keeps a softer `radius-card` (20px) — untouched, different surface, different rule.
- One elevation for floating UI (`--shadow-float`, dropdowns/popovers/the bulk-edit action bar). Cards and panels stay flat — separation comes from the `card → card-hover → raised` background-color ramp, not blur or shadow stacking.
- No gradients, glassmorphism, or decorative imagery anywhere in the console. This is an instrument used under pressure.

## Components

- **Buttons** (`components/ui/button.tsx`): `primary` (inverted, light-on-ink), `secondary` (raised + border), `ghost`, `warning`, and a three-step danger escalation (`danger-minor` → `danger` → `danger-solid`) that commits weight through one hue (alert red) rather than a spreading family of danger colors.
- **Queue row / cue-sheet row**: 44px minimum height (touch-target floor, and the tightest a draggable row may go), tabular time, drag handle, real `<button>`s for actions — never a `<div onClick>`.
- **Dialogs**: `useDialogFocus`-backed focus trap, `focus-visible` rings throughout (`ring-accent`, since accent = primary here, not a separate hue).
- **Status/ownership treatments**: named, not anonymous — control lease, presence, and activity history all resolve and show a real display name (see `lib/use-controller-name.ts`, `lib/use-operator-presence.ts`) rather than a bare lock icon or count. Identity never appears on the publicly-readable `live_state` row (anonymous TV displays read it); it's resolved from `activity_log`, which is operator-only.

## Motion

`--animate-fade-in` (250ms) and `--animate-rise` (180ms, cubic-bezier(0.2,0,0,1), enters-from-below-already-visible) are the two authored keyframes — used for toasts, popovers, the bulk-edit action bar. Nothing ambient, nothing decorative; an operator watching this screen during a live show must never be drawn to motion that doesn't mean something. `prefers-reduced-motion: reduce` is honored globally (`app/globals.css`).

## Guardrails

- Do not apply the Stage type scale to Console, or the reverse.
- Do not introduce a second interface-state hue — accent stays equal to primary.
- Do not use a show-state hue (green/orange/red/blue) for anything that isn't show state.
- Do not add gradients, glassmorphism, or ambient/decorative effects to Console.
- Do not let a cue-sheet/queue row grow past 44px.
- Do not convey status by color alone.
- A CSS Grid column meant to scroll independently (`overflow-y-auto` on a grid child) needs the grid's row track pinned (`grid-rows-[1fr]` on the container, `min-h-0` on the child's own wrapper) or the row auto-sizes to the tallest column's content and the scroll clip silently fails — this exact bug shipped once on the Operator Console's three-column grid; verify visually (a real screenshot, not just code review) whenever a new fixed-height multi-column layout is added.
