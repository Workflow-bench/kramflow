# Customizable Display Engine — Requirements & Feature List

**Status:** Phase 1 (research/requirements) — for review before any build starts, per plan.

## How this was produced (read this before trusting anything below)

You asked for 10–30 interviews with real event staff. I have no way to contact or survey real people, so this document is **synthesized, not interviewed** — built from three sources instead:

1. **This codebase's own evidence of what operators actually needed** — the 4 existing display types (Presenter, Green Room/Speaker Ready, AV, General) each encode a real, hard-won answer to "what does this specific role need to see," visible in their component comments (e.g. `stage-next-card.tsx`: "Green Room's two extras... stay opt-in props rather than always-on, so AV's output is unchanged" — that's a real behavioral difference someone fought for).
2. **The `DisplayType` union already reserves `"custom"`** as a value, explicitly excluded from every picker/preview list in the app (`app/screens/page.tsx`, `app/e/[eventId]/displays/page.tsx`) and falling back to the Presenter route with no real implementation. Someone already scoped this feature and stopped short of building it — that's a strong, real signal about what was planned, not a guess.
3. **Comparable-product research** — StageTimer.io and similar run-of-show display tools, which this codebase's own `senior-ux-layout-standards` skill already treats as a reference point for this exact product category.

This is a *reasonable starting hypothesis*, not a validated spec. Anywhere you actually can get 5–10 minutes from a real AV tech, stage manager, or event producer, do it — even 3 real conversations will surface something this synthesis can't (a venue-specific constraint, a workflow habit, a request nobody would think to ask about in the abstract). Treat this doc as the first draft to react to, not the final word.

---

## 1. Who actually uses a display, and what they need from it

Derived from the 4 existing display types' own design intent (comments, component props, layout choices):

| Role | Existing display | What the current design already assumes they need |
|---|---|---|
| **AV / technical crew** | AV | Dense, technical: current + next item, presenter contact, technical requirements (mic, video, lighting, curtains) — see `AV Waiting Room`'s "PREP REQUIREMENTS" panel |
| **Speaker / performer waiting to go on** (Green Room) | Green Room | Calmer, larger type, a "Speaker Ready" toggle, operator staging notes, background wash when *they* are up next specifically |
| **Presenter on stage** | Presenter | A confidence monitor — 6 modes, keyboard shortcuts, wake lock (per the KramFlow case study) — built for someone glancing at it *while talking*, not reading it |
| **Anyone in the venue** (lobby, hallway, overflow room) | General | The plain audience-facing default — current item + countdown, nothing operator-only |
| **Everyone above, for a role nobody anticipated** | *(none — "custom" is a stub)* | Whatever combination of the above the actual event needs — a green room that also wants the technical checklist, a lobby display that wants sponsor branding, a stage manager's own private monitor with operator-only info |

That last row is the actual gap. The four fixed types are real, validated designs for four real roles — but any event whose needs don't map exactly onto one of those four currently has no path forward except picking the closest fit and living with the mismatch.

## 2. What "customizable" concretely needs to mean

Broken into what an operator should be able to configure, most-requested-in-similar-products first:

