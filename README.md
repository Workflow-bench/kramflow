# KramFlow

**Order in motion.** A real-time, multi-tenant live-event operating system for running multi-day, multi-session programs — built for stage managers, AV operators, green rooms, and performers, across Smart TVs, desktop, and mobile.

> क्रम (*Krama*) — sequence, order, progression, flow.

KramFlow answers exactly two questions, everywhere it's displayed: **what's happening now, and what happens next.** No spreadsheets, no dashboards full of charts — just the run of show, live, on whatever screen you're looking at.

---

## Overview

Live events run on a spreadsheet that gets shouted across a green room. KramFlow replaces that with one shared, real-time program state in Supabase, then projects that state into the right interface for each person in the venue: stage managers get a command console, backstage teams get a mobile remote, AV teams get timing and technical cues, green rooms get speaker readiness, presenters get confidence-monitor context, and public displays get a clean "now / next" view.

Phase 1 is a complete multi-tenant event operating system:

- Operators can sign up, log in, create events, and manage only events they own or have been invited to.
- Each event can span multiple days, sessions, partitions, auditoriums, and cue-sheet items.
- Owners can invite collaborators as `viewer` or `editor`; owners retain event, collaborator, display, integration, and live-control authority.
- The cue sheet can be uploaded from Excel, edited directly, exported, printed, reordered, bulk-edited, and used as the source of live display state.
- Live show state is synchronized through Supabase for authenticated operator surfaces and served through token-verified polling for public display surfaces.
- Public display access uses revocable share links rather than accounts, so a TV can be opened with a QR code while still preserving event isolation.
- Display Manager, Broadcast Center, Rehearsal Mode, integration tokens, and activity logs are first-class Phase 1 features, not placeholders.

The app is deliberately not a generic dashboard. It is built around the live-event trust boundary: an event's owner, collaborators, share-link viewers, connected displays, and integration clients can each do different things, and every route is scoped back to a specific event.

## Features

### Operator Workspace

- **Landing page** (`/`) — public product entry with login/signup paths.
- **Authentication** (`/login`, `/signup`) — Supabase Auth email/password signup, login, logout, resend confirmation, generic credential errors, and database-backed rate limiting.
- **Dashboard** (`/dashboard`) — the signed-in operator's event list, event creation, event deletion, empty-state guidance, help menu, and launch points into each event.
- **Event shell** (`/e/[eventId]`) — shared event layout that verifies the signed-in user is the owner or an accepted collaborator before rendering any operator surface.

### Event Management

- **Event details** — event name, date, venue, timezone, and configurable event metadata.
- **Auditoriums** — per-event auditorium setup used by cue-sheet items and production fields.
- **Collaborators** — invite by email, assign `viewer` or `editor`, list accepted and pending collaborators, hide invite tokens from non-owners, and accept invite links from signed-in users.
- **Roles** — `viewer` can read event surfaces, `editor` can mutate cue-sheet content, and `owner` can manage settings, displays, broadcasts, collaborators, integrations, and live control.
- **Plan limits** — per-plan event limits are enforced server-side when creating events.

### Cue Sheet & Program Management

- **Excel import** — upload a cue sheet, parse sessions/partitions/program rows, validate data, and replace the selected event's reference data.
- **Cue Sheet editor** (`/e/[eventId]/operator/cue-sheet`) — view sessions, partitions, and program items in editable form.
- **Program item CRUD** — create, update, and delete cue-sheet items with validation for names, durations, cue fields, status, color tags, auditorium, session, and partition.
- **Drag-and-drop reorder** — move items within and across partitions while preserving sort order and optimistic item versions.
- **Bulk edit** — update selected item fields such as status, color, presenter, production notes, curtains, and video mode.
- **Bulk move** — move selected items to another section while enforcing event and partition ownership.
- **Session management** — create, rename, reorder, and delete sessions; deleting a live session clears the active-session pointer first.
- **Partition management** — set section start times used by computed timing cascades.
- **Export & print** — export cue-sheet data and render print/report-oriented cue-sheet pages.
- **Computed timing** — derive scheduled item start/end times from section anchors and durations without requiring every row to store fixed times.

