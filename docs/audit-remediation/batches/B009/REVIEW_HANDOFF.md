# B009 consolidated review handoff (integration branch)

Status: SELF-VERIFIED, PENDING CODEX REVIEW. No self-approval. No push. No deployment. No shared database, provider, DNS or account change.

## Branch relationship
- Remediation branch `fix/audit-remediation-phase1` tip `79a2ed4` is an ancestor of `integrate/ui-revamp-landing`. Nothing from the remediation branch is absent from the integration branch.
- The integration branch adds the ui-revamp landing (`b657c82`) and later fixes. Consolidation of the two branches is deferred until Codex accepts this batch. Neither branch has been rewritten.

## Revision list (integration branch, this batch)
| Commit | Subject |
|---|---|
| 79a2ed4 | KF-020 Escape closes mobile navbar and returns focus (remediation tip) |
| b657c82 | feat(landing): integrate ui-revamp landing (landing scope) |
| 47f25f1 | fix(a11y): solid muted tokens on landing text (contrast) |
| 368f8cd | fix(build): move runLiveAction out of the route module |
| 12677f5 | perf(landing): mobile LCP uses 1050 px live-column crop, priority (KF-023) |
| (this commit) | B009 remaining work: KF-001, KF-017, KF-026, KF-004 isolation, rehearsal, metadata, DB evidence |

Working-tree changes not yet committed at time of writing are listed in the final message. Final revision is the commit that contains this file.

## Gates (current tree, before this commit)
- `npm test`: 49 files, 567 tests passed.
- Archive/reporting subset (xlsx-archive, xlsx-limits, parse-cuesheet, observability, observability endpoint): 6 files, 67 tests passed.
- `npm run lint`: 0 errors, 6 warnings (outside changed files).
- `npx tsc --noEmit`: passed, sequential, after build.
- `validate_ledger.mjs`: PASS. Ledger item statuses were NOT changed by this batch.
- Production build, webpack (`next build --webpack`): PASSED.
- Production build, default Turbopack (`next build`): FAILED in this environment at `app/globals.css` PostCSS worker, `binding to a port: Operation not permitted (os error 1)`, with and without sandbox and with TMPDIR relocated. Not fixed; default build left unchanged. Turbopack result is UNVERIFIED here.

## Criteria by item

### runLiveAction move (368f8cd) — verified
- Real PATCH entry (`app/api/live/route.ts`) now covered by 4 tests: anonymous refused 401 with zero live_state writes; foreign eventId checked with `requireEventAccess(eventId, "owner")` and refused 403 with zero writes; non-controller client refused 423 with zero writes; controller/owner mutation writes exactly one live_state row.
- Full live route suite: 29/29 (includes existing tenant-scope, Start guard, controller-lease and mid-session traversal tests).

### KF-001 owner floor — reconciled
- `app/api/display-engine/owner-floor.test.ts`: 25 tests. Real `verifySessionAccess` and real handlers for hold, timer, speaker-ready and broadcast cancel. Only the role resolver and database boundary are replaced.
- Anonymous, unrelated, viewer and editor: refused 401/403 with zero writes, for every route.
- Owner: 200 and exactly one mutating write (update, or delete for broadcast cancel) in the correct table. Hold and timer may first run the idempotent `display_type_state` provisioning upsert; the test excludes that upsert from the count and says so.
- Read access below owner: `verifySessionAccess` ok for viewer, editor, owner; refused for anonymous and unrelated.
- Limit: the role resolver is replaced; real `requireEventAccess` is not exercised by these tests.

### KF-017 password replacement and reauthentication — partially verified
- `app/api/auth/set-password/route.test.ts` (new): 8 tests. Refuses no session (401, no change); refuses short or non-string password (400, no change); replaces password with `must_change_password: false`; reauthenticates with the new password after the change; reports `reauthFailed` (200) when only sign-in fails; generic 500 when admin replacement fails, with no provider detail or password echoed; no password in success reply.
- Reset request: existing `app/api/auth/reset/route.test.ts` covers enumeration-safe identical replies, rate limit, canonical redirect origin, no provider error returned. Not re-run against a real provider (remote reset submission prohibited).
- Browser (`browser-pass2/login-toggle.out`): show/hide control `aria-pressed` false→true, label "Show password"→"Hide password", typed value kept, paste accepted, no POST on toggle.
- Expired or used link: `/login?link=expired` shows "That link has expired or was already used. Request a new link." with a link to `/reset` (browser-verified).
- UNVERIFIED: screen-reader announcement of the toggle state; password-manager autofill behaviour; real provider reset email.

### KF-026 route metadata — fixed, verified over HTTP
- Found: every noindex layout inherited root `og:url` (homepage) and root OG title. Fixed: `lib/private-metadata.ts` `PRIVATE_OPEN_GRAPH` (title and site name only) set in all 15 noindex layouts. HTTP check on the webpack build: `/login`, `/signup`, `/tv`, `/reset`, `/invite/test-token`, `/dev/components` carry no `og:url`; `/` keeps canonical and `og:url` `https://www.kramflow.me`.
- Found: `robots.txt` disallowed `/invite/` and `/dev/`, which carry noindex meta, so crawlers could not read the control. Fixed: robots now disallows `/dashboard`, `/e/`, `/api/` only.
- Sitemap: contains only the homepage; login and signup absent. Verified over HTTP.
- Correction: the policy doc claimed the invite token is absent from HTML. It appears once in the RSC segment payload (it is in the request URL). Corrected in `ROUTE_METADATA_POLICY.md`.
- Duplicate robots meta on `/dev/components` (`noindex` from catalog layout and `noindex, nofollow` from the page). Both noindex; not changed. Recorded as minor.
- Policy tests: `app/route-metadata-policy.test.ts` 20/20, including per-layout OG check and robots check.
- UNVERIFIED: how search engines treat previously indexed private URLs (needs Search Console).

