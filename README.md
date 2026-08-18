# KramFlow

**Order in motion.** A live event operating system for running multi-day, multi-session programs — built for stage managers, AV operators, green rooms, and performers, across Smart TVs, desktop, and mobile.

> क्रम (*Krama*) — sequence, order, progression, flow.

KramFlow answers exactly two questions, everywhere it's displayed: **what's happening now, and what happens next.** No spreadsheets, no dashboards full of charts — just the run of show, live, on whatever screen you're looking at.

---

## Overview

Live events run on a spreadsheet that gets shouted across a green room. KramFlow replaces that with four purpose-built surfaces reading from one shared, real-time program state:

- **Operator Dashboard** — a desktop control room for the person running the show
- **Operator Remote** — a one-handed mobile controller for walking backstage
- **Green Room Display** — a TV performers glance at while getting ready
- **AV Waiting Room Display** — a TV showing technical requirements for what's next

All four stay in sync. Advance the program from a phone backstage, and every TV in the building updates within about a second.

## Features

- **Real cue-sheet-driven data** — the actual event program (`data/cue-sheet.xlsx`) is parsed at build time into typed, normalized sessions. No manual data entry, no generic import UI to fight with.
- **Session-aware control** — the event spans multiple days and sessions; the operator switches between them, and each session remembers its own progress independently.
- **Next / Previous / Jump to Item** — full control over what's live, with input validation on jump targets.
- **Pause / Hold** — freezes the countdown across every connected display in lockstep, and resumes exactly where it left off (no time lost or gained).
- **Live alerts** — post a message with a severity level; it appears instantly on every TV and the operator's own screen.
- **Editable stage notes** — pre-filled from the cue sheet, editable live without touching the source file.
- **Four dedicated interfaces, not one responsive page** — TV, desktop, and mobile each get a layout designed for how that surface is actually used.
- **Real per-operator accounts (Supabase Auth)** — `/dashboard`, `/operator`, `/remote`, and every other control surface require a signed-in session; unauthenticated visitors are redirected to `/login`.
- **Share Display Link + QR** — from `/dashboard`, an operator generates an unguessable, revocable link/QR tied to the event. Opening it (no login) lands on `/screens`, a no-login screen picker (General/AV/Green Room/Presenter); picking one opens that display, live-synced, strictly read-only, and instantly killable from the dashboard's Revoke button.
- **Dark mode only, TV-legible typography** — designed to be read from 5–15 feet away on a 1920×1080 display, and to feel calm rather than like an admin panel.

## Display Engine (preview, this branch)

This branch (`feature/kramflow-display-engine`) adds a new, additive real-time display subsystem — the foundation for a Presenter Confidence Monitor plus next-generation Green Room, AV, Lobby, and Volunteer displays, a Broadcast Center, and a Display Manager. It does not modify any existing route, component, or data model; the only touched file in the entire diff is `app/page.tsx` (an additive, flag-gated launcher section).

- **Presenter Display** (`/displays/presenter`) — 6 modes (Countdown, Count-up, Session, Clock, Minimal, Program), auto-follows the Operator Dashboard with manual override, Hold Mode, keyboard shortcuts, fullscreen + wake lock.
- **Green Room / AV / Lobby / Volunteer displays** (`/displays/*`) — new routes, distinct from and coexisting with the existing `/green-room` and `/av`, all reading the same shared program/session state.
- **Broadcast Center** (`/e/[eventId]/broadcast`) — targeted messaging (all/type/display/group) with emergency override, scheduling, templates, and history. Gated by real per-operator auth, scoped to the event's owner.
- **Display Manager** (`/e/[eventId]/display-manager`) — live registry of connected displays with status/latency, remote commands (fullscreen, test message, reload), live preview, and screenshot capture. Gated the same way.

Everything above is invisible from the launcher until this flag is set at build time:

```bash
NEXT_PUBLIC_DISPLAY_ENGINE_ENABLED=1 npm run build
```

The routes themselves are always reachable directly by URL regardless of the flag. Full architecture, transport design (BroadcastChannel by default, optional WebSocket relay for cross-device sync), and every simplification/limitation found during testing: [`docs/DISPLAY_ENGINE.md`](docs/DISPLAY_ENGINE.md).

## Screenshots