### 2.1 Content — which widgets appear
Building blocks that already exist as real, reusable pieces (`components/display-engine/*`) and should become the customization primitives, not be rebuilt:
- **Now playing** — current item name, presenter, countdown/timer (`stage-info-card` + the timer engine already in `lib/display-engine/types.ts`)
- **Up next** — the `stage-next-card`, with its existing opt-in extras (ready badge, presenter contact, emphasis wash)
- **Status pill** — LIVE / PAUSED / STANDBY / ON HOLD (`stage-status-pill`)
- **Technical requirements checklist** — currently AV-only; should be an optional widget any custom display can add
- **Operator/staging notes** — currently Green Room-only; same treatment
- **Full schedule / run of show list** — doesn't exist as a widget yet anywhere; a real gap even the 4 fixed types don't cover (useful for a lobby monitor or a stage manager's screen)
- **Branding / sponsor image or logo** — doesn't exist yet; a common ask for any audience-facing (General-type) display in comparable products
- **Custom text/message block** — a static or operator-editable text field (venue rules, wifi password — note the existing Broadcast Center already has a "Wi-Fi" info broadcast used in the seed data, suggesting this need is already being worked around via broadcasts rather than a persistent widget)
- **QR code** (share link / feedback form / program) — common in this product category, no existing equivalent

Every widget must still compose correctly with the systems that already cut across ALL displays regardless of type — Hold screen, Broadcast overlay, emergency takeover, fullscreen prompt — since those are rendered by `display-shell.tsx` outside individual display content already, this should mostly fall out "for free" if a custom display goes through the same shell.

### 2.2 Layout — how widgets are arranged
- Pick from a small set of **zone templates** (e.g. "hero + sidebar," "3-up grid," "full-bleed single widget") rather than free-form drag-and-drop for v1 — free-form layout is a much bigger, riskier build (collision detection, responsive reflow at every screen size a real TV/tablet/phone might use) and none of the 4 existing displays needed it; a template picker gets most of the value at a fraction of the risk.
- Per-zone widget assignment: pick which widget goes in which zone of the chosen template.
- **This is the part most likely to be wrong without real interviews** — "which layouts do people actually want" is a real design question that benefits enormously from even a handful of real answers.

### 2.3 Presentation — reading-distance and branding
- **Type scale**: the existing product already treats "distance dictates fidelity" as a first-class design principle (per the case study) — a custom display needs a "viewing distance" setting (arm's-length console vs. across-the-room TV) that scales its own type/spacing, reusing the same logic AV/General/Presenter already encode by hand.
- **Theme/color**: dark-only today (per `stageflow`'s own CLAUDE.md — "Kramflow is dark-mode only by design... no light theme"); a custom display should probably stay within that same constraint rather than introduce a second visual system, unless a real customer request says otherwise.
- **Accent/brand color override** — a lighter-weight, safer customization than full theming: let an event set one accent color (e.g. from their own brand) without touching the base dark palette.

### 2.4 Reuse and management
- **Save as a named template** — so a custom layout built for one event's lobby display can be reused on the next event without rebuilding it from scratch.
- **Per-display override vs. per-event default** — an event might want one custom layout as its default "General" replacement and a different one-off custom layout for a single extra screen.
- **Preview before publish** — the Displays fleet page already has a "Preview" button per display; a custom display's config should be checkable there before it's live on a real screen.

### 2.5 Permissions
- Who can create/edit a custom display's layout? The existing model has two tiers already (PIN-gated Operator/Remote vs. no-login public displays) — building/editing layouts should sit with the Operator tier, same as everything else in Cue Sheet/Displays/Settings; the public display route itself stays read-only and no-login, unchanged.

## 3. Explicit non-goals for v1 (things a real interview might overturn, but that keep this scoped)

- Free-form drag-and-drop layout (zone templates instead — see 2.2)
- Per-widget custom CSS/styling beyond accent color
- Multiple simultaneous custom layouts assigned to rotate on one screen (a "playlist" of scenes) — real feature in some competing products, but adds real-time scheduling complexity on top of everything else here
- A public template marketplace/sharing between different KramFlow customers

## 4. Proposed technical shape (how this fits the existing architecture, not a rewrite)

- Extend `DisplayEngineState` (or a new sibling table, following the same pattern as `groups`/`broadcasts`) with a `customLayouts: Record<string, CustomLayoutConfig>` and a `CustomLayoutConfig` shape: `{ id, name, template: ZoneTemplateId, zones: Record<ZoneId, WidgetConfig>, accentColor?: string, viewingDistance: "close" | "far" }`.
- `DisplayInstance.type === "custom"` gains a `layoutId` reference (currently `DisplayInstance` has no such field — new, additive column/property, same pattern as `profileId`).
- A new `app/custom/[layoutId]` (or similar) route replaces the current `"custom" → route: "/presenter"` fallback in `DISPLAY_TYPES`, rendering through the same `display-shell.tsx` (so Hold/Broadcast/fullscreen keep working identically) but composing widgets from the zone config instead of a hardcoded JSX tree.
- The widget components in `components/display-engine/*` (`stage-info-card`, `stage-next-card`, `stage-status-pill`, etc.) become the actual renderable widget catalog — each wrapped in a small adapter that reads its props from the zone config instead of being hand-wired per display client, the same refactor direction their own comments already point at ("was hand-copied... one structural wrapper here").
- A new Operator-facing editor UI (likely a new page or panel off `app/e/[eventId]/displays`) for picking a template, assigning widgets to zones, naming/saving the layout — the actual "build" phase, once this doc is confirmed.

## 5. Prioritized feature list (MVP → later)

**MVP**
1. Zone-template picker (2–3 templates to start: hero+sidebar, 3-up grid, single full-bleed)
2. Widget catalog: Now Playing, Up Next, Status Pill, Schedule List, Custom Text
3. Viewing-distance scale setting
4. Save/name/reuse a layout across events
5. Wire `"custom"` into the real display route + all the pickers that currently filter it out

**Next**
6. Technical Checklist and Staging Notes widgets (promoted from AV/Green Room-only to available-everywhere)
7. Accent color override
8. Branding/logo widget
9. QR code widget

**Later / needs real validation first**
10. Free-form layout (if templates prove too limiting)
11. Scene rotation/playlists
12. Anything from real interview feedback that isn't covered above

---

## Open questions for you (or real interviewees) before build starts

1. Do the 2–3 proposed zone templates actually match real screen shapes people use (TVs, tablets, monitors), or are there aspect ratios/orientations not covered?
2. Is "Custom Text" a static per-layout field, or does it need to be operator-editable live during a show (more like a lightweight Broadcast)?
3. Should a custom display be allowed to show operator-only information (control ownership, etc.) the way Presenter/Green Room currently never do, or does "custom" stay strictly public-safe like General?
4. Any hard requirement from a real venue (specific TV model, specific browser, specific network constraint) that should shape the technical widget/layout choices?