### KF-004 / KF-005 rehearsal — partial
- Boundary and exit rules: `lib/rehearsal.test.ts` (existing 11 tests) plus new source-level isolation checks (2): the page never calls `/api/live`, never issues a mutating request, and its completion summary shows only tracked fields. 13/13.
- Not verified: the rehearsal page sits behind authenticated event access. No browser evidence was produced for zero/one/multi-cue completion, keyboard Finish, or the exit dialog. No production-excluded harness was built. UNVERIFIED.
- KF-005 focus return and dialog behaviour: not verified in a browser in this pass.

### KF-007 active-session traversal — reconciled to existing tests
- Mid-session edits covered in `app/api/live/route.test.ts`: `next` refused when an edit leaves a gap at the landing order (writes nothing); `previous` refused when a gap is below the position; `next` advances again after the gap is fixed to a contiguous 1..n. Invalid, foreign, deleted and empty sessions refused with zero writes. Client `maxOrder` inflation ignored.
- Import UI and real-database import into Start/Next/Finish: not executed in a browser (authenticated). UNVERIFIED.

### KF-006 / KF-031 / database scenarios — verified on local Postgres 16.15
Disposable databases (throwaway, local socket, port 54329), reproduce with `docs/audit-remediation/evidence/B009/db/race-full.sh`. Results in `evidence/B009/db/race-results.txt`:
- `import_cue_sheet.test.sql` (fresh database `b9_rerun`): ALL PASSED.
- First import, two connections: A_exit=0, B_exit=0. B stored as `sat-am~69e2703f`; both events keep their session.
- Same-event import race: A_exit=0, B_exit=0. B replaces A completely; A-prefixed rows after B = 0.
- Version race (`display_type_state`): second writer returns 0 rows; stored version 1, mode countdown.
- Multi-session race (two sessions, two events): A_exit=0, B_exit=0; both events stored; cross-tenant rows 0.
- Forced-failure race (B references a foreign session): B_exit=3, race-B has no rows, cross-tenant rows 0. Full rollback observed.
- Limit: the timer route's 409 path is still exercised with a simulated writer in unit tests; the real-database version race is the `race_version.sh` run above.
- Not run: Supabase runtime, RLS policies, triggers, shared dev database (prohibited).

### KF-034 archive and reporting — tests recorded
- `lib/xlsx-archive.test.ts`, `lib/xlsx-limits.test.ts`, `lib/parse-cuesheet-limits.test.ts`, `lib/observability/report.test.ts`, `app/api/observability/report/route.test.ts`: in the 67-test subset above, all passed.
- Known: retained-memory bound not measured (carried from resume 4). Bounded-memory claim remains UNVERIFIED.

### KF-010 reporting — local only
- Redacted sink record captured through the real error boundary (earlier pass). Endpoint 8 KiB cap, re-redaction, 204, log-only. Provider, source maps, alert owner and staging capture: UNVERIFIED (external).

### KF-019 contrast — reconciled, with an inventory gap
- Original landing: 10 tiny labels at 2.29–2.51:1 (`source-package/KRAMFLOW_FULL_AUDIT.md:344`). Those labels belong to the superseded landing and are removed by the integration.
- The ledger's "27-node desktop and 10-node mobile inventory" is not present in this repository. It cannot be reconciled node-by-node. UNVERIFIED.
- Current landing, oklab-aware, settled, full-opacity text nodes: desktop 496, 0 failing, min 4.63:1; mobile 491, 0 failing, min 4.63:1. Lighthouse color-contrast 0 items on all runs.
- Historical rgb-only claims corrected: `evidence/B009/browser/CORRECTION_rgb_only_contrast.md`. Original evidence kept, amendment appended to `OBSERVATIONS.md`.
- Labels at high contrast and zoom: not verified.

### KF-020 keyboard, skip link, reflow — partial
- Skip link: first Tab focuses "Skip to content" (`#main-content`); Enter moves focus to `#main-content`. Browser-verified.
- Horizontal overflow: 0 px at 320, 375, 768, 1024 and 1440 CSS px. Browser-verified (viewport approximation of 400% zoom, not browser zoom).
- Escape closes the mobile navbar and returns focus to its toggle (earlier pass, `79a2ed4`).
- UNVERIFIED: real browser zoom at 200%; screen-reader names; full keyboard completeness across cue controls and modals; focus return after the rehearsal exit dialog.

### KF-021 duplicated headings — tree-visible pass, DOM smell remains
- Rendered, visible H2 for "One cue. The room responds." is one at 1440 and one at 375. The mobile twin is `display:none` at each width and excluded from the accessibility tree.
- The DOM still carries the duplicated responsive section. Not removed. A CDP accessibility-tree dump was not taken (heading check uses `getClientRects`).

### KF-023 performance — OPEN, measured
Lighthouse 13.5.0, production webpack build, `--only-categories=performance,accessibility`. Simulated and observed reported separately. Raw runs in `evidence/B009/final-measurements/` and `landing-lcp-fix/`.

