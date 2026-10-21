# B007 Batch Report: local accelerated scope

Scope: `docs/audit-remediation/REVIEWS/2026-09-30_KRAMFLOW_CLAUDE_B007_CONTINUATION.md`, resumed from the B006 checkpoint `c67d0f3`. Codex B006 review (verbatim): `REVIEWS/2026-09-30_KRAMFLOW_CODEX_B006_REVIEW.md`.

Exact revision: **`71b7944`** (HEAD at report time, clean tracked tree). Commits since `c67d0f3`: 11, 55 files, +1772 / -184.

Checkpoints kept, not approved: `553ace3` (B006-S1 import identity), `57785ca` (B006-F1 homepage OG). Neither has Codex approval. History was not rewritten.

Evidence classes: **SOURCE/TEST** (repo code, unit tests, local SQL), **LOCAL-BUILD** (`npm run build` + `next start` on localhost), **BROWSER-LOCAL** (Browser pane on the local production server, unauthenticated), **LH-LOCAL** (Lighthouse 13.5.0, Chrome headless, this machine). **REMOTE** and **PRODUCTION**: none. No deploy, push, merge, remote migration, mail send, DNS change, provider change, KF-002 retry, or remote session creation.

## 1. Verification at `71b7944`

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0, 0 errors, 6 warnings: five pre-existing hard-navigation rules (`window.location.href` on logout/login paths) and one in untracked `brag-output/` (not repo code) |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (Turbopack, all routes built) |
| `npx vitest run` | 40 files, 418 tests, all passing |
| `node docs/audit-remediation/validate_ledger.mjs` | PASS (all checks) |
| Local SQL, `import_cue_sheet` (9 scenarios) | passing against throwaway Postgres 16 |
| Mutant: partition-ownership guard removed | fails at `partition owned by another event is rejected with 23503 (got 23505)` |

## 2. Criterion-by-criterion audit of B007 scope

Status key: **DONE-LOCAL** (implemented and verified at the level stated), **PARTIAL** (some of it done), **NOT DONE** (no change in this batch), **EXTERNAL** (needs a provider, dashboard, live project, or owner).

### Lane B / B006-S1: repeated-workbook import identity
- DONE-LOCAL: event-scoped session mapping at the DB boundary (`553ace3`). Excel and AI paths both return `sessionIds`. Foreign references rejected with zero writes (SQL).
- EXTERNAL: migration apply to any shared database. Not authorised.

### Lane C: import UI, coherence, session start
- DONE-LOCAL: explicit post-import session choice (`0d17dbe`). "Open console" makes a session live only when no session has started. Otherwise the console opens unchanged. Replace warnings match by labels, so a scoped repeat import is still flagged. Unit tests for the helpers (5).
- DONE-LOCAL: live-start guard in `api/live` `start` action: deleted or foreign session 404, malformed id 400, empty session 409, no active session 409. All refusals write nothing (6 route tests).
- NOT DONE: browser evidence of the post-import flow. It needs an authenticated owner session and a control lease. The synthetic harness does not reach this path.
- PARTIAL: "refreshed coherence" is covered by refetching sessions and reloading rows after import. Not observed live.

### B006-F1: homepage OG
- DONE-LOCAL (`57785ca`): production HTML shows `og:site_name=KramFlow`, `og:type=website`, canonical kept.

### B006-F2: route metadata inventory and policy
- DONE-LOCAL (`3b290c0`): every private surface noindex in its own layout (dashboard, `/e/[eventId]/**`, invite, catalog, reset). Policy test reads the source (4 tests). Inventory: `docs/audit-remediation/ROUTE_METADATA_POLICY.md`.
- Verified in production HTML: `/`, `/login`, `/invite/<token>` (token absent from HTML). Dashboard and event routes redirect anonymous requests to `/login`, so their head was checked from source only.
- EXTERNAL: how search engines treat these routes, and any URL removal. Needs Search Console.