### Live Operator Console

- **Operator Console** (`/e/[eventId]/operator`) — desktop control room for running the show.
- **Session selection** — switch the active session for the event.
- **Start / Next / Previous / Jump / Finish** — move through the active session with server-side bounds, event-scoped resource checks, and optimistic live-state versioning.
- **Hold / pause / resume** — pause the live countdown, resume without losing elapsed-time accuracy, and surface hold state to displays.
- **Timer correction** — adjust the live timer forward or backward while clamping impossible future starts.
- **Live alerts** — set and dismiss event-wide alerts.
- **Live notes** — override cue-sheet notes during the show without editing the source cue sheet.
- **Sequencing lock** — claim, renew, release, or force control; stale claims expire automatically so a closed tab cannot permanently lock the show.
- **Activity feed** — record meaningful operator actions such as program changes, live control, display commands, broadcasts, and collaborator actions.

### Mobile Remote

- **Remote control** (`/e/[eventId]/remote`) — mobile-optimized live-control surface for backstage use.
- **One-handed operation** — exposes the essential live controls without the full desktop console layout.
- **Shared live state** — uses the same event-scoped live mutation route as the Operator Console, so mobile and desktop controls cannot diverge.

### Display Engine

- **Display Manager** (`/e/[eventId]/displays`) — registry of connected displays with names, types, rooms, status, latency, profile assignments, and pending commands.
- **Display registration** — public display pages heartbeat into an event-scoped registry using either a share-link token or an authorized event preview.
- **Remote display commands** — owners can send reload, test-message, and fullscreen-oriented commands to connected displays.
- **Display profiles** — create, edit, read, assign, and delete custom display profiles for event-specific screen layouts.
- **Custom display** (`/custom`) — render a configured custom profile for a share-link or operator preview.
- **Time sync** — public display surfaces can measure server/client clock offset and latency.

### Public Display Surfaces

- **Screens picker** (`/screens`) — no-login entry opened from a share link; lets a TV choose which display type to show.
- **General display** (`/general`) — audience-facing now/next display.
- **AV display** (`/av`) — AV waiting-room/technical display.
- **Green Room display** (`/green-room`) — backstage speaker-readiness display.
- **Presenter display** (`/presenter`) — confidence-monitor display with presenter-focused state.
- **Token or session access** — each display can be reached by a valid share-link token or by an authenticated operator previewing their own event.
- **Event-scoped polling** — anonymous displays poll server routes that resolve the token to one event before reading service-role data.
- **Display-type state** — hold and timer overrides are scoped by `(event_id, display_type)` so one display type cannot accidentally take over all display types.
- **Speaker ready** — green-room readiness state is written into display state and reflected on live display surfaces.

### Broadcast Center

- **Broadcast Center** (`/e/[eventId]/broadcast`) — send operational messages and emergency display overrides.
- **Immediate broadcasts** — publish messages to all displays, a display type, or a selected group.
- **Scheduled broadcasts** — queue future broadcasts and promote them when due.
- **Dismiss / acknowledge** — display clients can dismiss or acknowledge broadcasts from public display routes.
- **Broadcast history** — owners can see prior broadcast activity and scheduled messages.
- **Severity and targeting** — broadcasts include severity, target type, and display routing metadata.

### Rehearsal Mode

- **Rehearsal surface** (`/e/[eventId]/rehearsal`) — practice live-show progression without changing production display state.
- **Local rehearsal state** — lets operators test timing and sequence decisions safely before showtime.
- **Reset rehearsal progress** — clear rehearsal-only state without disturbing the real event run.

### Share Links & QR

- **Share-link creation** — owners create expiring, revocable display links backed by 256-bit random opaque tokens.
- **QR rendering** — dashboard/settings surfaces can show QR codes for display setup.
- **Instant revoke** — revoking the database row kills that one link without rotating any global signing secret.
- **Last-used tracking** — share-link use updates metadata so operators can see whether a link is active.

### Integration API