| Series | Runs | Mobile LCP (median) | Desktop LCP (median) | Notes |
|---|---|---|---|---|
| Simulated (Lighthouse default) | 3 each | 3309 ms (3781, 3309, 3309) | 720 ms | Target 2500 ms NOT met. Perf 0.89–0.92 mobile, 1.00 desktop. a11y 1.00. CLS 0. Contrast items 0. Unused JS 71 KiB. |
| Observed (devtools throttling) | 3 | 2317 ms (2317, 2684, 2311) | not run | Meets 2500 ms under observed throttling. Not the same metric as the simulated series. |

Remaining bottleneck (simulated, from raw LCP breakdown in `landing-lcp-fix/`): the mobile LCP is the one-cue crop image. Resource load delay and load duration dominate the observed series (about 2.0 s delay and 2.4 s load in the devtools run before the priority change; about 0.5 s and 1.7 s after). Unused JavaScript of about 71 KiB remains from framer-motion and gsap chunks shipped to all pages. A simulated-vs-observed gap is not explained.

Not done: further reduction of the simulated LCP below 2500 ms.

### KF-036.9, KF-010 — carried from earlier passes
- Earlier batch evidence (store.realtime tests, reporting boundary) unchanged in this pass; see earlier checkpoint entries.

## Not verified (external or environment limits)
- Real browser zoom at 200%. The browser tool cannot set zoom.
- Screen-reader testing of any control.
- Authenticated flows: rehearsal, import UI, display operator, real Supabase session.
- Remote proof of any kind: shared database, Supabase runtime, provider email, DNS, remote reset submission. Prohibited without separate authorization.
- Turbopack production build in this environment.
- Monitoring provider, source maps, alert owner (KF-010).
- Search Console effects of metadata changes (KF-026).

## Sandbox and processes
- Build, Lighthouse, Chromium and the production servers needed the sandbox off (port binding denied inside the sandbox; demonstrated). Test servers on ports 3941 to 3945 were started by this session; they are stopped at the end of this pass.
- Throwaway databases `b9_r_*` and `b9_rerun*` were created locally for the race runs. Dropping them is left to the reviewer; they are not shared.

## Requested from Codex
1. Review the runLiveAction move and the new live-route PATCH tests.
2. Review owner-floor tests as a reconciliation of KF-001 (note the provisioning-upsert exclusion).
3. Review the metadata and robots changes; decide whether `/dev/components` duplicate robots meta is acceptable.
4. Decide whether the observed devtools median (2317 ms) or the simulated median (3309 ms) governs KF-023. Current evidence says the simulated series misses.
5. Confirm the contrast reconciliation and the missing 27/10 inventory.
6. Accept or reject the Turbopack build failure as an environment limit.

---

# Update r2 (supersedes the items above where they conflict)

Scope: the remaining locally actionable B009 gaps after `04598ea`. Status: SELF-VERIFIED, PENDING CODEX REVIEW. No CODEX_VERIFIED granted. No push, no deployment, no shared-resource change.

## Final revision
the commit that adds this section (see the final message for its hash).
Built and measured on the final tree. Gates below were run on the same tree.

## Gates (final tree)
- `npm test`: 50 files, 570 tests passed.
- Archive/reporting subset: 67 tests passed.
- `npm run lint`: 0 errors, 6 warnings (outside changed files). Evidence capture scripts are excluded from lint (`eslint.config.mjs`, `docs/audit-remediation/evidence/**`).
- `npx tsc --noEmit`: passed, run sequentially after the production build.
- `validate_ledger.mjs`: PASS, after the ledger reconciliation below.
- Production build, webpack (`next build --webpack`): PASSED (run twice).
- Production build, default Turbopack (`next build`): FAILED. `binding to a port: Operation not permitted (os error 1)` in the PostCSS worker, same as before. Not changed to hide the failure. Recorded separately; UNVERIFIED in this environment.

## Criteria: new completed evidence in this pass
1. **Rehearsal and import harnesses (KF-004, KF-005, KF-006 UI-selection).**
   - Rehearsal logic moved to `components/rehearsal/rehearsal-view.tsx` (the Next route module may export only the page default). The real route is a thin wrapper; behaviour unchanged. The consolidated console-surface lint guardrail glob now includes `components/rehearsal/**` so the Stage-token guard still applies.
   - Synthetic harness: `app/(catalog)/dev/rehearsal/` (`page.tsx`, `harness.tsx`). Labelled SYNTHETIC on screen. Production gate `notFound()`: verified 404 on the production server.
   - Captured in dev mode (`evidence/B009/harness-rehearsal/`): none (empty state text), zero cues (Start disabled), one cue (Finish by keyboard, completion once, "1 of 1 cues completed"), four cues (Finish absent before last cue, enabled at last, completion once, "4 of 4 cues completed", Run again returns to Not started), Jump to Finish (completion once), exit with progress (alertdialog "Leave rehearsal?" from the AX tree, focus inside on open, Escape returns focus to "Exit Rehearsal", confirm calls `onExit`), exit without progress (plain link to `/e/synthetic-harness/operator`, not intercepted), two sessions (explicit selector "Session to rehearse"; the first session is selected by default; changing it resets progress). Mutating requests and `/api/live` requests: 0 in every state.
   - Explicit session selection for the Console: `app/e/[eventId]/operator/explicit-session.test.ts` (3 source-level checks). The Console derives its session only from `state.activeSessionId` and shows "Select a session to get started." when none is set; no `sessions[0]` fallback.
   - Import UI (cue-sheet import confirmation, Open Console from the import result): NOT built as a harness. The import flow is inside a large authenticated page. UNVERIFIED in browser. The database side is verified (see DB below).
