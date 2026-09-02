# Deployment

## Platform

KramFlow deploys to [Vercel](https://vercel.com) with zero special configuration — it's a standard Next.js App Router project. Connect the GitHub repository and Vercel auto-detects the framework, build command (`npm run build`), and output.

## Before every deploy

Run locally and confirm all three pass:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Reference data (`sessions`/`programs`) is no longer a build artifact — it lives in Supabase and is populated via `npm run seed` (once, against a fresh project) or at runtime via Excel upload / the item form. There is no `predev`/`prebuild` data-generation step anymore; `npm run build` just builds the app.

## Supabase setup (required)

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` once in the project's SQL Editor — creates the base tables (`sessions`, `programs`, `live_state`, `activity_log`, etc.) and adds them to the Realtime publication.
3. Run every file in `supabase/migrations/`, in filename order, in the same SQL Editor — `0001_multitenant.sql` brings the schema up to what the app code actually expects: `events`/`event_collaborators`, event-scoped RLS on every table, and the `p_event_id`-aware RPCs (`delete_program`, `insert_program_into_partition`). `0002_fix_missing_rpcs.sql` fills a gap `0001` missed: `replace_session_programs`, `move_program`, `bulk_move_programs_to_partition`, `bulk_update_programs`, and `swap_program_order` didn't actually exist in the database at all until this file, and the cue-sheet upload route's session upsert needs a `UNIQUE (event_id, id)` constraint this file also adds. `0003_rate_limits.sql` adds the `rate_limit_attempts` table and `check_and_record_rate_limit` RPC that `lib/server/rate-limit.ts` reads/writes through — required for login/signup rate-limiting to work at all (there's no in-memory fallback). `0004_fix_cross_tenant_program_insert.sql` fixes a real cross-tenant data-integrity bug: `insert_program_into_partition` never checked that the session it was inserting into actually belonged to the calling event. `0005_sync_schema_backward_compat_columns.sql` re-applies a handful of `schema.sql` columns (`live_state.version`/`controller_id`/`controller_claimed_at`, `display_state.timer_version`) that were added to `schema.sql` after some projects' initial setup — since this document says to run `schema.sql` only **once**, an already-provisioned project never picks up a column added to it later; this migration is that catch-up step, made explicit instead of relying on someone remembering to re-run `schema.sql` by hand. **All five migration steps are required** — the app does not work against `schema.sql` alone, cue-sheet upload / reorder / bulk-edit / login rate-limiting don't work without `0002`/`0003` even after `0001`, and the entire live-show control surface (Start/Next/Previous/Hold/Finish/jumpTo) doesn't work without `0005` on a project whose `live_state`/`display_state` predate those columns.
4. Run `npm run seed` locally (with the env vars below set in `.env.local`) to load the bundled `data/cue-sheet.xlsx`, or `node --env-file=.env.local scripts/seed-mock.mjs` for a fuller multi-event/multi-role QA dataset — or skip both and upload a cue sheet from the app after first deploy.

## Environment variables

Set in the Vercel project's **Settings → Environment Variables** (and locally in `.env.local`, gitignored — see `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Supabase project URL. Safe to expose to the client — also what the Supabase Auth client talks to. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Supabase anon public key. Safe to expose — Row Level Security restricts it to read-only on public tables (see `supabase/schema.sql`); Auth has its own access controls independent of that. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Server-only. Used by every API route that writes data. Bypasses RLS — never expose to the client, never prefix with `NEXT_PUBLIC_`. |

No separate auth secret to manage: signup/login/logout, password hashing, and session expiry all run on Supabase Auth. In the Supabase dashboard, enable **Authentication → Providers → Email**, and set **Authentication → Settings → Confirm email** according to whether you want operators to click an email link before their account activates (recommended for a public deploy; optional for a closed crew you're onboarding by hand).

`@supabase/ssr` and `@supabase/supabase-js` are both in active use (client + server Supabase clients, `lib/supabase/*`).

## What "production-ready" means here — and what it doesn't

The build is clean, routes are correctly split between static (TV/Display Engine displays, the launcher) and dynamic (auth, live-state mutations, the programs/sessions/upload API), and the core flows — signup, login, session persistence, protected-route redirects, share-link generation/resolution/revocation, and Realtime sync to a no-login display — have been verified end-to-end against a live Supabase project, not just via static analysis. One thing to go in with eyes open about:

- **Run `npm run seed`** against a fresh project before a real event if `sessions`/`programs` are empty, then open `/operator` and a Share Display Link's `/general` on two separate devices and confirm a Next/Hold/Alert on one reaches the other within ~1s.

## Authentication model

Real per-operator accounts via Supabase Auth — any operator can sign up and create their own event(s); every event, session, program, share link, and live/display state is scoped to its owning operator, enforced by RLS at the database layer (`supabase/schema.sql`'s "owner select" policies), not just hidden in the UI:

- `proxy.ts` (project root) redirects any request under `/dashboard` or `/e/...` (every per-event operator surface — console, cue sheet, remote, broadcast center, display manager) to `/login` unless a valid Supabase session cookie is present.
- `app/e/[eventId]/layout.tsx` is the real per-event gate: it re-verifies the signed-in user actually owns that `eventId` server-side before rendering anything under it, redirecting to `/dashboard` (not a distinguishable error) otherwise.
- Every event-scoped API route calls `lib/server/require-event-access.ts`'s `requireEventAccess(eventId, minRole)`, which re-verifies both the session (`getUser()`, not just decoding the cookie) and the caller's role (owner/editor/viewer) for the specific `event_id` being acted on — the actual enforcement point, not the redirect. RLS is the backstop underneath it: it holds even if a route handler had a bug.
- Login attempts are rate-limited per IP (`lib/server/rate-limit.ts`) — 8 failures locks out for 30s, doubling per repeat offense up to 5 minutes.
- The four TV displays (`/general`, `/av`, `/green-room`, `/presenter`) are gated by `lib/server/verify-display-access.ts`: a real operator session that owns the requested event, or a share-link token that resolves to a non-expired, non-revoked row in `share_links` — which itself resolves to exactly one `event_id`, never a client-supplied one.
- Share links are owner-scoped too: only the operator who owns a link's event can revoke it (`app/api/share-links/[id]/route.ts`), not any authenticated operator.

For a deployment where more matters, consider adding:

- A durable audit log beyond the operator activity feed (`activity_log`, currently last-20 / not persisted long-term by any retention policy)
- Supabase's built-in MFA (TOTP) for operator accounts
- Rate limiting / abuse prevention on event creation — an authenticated operator can currently create unlimited events via `POST /api/events`
- Plan/billing limits if this ever moves beyond a free internal tool

## Rollback

Vercel keeps every deployment; use **Deployments → [previous deploy] → Promote to Production** to roll back the app instantly. Data rollback is separate — Supabase's point-in-time recovery (paid tiers) or your own backup/export of the `sessions`/`programs` tables, since app rollback doesn't touch the database.

## Custom domain

Standard Vercel domain setup — add the domain in **Settings → Domains**, point DNS per Vercel's instructions. No app-level changes needed.
