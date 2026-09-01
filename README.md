# KramFlow

**Order in motion.** A real-time, multi-tenant live-event operating system for running multi-day, multi-session programs — built for stage managers, AV operators, green rooms, and performers, across Smart TVs, desktop, and mobile.

> क्रम (*Krama*) — sequence, order, progression, flow.

KramFlow answers exactly two questions, everywhere it's displayed: **what's happening now, and what happens next.** No spreadsheets, no dashboards full of charts — just the run of show, live, on whatever screen you're looking at.

---

## Overview

Live events run on a spreadsheet that gets shouted across a green room. KramFlow replaces that with one shared, real-time program state (Supabase) driving every surface an event needs:

- **Dashboard** (`/dashboard`) — an operator's own event list: create, open, or delete an event.
- **Operator Console** (`/e/[eventId]/operator`) — the desktop control room: Next/Previous/Hold/Jump, live notes, alerts, sequencing lock.
- **Cue Sheet** (`/e/[eventId]/operator/cue-sheet`) — the editable program: drag-and-drop reorder, bulk edit, Excel import/export, print view.
- **Remote** (`/e/[eventId]/remote`) — a one-handed mobile controller for walking backstage.
- **Displays** (`/e/[eventId]/displays`) — the live registry of connected TV displays: status, latency, remote reload/test-message/fullscreen commands, screenshot capture.
- **Broadcast Center** (`/e/[eventId]/broadcast`) — targeted alerts and emergency overrides (all displays / by type / by group), scheduling, history.
- **Rehearsal Mode** (`/e/[eventId]/rehearsal`) — practice a show with zero risk to real displays.
- **Settings** (`/e/[eventId]/settings`) — event details, auditoriums, and the collaborator roster (editor/viewer roles).
- **Four public TV displays** — General, AV Waiting Room, Green Room, Presenter (`/general`, `/av`, `/green-room`, `/presenter`) — no-login, read-only, reachable via a revocable Share Link or an operator's own session.

Every event is owned by the operator who created it. Any signed-up operator can create their own event(s) and invite collaborators (editor or viewer) to their own — this is a real multi-tenant system, not a single shared event.

## Features

- **Real cue-sheet-driven data, live** — upload an Excel cue sheet (`app/api/cue-sheet/upload`) or build one from scratch in the Cue Sheet editor. Parsing (`lib/parse-cuesheet.ts`) is isomorphic — the same code path backs both the runtime upload route and the one-time seed scripts.
- **Session-aware control** — an event spans multiple days and sessions; the operator switches between them, and each session remembers its own progress independently.
- **Next / Previous / Jump to Item** — full control over what's live, with server-side bounds checking on jump targets and an optimistic-concurrency version check so two near-simultaneous writes (a fast double-tap, or Operator + Remote firing together) can't silently clobber each other.
- **Pause / Hold** — freezes the countdown across every connected display in lockstep, and resumes exactly where it left off.
- **Live alerts & Broadcast Center** — post a message with a severity level, or push a targeted/emergency broadcast to every display, a type, or a group — scheduled or immediate, with history and acknowledgement tracking.
- **Editable stage notes** — pre-filled from the cue sheet, editable live without touching the source file.
- **Sequencing lock** — an opt-in "Take Control" claim (server-enforced, auto-released if the controlling tab goes stale) so two open operator tabs can't silently fight over the same show.
- **Real per-operator accounts (Supabase Auth)** — every operator surface requires a signed-in session, enforced both by `proxy.ts` (redirect) and server-side on every mutating API route (the actual authorization boundary, not just the redirect).
- **Role-based collaborator access** — an event owner can invite collaborators as editor (can edit the cue sheet) or viewer (read-only), scoped per event via Postgres RLS, not just hidden in the UI.
- **Share Display Link + QR** — a revocable, expiring, cryptographically random token per event opens the four TV displays with no login — instantly killable from Settings.
- **Database-backed rate limiting** — login/signup lockout state lives in Postgres (`check_and_record_rate_limit`), so it survives restarts and is shared across serverless instances, not reset by every cold start.
- **Dark mode only, TV-legible typography** — designed to be read from 5–15 feet away on a 1920×1080 display, and to feel calm rather than like an admin panel.

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