2. **Original contrast inventory (KF-019).** Located in the vendored raw Lighthouse JSON: `source-package/kramflow-lighthouse-desktop.report.json` (27 items) and `kramflow-lighthouse-mobile.report.json` and `-rerun.report.json` (10 items each, selectors identical). Reconciled by class and original section (`evidence/B009/contrast/INVENTORY_RECONCILIATION.md`). Every entry belongs to surfaces-section, room-section or one-cue-section, all removed or replaced in the integration. Manifest discrepancy recorded: the exact class strings do not occur in the base commit `8a91668`; the Lighthouse snapshot (live site, 2026-09-28) was rendered from source not in this repository. Node-for-node replay is not possible from repo content.
3. **Real accessibility tree (KF-020, KF-021).** CDP `Accessibility.getFullAXTree` on the production build (`evidence/B009/ax-tree/`, `final-revision-browser/ax-final.json`):
   - Landing, desktop and mobile: 11 headings each, no duplicate heading names, 2 landmarks, 0 unnamed buttons or links.
   - Login: found 0 headings and 0 landmarks. **Fixed** (`app/login/page.tsx`: outer container is `<main>`, subtitle is `<h1>`, same classes plus `font-normal`). Now 1 heading, 1 `main`. Toggle behaviour unchanged.
   - Earlier computed-visibility heading check reported a duplicate (the hidden mobile twin). The AX tree excludes it. The computed method is recorded and superseded.
4. **Performance (KF-023).** Original acceptance method kept (Lighthouse 13.5.0, median of 3, mobile LCP ≤ 2.5 s). Two series reported separately, not merged. Final-revision numbers:

| Series | n | LCP runs (ms) | Median LCP | Perf | Notes |
|---|---|---|---|---|---|
| Simulated mobile | 3 | 3814, 3310, 3308 | **3310 ms** (misses 2500) | 0.89–0.92 | CLS 0, TBT median 11 ms, contrast items 0, unused JS 71 KiB |
| Simulated desktop | 3 | 699, 653, 671 | 671 ms | 1.00 | CLS 0, TBT 0, contrast items 0 |
| Observed mobile (devtools throttling) | 3 | 2223, 2321, 2304 | **2304 ms** (meets 2500 under observed throttling) | 0.96–0.97 | Different metric; not the acceptance series |

   - Bottleneck from raw breakdown: in the observed series, the LCP image (17.5 KB transfer) waits 575 ms for its request and takes 1730 ms to load, sharing a throttled link with about 250 KB of JavaScript and two fonts. In the simulated series, the breakdown subparts sum to about 50 ms while LCP is 3.3 s. This gap is unexplained and recorded.
   - Not changed in this pass: JS shipped to the landing (framer-motion and gsap chunks, unused JS 71 KiB). Reducing it touches the motion stack the design relies on. Requires a Codex decision on scope.
   - KF-023 remains NOT MET under the acceptance method (simulated). Not CODEX_VERIFIED.
5. **Ledger (KF-001 to KF-034 touched rows).** States reconciled to actual work; JSON `history` records each change with its evidence. Changes: KF-001 and KF-026 to READY_FOR_CODEX; KF-004, KF-005, KF-006, KF-007, KF-010, KF-017, KF-019, KF-020, KF-021, KF-023, KF-034 to IN_PROGRESS. Totals recomputed; validator PASS. `independent_review` fields untouched. Markdown ledger appended with a B009 reconciliation section (the B003 totals snapshot is not rewritten).

## Previously completed (carried, unchanged in this pass)
- runLiveAction move: real PATCH tests (auth, tenant scope, controller lease, mutation).
- KF-001 owner floor: `owner-floor.test.ts` (25) plus `owner-floor-matrix.test.ts` (existing 15).
- KF-017 set-password tests (8); login toggle browser check; expired-link message.
- KF-026 metadata: `PRIVATE_OPEN_GRAPH` in 15 noindex layouts; robots no longer disallows `/invite/` or `/dev/`; policy test updated.
- DB: `import_cue_sheet.test.sql` ALL PASSED; four two-connection races on fresh local Postgres 16.15 (`evidence/B009/db/race-results.txt`).
- Contrast: desktop 496 and mobile 491 settled full-opacity text nodes, 0 failing, min 4.63:1 (oklab-aware); Lighthouse contrast 0.
- Reduced motion (production, 375 px): cover hidden, nav compact at 200 ms, animations 1e-5 s, 0 long transitions; default shows cover and 46 transitions; no page errors.
- Reflow: 0 px horizontal overflow at 320, 375, 768, 1024, 1440 CSS px (viewport approximation; not browser zoom).

## Not verified / external (remaining blockers)
- Browser zoom at 200%: the browser tool cannot set zoom. Viewport reflow is the only substitute and is labelled as such.
- Screen-reader speech output: no screen reader in this environment. AX-tree names and roles are verified; spoken output is not.
- Authenticated flows: rehearsal on the real route with a real event; import UI and Open Console from an import result; operator console with real live state. Harness evidence is synthetic.
- Turbopack production build in this environment (environment port-binding failure).
- Remote proof: shared database, Supabase runtime, provider email, real password-reset submission, DNS, deployment. Not performed; prohibited without separate authorization.
- KF-010 monitoring provider, source maps, alert owner, staging capture: external.
- KF-023 simulated target: performance work remaining (see bottleneck).
- Original contrast node-for-node replay: needs the rendered source of the 2026-09-28 live site, which is not in the repository.