- **Integration credentials** — owners create and revoke per-event machine credentials.
- **Token hashing** — only token hashes are stored; raw tokens are returned once at creation.
- **Scoped API access** — credentials carry scopes such as `state:read` and `live:control`.
- **State endpoint** (`/api/v1/events/[eventId]/state`) — integration clients can read event live state with a valid bearer token.
- **Action endpoint** (`/api/v1/events/[eventId]/actions/[action]`) — integration clients can trigger supported live actions through the same live-action engine as the UI.

### Security, Isolation, And Reliability

- **Real per-operator accounts** — Supabase Auth owns password hashing, sessions, confirmation, and logout.
- **Server-side authorization** — mutating routes use `requireAuth`, `requireAuthUser`, `requireEventAccess`, `verifyDisplayAccess`, or integration-token checks before touching service-role data.
- **Multi-tenant event isolation** — event owners, collaborators, share links, displays, integrations, sessions, partitions, programs, broadcasts, and profiles are all scoped to an event.
- **Row Level Security backstop** — Postgres RLS protects browser/anon access; service-role routes resolve and validate event scope before bypassing RLS.
- **Optimistic concurrency** — live state and program item updates use version checks to avoid silent overwrites from near-simultaneous users.
- **Database-backed rate limits** — login and signup throttling state lives in Postgres and works across serverless instances.
- **Production-oriented UI** — dark-only design, large TV-readable typography, mobile-specific remote layout, and dense desktop operator surfaces.

## Screenshots