### Lane D: auth
- DONE-LOCAL (`d786fb0`): open redirect through tab or newline in `next=` closed. Confirmed before the fix with the WHATWG URL parser. Regression tests.
- DONE-LOCAL (`93aa06a`): show/hide password on login, signup, set-password. Keyboard and pointer verified in the browser.
- DONE-LOCAL (`93aa06a`): `/reset` and `POST /api/auth/reset`. Identical success body for every address, per-IP budget, redirect from `SITE_ORIGIN` only. Provider errors logged, never returned. Tested with a fake provider (7 tests). No email was sent.
- DONE-LOCAL: canonical origin constant shared by metadata base, sitemap, and reset redirect. Plan: `docs/audit-remediation/CANONICAL_ORIGIN_PLAN.md`.
- NOT DONE: "login product context" (a line on the login page explaining the product to someone who landed there cold). Not started.
- EXTERNAL: Supabase Site URL and redirect allowlist, Vercel apex-to-www redirect, owner decision on www vs apex.

### Lane E: accessibility, design, performance
- DONE-LOCAL (`d5e887c`): contrast. Caption opacity on the room section moved to the screen image. Measured text set 68 rows, 0 failing, lowest 4.72:1. Lighthouse desktop colour-contrast items 27 to 0.
- DONE-LOCAL: skip link on the landing page, verified by keyboard (first Tab stop, Enter moves focus to `#main-content`).
- DONE-LOCAL: duplicate headings. The DOM has hidden twins for two sections. Checked with computed style at 925 px and 1440 px: each heading is visible once. Not removed (component refactor, no user-visible effect).
- DONE-LOCAL: reflow on the landing page at 320, 375, 768, 1024, 1440: no document overflow, no visible element past the edge. `/login` at 1440 and `/reset` at 320 also checked.
- PARTIAL: hero overlay contrast. Not measured separately.
- DONE-LOCAL: production LCP profiling with Lighthouse (`docs/audit-remediation/LANE_E_EVIDENCE.md`). Image encode quality 90 to 80: console image 157 to 118 KB. Median mobile LCP 4590 vs 3557 ms in three runs each, inside the run-to-run spread, so the timing gain is not established.
- NOT DONE: JS reduction. Lighthouse estimates 61 KiB of unused JavaScript on mobile and no change was made.
- OPEN FINDING (measured, not fixed): desktop preload waste. The hero console preload fetches `w=3840` (117 KB) while the visible image uses `w=1920` (53 KB). Fix needs a measured change to the `priority` or `sizes` setup.
- NOT VERIFIED: screen-reader announcements, authenticated pages, real devices.

### Lane F: security, ops, legal, parser
- DONE-LOCAL (`71b7944`): CSP `Content-Security-Policy-Report-Only` on every route, verified present on `/`. No violation logged on the landing page in the browser. Not enforced.
- DECIDED NOT BUILT: CSP report endpoint. A public write endpoint needs limits and a destination first. Recorded in `SECURITY_OPS_PLAN.md`.
- NOT DONE: monitoring adapter. No monitoring provider exists in the repo. An adapter needs an owner decision and a new dependency. Runbook draft and candidate event list are in `SECURITY_OPS_PLAN.md`.
- PARTIAL: legal. Outline with code facts and open owner questions in `docs/legal/DRAFT_OUTLINE_FOR_REVIEW.md`. No privacy or terms text was drafted, and none is asserted.
- PARTIAL: DNS/Resend plan, RLS and advisor plan, backup and PITR plan. Written as plans in `SECURITY_OPS_PLAN.md`. Nothing run.
- DONE-LOCAL: SheetJS limits. `sheetRows = MAX_ROWS_PER_SHEET + 1` in both readers, with real-workbook tests (3). Residual risk: a small compressed file that expands far beyond 10 MB is not bounded. Needs a decompressed-size guard, not built.
- NOT DONE: SheetJS monitoring. Rejections already return 4xx and are not counted anywhere.
- DECIDED OPEN: KF-038 (structured data), KF-039 (AI-crawler policy), KF-040 (PRD review), KF-041 (operator-tool inventory written; verification against a real pre-show setup open). Recorded in `DECISIONS_LANE_F.md`. KF-042: re-checked, no FAQ page, still not applicable.