## Requested from Codex
1. Decide whether the observed (devtools) or simulated Lighthouse series governs KF-023. The original acceptance method uses the simulated series; current evidence misses it.
2. Decide whether the destructive-confirm initial focus in the rehearsal exit dialog (`useDialogFocus`) is acceptable (`evidence/B009/harness-rehearsal/README.md` finding 1).
3. Decide whether the background of open dialogs needs `aria-hidden` or `inert` (finding 2).
4. Confirm the contrast reconciliation by provenance (the 27/10 inventory is in the vendored JSON; the rendered source is not in the repository).
5. Confirm the login `main` and heading change (`app/login/page.tsx`).
6. Accept or reject the Turbopack failure as an environment limit.

---

# Update r3 (supersedes r2 where they conflict)

Status: SELF-VERIFIED, PENDING CODEX REVIEW. No CODEX_VERIFIED. No push, no deployment, no shared-resource change.
Final revision: the commit that adds this section (hash in the final message).

## Gates (final tree)
- `npm test`: 51 files, 574 tests passed.
- Archive/reporting subset: 67 passed.
- `npx eslint .`: 0 errors, 6 warnings (outside changed files). ESLint evidence exclusion narrowed to `docs/audit-remediation/evidence/**/*.cjs` (capture scripts). Product code, tests and repo tooling are linted. The rehearsal view is in the console-surface guardrail glob (`components/rehearsal/**`).
- `npx tsc --noEmit`: passed, after the production build.
- `validate_ledger.mjs`: PASS.
- Production build, default Turbopack (`npm run build`): **PASSED** (exit 0, no binding errors). The earlier PostCSS port-binding failure did not reproduce in this pass. Cause not determined; not claimed as fixed by a code change.
- Production build, webpack (`next build --webpack`): PASSED.
- Production 404 for `/dev/import` and `/dev/rehearsal` on both builds. Landing 200.

## Criteria, r3
1. **Import / Open Console harness (KF-006).** Synthetic, dev-only, `app/(catalog)/dev/import/`. Mounts the real `UploadPanel` (now `components/cue-sheet/upload-panel.tsx`, with an injected request seam), the real `ImportCompleteStep` (`components/cue-sheet/import-complete.tsx`) and the pure `planOpenConsole` (`lib/cue-sheet-open.ts`, 4 unit tests). The cue-sheet page now calls these; behaviour unchanged.
   - Explicit multi-session choice: each session has its own Open console; no selectSession before a click.
   - No automatic live start: import performs no live call; the decision is recorded by the harness.
   - Success, parse-error, commit-error states: parse and commit errors now have `role="alert"` (previously announced nothing).
   - Guards: a running session is not switched; control held elsewhere is refused.
   - Zero network requests in every case. Evidence: `evidence/B009/import-harness/`.
   - Refresh coherence on the real route: NOT verified (needs an authenticated event and a database). The stored-id mapping rule is covered by `lib/cue-sheet-import-result.test.ts`.
2. **Rehearsal exit dialog (KF-005).** Initial focus on Cancel (`data-initial-focus` on danger tones in `ConfirmDialog`; the hook honours the marker). Keyboard containment, Escape, focus return, accessible name ("Leave rehearsal?", alertdialog) verified. Background pointer: the backdrop intercepts and the cue is unchanged. The established pattern (backdrop + focus trap) is kept; `inert` on the page was not added. Evidence: `evidence/B009/harness-rehearsal/exit-verify.json`.
   - Side effect: every destructive ConfirmDialog caller now opens on Cancel. Intended; Codex to confirm.
3. **Performance (KF-023), motion stack.** GSAP (≈140 KB script) moved from the first parse to a dynamic import after first paint (`components/site/use-gsap.ts`). The one-cue hidden starting state moved to motion-allowed CSS (`app/globals.css`) so the after-screens do not flash before GSAP arrives.
   - Verified: first paint hidden; the after-screens reveal through the pin; nav compacts past 140 px; reduced motion static, no errors. Evidence: `perf-gsap-deferred/one-cue-scroll.json`, `reduced-motion.json`.
   - Simulated mobile median: **3310 → 3012 ms** (n=3: 3879, 3012, 3009). Target 2500 ms **still not met**. Desktop 671 → 704 (within noise).
   - Observed mobile (supplementary, n=3): 2304 → 2339 ms. No material change.
   - Remaining bottleneck: framer-motion (≈131 KB chunk) used by the navbar, hero, split-flap, reveal wrapper, live-operations and playable-show. Removing it from the landing is a design change, not a routine fix. Not done; needs a decision.
   - Original acceptance method kept (simulated, median of 3).
4. **ESLint exclusion.** Narrowed as above.
5. **Ledger.** KF-021 → READY_FOR_CODEX (AX tree). KF-005, KF-006, KF-017, KF-023 updated with new evidence, remain IN_PROGRESS. KF-001 and KF-026 remain READY_FOR_CODEX. Totals recomputed; validator PASS.
6. **Contrast provenance.** `evidence/B009/contrast/INVENTORY_RECONCILIATION.md` documents where the 27 desktop and 10 mobile entries are and which removed section produced each class. No node-for-node replay is claimed: the rendered source of the 2026-09-28 live site is not in the repository.

