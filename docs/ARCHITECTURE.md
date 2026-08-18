# Architecture

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (Postgres + Realtime) — the data and live-sync backbone, see below
- Vercel (hosting)
- Lucide Icons
- `xlsx`, used both by the one-time seed script and the runtime Excel upload route
- `zod`, shared validation for the cue-sheet schema

## Route groups

```text
app/
├── av/page.tsx                 — technical TV display, public, no PIN
├── green-room/page.tsx         — performer TV display, public, no PIN
├── general/page.tsx            — generic public display (no dept-specific info)
├── presenter/page.tsx          — confidence monitor, public, no PIN
├── (operator)/
│   ├── layout.tsx              — wraps every route below in the PIN gate
│   ├── operator/page.tsx       — desktop control room, 3-column, full width
│   ├── operator/cue-sheet/     — Excel upload + ad-hoc item form + edit/delete
│   ├── remote/page.tsx         — one-handed mobile remote, not a resized dashboard
│   ├── broadcast/page.tsx      — Broadcast Center, linked from the Operator header
│   └── display-manager/page.tsx — Display Manager, linked from the Operator header
├── api/
│   ├── auth/route.ts           — PIN check, sets the signed session cookie (see Authentication)
│   ├── live/route.ts           — every live-state mutation (Next/Previous/Hold/Alert/…)
│   ├── sessions/route.ts       — session list/create
│   ├── programs/route.ts       — program list/create
│   ├── programs/[id]/route.ts  — program update/delete
│   ├── cue-sheet/upload/route.ts — Excel upload, dry-run preview + commit
│   └── display-engine/*        — registry/hold/timer/speaker-ready/broadcasts (see docs/DISPLAY_ENGINE.md)
└── layout.tsx
```

Exactly 6 canonical screens: Operator, Remote, AV, Green Room, General,
Presenter — see `docs/DISPLAY_ENGINE.md`'s "History" section for how this
consolidated down from two generations of AV/Green Room plus a Volunteer
Board that was dropped.

## Two data layers, on purpose

1. **Reference data — dynamic, Supabase-backed, editable at runtime.**
   `sessions` and `programs` tables (`supabase/schema.sql`). Populated
   initially by `npm run seed` (parses `data/cue-sheet.xlsx` via
   `lib/parse-cuesheet.ts`), and from then on editable live: an operator
   can re-upload a `.xlsx` (`app/api/cue-sheet/upload/route.ts`) or add/edit
   individual items through a form (`app/(operator)/operator/cue-sheet`,
   `app/api/programs/*`) — no rebuild or redeploy required. Every write
   goes through a Zod schema (`lib/validation/program.ts`) shared by the
   form, the upload route, and the CRUD API, so the column list is defined
   exactly once. See `docs/DATA_MODEL.md` for the full column list.
2. **Live state — small, mutable, synced across displays.**
   `LiveState` (`lib/types.ts`) holds only what actually changes during the
   event: which session is active, each session's current position, hold
   state, the active alert, and any operator note overrides. Kept
   deliberately separate from the larger reference data so every sync
   write stays small — one `live_state` row per event in Supabase (keyed
   by `event_id`, not a global singleton) rather than a `localStorage`
   blob.

Components never query Supabase directly for reference data — they go
through `useSessions()` (`lib/use-sessions.ts`) + `getSessionById()`
(`lib/data/sessions.ts`) for reference data and `useEventStore()` for live
state, then combine them with `getLive`/`getNext`/`getOnDeck` from
`lib/types.ts`.

## State flow

1. Operator actions (Next/Previous/Jump/Hold/Alert/session switch) call
   `lib/store.tsx`'s `useEventStore()`, whose action functions (`start()`,
   `next()`, …) `PATCH` `app/api/live/route.ts`. The route applies the
   mutation to the `live_state` row and appends a row to `activity_log`.
2. Every open display subscribes to Supabase Realtime on the `live_state`
   row (and, for reference data, on `sessions`/`programs`), so every
   connected device — not just tabs on one machine — picks up the change
   within about a second. `useEventStore()`'s public shape
   (`{state, start, next, ...}`) is unchanged from the pre-Supabase
   version on purpose, so no consuming component needed to change for this
   swap, including the Display Engine (`lib/display-engine/*`), which
   reads this same hook.
3. Display surfaces are pure renderers of `{ session, liveState }` — they
   hold no local mutable program state, only animation state.

## Pause / Hold

`LiveState.pausedAt` is the timestamp a hold began, not a boolean. Freezing
the countdown just means every display computes elapsed time against
`pausedAt` instead of the live clock while it's set (`lib/use-countdown.ts`).
Resuming shifts the active item's `startedAt` forward by the paused
duration, so the countdown picks up exactly where it left off — this keeps
every display in lockstep without needing per-client pause bookkeeping.
The same shift-on-resume computation now lives server-side in
`app/api/live/route.ts`'s `togglePause` case.