_Coming soon — screenshots of the Operator Console, Cue Sheet, Remote, and the four TV displays will go here._

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Motion | [Framer Motion](https://www.framer.com/motion/) |
| Icons | [Lucide](https://lucide.dev) |
| Database, Auth, Realtime | [Supabase](https://supabase.com) — Postgres + RLS, Supabase Auth, Realtime subscriptions |
| Cue sheet parsing | [SheetJS (`xlsx`)](https://sheetjs.com) — runtime upload, isomorphic parser |
| Unit tests | [Vitest](https://vitest.dev) |
| End-to-end tests | [Playwright](https://playwright.dev) — real dev server, real Supabase project, no mocking |
| CI | GitHub Actions — typecheck, lint, build, unit tests, E2E tests on every push/PR |
| Deployment | [Vercel](https://vercel.com) |

## Installation

Requires Node.js ≥20.9 and npm.

```bash
git clone https://github.com/Workflow-bench/kramflow.git
cd kramflow
npm install
```

## Getting Started

1. Set up a Supabase project and run every file in `supabase/schema.sql` then `supabase/migrations/` in order — see [Environment Variables](#environment-variables) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full setup.
2. Copy `.env.example` to `.env.local` and fill in the three Supabase values.
3. `npm run dev`, open [http://localhost:3000](http://localhost:3000).

Anonymous visitors see a minimal landing page with a Log In link. Signing up (`/signup`) or logging in (`/login`) lands you on `/dashboard` — create an event, and every other route above is reachable from there via `/e/<eventId>/...`.

See [Security](#security) for exactly what's gated vs. public.

## Development

There is no build-time data-generation step — the cue sheet lives in Supabase and is populated via `npm run seed` (once, against a fresh project) or at runtime through Excel upload / the item form.

Useful things to know before making changes:

- **Read `docs/DATA_MODEL.md` first** if you're touching the parser (`lib/parse-cuesheet.ts`) — it documents the exact column mapping and the quirks of the source file.
- **Read `docs/DESIGN_SYSTEM.md`** before touching layout — each surface (TV, desktop, mobile) has its own deliberate layout logic; "just shrink the desktop version" is explicitly the wrong move for mobile/TV.
- **Read `docs/ARCHITECTURE.md`** before touching the data model or the Display Engine's sync — two data layers (reference vs. live state) and a specific transport design are both deliberate.
- State flows through `lib/store.tsx`'s `useEventStore()` hook (live show state) and `lib/display-engine/store.tsx`'s `useDisplayEngine()` (display/broadcast state) — components don't read Supabase directly.

## Folder Structure

```text
kramflow/
├── app/
│   ├── (operator)/dashboard/     — post-login landing: this operator's event list
│   ├── e/[eventId]/              — every per-event operator surface
│   │   ├── operator/             — desktop control room + cue-sheet editor
│   │   ├── remote/               — one-handed mobile controller
│   │   ├── broadcast/            — Broadcast Center
│   │   ├── displays/             — Display Manager
│   │   ├── rehearsal/            — Rehearsal Mode
│   │   └── settings/             — event details, auditoriums, collaborators
│   ├── login/, signup/           — real auth forms (Supabase Auth)
│   ├── screens/                  — no-login screen picker a Share Link opens
│   ├── general/, av/, green-room/, presenter/  — the four public TV displays
│   ├── api/                      — every write path; see lib/server/ for the guards each route calls
│   ├── layout.tsx / page.tsx     — root layout + landing page
│   └── globals.css               — design tokens, dark theme
├── proxy.ts                      — Next 16's middleware.ts equivalent; route-level auth redirects
├── components/
│   ├── auth/                     — session auth context
│   ├── dashboard/                — event list, Share Link panel, QR code
│   ├── operator/                 — desktop console building blocks
│   ├── remote/                   — mobile-only components
│   ├── display-engine/           — Display Manager, Broadcast Center, display shells
│   ├── forms/                    — cue-sheet item form, event settings panel
│   ├── tv/                       — shared TV display primitives
│   └── ui/                       — generic button/input/card/badge/select
├── lib/
│   ├── store.tsx                 — live show state (Next/Previous/Hold/notes/alerts)
│   ├── display-engine/store.tsx  — display registry + broadcast state
│   ├── types.ts                  — Program/Session/LiveState + selectors
│   ├── parse-cuesheet.ts         — isomorphic Excel parser (upload route + seed scripts)
│   ├── validation/                — zod schemas for programs and per-event custom form config
│   ├── server/                   — require-auth, require-event-access (role-based), rate-limit, share-links
│   └── supabase/                 — browser client, request-scoped SSR client, service-role admin client
├── supabase/
│   ├── schema.sql                — base schema, run once on a fresh project
│   └── migrations/                — everything since, run in order (multi-tenant, RPC fixes, rate limits, ...)
├── scripts/                      — seed.ts, seed-demo.ts, seed-mock.mjs, provision-test-account.mjs
├── e2e/                          — Playwright end-to-end tests
├── data/cue-sheet.xlsx           — the bundled reference cue sheet
└── docs/                         — architecture, design system, deployment, etc.
```

## Architecture

Two data layers, deliberately kept separate:

1. **Reference data** — sessions, partitions, programs. Lives in Supabase, mutated via the Cue Sheet editor or Excel upload, not regenerated at build time.
2. **Live state** — small and mutable: which session is active, current position per session, hold state, the active alert, note overrides, and the sequencing-lock claim. This is what actually syncs between displays, via Supabase Realtime (authenticated operators) or polling (anonymous share-link viewers, who have no `auth.uid()` for Realtime to scope to).

Every component reaches live-show state through `useEventStore()` and display/broadcast state through `useDisplayEngine()` — one hook each, so the sync backend is a contained concern.

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/DISPLAY_ENGINE.md`](docs/DISPLAY_ENGINE.md).

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL — also what the Supabase Auth client (signup/login/logout) talks to. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key — safe to expose; Row Level Security restricts it to read-only on public tables, and Auth has its own access controls independent of that. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only, used by every write API route. Bypasses RLS — never expose to the client. |

No separate auth secret: real authentication (signup/login/logout, password hashing, session expiry) runs on Supabase Auth, not custom code. In the Supabase dashboard, enable **Authentication → Providers → Email**, and decide under **Authentication → Settings** whether operator signups require email confirmation before they can log in.

Copy `.env.example` to `.env.local` and set real values before deploying:

```bash
cp .env.example .env.local
```

## Security

Real per-operator accounts via **Supabase Auth**. `proxy.ts` redirects any unauthenticated request under `/dashboard` or `/e/...` straight to `/login` — but that redirect is defense in depth, not the actual boundary: every mutating API route calls `lib/server/require-auth.ts` or `lib/server/require-event-access.ts`, which re-verify the session server-side (`supabase.auth.getUser()`, not just decoding a cookie) and, for event-scoped routes, the caller's role (viewer/editor/owner) against that specific event. Row Level Security in `supabase/schema.sql` and `supabase/migrations/` is the backstop underneath both — it holds even if a route handler had a bug.

**Share Display Link** is the no-login path for the four TV displays (General/AV/Green Room/Presenter):

- From Settings, an operator generates a link — an opaque, cryptographically random 256-bit token (`lib/server/share-links.ts`), not a stateless signed URL — with a chosen expiry.
- The link opens `/screens` (no login), a picker for the four display types.
- Each display page is gated server-side (`lib/server/verify-display-access.ts`): it renders only for a real operator session that owns the event, or a token that resolves to a non-expired, non-revoked row in `share_links` — checked fresh on every request.
- **Revoke is instant and one-click** — a deliberate improvement over a stateless signed-URL scheme, where killing one leaked link means rotating the key for every other link too.
- Display pages are read-only by construction: every route capable of writing anything requires a real operator session with sufficient role, regardless of what's in the URL.

**Rate limiting**: login and signup attempts are throttled per IP, backed by a Postgres table and RPC (`check_and_record_rate_limit`) rather than in-memory state, so it survives restarts and applies consistently across serverless instances.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, real dev server + real Supabase) |
| `npm run seed` | Load `data/cue-sheet.xlsx` into a fresh project |
| `npx tsx scripts/seed-demo.ts` | Provision 2 demo operator accounts with a full real cue sheet each — see the script's own header |

## Testing & CI

- **Unit tests** (`npm test`) cover the highest-logic-risk modules: cue-sheet parsing, form validation, and the rate limiter.
- **One real end-to-end test** (`npm run test:e2e`, `e2e/auth-golden-path.spec.ts`) drives the actual golden path — signup/login, dashboard, event creation, logout — against a real running dev server and a real Supabase project, not mocks. Needs a provisioned test account first: `node --env-file=.env.local scripts/provision-test-account.mjs` (see `e2e/README.md`).
- **CI** (`.github/workflows/ci.yml`) runs typecheck, lint, build, unit tests, and the E2E test on every push and pull request. `main` is protected — merges require a green check and a pull request, no direct pushes.

## Deployment

Deploys to Vercel with zero configuration beyond the environment variables above — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full checklist, including the exact Supabase migration order and what a further-hardened production setup would still add.

## Brand Identity

KramFlow's name and meaning are final; the visual identity (logo, icon set, favicons) is **not yet implemented** — this codebase currently runs on placeholder/inherited assets. See [`docs/BRAND_GUIDELINES.md`](docs/BRAND_GUIDELINES.md) for the naming rationale and what's pending.

## Design System

Every surface — TV, desktop console, mobile remote — gets a layout strategy purpose-built for how it's actually used, not one responsive page. Full rationale, type scale, spacing, and color tokens: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for setup, conventions, and how changes are reviewed. In short: `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` should all pass before opening a PR — CI enforces this on every PR regardless.

## Roadmap

```text
MVP — single event, localStorage/BroadcastChannel sync ✓
  ↓
Supabase Realtime — replace localStorage/BroadcastChannel sync ✓
  ↓
Real auth + multi-tenant events — any operator can sign up and run their own event(s) ✓
  ↓
Display Engine — Broadcast Center, Display Manager, Rehearsal Mode ✓
  ↓
CI/CD, automated tests, database-backed rate limiting ✓
  ↓
Real brand identity — logo, favicons, PWA icons
  ↓
Generic cue sheet import — any file, not just one event
  ↓
Phone companion for performers · volunteer check-in · QR join
  ↓
Automatic cue timing · analytics
```

Full detail: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Future Improvements

- Real brand assets across every touchpoint listed in `docs/BRAND_GUIDELINES.md`
- Automated visual regression tests across the responsive breakpoints
- A durable audit log beyond the operator activity feed's last-20 window
- Supabase's built-in MFA (TOTP) for operator accounts
- Rate limiting / abuse prevention on event creation beyond the current per-tier event-count cap

## License

Not yet licensed for public/open-source use. All rights reserved pending a license decision.

## Credits

Built for BAPS Phoenix's Satsang Shibir 2026. Cue sheet data, program structure, and event requirements courtesy of the event's production team.
