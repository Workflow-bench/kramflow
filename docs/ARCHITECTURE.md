# Architecture

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (Postgres, Auth, Realtime) - the data, auth, and live-sync backbone, see below
- Vercel (hosting)
- Lucide Icons
- `xlsx`, used both by the one-time seed script and the runtime Excel upload route
- `zod`, shared validation for the cue-sheet schema

## Route groups

```text
app/
├── av/, green-room/, general/, presenter/   - the four display routes; no login with a valid share token
├── screens/                    - screen picker a share link or TV code opens
├── tv/                         - no-login TV onboarding: enter a 6-digit code
├── login/, signup/, set-password/, invite/[token]/   - auth and collaborator invites
├── (operator)/dashboard/       - the signed-in operator's event list
├── e/[eventId]/                - every per-event operator surface (session required)
│   ├── operator/               - Operator Console (desktop control room)
│   ├── operator/cue-sheet/     - Cue Sheet editor: import/export, reorder, bulk edit, print
│   ├── remote/                 - one-handed mobile controller, not a resized console
│   ├── broadcast/              - Broadcast Center
│   ├── displays/               - Display Manager: registry, previews, share links
│   ├── rehearsal/              - Rehearsal mode (local state, never reaches real displays)
│   └── settings/               - event details, auditoriums, collaborators, API credentials
├── api/
│   ├── live/route.ts           — every live-state mutation (Next/Previous/Hold/Alert/…)
│   ├── display-view/route.ts   - read-only route the four displays poll
│   ├── display-engine/*        - registry/hold/timer/speaker-ready/broadcasts (see docs/DISPLAY_ENGINE.md)
│   ├── share-links/, tv/connect/ - share links and the TV-code lookup
│   ├── cue-sheet/{upload,export}/ - Excel import and export
│   ├── sessions/, programs/, partitions/, auditoriums/ - reference-data writes
│   ├── events/, auth/, invites/ - events, Supabase Auth, collaborator invites
│   └── v1/events/[eventId]/*   - scoped external HTTP API (docs/EXTERNAL_API.md)
└── layout.tsx
```

The four display surfaces plus Operator Console and Remote are the core
screens. See `docs/DISPLAY_ENGINE.md`'s "History" section for how the
displays consolidated down from two generations of AV/Green Room plus a
Volunteer Board that was dropped.

## Two data layers, on purpose

1. **Reference data — dynamic, Supabase-backed, editable at runtime.**
   `sessions` and `programs` tables (`supabase/schema.sql`). Populated
   initially by `npm run seed` (parses `data/cue-sheet.xlsx` via
   `lib/parse-cuesheet.ts`), and from then on editable live: an operator
   can re-upload a `.xlsx` (`app/api/cue-sheet/upload/route.ts`) or add/edit
   individual items through a form (`app/e/[eventId]/operator/cue-sheet`,
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
2. Surfaces pick the change up by one of two paths, depending on who is
   reading:
   - **Operator-side surfaces** (Console, Remote, Cue Sheet) subscribe to
     Supabase Realtime on the `live_state` row (and, for reference data, on
     `sessions`/`programs`) through `useEventStore()`.
   - **The four display pages** (`/general`, `/av`, `/green-room`,
     `/presenter`) do not use Realtime for show state. They poll the
     read-only `GET /api/display-view` route about every 2.5 seconds
     (`lib/use-display-view.ts`), whether they were opened with a share
     token or as a signed-in preview. A share-link viewer has no
     `auth.uid()` for Realtime and row-level security to scope to, so the
     route verifies the token server-side and reads on their behalf. A
     change therefore reaches a display within one poll interval, not
     instantly.

   `useEventStore()`'s public shape (`{state, start, next, ...}`) is
   unchanged from the pre-Supabase version on purpose, so no consuming
   component needed to change for this swap, including the Display Engine
   (`lib/display-engine/*`), which reads this same hook.
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
  and redirects unauthenticated requests to `/dashboard` or anything under
  `/e/` (every per-event operator surface) to `/login`. This is a UX
  nicety (fast, no round trip to the actual data), not the security
  boundary.
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
- Reads by a signed-in client are scoped by Row Level Security to events
  that user owns or collaborates on. A no-login display has no
  `auth.uid()`, so it never queries tables directly: it reads through
  `GET /api/display-view`, which verifies the share token (or the
  operator's session) and then reads that one event with the service-role
  client. Writes have no public RLS policy at all; every write goes through an API route
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

The four display surfaces (AV/Green Room/General/Presenter) plus Broadcast
Center and the Display Manager make up the Display Engine
(`lib/display-engine/`, `components/display-engine/`, `app/{av,green-room,
general,presenter}`, `app/e/[eventId]/broadcast`,
`app/e/[eventId]/displays`). See `docs/DISPLAY_ENGINE.md` for its own
design doc. It reads the same `useEventStore()`/`useSessions()` this
document describes for core show data, and also keeps its own state
(display registry, timer, Hold, Broadcasts, Speaker Ready) in Supabase:
the `display_state`, `display_registry`, `display_broadcasts` and
`display_type_state` tables.

How that state reaches a surface depends on who is reading:

- A signed-in operator's own engine instance fetches it and then follows
  `postgres_changes` over Realtime.
- A share-link display has no `auth.uid()`, so its engine instance polls
  `GET /api/display-view` about every 2.5 seconds instead.

Writes always go through `app/api/display-engine/*` routes. Only Groups,
Broadcast templates, favorites and drafts (operator UI configuration, not
live show state) stay in the browser, in `localStorage`, synced between
tabs of the same browser with `BroadcastChannel`. Display profiles are
stored per event in `display_profiles`. See `docs/DISPLAY_ENGINE.md`'s
"Real-time transport" section for exactly which state lives where.