## Authentication

Real per-operator accounts via Supabase Auth, not a shared PIN. Two
independent gates, matching Next's own guidance (see
`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) that Proxy
should do cheap/optimistic checks and the real enforcement should sit at
the data layer:

- **`proxy.ts`** (project root — Next 16 renamed `middleware.ts` to
  `proxy.ts`; same runtime, same purpose) runs on every request, refreshes
  the Supabase session cookie via `@supabase/ssr`'s `createServerClient`,
  and redirects unauthenticated requests to `/dashboard`, `/operator`,
  `/remote`, `/broadcast`, `/display-manager`, or the cue sheet editor to
  `/login`. This is a UX nicety (fast, no round trip to the actual data),
  not the security boundary.
- **`lib/server/require-auth.ts`** is the actual boundary: every mutating
  API route calls it first, and it calls `supabase.auth.getUser()` — a real
  round trip that re-validates the session against Supabase rather than
  just trusting whatever's in the cookie — before allowing the write.
- **The four TV displays** (`/general`, `/av`, `/green-room`, `/presenter`)
  are public routes gated a different way: `lib/server/verify-display-access.ts`
  allows a request through if there's either a real operator session *or*
  a `?token=` that resolves (`lib/server/share-links.ts`) to a non-expired,
  non-revoked row in `share_links`. Each display's `page.tsx` is a thin
  Server Component that runs this check and renders a specific "this link
  is no longer valid" state (`components/auth/link-invalid.tsx`) on
  failure, wrapping the actual display UI (`*-display-client.tsx`,
  unchanged from before this existed) only on success.
- **Share links** (`share_links` table) are the no-login path an operator
  hands out via QR/URL from `/dashboard`. The token is an opaque, random
  256-bit value looked up row-by-row — deliberately not a stateless signed
  URL, so revoking one link (a column flip to `revoked_at`) can't be
  achieved any other way than actually invalidating that exact link, and
  can't accidentally invalidate any other link the way rotating a shared
  signing key would.
- Reads (public `select` on `sessions`/`programs`/`live_state`) are open to
  anyone via Supabase's Row Level Security policies — the public TV/Display
  Engine surfaces need this regardless of the auth model above; a no-login
  display was never a data-security boundary, only a routing one. Writes
  have no public RLS policy at all; every write goes through an API route
  using the Supabase `service_role` key (`lib/supabase/server.ts`), which
  bypasses RLS and is never shipped to the client. `share_links` itself
  follows the same pattern — zero RLS policies, resolved only through
  `lib/server/share-links.ts` using the service-role client.
- `AuthProvider` (`components/auth/auth-context.tsx`) tracks session status
  client-side via Supabase's `onAuthStateChange` listener — this drives the
  operator UI (the "Lock"/log-out button, command palette gating), not
  access control; `useAuth().lock()` calls `POST /api/auth/logout` (which
  calls `supabase.auth.signOut()` server-side, clearing the real session
  cookie) before redirecting to `/login`.

## Operator activity log

A short, reverse-chronological list of the last ~20 operator actions
(`components/operator/activity-log.tsx`, backed by the `activity_log`
table) shown on the Operator dashboard — not analytics or historical
reporting (`docs/PRD.md`'s non-goals still hold), just enough that a
mid-show stage-manager handoff doesn't lose context. Populated
server-side, as a side effect of every successful `app/api/live/route.ts`
mutation.

## Display Engine

The four public display surfaces (AV/Green Room/General/Presenter) plus
Broadcast Center and Display Manager are a real-time subsystem
(`lib/display-engine/`, `components/display-engine/`, `app/{av,green-room,
general,presenter}`, `app/(operator)/broadcast`,
`app/(operator)/display-manager`) — see `docs/DISPLAY_ENGINE.md` for its
own design doc. It reads the same `useEventStore()`/`useSessions()` this
document describes for core show data, and now *also* syncs its own state
(display registry, timer, Hold, Broadcasts, Speaker Ready) via Supabase —
`display_state`/`display_registry`/`display_broadcasts` tables, the exact
same fetch + `postgres_changes` Realtime + service-role-API-route pattern
used everywhere else in this document. Only Profiles/Groups/Broadcast
templates/favorites/drafts (operator UI configuration, not live show
state) stay on a separate, deliberately local-only transport
(`BroadcastChannel`, same-browser) — see `docs/DISPLAY_ENGINE.md`'s
"Real-time transport" section for exactly which state lives where and why.
