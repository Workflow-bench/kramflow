# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct audiences, at two distinct distances from the screen, who never see the same surface:

- **Operators** — the stage manager / AV/production crew member actually running a live event. Sits at a laptop (Operator Console, Cue Sheet) or holds a phone backstage (Remote) while walking. Task-focused, trained on the tool, returns to it repeatedly across a multi-day event. Now (post multi-tenancy) any operator can sign up and run their own event(s) — this is no longer a single-crew internal tool.
- **Everyone else in the venue** — performers, AV/production crew, general attendees, presenters — glancing at a TV or tablet from 5–15ft, or a confidence monitor a few feet away. Never touches the interface (General/AV/Green Room displays are strictly read-only) except Presenter, which has a light physical-proximity control bar. Reached via a no-login share link/QR, not an account.

## Product Purpose

Kramflow (formerly "KramFlow") replaces the run-of-show spreadsheet that gets shouted across a green room. It's a real-time production console: an operator drives a queue of program items through a live show, and every connected display — audience-facing, crew-facing, or performer-facing — reflects that state within about a second, with zero manual relay.

It answers exactly two questions for anyone not driving it: **what's happening now, and what's next.**

## Positioning

Purpose-built for the actual mechanics of running a live multi-session event (sections/partitions, dynamic cue scheduling, per-auditorium/program-type production requirements, a real cue sheet with 200+ items) — not a generic countdown-timer tool retrofitted with a queue, and not a generic event-management SaaS retrofitted with live sync. The queue *is* the product; timers are a property of a queue item, not the other way around.

StageTimer.io is the closest existing product and the explicit inspiration for this redesign's UX research phase — but Kramflow's core entity model (events → sessions → sections/partitions → queue items, each with dynamic production requirements) is its own, not StageTimer's timers-in-a-room model re-skinned.

## Operating Context

- A live event runs across multiple days and multiple sessions per day (e.g., "Friday Evening," "Saturday Morning"), each session containing a queue of items grouped into sections/partitions.
- The operator edits and reorders the queue before and *during* a live show — drag-and-drop reorder, bulk multi-select edit, dynamic duration-based schedule recalculation that cascades through the rest of the queue.
- Item fields are dynamic per event (a configurable Add Item form) and per production context (auditorium/program type changes which fields are relevant — mic requirements, video/slides, lighting, camera angle, etc.).
- Four no-login display surfaces exist today, each serving a different vantage point on the same live state: **General** (public/lobby), **AV** (technical requirements for crew), **Green Room** (performer-facing, "prepare now" cueing), **Presenter** (confidence monitor with a physical control bar).
- Distribution to displays is via a single generated share link + QR per event, opening a no-login screen-picker (General/AV/Green Room/Presenter) — a deliberate departure from StageTimer's one-signed-link-per-role model, already confirmed and not to be revisited by this redesign.
- Multi-tenant: any operator can sign up, create their own event(s), and only ever sees/manages their own — enforced at the database layer, not just the UI. This redesign changes structure and visuals only; it must not regress that isolation or any other already-shipped functionality (auth, drag-reorder persistence, bulk edit, dynamic scheduling, dynamic forms, share-link generate/revoke, live sync).

## Capabilities and Constraints

- Stack: Next.js (App Router) + Supabase (Postgres, Auth, Realtime, RLS) + Tailwind. TV/display surfaces poll a dedicated read route rather than subscribing directly (anonymous visitors have no `auth.uid()` for RLS-gated Realtime).
- Entities: `events` (tenant root) → `sessions` → `programs` (queue items) grouped by `partitions` (sections), plus `auditoriums`, `live_state`, `display_state`, `share_links`.
- Existing, load-bearing UI surfaces as of this redesign: Dashboard (event list) → Operator Console, Cue Sheet, Remote, Broadcast Center, Display Manager (all per-event, operator-only) → General/AV/Green Room/Presenter (no-login, per-event via share link).
- Two prior from-scratch design systems exist in the repo (`docs/DESIGN_SYSTEM.md` for Stage/TV surfaces, `docs/DESIGN.md` for the Console) plus an earlier "Nexus Interface" design system proposal (Aug 13 artifact) — none of these are authoritative going forward. Per the current request, this is a full replacement, not an extension: the old look is evidence/anti-reference only, not a base to theme-swap.
- Read from 5–15ft on TV surfaces, 18–24in on the console, one-handed on a phone (Remote) — the interface cannot use one type scale or density across all of them.

## Brand Commitments

Name is "Kramflow" (previously stylized "KramFlow" — confirm current preferred casing before implementation). No formal logo/icon set yet (`docs/BRAND_GUIDELINES.md` notes this is still placeholder). Dark-mode-only has been a standing constraint through every prior design pass; treat as a strong default to confirm, not silently overturn, in Phase 3.

## Evidence on Hand

- Full hands-on StageTimer.io research audit (`stagetimer-audit.md`, also published as an artifact) — the explicit base for Phase 1, not to be re-researched from zero.
- Real production content: an actual multi-day, multi-session cue sheet (200+ items) previously imported for a real event, now generalized behind multi-tenancy.
- Existing, working, tested implementations of every "must keep working" capability listed in Operating Context above — these are the functional ground truth Phase 4 must reproduce, not spec from scratch.

## Product Principles

1. **The queue is the product.** Every surface is a different lens onto one shared live queue state, not a separate feature.
2. **Control and display are categorically different surfaces**, not the same UI with permissions toggled — density, interactivity, and distance-from-user diverge on purpose.
3. **Progressive disclosure over upfront complexity** — the Add Item form's dynamic, per-event, per-context field set is the sharpest current example of a place complexity must be earned, not dumped on the operator at once.
4. **Redesign preserves function, replaces form.** Multi-tenant isolation, real-time sync, dynamic scheduling, and every other shipped capability are product truth this redesign must carry forward exactly, even as structure and visuals change completely.
5. **Distance dictates fidelity.** A TV read from across a room, a console read at arm's length, and a phone held one-handed are three different design problems with the same underlying data.

## Accessibility & Inclusion

WCAG AA contrast has been an enforced standard in prior passes (`docs/DESIGN_SYSTEM.md` documents specific token-contrast fixes) — carry this forward as a floor, not a ceiling, in the new system.