_Coming soon — screenshots of the Operator Dashboard, Remote, Green Room, and AV displays will go here._

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| UI | [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Motion | [Framer Motion](https://www.framer.com/motion/) |
| Icons | [Lucide](https://lucide.dev) |
| Cue sheet parsing | [SheetJS (`xlsx`)](https://sheetjs.com) — build-time only, never shipped to the client |
| State sync | `localStorage` + `BroadcastChannel` (interim — see [Architecture](#architecture)); Supabase Realtime for `live_state`/`display_state`/share links |
| Auth | [Supabase Auth](https://supabase.com/docs/guides/auth) — real per-operator accounts (see [Security](#security)) |
| Deployment | [Vercel](https://vercel.com) |

## Installation

Requires Node.js ≥20.9 and npm.

```bash
git clone https://github.com/deep8904/kramflow.git
cd kramflow
npm install
```

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Anonymous visitors see a minimal landing page with a Log In link; signing up (`/signup`) or logging in (`/login`) lands you on `/dashboard`, the real starting point:

- `/dashboard` — operator home base: event summary, quick links, and Share Display Link (generate/revoke link + QR)
- `/operator` — desktop control room (requires login)
- `/remote` — mobile controller (requires login)
- `/general`, `/av`, `/green-room`, `/presenter` — TV displays; reachable directly when logged in, or via a Share Display Link/QR (no login) through `/screens`

See [Security](#security) for exactly what's gated vs. public.

## Development

`npm run dev` automatically regenerates `lib/generated/cuesheet.json` from `data/cue-sheet.xlsx` before starting (via the `predev` script), so the app always reflects the bundled cue sheet. If you edit the source spreadsheet, just restart dev — no manual rebuild step.

To regenerate the parsed data without starting the dev server:

```bash
npm run cuesheet:build
```

Useful things to know before making changes:

- **Read `docs/DATA_MODEL.md` first** if you're touching the parser (`scripts/build-cuesheet.mjs`) — it documents the exact column mapping and the quirks of the source file.
- **Read `docs/DESIGN_SYSTEM.md`** before touching layout — each of the four surfaces has its own deliberate layout logic; "just shrink the desktop version" is explicitly the wrong move for mobile/TV.
- State flows through `lib/store.tsx`'s `useEventStore()` hook exclusively — no component reads `localStorage` directly.

## Folder Structure

```text
kramflow/
├── app/
│   ├── (operator)/
│   │   ├── layout.tsx            — wraps operator routes in AuthProvider (access itself is gated by proxy.ts)
│   │   ├── dashboard/page.tsx    — post-login landing: event summary, quick links, Share Display Link
│   │   ├── operator/page.tsx     — desktop control room
│   │   └── remote/page.tsx       — one-handed mobile controller
│   ├── login/, signup/           — real auth forms (Supabase Auth)
│   ├── screens/page.tsx          — no-login screen picker a Share Display Link opens
│   ├── general/, av/, green-room/, presenter/
│   │   ├── page.tsx              — server-side access gate (session OR valid share-link token)
│   │   └── *-display-client.tsx  — the actual TV display, unchanged, public-facing
│   ├── api/auth/                 — signup/login/logout route handlers
│   ├── api/share-links/          — create/list/revoke share links
│   ├── layout.tsx / page.tsx     — root layout + minimal landing page
│   └── globals.css               — design tokens, dark theme
├── proxy.ts                      — Next 16's middleware.ts equivalent; route-level auth redirects
├── components/
│   ├── auth/                     — session auth context, "link no longer valid" state
│   ├── dashboard/                — Share Display Link panel, QR code
│   ├── operator/                 — desktop dashboard building blocks
│   ├── remote/                   — mobile-only components
│   ├── tv/                       — shared TV display primitives
│   └── ui/                       — generic button/input/card/badge
├── lib/
│   ├── store.tsx                 — live state (sync, not reference data)
│   ├── types.ts                  — Program/Session/LiveState + selectors
│   ├── server/require-auth.ts    — Supabase-session check every write API route calls
│   ├── server/share-links.ts     — share-link token generation + resolution
│   ├── server/verify-display-access.ts — the four display pages' access gate
│   ├── supabase/client.ts        — browser client (data + auth)
│   ├── supabase/server.ts        — request-scoped SSR client + service-role admin client
│   └── use-countdown.ts          — hold-aware countdown hook
├── data/cue-sheet.xlsx           — the real source of truth for program data
├── scripts/build-cuesheet.mjs    — parses the xlsx into normalized JSON
└── docs/                         — architecture, design system, deployment, etc.
```

## Architecture

Two data layers, deliberately kept separate:

1. **Reference data** — static, generated at build time from `data/cue-sheet.xlsx`, never mutated at runtime. ~250 cues across 6 sessions.
2. **Live state** — small and mutable: which session is active, current position per session, hold state, the active alert, and any note overrides. This is what actually syncs between displays.

Sync currently runs over `localStorage` + `BroadcastChannel` — a stand-in for Supabase Realtime, which is the next planned step (see `docs/ARCHITECTURE.md` and [Roadmap](#roadmap)). Every component reaches this state through one hook (`useEventStore()`), so swapping the sync backend is a one-file change.

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL — also what the Supabase Auth client (signup/login/logout) talks to. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key — safe to expose; Auth has its own access controls independent of table RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only, used by every write API route. Bypasses RLS — never expose to the client. |

No separate auth secret: real authentication (signup/login/logout, password hashing, session expiry) runs on Supabase Auth, not a custom cookie signer. In the Supabase dashboard, enable **Authentication → Providers → Email**, and decide under **Authentication → Settings** whether operator signups require email confirmation before they can log in.

Copy `.env.example` to `.env.local` and set a real value before deploying:

```bash
cp .env.example .env.local
```

## Security

Real per-operator accounts via **Supabase Auth** — signup, login, logout, hashed passwords, and session expiry are all handled by Supabase's GoTrue service, not custom code. `proxy.ts` (project root) redirects any unauthenticated request to `/dashboard`, `/operator`, `/remote`, `/broadcast`, `/display-manager`, or the cue sheet editor straight to `/login`. Every mutating API route calls `lib/server/require-auth.ts`, which re-verifies the session server-side (`supabase.auth.getUser()`) — this is the actual enforcement layer, not just the redirect.

**Share Display Link** is the no-login path for the four TV displays (General/AV/Green Room/Presenter), replacing the old "just public, no gate at all" model:

- From `/dashboard`, an operator generates a link — an opaque, cryptographically random 256-bit token (`lib/server/share-links.ts`), *not* a stateless signed URL — with a chosen expiry (1/3/7/30 days).
- The link opens `/screens` (no login), a picker for the four display types; picking one opens that display with the token carried through.
- Each of `/general`, `/av`, `/green-room`, `/presenter` is itself gated server-side (`lib/server/verify-display-access.ts`): it renders only for a real operator session *or* a token that resolves to a non-expired, non-revoked row in `share_links` — checked fresh on every request, not cached client-side.
- **Revoke is instant and one-click**, from the dashboard — a deliberate improvement over a stateless signed-URL scheme (where killing one leaked link means rotating the key for every other link too). A revoked or expired link shows a specific "this link is no longer valid" page, never a blank screen or generic error.
- Display pages are read-only by construction, not just in the UI: they only ever read `sessions`/`programs`/`live_state`/`display_state` (public-read tables per `supabase/schema.sql`), and every route capable of writing anything requires a real operator session regardless of what's in the URL.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server (auto-regenerates cue sheet data first) |
| `npm run build` | Production build (auto-regenerates cue sheet data first) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run cuesheet:build` | Regenerate `lib/generated/cuesheet.json` from `data/cue-sheet.xlsx` without starting anything |

## Deployment

Deploys to Vercel with zero configuration beyond the environment variable above — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full checklist, including what a production-hardened auth setup would add.

## Brand Identity

KramFlow's name and meaning are final; the visual identity (logo, icon set, favicons) is **not yet implemented** — this codebase currently runs on placeholder/inherited assets. See [`docs/BRAND_GUIDELINES.md`](docs/BRAND_GUIDELINES.md) for the naming rationale and what's pending.

## Design System

Four surfaces, four layout strategies — TV is full-bleed with hero typography and zero controls, the desktop dashboard is a dense three-column control room, and the mobile remote is a purpose-built one-handed controller, not a shrunk dashboard. Full rationale, type scale, spacing, and color tokens: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for setup, conventions, and how changes are reviewed. In short: `npm run lint`, `npx tsc --noEmit`, and `npm run build` should all pass before opening a PR.

## Roadmap

```text
MVP (this codebase)
  ↓
Supabase Realtime — replace localStorage/BroadcastChannel sync ✓
  ↓
Real auth + multi-tenant events — any operator can sign up and run their own event(s) ✓
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

- Automated visual regression tests across the responsive breakpoints
- Real brand assets across every touchpoint listed in `docs/BRAND_GUIDELINES.md`
- Rate limiting / abuse prevention on event creation (an authenticated operator can currently create unlimited events)

## License

Not yet licensed for public/open-source use. All rights reserved pending a license decision.

## Credits

Built for BAPS Phoenix's Satsang Shibir 2026. Cue sheet data, program structure, and event requirements courtesy of the event's production team.