### KF-031: hold and timer persistence
- DONE-LOCAL (`7a8d140`): root cause from code. Migration `20260909091740` backfilled `display_type_state` only for events existing then. Event creation provisioned `display_state` but not `display_type_state`. Hold activate used an `UPDATE` with no row count, so a zero-row write returned `ok:true`. Fix: idempotent provisioning in event creation (rollback on failure) and before hold writes, exactly-one-row update, readback before success. Tests added: 5 hold route tests and 4 provisioning-helper tests. The events route has no new test; its existing tests still pass.
- EXTERNAL: live row state on the dev project was not queried. Not reproduced live.

### KF-036.9: session-identity realtime first connect
- LOCATED, NOT FIXED: root cause in code. The one-time hydrate and the channel subscribe are independent, and the refetch on `SUBSCRIBED` runs only after `wasEverConnected` is true. A change between hydrate and first `SUBSCRIBED` is never replayed. Not reproduced live, so not fixed, under the fix-only-when-confirmed rule. Note in the ledger on KF-036.

### B005-S3: secure-cookie inputs and procedure
- DONE-LOCAL (`b2f2ae7`): `getSessionCookie` reads each fixture account's Supabase auth cookie from an operator-set env variable. Names validated (`sb-<ref>-auth-token[.N]`). Values never echoed. The procedure is in the fixture header. No password is typed, no account created or reset, no session minted. Tests: 6 cookie-input tests with fake env values.
- NOT RUN: the remote setup, run, and cleanup of the matrix. Not authorised.

### Mutation test (requested repair)
- DONE-LOCAL (`d5294ec`): the unmodified test passes. The mutant fails at the intended security assertion, `got 23505` from the partition guard removal, not from setup.

## 3. Remaining local work (honest list)

1. Browser evidence of the post-import Open console flow and the live-start refusals. Needs an authenticated owner session on the local dev server. Not created here.
2. Login product context copy.
3. JS reduction (61 KiB unused on mobile).
4. Desktop preload waste on the hero console (117 KB unused on desktop).
5. Decompressed-size guard for XLSX files.
6. Monitoring adapter and SheetJS rejection counting (needs the owner's provider decision).
7. Hero overlay contrast measurement.
8. Removing hidden duplicate DOM twins on the landing page (a refactor, no visible effect).

## 4. External verification debt (not done, by design)

- Migration apply: `supabase/migrations/20260930000000_import_cue_sheet_atomic.sql` and the hold and timer provisioning work on any shared database.
- Supabase: Site URL, redirect allowlist, security and performance advisors, PITR and backup verification.
- Vercel: apex to www redirect; a decision on the canonical host.
- Resend and DNS: SPF, DKIM, DMARC, template review, a test send to an owner address. Requires approval.
- Search Console: indexing status of private and public routes.
- Owner decisions: monitoring provider, CSP report endpoint, enforcement timing for CSP, KF-038 timing, KF-039 AI-crawler default, KF-040 PRD scope, KF-041 pre-show verification.
- Legal review of any text derived from `docs/legal/`.
- Authenticated runtime: the owner floor matrix (remote), the post-import console flow, rehearsal and logout rendering with real sessions.
- Real devices: touch targets, TV hardware, venue network.
- Lighthouse on a deployed URL. The numbers here are local, and mobile LCP has wide run-to-run spread.

## 5. Pause

Pausing for Codex review at `71b7944`. Checkpoints `553ace3` and `57785ca` are kept and still unreviewed.
