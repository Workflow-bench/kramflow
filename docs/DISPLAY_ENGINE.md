# KramFlow Display Engine

A centralized real-time display subsystem covering the Presenter Confidence
Monitor, and the Green Room / AV / General displays. Originally built as an
additive, flag-gated preview subsystem alongside the pre-existing app; since
consolidated into the canonical implementation of those surfaces — see
"History" below.

## Design intent

Long-distance readability, huge typography, a single confidence-monitor
mental model applied consistently across display types — inspired by the
*usability principles* of tools like StageTimer (countdown/count-up,
overtime awareness, fullscreen, distraction-free), not their interface.
Nothing here reuses StageTimer's layout, colors, or branding; it follows
KramFlow's own design tokens (`app/globals.css`) and the same "one accent
color, no gradients, no decorative motion" discipline as the rest of the
app, with one documented exception (see [Timer colors](#timer-colors)).

## History

This subsystem was originally built additively on a feature branch, kept
behind a `NEXT_PUBLIC_DISPLAY_ENGINE_ENABLED` build flag, and synced its own
state (registry, timer, Hold, Broadcasts, Speaker Ready) purely via
`BroadcastChannel` (same-browser only) or an optional self-hosted WebSocket
relay — built before Supabase existed in this project.

Two consolidation passes later:

1. **View consolidation** — the plain "original" AV and Green Room pages
   were deleted in favor of these richer ones (they already had every field
   the originals had, plus Hold/Broadcast/timer escalation/props/camera
   angle). Volunteer Board was dropped (not a wanted surface; its one
   distinguishing feature, `Program.team`, is dead data — always `null` in
   `lib/data/sessions.ts`). Routes were renamed to clean top-level paths
   (`/displays/av` → `/av`, etc. — see [Module map](#module-map)) and the
   feature flag was removed; these are permanent canonical routes now, not
   an experimental preview.
2. **Transport migration** — Hold, Timer, Speaker Ready, the display
   registry, and Broadcasts (active/scheduled/history) moved onto Supabase
   Postgres + Realtime, the same backbone `lib/store.tsx` already used for
   the core show data. This closed a real inconsistency: Next/Previous/
   Alert/Notes always synced across real devices; Hold/Broadcast did not,
   unless the separate WS relay was deployed. See
   [Real-time transport](#real-time-transport).

Program/session/live-state data is still never duplicated — every display
page reads the same `useEventStore()`, `useSessions()`,
`getLive()`/`getNext()`/`getOnDeck()` the Operator Dashboard uses.

## Module map

```text
lib/display-engine/
├── types.ts                 — all engine types; imports/re-exports AlertSeverity from @/lib/types rather than redefining
├── defaults.ts               — BUILT_IN_PROFILES, createInitialEngineState()
├── transport.ts               — RealtimeTransport interface + BroadcastChannel/WebSocket implementations (now used only for the local-only slice, see below)
├── store.tsx                 — useDisplayEngine(), useTransportStatus(), targetMatchesDisplay()
├── colors.ts                  — TIMER_COLORS / TIMER_COLOR_LABELS
├── use-time-sync.ts            — Cristian's-algorithm clock sync against /api/display-engine/time
├── use-register-display.ts      — registry registration + heartbeat + pending-command delivery
├── use-display-timer.ts         — the timer engine (auto-follow + manual), formatClock(), useDisplayClock()
├── use-fullscreen.ts            — Fullscreen API + Screen Wake Lock API wrappers
├── use-keyboard-shortcuts.ts     — scoped per-page shortcut map
└── use-idle-visibility.ts        — controls auto-hide/reveal on activity

components/display-engine/
├── display-shell.tsx        — full-viewport safe-area wrapper (not a reuse of the deleted components/tv/tv-layout.tsx)
├── timer-ring.tsx            — SVG progress ring, Framer Motion (not styled-jsx — see Known constraints)
├── hold-screen.tsx            — full-screen Hold takeover
├── broadcast-overlay.tsx       — renders active broadcasts targeted at a display (banner or emergency takeover)
├── session-timeline.tsx        — shared running-order list (General/AV)
└── profile-editor.tsx          — Display Profiles CRUD, embedded in Display Manager

app/{presenter,green-room,av,general}/page.tsx  — the 4 Display Engine display surfaces (Operator/Remote aren't Display Engine surfaces)
app/(operator)/broadcast/page.tsx        — Broadcast Center (PIN-gated, linked from the Operator dashboard header)
app/(operator)/display-manager/page.tsx    — Display Manager (PIN-gated, linked from the Operator dashboard header)
app/api/display-engine/time/route.ts       — { serverTime } for clock sync
app/api/display-engine/registry/*          — display registration/heartbeat (public) + rename/assign/command/remove (PIN-gated)
app/api/display-engine/hold/route.ts       — Hold activate/deactivate (public)
app/api/display-engine/timer/route.ts      — every timer action (public)
app/api/display-engine/speaker-ready/route.ts — Green Room's speaker-ready toggle (public)
app/api/display-engine/broadcasts/*        — send/schedule (PIN-gated), dismiss/acknowledge/promote (public)
scripts/display-engine-ws-server.mjs        — optional standalone WS relay; no longer needed for Hold/Broadcast/Timer/Registry (see below), still usable for the local-only slice if ever needed
```

## Real-time transport — two systems now, on purpose

- **Hold, Timer, Speaker Ready, the display registry, and Broadcasts
  (active/scheduled/history)** sync via **Supabase Postgres + Realtime**
  (`supabase/schema.sql`'s `display_state`, `display_registry`,
  `display_broadcasts` tables), following the exact pattern
  `lib/store.tsx`/`lib/use-sessions.ts` already established: reads are a
  fetch + `postgres_changes` Realtime subscription
  (`lib/display-engine/store.tsx`'s `fetchRemoteSlice()`/
  `ensureRemoteTransportConnected()`), writes go through
  `app/api/display-engine/*` routes using the service-role key. This is
  genuinely cross-device now — a phone and a lobby TV in different rooms
  see each other's Hold/Broadcast state without any extra infrastructure.
- **Profiles, Groups, and Broadcast templates/favorites/drafts** — operator
  UI configuration, not live show state — stay on `localStorage`, synced
  same-browser-only via `BroadcastChannel` (`lib/display-engine/transport.ts`,
  unchanged from before). Deliberately out of scope for the Supabase
  migration; each operator's browser has its own. The optional WebSocket
  relay (`scripts/display-engine-ws-server.mjs`) still exists and would
  extend this local-only slice across devices if ever needed, but nothing
  in this app requires it anymore.

### Auth boundary

Hold/Timer/Speaker-Ready/Registry-heartbeat write endpoints are
**intentionally public** (no PIN) — Presenter and Green Room are
unauthenticated pages today (no PIN gate on `/presenter`, `/green-room`,
`/av`, `/general`), so this matches the actual pre-existing risk level;
the Supabase migration changed *how* this state syncs, not *who* can
trigger it. Broadcast Center's send/schedule/cancel actions, and Display
Manager's rename/assign/command/remove actions, **are** PIN-gated
(`lib/server/require-auth.ts`) since those pages sit inside the
`(operator)` route group. Dismiss/acknowledge/promote-a-scheduled-broadcast
stay public too — `components/display-engine/broadcast-overlay.tsx`,
rendered on every public display, calls dismiss/acknowledge directly, and
the scheduled-broadcast poller runs in whichever tab happens to have the
store loaded, not just an authenticated one.

## Timer engine

`useDisplayTimer()` drives every timer-bearing display from one of two sources, selected by `engine.timer.source`:

- **Auto** — reads the *existing* app's live program (`durationMinutes`, `progress.startedAt`, `LiveState.pausedAt`). This is what "auto-follows the Operator Dashboard" means concretely: no separate program state, just the same numbers every other display already reads.
- **Manual** — the engine's own independent `TimerState` (now the `timer` column of the `display_state` singleton row), driven by the Presenter Display's controls (start/pause/resume/reset/±30s/±1min), using the identical shift-on-resume model as the main app's own Hold (`pausedAt` shifts `startedAt` forward by the paused duration on resume — computed server-side now in `app/api/display-engine/timer/route.ts`'s `resume` case).

### Timer colors

Green/orange/red reuse the exact hex values already in `app/globals.css`. **Yellow is new** — a confidence monitor needs a 5-step escalation (on-time → approaching end → final minute → overtime → critical/blinking) that the rest of the app's 4-color palette doesn't provide. This is the one deliberate, contrast-verified (9.85:1 against `#0F1115`) exception to "one accent color," scoped narrowly to `lib/display-engine/colors.ts` — no shared design token was touched.

### Session Timer mode — known simplification

The existing data model tracks *per-item* `startedAt` (`SessionProgress.startedAt`), not a separate "whole session start time." Session Timer mode therefore reuses the same elapsed-time math as Count-up mode, differentiated by label/framing only ("session elapsed" vs "elapsed"), not by genuinely different timer semantics. A true session-wide timer would need a new field on `LiveState` — out of scope for this pass since it would touch the existing, frozen data model.

## Hold Mode

`HoldState` (`activateHold`/`deactivateHold`, now backed by `app/api/display-engine/hold/route.ts` and the `display_state.hold` column) is a full-screen takeover (`HoldScreen`), independent of the timer, with five presets (`HOLD_PRESETS`) and an optional `continueClock` flag. Rendered above `BroadcastOverlay`'s banners (z-40 vs z-30) but below emergency broadcasts (z-50) — an active emergency is meant to interrupt even a Hold screen. The Presenter page's own control bar sits at `z-[45]`, above the Hold overlay, specifically so a real click can still release Hold once it's active — see the "4 real bugs" fix in git history for why this matters (the overlay used to fully occlude the only Hold toggle).

## Broadcast Center

`BroadcastMessage`/`BroadcastDraft` cover title/message/icon/priority/target/expiration/duration/acknowledgement/persistence, plus scheduling (below). Targeting (`targetMatchesDisplay()`) supports all/type/specific-display/group. Each display renders broadcasts itself via `<BroadcastOverlay>` — non-emergency messages stack as up-to-3 bottom banners (dismissible unless `persistent`), emergency messages take over the full screen and can require acknowledgement.

**Banners are rendered on an opaque `bg-card/95` + blur surface, not a translucent tint** — an earlier version used `bg-status-*/15`, which let page content (e.g. the Presenter Display's own footer) bleed through and visually collide with banner text in Program/Session mode. Caught during end-to-end browser testing; fixed by giving the banner container a solid backdrop and moving the type's accent color to just the icon chip.

### Scheduled broadcasts — known limitation (carried forward, not solved by the Supabase migration)

A scheduled broadcast (`display_broadcasts` row with `status = 'scheduled'`) is promoted to `status = 'sent'` by `app/api/display-engine/broadcasts/[id]/promote/route.ts`, called by a lightweight in-store scheduler (`ensureSchedulerRunning()`, polling every 5s) that runs inside whichever browser tab happens to have the Display Engine loaded. **There is still no server-side cron in this environment.** Moving the state to Supabase made the *result* of promotion genuinely cross-device (every display sees the promoted broadcast via Realtime), but the *trigger* is still "some open tab happened to notice" — a real fix would need Supabase `pg_cron` or a Vercel Cron Job calling the promote route on a schedule.

Recurrence (from the original spec's "schedule/recurrence") was **not implemented** — only one-shot future sends.

## Display Registry, Manager, and Profiles

Every display page calls `useRegisterDisplay(name, type, room, onCommand)` once: registers itself (now via `POST /api/display-engine/registry`, public), heartbeats every 15s with a latency sample, and applies+clears any `pendingCommand` the Display Manager issues (`test-message`, `force-fullscreen`, `reload`, delivered via `PATCH /api/display-engine/registry/[id]`, PIN-gated). A display is considered `offline` after 45s without a heartbeat (`OFFLINE_AFTER_MS`).

**Display Manager** (`/display-manager`, PIN-gated) lists every registered display with live status/latency — genuinely cross-device now, since the registry lives in `display_registry` rather than same-browser `localStorage` — with inline rename/type/room/profile assignment, and per-display actions:
- **Preview** — a real, live `<iframe>` of the display's actual route (same synced state, genuinely live).
- **Screenshot** — uses the browser's native `getDisplayMedia()` picker (the operator selects the window/screen to capture) and downloads a PNG. Unaffected by the transport migration — pure browser API.
- **Force Fullscreen / Test Message / Reload** — delivered via `sendCommand()` → the target's `pending_command` column, read back via Realtime.

**Display Profiles** (`profile-editor.tsx`, embedded in Display Manager) are full CRUD on top of `BUILT_IN_PROFILES` (Presenter/Minimal/AV/General/Green Room) — **stay local-only**, same as Groups. Built-in profiles are read-only; operators can create/edit/delete their own, then assign them to a display from the same list.

## Speaker Ready — new, narrowly-scoped state

The Green Room Display's "speaker ready" indicator has no equivalent in the existing `Program`/`LiveState` model — it's genuinely new information (has the next speaker checked in?), not derivable from anything already tracked. Lives in `display_state.speaker_ready` (a `Record<programId, boolean>` jsonb map), written via `PATCH /api/display-engine/speaker-ready` (public — Green Room's toggle is unauthenticated).

## General Display — pragmatic scoping

Originally scoped down to a static "Sponsor Slides"/"Directional Information" text section rather than a full slide/asset-management CMS, which would be a project of its own — that static section was later found to be entirely hardcoded copy unrelated to any real event ("Restrooms are near the main hall entrance" on every event, regardless of actual venue) and was removed during the Public Displays redesign pass in favor of the event's real `venue` field (shown only when the operator has actually set one). "Countdown to Next Event" is real and live (see `parseTimeToday()` below); a "Daily Schedule" widget was never actually built — On Deck (N+2 lookahead) is the closest equivalent that shipped.

### `scheduledStart` is a display string, not a timestamp — a real bug found and fixed

`Program.scheduledStart` (from the cue sheet) is a pre-formatted string like `"5:00 PM"` — the existing app has only ever rendered it as plain text (`components/operator/program-list.tsx`). Three places in this subsystem initially called `new Date(scheduledStart)` / `Date.parse(scheduledStart)` on it, which is not a parseable format and silently produced `Invalid Date` (`session-timeline.tsx`, the Green Room "expected start" label, and the General display's countdown). Caught during end-to-end browser testing. Fixed by:
- Rendering the field as plain text everywhere except the one place a real countdown is required.
- Adding a narrow `parseTimeToday()` helper (General display page only) that parses the actual `"H:MM AM/PM"` format against *today's* date — a safe assumption for a display that only ever runs on the actual event day, same assumption the rest of the live-event tooling already makes.

## A real bug found in testing: stale `clientId` race

`useDisplayEngine()`'s `clientId` was a module-level variable only corrected (from the SSR `"server"` fallback to the real per-tab id) inside `ensureTransportConnected()`, which runs post-commit via `useSyncExternalStore`'s `subscribe()`. A fast-firing effect (`useRegisterDisplay`'s registration effect) could run before that correction landed, registering a bogus `"server"` entry in the shared display registry. Fixed by resolving `clientId` eagerly at module init (`typeof window !== "undefined" ? readClientId() : "server"`) instead of waiting for `subscribe()` — verified fixed by clearing state and re-registering, confirming exactly one clean entry.

## Keyboard shortcuts (Presenter Display)

`Space` pause/resume · `+`/`-` adjust 30s · `R` reset · `F` fullscreen toggle · `H` hold toggle · `Esc` exit fullscreen. Scoped per-page via `useKeyboardShortcuts()`, ignored while an `<input>`/`<textarea>` has focus, never attached globally.

## Session persistence & reconnection

Hold/Timer/Speaker-Ready/Registry/Broadcasts rehydrate from Supabase on load (a fetch, then Realtime keeps them current) — a refreshed display picks up exactly where the shared state left off regardless of which device refreshed. The local-only slice (Profiles/Groups/templates/favorites/drafts) still rehydrates from `localStorage` as before. `useFullscreen()` remembers the fullscreen preference across reloads (browsers only allow *entering* fullscreen from a real user gesture, so a refreshed display can't silently re-enter it, but the preference is available for an operator to act on).

## Known constraints

- **Framer Motion over `styled-jsx`** — `AGENTS.md` warns this Next.js version has unverified/changed APIs; HoldScreen's fade uses Framer Motion (already a project dependency) rather than risk `styled-jsx`.
- **No new runtime dependencies** — the WS relay is hand-rolled specifically to avoid adding `ws` to `package.json` for what is now genuinely optional infrastructure (only relevant to the local-only Profiles/Groups slice, if ever needed cross-device).
