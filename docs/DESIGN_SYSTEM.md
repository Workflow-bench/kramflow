# Design System — Stage surfaces

> **Scope changed.** This file now governs the **Stage** surfaces only:
> `/green-room`, `/av`, `/general`, `/presenter`, `/broadcast` — the TV and
> display routes read from 5–15ft.
>
> The **Console** surfaces (`/operator`, `/operator/cue-sheet`) are governed
> by [DESIGN.md](DESIGN.md).
>
> The two were previously one system, and the rules below — "No tables",
> "No tiny text", "Cards should breathe", a 23px body and 92px hero — are
> correct for a TV read across a room and wrong for a 244-row cue sheet
> operated at 18–24in. Applying them to the console is what made it feel
> bloated. Do not re-merge them.

## Four experiences, not one responsive page

KramFlow is four purpose-built surfaces (`docs/IA.md`), each with its own
layout logic:

- **TV** (Green Room, AV) — full-bleed, hero typography, zero controls.
- **Operator Dashboard** — dense, full-width, three-column control room.
- **Operator Remote** — one-handed, thumb-zone controls, huge primary button.

Never solve "does it work on mobile" by shrinking the desktop layout, and
never solve "does it work on a TV" by centering the desktop layout in a
`max-width` box. Each breakpoint gets its own layout decision.

## Principles

- Minimal
- Large typography
- Whitespace
- One action per screen
- No tables
- No charts
- No analytics
- No tiny text
- Only one accent color per status
- Cards should breathe
- Everything aligns to an 8px grid

## Inspiration (combine, do not copy)

| Layer | References |
|---|---|
| Typography | Apple TV, Apple Calendar, Apple Keynote Presenter View |
| Layout | Linear, Notion Calendar, Raycast |
| Status system | Formula 1 Race Control, airport departure boards |
| Motion | Apple Human Interface Guidelines, Framer Motion |
| Spacing | Vercel Dashboard, Linear |

## Color palette

No gradients. No glassmorphism. No neumorphism. Maximum 3 colors visible
simultaneously (background + card + one accent).

| Token | Value | Use |
|---|---|---|
| `background` | `#0c0b09` | App background |
| `card` | `#17140f` | Card surfaces |
| `primary` | `#f4efe5` | Primary text |
| `muted` | `#a79d8b` | Secondary text, labels |
| `muted-2` | `#8a8070` | Tertiary text — captions, timestamps, dividing labels |
| `green` | `#2bb673` | Ready / go / live |
| `blue` | `#4b8fe3` | Informational / next |
| `orange` | `#e8a33d` | Warning / prepare |
| `red` | `#e5484d` | Alert / not ready |

Every text color is checked against both `background` and `card` for WCAG AA
(4.5:1 for body text) — the exact ratio is inlined as a comment next to each
token in `app/globals.css`. This table's values previously drifted from the
actual tokens (a warm near-black/cream palette replaced an earlier cool
dark-slate one at some point without this doc being updated) — if you ever
adjust these tokens, re-verify contrast and update both places together
rather than letting them diverge again.

## Border radius

`20px` on cards and surfaces, `12px` on inputs/small controls.

## Spacing scale

`8 / 16 / 24 / 32 / 48 / 64 / 80` — everything aligns to an 8px grid. TV
surfaces use the top of this range (`64px`–`80px` between stacked sections);
the denser operator dashboard uses the middle (`24px`–`40px`).

This is a documented convention, not an enforced token — unlike color and
type (`app/globals.css`'s `@theme inline` block), there's no `--spacing-*`
custom property or Tailwind config extension backing it, so nothing stops a
new component from reaching for an arbitrary value instead. In practice the
scale has held (spot-checked across the app), but it's worth knowing the
enforcement is convention-and-code-review, not the build.

## Elevation

Flat by default. `shadow-lg` appears in exactly three places in the entire
codebase — the toast (`components/ui/toast.tsx`), Presenter's floating
control bar (`app/presenter/page.tsx`), and the broadcast overlay
(`components/display-engine/broadcast-overlay.tsx`) — and every one of them
is a genuinely floating element sitting above the page content, not a card
or panel. Cards, panels, and dialogs stay flat (`bg-card`, a `border`, no
shadow) even when stacked or layered; separation there comes from the
background-color step between `background` → `card` → `card-hover`, not
from elevation.

The rule: reach for `shadow-lg` only when something is floating free of the
page's normal layout (fixed-position, appears above other content, would
look wrong if it just "sat" on the page like a card does). Everything else
stays flat. This was already true in practice before it was written down
here — confirmed by grepping the whole codebase for `shadow` — so treat this
as documenting an existing, consistently-applied decision, not introducing
a new one.

## TV safe area

A **fixed** margin, not a proportion of the screen: `clamp(48px, 4vw, 64px)`
on every edge (`.tv-safe-area`). TV surfaces are full-bleed otherwise — no
centered `max-width` container. The safe area is the only inset.

## Responsive breakpoints (Operator Dashboard)

The desktop dashboard stacks into a single scrollable column below `xl`
(1280px) — including the header, which goes from a single row to a stacked
layout. `ProgramList` rows independently switch from a two-line stacked
layout to a single-line row at `sm` (640px), regardless of the page-level
breakpoint.

The three-column grid uses **narrower** fixed column widths at `xl`
(`340px`/`280px`) than at `2xl` (`400px`/`320px`, 1536px+). This was a real
bug, not a preference: at exactly `lg` (1024px) with the original fixed
400px/320px columns, the remaining space for the program list dropped to
~280px — not enough for the single-line row layout, causing titles to
truncate to almost nothing. If you widen these columns again, re-check the
1024–1439px range specifically, not just 1920px.

`/remote` doesn't have this problem — it's a single column at every width by
design — but was verified down to 320px regardless (no horizontal overflow,
every control reachable).

## Typography scale

Sized for the surface, not one scale stretched across four devices.

| Name | Size | Use |
|---|---|---|
| Hero | 92px | Live Now title (TV), the countdown number (Remote) |
| Title | 42px | Section titles, current-item title (Operator/Remote) |
| Subtitle | 30px | Program titles, Next item, presenter names |
| Body | 23px | Secondary text — notes, requirement values, list rows |
| Caption | 17px | Eyebrow labels only (`LIVE NOW`, footer) — never body copy |

Font: system sans (SF Pro-equivalent) — `-apple-system`/Inter fallback stack,
tabular numerals for countdowns and item counts.

## Motion

- Fade, slide, opacity only.
- Duration: `250ms`.
- Easing: standard ease-out, no bounce, no spring overshoot.
- Motion communicates state change (item advanced, alert appeared) — never
  decoration.

## Rules

- One accent color per status badge, never combined.
- No unnecessary icons — an icon only appears when it replaces a word, never
  alongside one.
- No borders as decoration — separation comes from spacing and card surfaces.

## Accessibility

- Every custom interactive element carries a `focus-visible` ring:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40
  focus-visible:ring-offset-2 focus-visible:ring-offset-background` (inputs
  use `/30` instead of `/40`). Copy this pattern for new components.
- Anything clickable is a real `<button>`, not a `<div onClick>` —
  `ProgramList` rows were the one place this had drifted; fixed, see
  `docs/CHANGELOG.md`.
- Icon-only controls get an `aria-label`; toggle-style controls (severity
  pills, quick-action panels, session tabs) get `aria-pressed` or
  `aria-current`.
- All text colors are checked against WCAG AA — see the note under Color
  palette above.
- Alert banners carry `role="alert"`.
