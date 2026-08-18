# Component Guide

Four component families, matching the four surfaces (see `docs/IA.md`). A component in one family generally shouldn't be reused wholesale in another — a TV component is styled for hero-scale legibility, an operator component for dense information, a remote component for a thumb.

## `components/ui/` — generic primitives

Used across TV, operator, and auth surfaces. No knowledge of program/session data.

| Component | Purpose |
|---|---|
| `Button` | `variant`: `primary` / `secondary` / `ghost` / `danger`. `size`: `sm` / `md` / `lg` / `xl`. All variants include a `focus-visible` ring. |
| `Input` | Single-line text/number input, dark background, focus ring. |
| `Card` | A simple padded, rounded surface. Used sparingly — most of the app avoids "card soup" in favor of spacing and dividers (see `docs/DESIGN_SYSTEM.md`). |
| `Badge` | Small status pill. `tone`: `green` / `blue` / `orange` / `red` / `muted`. |

## `components/tv/` — shared TV display primitives

Used by both `/green-room` and `/av`. Full-bleed, hero-scale, zero interactivity.

| Component | Purpose |
|---|---|
| `TvLayout`, `TvSection`, `TvStack` | Layout shell — full-viewport, fixed `.tv-safe-area` margin, vertical rhythm. Never add a `max-width` container inside these. |
| `LiveNow` | The hero: kicker, title, presenter, countdown. Accepts `isFinished` to distinguish "session over" from "not started" — don't reuse the `program === null` branch for both states, they read very differently to a performer. |
| `NextUp`, `OnDeck` | Next/On Deck items. `NextUp` takes an optional `prepareCue` — only pass this for real items, never for a `type: "break"` program. |
| `AlertBanner` | Renders nothing when `alert` is null (doesn't reserve space). Carries `role="alert"`. |
| `ProgressFooter` | Day/session label + `n / total` + a slim progress bar. Always clamp `currentIndex` to `total` before passing it in (a finished session's `currentOrder` legitimately exceeds the item count internally — don't leak that into the display). |
| `HoldBadge`, `SectionLabel`, `ProgressBar`, `RequirementRow` | Small building blocks used by the above. |

## `components/operator/` — desktop dashboard

Data-aware; each takes a `Session` and reads live state via `useEventStore()` directly rather than through props, so they can be composed independently inside the three-column layout.

| Component | Purpose |
|---|---|
| `ProgramList` | The full rundown, grouped by section. Rows are real `<button>` elements (keyboard/screen-reader accessible) with a responsive layout: a single-line desktop row (`sm:` and up) collapses to a two-line stacked row below `sm` so the title never gets starved of width by fixed-width time/duration columns. If you add a column, make sure it degrades the same way. |
| `LiveDetailsPanel` | Center column — live item, big countdown, editable notes textarea. |
| `ControlsPanel` | Right column — Start/Next/Previous/Hold, `JumpControl`, `AlertComposer`. |
| `SessionSwitcher` | Horizontal-scroll session picker; shows a live dot for any session with progress recorded. |
| `JumpControl`, `AlertComposer` | Self-contained, validate their own input before enabling their action button. |

## `components/remote/` — mobile controller

Not shrunk desktop components — sized and styled specifically for one-handed use.

| Component | Purpose |
|---|---|
| `BigActionButton` | The primary action (Next/Start/Finish). `variant`: `primary` / `secondary` / `warning`. Always `type="button"`. |
| `QuickActionButton` | Icon + label, used for the Jump/Alert/Notes row. Carries `aria-pressed` since these toggle an inline panel. |

The remote page (`app/(operator)/remote/page.tsx`) also defines a page-local `QuickPanel` for the inline Jump/Alert/Notes forms — deliberately not a shared component, since its layout is tied to the remote's specific thumb-zone structure.

## `components/auth/`

| Component | Purpose |
|---|---|
| `AuthProvider` / `useAuth()` | `status`: `"checking"` / `"locked"` / `"unlocked"`, backed by a real Supabase Auth session (`supabase.auth.getSession()` + `onAuthStateChange`), not `sessionStorage`. Drives UI only (the "Log Out" button, command-palette gating) — access control itself is `proxy.ts` + `lib/server/require-auth.ts`, not this component. `lock()` calls `POST /api/auth/logout` then redirects to `/login`. |
| `LinkInvalid` | The four TV displays' and `/screens`'s failure state for an expired/revoked/unrecognized share-link token or a route hit with no session and no token — a specific message per reason, never a blank screen. |

There is no `PinGate` anymore — real auth means an unauthenticated visitor is redirected server-side to a real `/login` page (`proxy.ts`) rather than shown an inline PIN screen inside the layout.

## Conventions worth keeping

- **State access**: components read live state via `useEventStore()`, not via props drilled from a page — keeps `ProgramList`/`LiveDetailsPanel`/`ControlsPanel` independently composable in the three-column grid.
- **`cn()` for conditional classes** (`lib/utils.ts`) — a thin `clsx` + `tailwind-merge` wrapper, used everywhere instead of manual string concatenation.
- **`focus-visible` rings**: every custom interactive element should carry `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background` (or the `/30` variant on inputs) — copy this pattern for new components rather than inventing a new focus style.
- **Real `<button>` for anything clickable** — not a `<div onClick>`. It's free keyboard support and screen-reader semantics.
