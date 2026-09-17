---
version: "kramflow-v4"
name: "Kramflow"
description: "Three related visual systems sharing one design language: Brand/Marketing (the public landing page), Operational Product (the authenticated application), and Presentation (public TV/display surfaces). The landing page is the primary brand reference — the product inherits its typography discipline, spacing rhythm, and material restraint, not its literal color palette or layout. Dark-mode only throughout."
mode: "dark only"
supersedes: ["docs/DESIGN.md", "docs/DESIGN_SYSTEM.md", "DESIGN.md (kramflow-v2)", "DESIGN.md (kramflow-v3)"]
source_of_truth: "app/globals.css (@theme inline block) for the Operational Product's tokens; components/site/ for the Brand/Marketing system's own literal values. If code and this file ever disagree, the code wins — update this file."
---

# Kramflow

## Why this file exists, and what changed at v4

v2 was a from-scratch token replacement done directly in `app/globals.css`,
superseding two early, non-authoritative docs. v3 adopted real macOS 26
Liquid Glass material for Console (genuine translucency, the actual system
color ramp, continuous radii) — a material and geometry change, not an
information-model rewrite. **v4 is a scope change, not another material
pass**: the public landing page was rebuilt as its own literal-value brand
system (`components/site/`), and this file now documents three systems and
the relationship between them, where v1–v3 only ever described one
(Console/Stage). Nothing v3 got right about Console or Stage is reversed
here — v4 adds a frame around it, and corrects two things v3 stated
inaccurately (below).

**Corrections made at v4, stated plainly:**

- **`components/tv/*` no longer exists.** Prior versions of this file
  named it as Stage's component home. Stage/presentation components now
  live in `components/display-engine/` (`display-shell.tsx`,
  `stage-status-pill.tsx`, `stage-info-card.tsx`, `stage-next-card.tsx`,
  `broadcast-overlay.tsx`, `hold-screen.tsx`, `target-health-summary.tsx`,
  `operator-broadcast-panel.tsx`, `fullscreen-prompt.tsx`,
  `test-message-overlay.tsx`). A handful of source comments
  (`components/ui/section-label.tsx`, `progress-bar.tsx`,
  `progress-footer.tsx`) and two docs (`docs/DISPLAY_ENGINE.md`,
  `docs/COMPONENT_GUIDE.md`) still say `components/tv/*` in prose — noted
  here as a known cleanup item, not fixed as part of this documentation
  pass.
- **Console's monospace face is IBM Plex Mono, not JetBrains Mono.**
  `app/layout.tsx` loads `IBM_Plex_Mono` (`--font-plex-mono`, mapped to
  `--font-mono`) — a deliberate choice for a face with more mechanical,
  less "developer-tool" character than JetBrains Mono. Prior versions of
  this file named the wrong face.

Do not delete the older docs — useful history of what was tried and
rejected — but do not treat any of them, v3 included past this point, as
current.

## The three systems, and how they relate

```
Landing page (app/page.tsx, components/site/)
        │  establishes
        ▼
Brand / Marketing System  ──┐
                             │  same design LANGUAGE,
        inherits             │  not the same literal values
        ▼                    │
Operational Product           │
(Console, Dashboard, Cue Sheet,
 Remote, Broadcast, Displays,
 Settings, Rehearsal, auth) ──┘

Public Displays (General/AV/Green Room/Presenter)
        remain their own Presentation system —
        related by the same operational vocabulary
        (show state, timing, live/hold), not by
        sharing chrome, density, or brand color with
        either system above.
```

**The landing page is the primary brand reference. Do not copy its
sections into the product, and do not copy the product's density into it.**
What the product inherits from the brand system is the *design language* —
the underlying discipline — not its literal component tree:

- a confident, editorial type hierarchy (the brand system's willingness to
  let one headline dominate a viewport) informs how much room Console's
  own rare hero numbers (the live countdown) are given, without the
  product adopting 56–92px marketing display sizes anywhere routine.
- generous, deliberate spacing rhythm (one idea per section, breathing
  room around it) informs the product's own section spacing *at the scale
  appropriate to a scanned instrument*, not by copying the marketing
  page's section padding wholesale.
- quiet, mostly-opaque surfaces and restrained material use (materials
  mark functional layering, never decorate) is a rule already true of
  Console and now explicit for both systems.