## Remaining external proof and limits (not local failures)
- Authenticated real-route flows: rehearsal, import UI on a real event, refresh coherence after import, real Open Console navigation with the real store.
- Migration staging for `20260930000000_import_cue_sheet_atomic.sql`: no production migration without separate authorization.
- Password-manager autofill (KF-017); real reset provider and reset email (prohibited without authorization).
- Browser zoom at 200% (tool cannot set zoom). Viewport reflow is labelled as a substitute.
- Screen-reader speech output (no screen reader here). AX-tree names, roles and states are verified.
- KF-010 monitoring provider, source maps, alert owner, staging capture.
- Browser back navigation for the rehearsal exit (KF-005).

## Genuine unresolved items
- KF-023 simulated mobile median 3012 ms against the 2500 ms acceptance target. Open.
- Framer-motion removal from the landing: decision needed (design impact).
- Landing DOM still carries the hidden mobile twin of the One-cue section (tree-invisible; a code-quality issue, not a tree failure).
- `brag-output/` untracked directory produces 2 ESLint warnings in a file this batch did not create. Left alone.
- Ledger rows outside the B009 list were not re-reviewed in this pass.

## Requested from Codex
1. Accept or reject the GSAP deferral and the CSS initial state as the KF-023 step (simulated 3310 → 3012 ms, target still missed).
2. Decide whether the framer-motion stack may be replaced on the landing (design sign-off needed).
3. Confirm destructive ConfirmDialogs opening on Cancel is the intended product behaviour.
4. Confirm the import harness scope (synthetic components, real UploadPanel/ImportCompleteStep/planner) as evidence for KF-006 UI criteria, with refresh coherence and real route left external.
5. Confirm the Turbopack build passes at this revision; the earlier failure is unexplained.

---

# Update r4 (supersedes r3 where they conflict)

Status: SELF-VERIFIED, PENDING CODEX REVIEW. No CODEX_VERIFIED anywhere. No push, no deployment, no shared-resource change. Ledger items outside B009 were not reviewed and still require later batches.

## Final checks (exact revision: the commit adding this section)
- `npm test`: 51 files, 574 passed. `npx eslint .`: 0 errors, 6 warnings (outside changed files). `npx tsc --noEmit`: clean, also after both production builds. `validate_ledger.mjs`: PASS.
- Production build, default Turbopack: PASS. Production build, webpack: PASS.
- Production (Turbopack build): `/dev/import`, `/dev/import/console`, `/dev/rehearsal` return 404; landing 200.

## Work this pass
1. **Modal exclusion (shared hook).** `components/ui/use-dialog-focus.ts` now marks everything outside the dialog's ancestor chain `inert` while open and restores exactly on close. The backdrop plus focus trap alone did not exclude the background from the accessibility tree (the old comment said "no inert, deliberately out of scope"; that is corrected). Verified with the real browser AX tree (`evidence/B009/modal-exclusion/ax-modal.json`): background button and link nodes leave the tree while open; 6 elements become inert; 12 Tab presses never leave the dialog; a direct `.focus()` on a background control is blocked; on Escape, the inert set returns to 0 and focus returns to the trigger. Limit: verified on ConfirmDialog. Modal uses the same hook but has no separate browser check here.
2. **Rehearsal browser back (harness).** `evidence/B009/rehearsal-browser-back/browser-back.json`: progress is not carried across a history visit; back returns to a fresh "Not started" state; back with the exit dialog open returns fresh with no dialog and no beforeunload prompt; forward works; no `/api/live` or mutating requests. Limit: full page navigations; in-app `router.push` was not exercised separately.
3. **Import refresh coherence and Open Console (controlled store).** Harness store is sessionStorage with a `useSyncExternalStore` read; console stub at `/dev/import/console`. `evidence/B009/import-harness/import-coherence.json`:
   - Import, Open console on the second session, reload the console: same live session, coherent; no real API requests.
   - Reload the import page: store shows the session chosen earlier; opening the other session (not started) selects it explicitly.
   - Running session (fixture started): opening another session leaves the running one live.
   - Control held elsewhere: refused, no navigation.
   Two render-loop bugs found in the harness during this pass (unstable snapshot) and fixed. Limit: this is a controlled store, not the real store; real route persistence, refresh on a real event and real selectSession remain external.
4. **Performance (KF-023).**
   - Kept: GSAP deferred after first paint (simulated mobile 3310 → 3012 ms, n=3; observed unchanged).
   - Negative and reverted: LazyMotion with `domAnimation` on the landing (`evidence/B009/perf-lazymotion/NEGATIVE_RESULT.md`): simulated mobile 3158 ms, desktop 649 ms, observed 2330 ms. No clear gain; raw runs kept.
   - Target 2500 ms (simulated) still missed. Remaining cost: framer-motion feature code and the React/Next runtime on the main thread during load. Further gains need either a broader replacement of the landing's `motion.*` usage (navbar, hero, split-flap, reveal, playable-show) with CSS/IntersectionObserver, or a decision to change the acceptance method. Neither is done.
   - Observed mobile is supplementary (n=3, median 2330 ms), not the acceptance series.
5. **Reconciliation** (below). No criterion is marked accepted.

## Reconciliation of the B009 backlog (15 items)
Columns: implementation (code exists), local evidence (reproducible here), independent acceptance (Codex), external proof still needed. None is CODEX_VERIFIED.

