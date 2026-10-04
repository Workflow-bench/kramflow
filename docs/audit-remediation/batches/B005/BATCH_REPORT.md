# B005 Batch Report

Scope: `KRAMFLOW_CLAUDE_B005_PROMPT.md` (verbatim in `../../REVIEWS/2026-09-30_KRAMFLOW_CLAUDE_B005_PROMPT.md`), responding to `KRAMFLOW_CODEX_B004_REVIEW.md` (verbatim in `../../REVIEWS/2026-09-30_KRAMFLOW_CODEX_B004_REVIEW.md`, HOLD/PARTIAL). Base: `c8e855ee05ae0415252c160a52a25543907f23ae`. Intervening-work check: HEAD and tree matched the reviewed SHA at start.

Evidence classes used below: **SOURCE/TEST** = repo code and unit tests. **SYNTHETIC-BROWSER** = local dev server rendering of the `/dev/components` harness with synthetic seeded state; not authenticated, not remote. **REMOTE-RUNTIME** = none in this batch. **PRODUCTION** = none.

## 1. Fixture correctness and recovery (B004-S1/S2) — SOURCE/TEST, UNVERIFIED remotely

- `display_broadcasts` insert now supplies `message` and `target` (NOT NULL, no default: `supabase/migrations/20260909091731_schema_base.sql`). Verified against migration text, not `schema.sql` (stale pre-multitenant snapshot).
- Collaborator insert supplies `invited_email` (NOT NULL, `supabase/schema.sql` + base migration). Found during this batch; not in the review.
- Each resource step is lookup-before-insert, persists state immediately: event → collaborators → `display_type_state` → `display_state` (speaker-ready prerequisite) → broadcast → complete.
- Schema-aware fake db enforces NOT NULL and unique keys (`event_collaborators(event_id,user_id)`, `display_type_state(event_id,display_type)`, `display_state(event_id)`).
- Failure injection proven at: display-success/broadcast-fail, collaborator save-fail, broadcast save-fail; each retry reaches complete with exactly one resource set.
- Reviewer's note: `display_type_state.id` is a valid identity PK; left unchanged.

## 2. Executable bounded verification procedure (B004-S3) — SOURCE/TEST, not executed remotely

- `runMatrix`: owner/editor/viewer × hold, timer, speaker-ready, dismiss of a real fixture broadcast. Owner success proven by independent DB before/after readback; denied identities proven by byte-identical before/after (no mutation). Exits non-zero on failure (`main()`).
- Local-origin guard (`assertLocalDevOrigin`) before any cookie leaves; `redirect: "manual"` on every call.
- Session cookies: still **not produced**. `getSessionCookie` default throws. No existing-user reset, no fabricated cookie, no email.
- Tests use fake fetch/db only; labeled fake-harness in test names.
- Exact steps: see `fixtures/owner_floor_live_matrix.mjs` header. Remote setup/run/cleanup **not executed**.

## 3. Local rendered evidence — SYNTHETIC-BROWSER

Catalog section `/dev/components` → "Broadcast overlay — Dismiss states" renders the real `BroadcastOverlay` under real `DisplayEngineProvider` with a seeded synthetic broadcast. Seeding is `seedHarnessBroadcast` (store.tsx), guarded by `isHarnessIdentity` (reserved nil-UUID event id and reserved harness token only).

Harness-only behavior in `lib/display-engine/store.tsx` (no product identity affected; verified by guard):
- `ensureRemoteConnected`, `subscribe`'s remote hydrate: skipped for harness identities → no Supabase channel, no fetch, no poll.
- `dismissBroadcast`: returns `null` for harness identities (the same value a transport failure yields) → the component's own real error path runs. Controlled failure, labeled as such.
- No global console suppression. Earlier `[display-engine] fetch … failed` errors came from pre-fix HMR state; after the fix, no new console errors and the Next dev error overlay did not appear.