- one shared radius and border language (see Surfaces/Materials below)
  keeps a signup button and a Console button feeling like the same
  object family even though they never share a color token.

What the product does **not** inherit: the brand system's grayscale-only
palette (see Color below — this is the single most load-bearing
distinction in this file), its `components/site/` component tree, or its
Persuade-mode motion.

## Typography

Three tiers, each already correctly scoped to its own surface before this
file existed — v4 names them together for the first time.

**Brand / Marketing display** (`components/site/*`, literal Tailwind
values, not the product's `--text-*` tokens): headlines run from
`text-4xl` (mobile) up to an arbitrary `text-[56px]`–`text-[92px]` for the
hero, tight tracking (`-0.0325em` on the largest sizes), line-height 1.1,
a distinct heavier weight (`font-weight: 538`) on the biggest headlines
only. **Current reality, not aspiration:** the component markup carries
comments referencing Geist, but no Geist font is loaded anywhere in
`app/layout.tsx` — the brand system currently renders in Inter (the
product's own loaded font, inherited via `body`'s `font-family`). Treat
"renders in Inter today" as the documented fact; wiring an actual display
face for the brand system is an open decision, not yet made.

**Console operational** (`--text-console-*`, `app/globals.css`) — dense,
scanned not read, 18–24in:

| Token | Size | Use |
|---|---|---|
| `console-headline` | 48px | Live countdown — the one number that matters most |
| `console-lg` | 22px | Page title |
| `console-md` | 18px | Panel heading |
| `console-sm` | 14px | Body, form fields |
| `console-row` | 15px | Queue row title |
| `console-meta` | 12px | Timestamps, secondary |
| `console-label` | 11px | Uppercase tracked labels |

**Stage presentation** (`--text-hero`/`--text-title`/`--text-subtitle`/`--text-body`/`--text-caption`, `app/globals.css`) — read at 5–15ft: 92 / 42 / 30 / 23 / 17px.

**Fonts:** Inter (`--font-sans`) for language everywhere in the
Operational Product and, currently, the Brand system too. IBM Plex Mono
(`--font-mono`, via the `.tnum` utility) for anything where digits stack
in a column — start times, durations, countdowns, sort indices — set with
`font-variant-numeric: tabular-nums`. Mono never sets titles: item titles
are transliterated Gujarati/Sanskrit with diacritics, which mono renders
~40% wider and worse.

**Weight and tracking rules:** Console headings sit at 600–700 weight with
slightly negative tracking (-0.005 to -0.01em) at 18px and above; body and
row text stays at 400–500 with no tracking adjustment. Stage hero text is
700 weight, -0.015em tracking — the one place outside the brand system
tight tracking on a large size is deliberate, for the same reason the
brand hero does it: a single dominant line read at distance or a glance.

## Spacing

No custom spacing scale — Tailwind's default 4px-increment scale, used
directly, is the canonical scale for both systems. What differs is which
steps get used where:

- **Brand/Marketing sections:** generous, page-level rhythm — `py-24`
  to `py-40` between major sections, large gaps (`gap-8` to `gap-24`)
  between a section's own elements. One idea per section, room around it.
- **Console operational spacing:** compact by design — 4px/8px steps
  govern row padding and control gaps, not 24px+ marketing gaps. Density
  is preserved through spacing choices at the *small* end of the scale,
  never through type set smaller than the Console floor above.
- **Responsive spacing:** the Brand system scales its section padding down
  at each breakpoint (e.g. `py-24` → smaller on mobile via explicit
  responsive classes); Console does not need the same treatment since it
  is already at its dense floor at every breakpoint — Console's
  responsive changes are about layout (columns collapsing, panels
  stacking), not about further shrinking spacing that's already compact.

## Surfaces

| Layer | Token / value | Role |
|---|---|---|
| App background | `--color-background` `#0c0b09` | The base every other surface sits on |
| Content surface | `--color-card` `#17140f`, `--color-card-hover` `#201c15` | Panels, rows, cards — predominantly **opaque** |
| Secondary surface | `--color-raised` `#2a251c` | Buttons, inputs, nested surfaces |
| Borders / dividers | `--color-line` `#3a3327`, `--color-line-soft` `#211d16` | Grouping and separation, never decoration |
| Functional chrome | `.glass-chrome`, `.glass-panel` (see Materials) | Nav/toolbar layer and floating/transient UI (popovers, sheets, dropdowns) — not Console content panels as of Phase 5 |
| Overlays | Modal/ConfirmDialog backdrop, Toast, dropdowns | Sit above everything, use `--shadow-float` |

**Content surfaces remain predominantly opaque.** Glass is the exception
inside a screen, applied to specific, named surfaces (see Materials) — not
the default state of "a card." A new panel defaults to `bg-card`
(`Panel`/`Card` in `components/ui/card.tsx`) unless it has a stated reason
to read as glass.

The Brand/Marketing system's surfaces are its own literal values
(`bg-zinc-950`, `bg-zinc-900/50`, `border-zinc-800`, etc.) — it does not
consume `--color-card`/`--color-line`. This is intentional, not drift: the
brand system is allowed its own literal palette (see Color), and forcing
it onto the product's CSS variables would be exactly the "copy the
marketing page into the product" mistake this file warns against in
reverse.

## Materials

Functional material — genuine translucency standing in for a real
layering relationship — is permitted in:

- **Navigation / toolbar chrome** — `.glass-chrome` (`EventShellHeader`'s
  bands, `DashboardInstrumentStrip`).
- **Floating/transient UI** — `Select`'s dropdown, `Toast`, `Popover`,
  command-palette, `overflow-menu`, `action-bar` via the direct utility
  pattern (`bg-card/90 backdrop-blur-xl`) since they're simple enough not
  to need the shared class.
- **The smallest, most-frequently-mounted transient surface gets the
  cheapest treatment** — `Tooltip` uses `bg-raised/90 backdrop-blur-md`
  (lighter blur, different base tint) deliberately, not as an oversight.
- **The shared `Panel` primitive** (`components/ui/card.tsx`) still carries
  `.glass-panel` and cascades it to Dashboard, Broadcast, Displays, Cue
  Sheet, Settings, and auth — unchanged by Phase 5, since none of those
  surfaces were in scope for that phase.

**Correction at Phase 5 (Console gold-standard pass):** `ControlsPanel` and
`LiveDetailsPanel`'s Live Now block no longer use `.glass-panel`. Both
previously rendered as bordered glass cards of equal visual weight — Phase
5's own direction was explicit that Liquid Glass belongs to functional
chrome (nav, toolbar, popover, sheet, floating controls), not to Console
*content*, and that the live item must read as the screen's operational
center rather than one card among visually-equal cards. Removing the box
around both is also what fixes a genuine nested-card violation:
`ControlLeaseStatus` already renders its own bordered, tinted surface
(deliberately — "held by other" needs to visually interrupt, Von
Restorff), and it was previously a card inside `ControlsPanel`'s own card.
It is now the one meaningful box in that column. Both components keep
their column's own padding and the `operator-columns.tsx` divider borders
for separation — structure now comes from spacing, typography, and the
existing column dividers, not from an additional bordered fill.

Each is a semi-transparent tint (`--glass-chrome-bg` /
`--glass-panel-bg`) plus `backdrop-filter: blur(24px) saturate(1.3–1.4)`
plus a single 1px inset highlight (`--glass-highlight`) standing in for
specular gloss — not a decorative gradient sweep.

**Do not use glass as decoration.** A gradient or blur with no material
logic behind it — a glow with no light source, blur on something that
isn't actually layered above content, glass applied because a surface
"looks more premium" rather than because it *is* a translucent layer over
something — is banned regardless of which system it appears in. This
applies equally to the Brand system, which uses **no** glass at all in its
current build (flat zinc surfaces throughout) — a legitimate choice for
an editorial, non-layered page, not an oversight to "fix" by adding it.

**Known pipeline gotcha:** do not pair a manual `-webkit-backdrop-filter`
with the standard `backdrop-filter` in the same rule — Next's CSS
pipeline (Lightning CSS) silently drops both, no build error. Let the
pipeline auto-prefix.

**Comment-authoring gotcha:** a CSS block comment containing the literal
two-character sequence `*/` as prose terminates the comment early and
corrupts everything until the next real `*/`. Spell out percentages in
comments (`bg-card at 90%`) instead of Tailwind's `/NN` shorthand.

## Color

**The single most important separation in this file.** Do not describe
grayscale as the universal application palette — it is the Brand system's
palette only.

### 1. Brand / Marketing color language (`components/site/*`)

Strictly grayscale: near-black background (`#09090B`/`bg-zinc-950`),
white/light-gray text (`zinc-400`/`zinc-500` for secondary), an off-white
pill primary button, **no colored accents anywhere**. This is a deliberate
brand-expression choice for a persuasive, editorial surface — restraint as
the whole point. It does not use `--color-*` tokens at all; it is its own
literal value system, on purpose (see Surfaces).

### 2. Operational Product color language (`app/globals.css`)

Chrome is warm graphite, not cool slate — the use scene is warm-black
hardware under practical stage light, not an office screen. Achromatic;
carries no meaning on its own:

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

**Interface state (`accent`) is not a fifth hue.** It equals `primary`
(`#f4efe5`) exactly — selection, focus rings, and the primary button fill
all read as "the same off-white the UI's text already uses." Real macOS
selection/focus is a plain light fill or a system-blue ring, never a
dedicated interface hue. Do not reintroduce a dedicated interface accent
(one existed pre-v2, was this project's own invention, and was removed).

### 3. Live-operations semantic color — preserved, never removed for parity

The Operational Product **may and must** use functional status color.
Stripping it to visually match the Brand system's grayscale would be a
real regression, not alignment — color here communicates real state, not
decoration, and an operator's trained color-to-meaning mapping is exactly
the kind of thing a live show is the wrong place to retrain:

| Token | Value | Role |
|---|---|---|
| `status-green` | `#30d158` | live / go / ready / healthy — macOS systemGreen (dark) |
| `status-orange` | `#ff9f0a` | standby / warning / attention / operational emphasis — macOS systemOrange (dark) |
| `status-red` | `#ff453a` | alert / not ready / danger / overrun / destructive — macOS systemRed (dark) |
| `status-blue` | `#0a84ff` | next / informational / secondary operational state — macOS systemBlue (dark) |

Real macOS 26 system color values, extracted via the Figma Plugin API from
Apple's own macOS 26 Community file (dark-mode column) — any macOS user's
color intuition transfers exactly. Color never carries meaning alone:
every status pairs a hue with an icon, dot, or label (`Badge`,
`OperationalStatus`).

**Two families within this system, never conflated** (see Live Operations
below for the full vocabulary): **show state** (green/orange/red/blue)
describes the *event* — audience-relevant. **System state** (its own
`ok`/`warn`/`bad`/`neutral` roles in `OperationalStatus`) describes the
*tool* — operator-relevant, never shown to a Stage audience. Reusing a
show-state hue for system state (or vice versa) is the exact ambiguity a
prior audit flagged ("is orange a warning about the show, or about my
connection?").

### 4. Public Displays

Consume the same Operational Product tokens (`status-green` etc. via
`StageStatusPill`, `ConnectionBadge`'s `stage` variant) at Stage type
scale and TV-safe spacing — a separate *density and distance* system, not
a separate *color* system. Do not force the Brand system's grayscale onto
displays: a TV-distance surface needs color-coded status more, not less,
than a desk-distance one.

### Vibrancy ladder

A systematic five-step opacity scale for hover/pressed/selected states on
translucent materials, replacing scattered ad hoc per-component values:

| Token | Value | Use |
|---|---|---|
| `overlay-1` | 10% white | hover |
| `overlay-2` | 8% white | pressed |
| `overlay-3` | 5% white | selected (subtle) |
| `overlay-4` | 3% white | raised-on-raised separation |
| `overlay-5` | 2% white | barely-there hairline fill |

Not yet fully retrofitted across every component — new interactive states
pull from this ladder; existing ones haven't all been migrated.

## Components

Canonical Operational Product primitives, all in `components/ui/`:

| Component | File | Notes |
|---|---|---|
| Button / IconButton | `button.tsx` | `variant`: primary (inverted, light-on-ink), secondary (raised + border), ghost, warning, three-step danger escalation (danger-minor → danger → danger-solid, one hue). `size`: sm/md (Console, `rounded-control`), lg/xl (Remote/Stage/high-emphasis, `rounded-card`, min touch target enforced via height not width). `square` for icon-only. |
| Link | `LinkButton` in `button.tsx` | Same variant/size API as Button, renders a `next/link`. |
| Input | `input.tsx` | `size` md/lg (lg for Remote/TV-adjacent forms). 16px+ text below `sm:` to avoid iOS zoom-on-focus. Focus ring is `accent`, never a status hue. |
| Select | `select.tsx` | Searchable by default; `size` md/lg (lg for the primary session switcher, which is navigation, not a form field). |
| Textarea | `textarea.tsx` | Same tokens as Input, same iOS zoom fix. |
| Badge | `badge.tsx` | Tinted fill + matching text + faint border of the same hue; `dot` for status use — color never stands alone. |
| OperationalStatus | `operational-status.tsx` | The canonical show-state/system-state unification: live/hold/ready are a bare dot (show state); rehearsal/stale/offline/warning/critical are dot + icon (system state). |
| ConnectionBadge | `connection-badge.tsx` | `variant`: console (small always-visible pill) / stage (safe-area corner, escalates from quiet dot to visible warning). Persistent by design — shows "Synced" when healthy, not only alarms on failure. |
| ControlLeaseStatus | `control-lease-status.tsx` | Four mutually-exclusive states (read-only / held-by-me / held-by-other / unclaimed) at one shape and height; only color/weight escalates. |
| SectionLabel | `section-label.tsx` | Console-scale (`text-console-label`) group-box title — functions as the heading for its region, not a kicker above a bigger one. |
| Panel | `card.tsx` (`Panel`) | Console surface, `.glass-panel` material — the shared primitive most Console pages build on. |
| Card | `card.tsx` (`Card`) | Stage surface, 20px radius, opaque `bg-card` — TV routes only. |
| Row | Cue-sheet/queue row pattern | 44px minimum height (touch-target floor, tightest a draggable row may go), tabular time, drag handle, real `<button>`s for actions — never a `<div onClick>`. Phase 6: also carries CURRENT/NEXT/ON-DECK (see Live operations vocabulary) and a compact production/remarks indicator, without becoming a bordered card — still a plain row, separated only by `border-b`. |
| Modal | `modal.tsx` | Generic shell for genuinely multi-step configuration tasks (Add/Edit Item, Event Settings). Focus-trapped (`useDialogFocus`), overlay-stack aware. Phase 7a: title/shell corrected from Stage-tier `text-subtitle`/`rounded-card` to Console-tier `text-console-lg`/`rounded-panel` — Modal is an Operational Product overlay (never used on a Stage/public-display surface) and had been mis-scaled for its actual 18-24in viewing distance since it predates the three-system split. |
| ConfirmDialog | `confirm-dialog.tsx` | `tone`: default / danger (outlined) / danger-solid (tier-4, `requireTypedConfirmation`). Guardrail weight is tier-aware, not one fixed style. Phase 7a: same Stage→Console token correction as Modal (`text-subtitle`/`text-body`/`rounded-card` → `text-console-lg`/`text-console-sm`/`rounded-panel`). |
| Sheet | `sheet.tsx` | Phase 6: the canonical slide-in-from-the-trailing-edge surface, filling the gap this table flagged at Phase 3. Shares Modal's `useDialogFocus`/overlay-stack/Escape conventions; reserved for a task genuinely contextual to what's behind it (Cue Sheet's session create/edit) rather than one the operator steps fully out of the view to do (that's still Modal — Add/Edit Item, Event Settings, Import). |
| Popover | `popover.tsx` | Phase 4: the canonical anchored-dropdown surface (built on `useDismissOnOutsideOrEscape`, deliberately not `@radix-ui/react-popover`, to avoid a second overlay paradigm alongside it). Used by `SessionPopover` and the mobile `EventNav` menu. `select.tsx`'s dropdown, `overflow-menu.tsx`, and the Cue Sheet's own `BulkEditPanel` predate it and still have their own implementations sharing the same conventions, not yet migrated. |
| Tooltip | `tooltip.tsx` | Required, not optional, for any icon-only control — shows on hover *and* focus, unlike a native `title=`. |
| Tabs | Session/day switcher pattern (`components/operator/session-switcher.tsx`) | No generic Tabs primitive — the one real tab-like pattern in the app is session switching, implemented directly. |
| ActionBar | `action-bar.tsx` | One floating pill, fixed slot (no layout shift from selection), sits above the toast stack's own corner. |
| EmptyState | `empty-state.tsx` | States what's true, why, and what to do next, with the action inline. |
| LoadingState | `loading-state.tsx` | Phase 4: closes the gap flagged below — `Loader2` + `animate-spin`, same anatomy as EmptyState (title/body, no layout shift when swapping between the two). |
| ErrorState | `error-state.tsx` | Phase 4: `status-red` + `OctagonAlert` (the same icon `OperationalStatus`'s `critical` variant uses) so a failed load reads as a failure, not a quiet empty list — event-settings-panel.tsx's collaborators list previously reused EmptyState verbatim for this and is the first real adopter. Optional `onRetry`. |
| SuccessState | `toast.tsx` (`success` tone) | Toast is the canonical success-feedback surface; no separate inline SuccessState component exists. |

**Gap closed at Phase 4:** Loading/Error states are now shared components
(`loading-state.tsx`, `error-state.tsx`), following the same
build-when-a-real-surface-needs-it discipline as Sheet and Popover before
them — not invented speculatively, retrofitted into the one real callsite
that was already awkwardly reusing EmptyState as an error state.

## Layout

- **Application shell:** `EventShellHeader` (two `.glass-chrome` bands) +
  `EventNav` — carries event identity, workspace navigation, connection
  state, and session context. Currently has more repeated chrome than the
  brand system's single-band nav; reducing that is Phase 7+ work, not
  resolved by this documentation pass.
- **Page header:** `PageHeader` (`components/ui/page-header.tsx`) for
  Settings-style pages; Console's own header is the shell band, not a
  separate per-page header.
- **Section header:** `SectionLabel` functions as this role — see
  Components.
- **Toolbar:** the Console header bands and Cue Sheet's sticky command
  bar (depends on `position: sticky`, which is why `html`'s
  `overflow-x: clip` — not `hidden` — is load-bearing; see the gotcha in
  `app/globals.css`).
- **List/detail, sidebar/detail:** Cue Sheet (list + detail panel),
  Console's three-column `operator-columns.tsx` (program list / live
  details / controls). A CSS Grid column meant to scroll independently
  needs the grid's row track pinned (`grid-rows-[1fr]` on the container,
  `min-h-0` on the child's own wrapper) or the row auto-sizes to the
  tallest column's content and the scroll clip silently fails — shipped
  once on this exact three-column grid; verify visually whenever a new
  fixed-height multi-column layout is added.
- **Responsive / mobile navigation:** Remote is the canonical mobile
  operational surface — not a shrunk desktop shell, a purpose-built
  one-handed layout. A real, confirmed issue as of this audit: Remote's
  timer-correction buttons (`−0:30`/`−0:10`/`+0:10`/`+0:30`) sit inside an
  inner `overflow-y-auto` region shorter than its content at common mobile
  heights (390×844: `clientHeight` 315px vs `scrollHeight` 543px), clipping
  the button labels at the region's bottom edge. Documented as a known
  functional issue, not fixed in this documentation-only pass.
- **Operational workspace:** Console is the gold-standard reference
  implementation for the Operational Product (Phase 5). Visual priority,
  top to bottom / left to right: current live item, timer, next, on deck,
  control authority, connection, rundown, secondary controls (Jump/Alert/
  Broadcast/Activity). Desktop (`xl:`, 1280px+) expresses this through the
  three-column grid's own left-to-right order (Program / Live Now /
  Controls) plus Live Now's unboxed, generously-padded treatment relative
  to the tighter, quieter Controls column. Tablet (1024–1279px) and mobile
  both render Live Now (which already bundles current item, timer, and
  Next/On Deck via `RunPosition`) before Controls' primary block
  (`ControlLeaseStatus` + transport) — superseding an earlier ordering
  that put Controls first purely to keep Next/Previous/Hold above the
  fold on short viewports; removing Live Now's own card chrome recovered
  most of that height at the source instead. Secondary controls collapse
  behind a closed-by-default disclosure on mobile only (`<MoreTools>` in
  `app/e/[eventId]/operator/page.tsx`) — visible permanently on tablet/
  desktop, where there's room and a mouse instead of a thumb scrolling
  past them to get back to the rundown.
- **Public display layout:** `DisplayShell` (`components/display-engine/`)
  — full-viewport, fixed TV-safe-area margin (`clamp(48px, 4vw, 64px)`,
  `.tv-safe-area`), no browser-chrome assumptions, wake-lock aware.

## Live operations vocabulary

Unchanged from v3 — restated here as the Operational Product's
information model, which this file's new three-system framing does not
touch:

**Two families, never conflated:**

- **Show state** (`status-green`/`orange`/`red`/`blue`) — describes the
  *event*: live, next, overrunning, on hold. Audience-relevant.
- **System state** (`OperationalStatus`'s own `ok`/`warn`/`bad`/`neutral`
  roles) — describes the *tool*: connected, stale, reachable, do I hold
  the lock. Operator-relevant, never shown to a Stage audience.

| Concept | Component | Notes |
|---|---|---|
| Live / next / on-deck / run position | `RunPosition` (`components/operator/run-position.tsx`) | One row-position model; Program list, Live Details, and Remote all read the same `getLive`/`getNext`/`getOnDeck` helpers in `lib/types.ts`. Phase 5: "Next" is labeled in `status-blue` (this table already specified it; it simply wasn't applied until Console's gold-standard pass) — "On deck" stays muted. `ProgramList` marks the same two rows with a bare dot in the rundown itself, so the current/next/on-deck relationship reads the same way in both places. Phase 6: the Cue Sheet (a planning instrument for every session, not just the live one) reuses the identical words and colors — `CURRENT`/`NEXT`/`ON DECK` text labels plus the same dot convention next to the row number — computed locally from `currentOrder ± 1/2` rather than importing Console's own helpers (the Cue Sheet's `ProgramRow` type isn't the same shape as `Program`), and only ever shown when the session currently open is the one `live_state.active_session_id` actually points to. Viewing any other session shows no live markers at all — the Cue Sheet never becomes a second Console. |
| Timing / drift | `driftMinutes()` (`lib/types.ts`) + `LiveDetailsPanel` | One live-item comparison, not a rundown-wide projection. |
| Countdown | Console's `console-headline` (48px) / Stage's `text-hero` (92px) / Remote's Stage-scale `text-hero` | Distance dictates fidelity — never apply one scale's countdown size to another surface. |
| Control authority | `ControlLeaseStatus` | Replaces inline lock-icon-plus-link markup previously duplicated across surfaces. |
| Connection | `ConnectionBadge` | Console and Stage variants, staleness escalation. |
| Rehearsal | `OperationalStatus` `rehearsal` variant | System state, not show state — never rendered on a public display. |
| Warning / error | `status-orange` / `status-red` via `OperationalStatus` or `Badge` | Always paired with icon or label, never color alone. |
| Ready / live | `status-green` via `OperationalStatus` | Show state — audience-relevant, safe to render on a public display. |
| Display health | `OperationalStatus` `offline`/`stale` | Consumed by Displays; not yet migrated everywhere it could apply. |

**Console vs. Stage remains a hard boundary, not a convention.** A Console
surface (`app/e/[eventId]/operator/**`, `remote`, `broadcast`, `displays`,
`settings`, dashboard) importing from `components/display-engine/*`
(Stage-scale) is the exact drift the old `components/tv/*` guardrail
existed to catch — the directory changed name, the rule didn't.

## Motion

Two authored Console keyframes: `--animate-fade-in` (250ms) and
`--animate-rise` (180ms, cubic-bezier(0.2,0,0,1), enters-from-below-
already-visible) — used for toasts, popovers, the bulk-edit action bar.
Nothing ambient, nothing decorative; an operator watching this screen
during a live show must never be drawn to motion that doesn't mean
something. `prefers-reduced-motion: reduce` is honored globally.

**The Brand system having motion is not a reason to add ambient motion to
the product.** The landing page's mount/scroll-reveal animations serve a
persuasive, one-time-viewing surface; Console is scanned repeatedly under
pressure, where the same animations would become noise, not delight. Do
not introduce animation to a product surface "because the landing page
has it" — every product animation still needs its own state-change
justification.

**Known dead tokens, not yet removed:** `--animate-signal-flow` and
`--animate-node-pulse` in `app/globals.css` were authored for the
previous, now-replaced `app/page.tsx` hero diagram. The current landing
page (`components/site/`) does not use them. Left in place as of this
audit — removing unused CSS is Phase 17 territory, not this pass.

## Iconography

Lucide is canonical, across all three systems. No custom SVG icons where
a Lucide icon is sufficient, no Unicode or emoji interface icons. The
Operational Product and Presentation systems are fully compliant. The
Landing → Product Visual System Audit found Unicode-glyph violations
(`◇◉◈◎`, `→`, `⚠`, `›`) confined to the Brand/Marketing system
(`components/site/`) and to dead code never reached by the live page —
tracked as brand-system cleanup, out of scope for the Operational Product
work this file otherwise governs.

### Canonical destination icons (Phase 7a)

One icon per authenticated destination, used identically everywhere that
destination is represented — `EventNav`, the command palette
(`components/operator/command-palette.tsx`), and Dashboard's per-event
action row (`components/dashboard/events-dashboard.tsx`). Verified
consistent across all three call sites as of Phase 7a; the one entry that
required a change is marked below.

| Destination | Icon | Notes |
|---|---|---|
| Dashboard (all events) | `LayoutGrid` | `EventIdentity`'s "All events" link |
| Console | `Gauge` | **Changed at Phase 7a** — was `LayoutDashboard`, a near-duplicate of Dashboard's own `LayoutGrid` that also read as "a dashboard" rather than "the live control surface." `Gauge` was unclaimed elsewhere in this table (`Radio`/`MonitorPlay`/`SlidersHorizontal` were each already assigned to something else) |
| Cue Sheet | `FileSpreadsheet` | |
| Displays | `MonitorPlay` | |
| Broadcast | `Megaphone` | Not a top-level `EventNav` tab (see `EventNav`'s own comment on why it shares the Displays tab) — this is its icon everywhere it appears as its own destination (command palette, Displays' teaser link) |
| Rehearsal | `FlaskConical` | Also used for `OperationalStatus`'s `rehearsal` variant — the mode and the destination share one icon deliberately |
| Settings | `Settings` | |
| Remote | `Smartphone` | |

Per-display-type icons (a separate, narrower vocabulary for the four
public display *types*, not the operator destinations above) live in
`lib/display-engine/display-meta.ts`: `Tv` (General), `Sliders` (AV),
`Sparkles` (Green Room), `Presentation` (Presenter) — consumed by
`app/screens/page.tsx` and the Displays fleet page. Do not confuse the
two tables or substitute one vocabulary for the other.

## Governance — prohibited patterns

- Generic AI-dashboard aesthetics: gradient-blob heroes, neon-on-black,
  card soup with no information hierarchy.
- Rounded rectangles or pill shapes used because they look premium, not
  because the component's own family calls for that radius tier.
- Decorative gradients, neon/glow, or blur with no material logic (see
  Materials).
- Glass applied to every surface — content surfaces stay predominantly
  opaque (see Surfaces).
- Fake macOS window chrome, visionOS imitation — the Liquid Glass
  material vocabulary is drawn from real specification, not pastiche.
- Arbitrary one-off colors or spacing values outside the documented
  scales in this file.
- Duplicate component implementations for the same concept (the reason
  `OperationalStatus`, `ConnectionBadge`, and `ControlLeaseStatus` exist
  as single canonical answers instead of per-surface reinvention).
- Unicode/emoji interface icons, or custom SVG where Lucide already
  covers the need.
- Do not apply the Stage type scale to Console, or the reverse.
- Do not introduce a second interface-state hue — accent stays equal to
  primary.
- Do not use a show-state hue for anything that isn't show state.
- Do not describe or implement the Operational Product as grayscale to
  match the Brand system — see Color.
- Do not let a cue-sheet/queue row grow past 44px.
- Do not convey status by color alone.
- Do not import from `components/display-engine/*` in a Console surface.
- Do not pair a manual `-webkit-backdrop-filter` with the standard
  `backdrop-filter` in the same rule.
- A CSS Grid column meant to scroll independently needs its row track
  pinned or the scroll clip silently fails — verify visually.

## Component catalog

`app/(catalog)/dev/components/page.tsx` — a real route rendering every
canonical Operational Product primitive across its meaningful states. Not
gated behind auth (synthetic data only), not linked from product
navigation. A new component or variant should be added there before, or
as part of, being used in a product surface. The Brand system
(`components/site/`) has no equivalent catalog yet — flagged, not built
here.
