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