| ID | Ledger state | Implementation | Local evidence | Independent acceptance | External proof still needed |
|---|---|---|---|---|---|
| KF-001 owner floor | READY_FOR_CODEX | owner-only hold/timer/speaker-ready/broadcast cancel | owner-floor.test.ts (25) + owner-floor-matrix.test.ts (15) | pending | real-session persistence (remote, prior batch) |
| KF-004 rehearsal completion | IN_PROGRESS | RehearsalView + synthetic harness | harness-rehearsal/results.json; rehearsal.test.ts 13 | pending | authenticated real-route run; pointer Finish click not separately captured |
| KF-005 rehearsal exit | IN_PROGRESS | alertdialog, Cancel-first focus, inert background | exit-verify.json; browser-back.json; ax-modal.json | pending | none local; in-app router exit not separately captured |
| KF-006 import | IN_PROGRESS | atomic RPC, UploadPanel/ImportCompleteStep/planner | race-results.txt, import_cue_sheet SQL ALL PASSED, import-coherence.json | pending | real route refresh coherence; migration staging (external) |
| KF-007 traversal | IN_PROGRESS | stored-count bounds, gap refusal, explicit session | live/route.test.ts; explicit-session.test.ts | pending | import UI into Start/Next on a real event |
| KF-010 reporting | IN_PROGRESS | redacted local sink, bounded endpoint | report tests; earlier browser boundary capture | pending | provider, source maps, alert owner, staging capture |
| KF-017 recovery | IN_PROGRESS | set-password 8 tests; reset route tests; toggle | set-password/route.test.ts; login-ax-toggle.json | pending | password-manager autofill; real reset provider (prohibited) |
| KF-019 contrast | IN_PROGRESS | landing token changes | oklab-aware 496/491 nodes 0 failing; Lighthouse 0; inventory reconciliation | pending | node-for-node replay impossible (source not in repo); zoom/high-contrast labels |
| KF-020 keyboard/focus/reflow | IN_PROGRESS | skip link, Escape focus return, inert modal, login landmark | a11y-pass.out; ax-modal.json; ax-tree | pending | real browser zoom 200%; screen-reader names |
| KF-021 duplicated headings | READY_FOR_CODEX | hidden twin remains in DOM | AX tree: 11 headings, 0 duplicates | pending | none; DOM twin is a code-quality item |
| KF-023 performance | IN_PROGRESS | GSAP deferred; LazyMotion reverted | perf-gsap-deferred; perf-lazymotion (negative) | pending | target not met (simulated 3012 ms) |
| KF-026 metadata | READY_FOR_CODEX | PRIVATE_OPEN_GRAPH; robots; policy test | HTTP checks; route-metadata-policy.test.ts | pending | none local; search-engine effects not in scope |
| KF-031 hold/timer | IN_PROGRESS | provisioning, conditional update, 409 | timer/hold tests; race-results.txt (version race) | pending | real-DB hold path; shared dev DB not touched |
| KF-034 archive | IN_PROGRESS | inspector and limits | 67-test archive/reporting subset | pending | retained-memory bound not measured |
| KF-036.9 realtime race | carried (earlier batch) | store sequencer and teardown | store.realtime.test.ts (9) | pending | browser reproduction through the real store |

## Genuinely unresolved
- KF-023: simulated mobile median 3012 ms vs 2500 ms.
- KF-036.9: browser reproduction through the real store not done.
- KF-031: real-DB hold path not exercised.
- Modal primitive: no separate browser exclusion check.
- DOM twin of the One-cue section still present in the landing DOM.
- Ledger rows outside B009 not reviewed.

## Requested from Codex
1. Accept or reject the `inert` background exclusion as the corrected shared modal pattern.
2. Decide whether KF-023 requires a further landing motion rewrite or a change of method (acceptance is still the simulated series).
3. Confirm reconciliation states above, especially READY_FOR_CODEX for KF-001, KF-021, KF-026.

---

# Update r5 (supersedes r4 where they conflict)

Status: SELF-VERIFIED, PENDING CODEX REVIEW. No CODEX_VERIFIED. No self-approval, no acceptance-method change, no push, no deployment, no shared-resource operation. Ledger items outside B009 remain for later batches.
Final revision: the commit that adds this section (hash in the final message).

## Final checks
- `npm test`: 52 files, 579 passed. `npx eslint .`: 0 errors, 6 warnings (outside changed files). `npx tsc --noEmit`: clean (also after both builds). Archive/reporting subset: 67 passed. `validate_ledger.mjs`: PASS.
- Production build, default Turbopack: PASS. Production build, webpack: PASS.
- Production 404: `/dev/modal`, `/dev/realtime`, `/dev/import`, `/dev/import/console`, `/dev/rehearsal`, `/dev/components`. Landing 200.

## 1. Shared Modal and nested stacks (KF-020, KF-005)
- Registry rewritten (`components/ui/use-dialog-focus.ts`): reference-counted inert marks. An element stays inert until every open dialog releases it, in any close order. Earlier version restored per dialog and could reactivate background that a lower dialog still excluded when the lower closed first. Fixed.
- Unit tests (`components/ui/use-dialog-focus.test.ts`, 5): nested upper-closes-first, nested lower-closes-first, sibling upper/lower, restore of pre-inert elements, zero marks after any order.
- Browser (`evidence/B009/modal-stack/`): lower Modal alone (open, background excluded, Escape closes, background restored, focus back to trigger). Lower + upper ConfirmDialog as DOM siblings: upper closed by Escape, Cancel and Revoke leaves lower open and background excluded; focus returns to upper trigger; closing lower restores background and focus.
- Limit: browser run used the pre-existing dev server on port 3000 (serves this tree; not started by this session; not stopped).