Captured (`batches/B005/evidence/`):
- `desktop-dismiss-states.jpg` — owner "Dismiss" enabled; editor and viewer "Only the owner can dismiss"; token card banner with no control.
- `desktop-keyboard-focus-owner-dismiss.jpg` — owner Dismiss reached by Tab only; `:focus-visible` true; ring computed from the canonical classes (`focus-visible:ring-2 ring-white/40 ring-offset-2`). Focusable-element list: 40 items; explanation spans not in it.
- `desktop-failed-dismiss-toast.jpg` — owner click → `Couldn't dismiss. Try again.` toast; banner and Dismiss remain (4 banners still in DOM). Toast container: `role="status" aria-live="polite" aria-atomic="true"`, DOM-verified. Screen-reader announcement NOT tested; markup only.
- `mobile-375-dismiss-states.jpg` — 375px viewport, `scrollWidth == innerWidth` (no horizontal overflow); explanation wraps.

Defect found and fixed in this batch: the explanation text had `shrink-0` and clipped at 375px ("Only the owner can dismi…"). Fixed to `max-w-[45%] text-right leading-snug`; catalog swatch height `h-44 sm:h-24` so wrapped text is not clipped by the swatch.

Limits (explicit):
- Harness cards are narrow; title truncation ("Re…") is the swatch width, not product layout.
- Next dev indicator visible bottom-left in screenshots (not an error overlay).
- Screen-reader behavior: UNVERIFIED.
- Real owner/editor/viewer/token rendering on live display pages: UNVERIFIED (no authorized runtime).

## 4. Coverage integrity (B004-F1/F2) — SOURCE/TEST

- `source-package/scripts/add_excerpts.mjs`: binds every line-based entry (534) with `source_excerpt` (exact text) and `source_excerpt_sha256`, separate from editorial `text`/`rationale`.
- `validate_ledger.mjs` refactored to exported `runValidation({dir,…})` (CLI unchanged). New checks:
  - 13: each vendored member's bytes match `PACKAGE_MANIFEST.json` sha256.
  - 14: stored excerpt digest self-consistent AND equal to the exact text at the locator in the vendored file.
  - 15: Lighthouse `#audits.*`/`#categories.*` JSON pointers resolve in the vendored raw JSON (scoped to `.json` locators).
- `validate_ledger.test.ts`: 7 negative tests on temp copies — clean pass; altered member; altered excerpt without digest update; excerpt+digest forged but text mismatches file; valid-but-wrong in-range locator; bad JSON pointer; missing excerpt. All pass.
- Pointer check found a real gap: `LH-MOBILE-2` locator had no pointer. Fixed in `build_coverage.mjs`.
- B004-F2: removed the invented KF-010/KF-014 coupling. Each FG-L220 obligation is independently checkable; combined exercise optional (history recorded on both entries).

Totals unchanged: 42 parent / 29 child (`READY_FOR_CODEX` 3, `OPEN` 30, `PRESERVE_PENDING_REVIEW` 3, `NOT_APPLICABLE` 5, `BLOCKED_EXTERNAL` 2). Validator: PASS.

## Preserved (not redone)
Exact Supabase URL guard, visible non-owner explanation, owner focus ring, toast live-region markup, Lighthouse desktop FAIL/27 mapping, KF-006 expanded criteria, KF-004 metric qualification, KF-036.9 tracking.

## Remaining blockers (UNVERIFIED)
- KF-002 flagged-account live runtime: pending user authorization; not retried.
- Remote setup/run/cleanup of the fixture: not executed; no remote mutation performed.
- Screen-reader announcement of failed-dismiss toast: UNVERIFIED.
- Authenticated owner/editor/viewer/token runtime on all five display surfaces + Remote/External API: UNVERIFIED.
- KF-031 (hold/timer persistence) and KF-036.9 (session-identity realtime first connect): OPEN.

## Verification (at final tree)
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 31 files, 361 tests pass (includes 7 validator negative tests).
- `npm run lint`: 0 errors, 6 baseline warnings.
- `npm run build` (standard Turbopack): exit 0.
- `npx tsc --noEmit --incremental false` (sequential, post-build): clean.
- `node docs/audit-remediation/validate_ledger.mjs`: PASS.

## Pause
Pausing for Codex independent review at the final revision. Only Codex can set independently verified status. No Phase 2, no deploy, no merge/push, no self-approval.
