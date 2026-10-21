# B006 Integrated Batch Report

Base: `3bee9e8`. Final commit: see `git log` (`b459b31` at report time). Only Codex sets CODEX_VERIFIED.

Evidence classes: SOURCE/TEST (repo code, unit tests), LOCAL-POSTGRES (throwaway local cluster, minimal table mirror, not Supabase), SYNTHETIC-BROWSER (dev server, public pages only), STANDARD (primary advisory text), REMOTE-RUNTIME (none), PRODUCTION (none).

## Lane C — import / session-start
- Done: `import_cue_sheet` migration (tenant check, one transaction, derived sessions, pinned search_path, service_role execute only), rollback script, app wired to one RPC call. Commit `1432733`.
- Done: LOCAL-POSTGRES tests, 7 scenarios pass; mutant without tenant check fails.
- Done: route contract tests (3).
- Not done: UI multi-session explicit choice and "Open Console" action after import; import-to-start browser evidence; refresh coherence test; Supabase emulator (no `supabase/config.toml`, no CLI/docker available here).
- Blocked: applying migration to any shared or production database (not authorized).

## Lane B — rehearsal
- Done: Finish at final cue, tracked-only completion summary, zero/one/many-cue rules (`lib/rehearsal.ts`, 11 tests). Exit confirmation keyed to operator action (advance past cue 1, pause, alert); elapsed time alone never prompts. Commit `54fe7e9`, earlier `6d75d39`.
- UNVERIFIED: rendered desktop/mobile rehearsal evidence; needs an authenticated event session (no login credentials in this run).

## Lane D — auth / logout / navigation
- Done: one `requestSignOut` contract (`lib/auth/sign-out.ts`, 4 tests) used by dashboard, event-shell header, remote page, command palette, invite account-switch, set-password. Route returns 500 on signOut error (2 tests). Commits `856ff4a`, `3bee9e8`.
- Not done: recovery/forgot-password flow, password visibility toggle, login trust copy, account-enumeration review of recovery, redirect allowlist audit for `next`, and KF-008 canonical-origin configuration plan.
- UNVERIFIED: rendered logout behavior; authenticated flows.

## Lane E — design / a11y / performance / metadata
- Done: landing micro-label opacity removed (token muted-2 on bg 5.06:1). Heuristic computed-style scan still flags hero overlay text; not confirmed, not claimed.
- Done: home-only canonical and og:url; noindex on login, signup, set-password, screens, tv, custom and display routes; robots disallow narrowed; sitemap pruned; branded OG image (`/opengraph-image` 200 image/png). Verified on dev server. Commit `55d0d67`.
- Not done: Lighthouse re-run (LCP profiling), keyboard/skip-link, 200% zoom and 320px reflow sweep, duplicate-heading accessibility-tree fix, footer year, responsive image changes.
- UNVERIFIED: all performance claims.

## Lane F — security / ops / dependencies / docs
- Done: SheetJS primary-source check (fetched github.com/advisories). GHSA-4r6h-8v6p-xvw6 / CVE-2023-30533 affects xlsx < 0.19.3. GHSA-5pgg-2g8v-p4x9 / CVE-2024-22363 affects xlsx < 0.20.2. Repo pins and installs 0.20.3 from cdn.sheetjs.com, so neither range applies. Recorded on KF-034 (`b459b31`). Residual: direct-URL dependency is outside npm audit; ongoing monitoring required.
- Not done: CSP Report-Only header and report handling, monitoring wiring, legal drafts, email DNS plan, RLS/backup/PITR plans, KF-038 schema decision, KF-039 AI-crawler options, KF-040/041 audits, KF-042 children re-evaluation.
- External blockers: DNS, Resend configuration, Supabase dashboard (backups, advisors), monitoring provider credentials, flagged-account authorization (KF-002, not retried).

## Explicitly still OPEN
- B005-S3 executable secure-cookie procedure (no verified session source).
- KF-031 hold/timer missing-row persistence and KF-036.9 session-identity first connect: not investigated this batch.

## Verification at final revision
- vitest: 34 files, 377 tests pass.
- `npx tsc --noEmit --incremental false`: clean.
- `npm run lint`: 0 errors, 6 baseline warnings.
- `npm run build`: exit 0; `next start`: `/dev/components` 404, `/`, `/login`, `/opengraph-image` 200.
- `node docs/audit-remediation/validate_ledger.mjs`: PASS.
- LOCAL-POSTGRES `import_cue_sheet` tests: pass (run against throwaway cluster).

## Pause
Pausing for Codex review at the final revision. No deploy, push, merge, remote mutation, or KF-002 retry.