## 2. KF-036.9 through the real store, controlled transport (synthetic)
- Shared transport extracted to `lib/display-engine/fake-transport.ts`. The node test (`store.realtime.test.ts`, 9 tests) imports it.
- Production-excluded harness `/dev/realtime` mounts the real `__testing`/store with the controlled transport.
- Browser (`evidence/B009/realtime-browser/kf036-9-browser.json`): broadcast sent after hydrate and before first SUBSCRIBED is visible after that SUBSCRIBED without another mutation. Reconnect refetches. Unsubscribe removes the channel.
- Negative control (`kf036-9-negative-control.json`): refetch-on-SUBSCRIBED disabled makes the race fail (`afterFirstSubscribed: none`). Source restored (no diff).
- Remote proof (authenticated display page, real Supabase Realtime) remains UNVERIFIED and external.

## 3. Hold persistence on disposable local Postgres (KF-031)
- `docs/audit-remediation/migrations/tests/hold/hold_persistence.sql` on database `b9_hold`. Mirrors the hold route statements and keys (not the production migration; no PostgREST, no RLS). 10 checks, all PASSED: activation (one row), deactivation (message kept, active cleared), missing-row provisioning (four rows, idempotent), hold after provisioning, missing event matches zero rows, tenant boundary (A does not touch B; cross-tenant predicate zero rows), display types independent, unknown type writes nothing.
- Risk recorded, not changed: deactivation is read-then-write (`{...current, active:false}`) with no version guard. A concurrent message update between read and write could be lost.

## 4. Rehearsal history through actual in-app navigation (KF-005)
- Before: in-app Link navigation with progress discarded it silently; Back returned a fresh state. Confirmed by `rehearsal-navigation.json` (C: progress lost, no prompt).
- Change: run kept per viewer in sessionStorage (`components/rehearsal/persisted-run.ts`, `useSyncExternalStore`), keyed by event. Cleared only by confirmed Exit. Reset rehearsal is the explicit discard. `beforeunload` prompt while progress is discardable (same rule as the Exit confirmation).
- After (`rehearsal-navigation.json`): in-app Link with progress: route changes, no confirmation, progress retained; Back: progress restored ("SYNTHETIC cue 1", rehearsing); Reset after Back: "Not started"; Exit Cancel keeps progress; confirmed Exit removes the stored run; reload with progress prompts, dismissing keeps progress.
- Open product decision (not closed): in-app navigation away from an in-progress rehearsal shows no confirmation, although nothing is lost. An app-wide navigation guard is out of scope here.

## 5. Import sessionStorage/stub evidence
- Labelled synthetic. `evidence/B009/import-harness/` covers the controlled store and console stub only. It does not close the real selectSession or real persistence criteria, which remain external.

## Performance (KF-023): negative results retained, target still missed
- Acceptance method unchanged: simulated Lighthouse 13.5.0, mobile, median of 3, target 2500 ms.
- Current landing sources equal `a782580` (verified: no landing source diff since), so the a782580 series (median 3012 ms) is the current state.
- Framer-motion removal upper bound (`perf-framer-negative/NEGATIVE_RESULT.md`): framer removed from every landing section, then also from the root `MotionConfig`. Medians 3009 and 3011 ms. No gain. The animation library is not the simulated bottleneck. CSS/IntersectionObserver rewrites would not reach 2500 ms by themselves.
- LazyMotion (async features): 3158 ms, reverted (`perf-lazymotion/NEGATIVE_RESULT.md`).
- Remaining cost, from profiling (critical-path script time and main-thread breakdown): script evaluation of the Next/React runtime chunks (~240 KB and ~200 KB, both multiplied by the 4x simulated CPU throttle) and hydration of the landing's client components. Reducing that means converting non-interactive landing sections to server components or otherwise shrinking the client bundle. That is a structural change, not an animation-internals change, and it has not been done or authorized here.

## Reconciliation changes in this pass
- KF-036.9 (child of KF-036): OPEN -> IN_PROGRESS (browser reproduction; remote proof external). KF-036 parent remains OPEN (other children open).
- KF-005, KF-020, KF-031, KF-023, KF-006: evidence links and history added; states unchanged or moved as recorded in the ledger history.
- Totals and child breakdown recomputed; validator PASS.

## Genuinely unresolved
- KF-023 simulated mobile median 3012 ms vs 2500 ms. Remaining cost is the Next/React runtime and landing client hydration (not the animation library).
- In-app navigation away from an in-progress rehearsal: no confirmation (product decision).
- Hold deactivation read-then-write without a version guard (possible lost update; not exercised concurrently).
- KF-036.4 (realtime burst), KF-036.1–.8 and all other OPEN children: not started.

## External (not local)
- Authenticated display page with real Supabase Realtime; real selectSession; real persistence of hold/rehearsal/import on an event; shared dev database; Supabase RLS policies; migration staging; remote reset; password-manager autofill; browser zoom 200%; screen-reader speech; KF-010 provider and alerts.

## Requested from Codex
1. Accept the reference-counted inert registry as the shared modal pattern (tests and browser evidence above).
2. Decide whether in-app navigation away from an in-progress rehearsal needs a confirmation; current protection is persistence, not a prompt.
3. Decide whether KF-023 proceeds to a structural client-bundle change (server components for non-interactive landing sections), which is outside animation internals.
4. Decide whether the hold deactivation read-then-write needs a conditional update, and whether to exercise it concurrently.
