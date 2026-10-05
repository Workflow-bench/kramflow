# CB-DESIGN batch report

**Status: NOT COMPLETE. KF-023 OPEN. Not READY for acceptance.**

Mobile simulated LCP median is 3454.8 ms against the ≤2500 ms target. The recovery to 3012 ms seen in an earlier pass was lost when the hero moved to the approved 45/55 composition, so the performance gap is now larger than the earlier checkpoint. No self-approval. `CODEX_VERIFIED` is not set.

## Identity

| Item | Value |
|---|---|
| Original base | `cb7737e` (BASE_SHA of the first CB-DESIGN checkpoint) |
| Resumed from | `54d1fc5318ece4e1bcb1217fe040797430e0d8a9` (branch `integrate/ui-revamp-landing`) |
| Uncommitted snapshot reviewed by Codex | `CB_DESIGN_WIP_TRACKED.patch`, sha256 `d0af67e724f3fe6dfa4e05f00d8f2436eee12ae4a324219bd61302c4412e1f35` |
| Final commit | Recorded in `TEST_RESULTS.json` (`finalSHA`) after commit |

Pre-existing untracked paths (`.agents/`, `.claude/`, `.impeccable/`, `brag-output*/`, `data/skills/`, `skills-lock.json`, two `REVIEWS` files) were not committed.

## Original package matrix (1–15)

Status key: **VERIFIED** = behaviour checked in this pass by unit, real-DOM or browser evidence. **PARTIAL** = implemented, some evidence missing. **PRIOR** = prior-batch work, covered by the 638-test suite, not re-run here. **OPEN** = not done.

| # | Original obligation | Status | Evidence / gap |
|---|---|---|---|
| 1 | CB-F1 identity-aware rehearsal persistence and provider ordering | PRIOR | Suite covers `persisted-run` and identity policy. Not changed in this pass. |
| 2 | CB-F2 complete installed auth event domain (MFA/event domain) | PRIOR | `auth-events.test.ts` exhaustive event coverage in suite. Not changed. |
| 3 | CB-F3 legacy Hold compare-and-set | PRIOR | Hold route tests and local Postgres evidence from earlier batch. Not changed. |
| 4 | CB-F4 safe dialog focus restoration | VERIFIED (real DOM) | Real Modal/ConfirmDialog harness, 9 scenarios, `focus-harness/cleanup-results.json`. Fixed BODY-as-trigger bug. Scroll restoration not measured. |
| 5 | Public component scale | PARTIAL | `Button` gains `nav` (44px) and keeps `public` (48px) and `hero` (52px). Heights not measured in browser. |
| 6 | Shared AuthShell | VERIFIED (layout) | CD-F5 art-less single column. One `h1`, one `main`, no horizontal overflow at 320/375/768/1280/short-600 (`after-batch3/browser`). |
| 7 | Login behaviour and composition | PARTIAL | Recovery and signup links carry validated `next`. Submit and error states unchanged, not re-run. |
| 8 | Signup, recovery and confirmation states | PARTIAL | Link targets verified (invite/next precedence, malformed invite, unsafe next). Controlled submit, busy, success, reset and reauth states not run. |
| 9 | Immediate landing hero and product scene | VERIFIED (visual) | Desktop 45/55 composition and mobile stacked captures. No clock, no scroll fade, one "Demo show" label. LCP open (see 14). |
| 10 | Unified navigation and actions | PARTIAL | Nav, hero and CTA use shared `LinkButton`. Menu keyboard and focus not re-tested in this pass. |
| 11 | Early playable local demonstration | PARTIAL | Demo still directly after hero (`#demo`). Local cue propagation and reduced motion not re-tested. |
| 12 | Mobile outputs and truthful claims | PARTIAL | Unmeasured `1 s` and `200+` removed (CD-F7). "6 digits" and "4 surfaces" kept, not verified in this pass. |
| 13 | Shared motif and reduced motion | PARTIAL | Hero entrance is CSS transform only, disabled under `prefers-reduced-motion: reduce`. Reduced-motion not browser-tested. |
| 14 | Integrated browser, accessibility and performance proof | PARTIAL / KF-023 OPEN | a11y 1.0 both series. CLS 0. Mobile LCP median 3454.8 ms (target ≤2500). Contrast composite, reduced-motion, controlled auth states, 200% zoom, screen reader not done. |
| 15 | Evidence, report and ledger handoff | PARTIAL | This report, `TEST_RESULTS.json`, `EVIDENCE_INDEX.md`. Ledger validator PASS. Commit pending. |

## Crosswalk: findings to packages and design IDs

| Finding | Package | Design IDs | Status |
|---|---|---|---|
| CD-F1 focus eligibility (visibility, disabled) | 4 | — | VERIFIED |
| WIP-F1 link inside disabled fieldset wrongly rejected | 4 | — | VERIFIED (native `:disabled`, links eligible) |
| CD-F2 failed sign-out drops pending hydration | 1 | — | PRIOR tests pass; real-provider ordering unverified |
| CD-F3 / WIP-F2 invite and recovery `next` continuation | 7, 8 | D01, D05, D12 | PARTIAL (links verified; controlled submit not run) |
| CD-F4 demo visibility gate and LCP | 11, 14 | D04, D13 | Gate removed; LCP OPEN |
| CD-F5 art-less AuthShell empty column | 6 | D01, D03, D05 | VERIFIED (layout) |
| CD-F6 / WIP-F3 hero composition, scroll fade, telemetry | 9, 10, 13 | D04, D06, D07, D08, D09, D10 | VERIFIED (visual); reduced motion PARTIAL |
| CD-F7 unmeasured numeric claims | 12 | D15 | PARTIAL |
| WIP-F5 performance target | 14 | D13 | OPEN |

Design IDs from `KRAMFLOW_LANDING_AUTH_DESIGN_REVIEW.md`. D02 (public sizing) → package 5. D11 (auth label size and contrast) → packages 7–8 and contrast in 14, **not reconciled in this pass**. D14 (no unsupported providers) → package 8, unchanged.

## Performance (KF-023)

Lighthouse 13.5.0, simulated throttling (default), production build on a separate server (port 3959, stopped after measurement). Raw runs are in `evidence/CB-DESIGN/after-batch3/lighthouse/`.

| Series | LCP runs (ms) | Median (ms) | Perf | A11y | CLS |
|---|---|---|---|---|---|
| Mobile simulated | 3383.1, 3463.0, 3454.8 | **3454.8** | 0.92, 0.91, 0.91 | 1 | 0 |
| Desktop simulated | 716.8, 718.0, 747.3 | 718.0 | 1 | 1 | 0 |

Target ≤2500 ms: **not met**. KF-023 stays OPEN.

Diagnosis (controlled, `evidence/CB-DESIGN/perf-probe/`):
- The LCP element is the hero support paragraph. Its paint is not gated by its own resources.
- Blocking-by-resource removal (images, fonts, CSS, preloads, system font, JS disabled) does not reach target. Each class alone leaves LCP at 3.2–3.4 s.
- Static control HTML of 638 ms LCP, the landing HTML copy at 3397 ms, and the same copy with all `<script>` tags removed at 1812 ms. Scripts are the largest factor in the simulator's model.
- Root providers (`MotionPreferences`, `ToastProvider`) removed: 3245 ms. Not the gate.
- Below-fold `next/dynamic` split: 3382 ms. No gain, reverted.
- CSS-only hero entrance and removal of `priority` on the below-fold mobile image: no measurable gain. Entrance kept (no framer on copy).
- Not resolved: which shared chunk is responsible. The simulator treats the 15 requested scripts as work before paint. Reducing that requires a route-level runtime split of marketing from product providers, a broader change not made here.

## Browser proof (production build, port 3959)

`evidence/CB-DESIGN/after-batch3/browser/browser-report.json` and screenshots at 1280×800, 768×1024, 375×812, 320×640, 1280×600 for landing, login, signup, reset and set-password. Measured `innerWidth`/`innerHeight` recorded. No horizontal overflow. One `h1` and one `main` per page.

Link targets (static DOM, no submission):
- `/login?next=/invite/<token>` → Forgot password and signup keep the validated invite destination.
- `/reset?next=…` → Back to log in keeps `next`.
- `/signup?invite=<malformed>` (contains `?` and `#`) → `/login?next=%2Fdashboard`.
- `/signup?next=…&invite=<valid>` → `next` wins, `/login?next=%2Fe%2F1%2Fremote`.
- `/signup?next=//evil.example` → `/login?next=%2Fdashboard`.

Dev and harness routes return 404 in production: `/dev`, `/dev/components`, `/dev/modal`, `/dev/realtime`, `/dev/import`, `/dev/import/console`, `/dev/rehearsal`, `/api/dev-harness`. Positive control `/login` returns 200 through the same check.

Hero check: no wall-clock text, `Demo show` label rendered once (uppercase by CSS), h1 opacity 1.

## Gates (final tree)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 58 files, 638 tests, all pass |
| `npx eslint .` | 0 errors, 5 warnings (existing `window.location.href` navigation in set-password, accept-invite-panel, auth-context) |
| `npx next build` | Pass |
| `node docs/audit-remediation/validate_ledger.mjs` | PASS |
| Production dev-route 404 check | Pass (see above) |
| Harness-asset scan | Not performed. Dev routes are absent from the build and the known list returns 404. A hashed-asset string scan remains open. |

Lint config now excludes `docs/audit-remediation/evidence/**` (generated bundles and capture scripts), so evidence does not count as product lint.

## Not verified (open)

- Controlled signup success, busy and error states; reset submit; reauthentication failure and generic new-link copy in a browser. Requires local transport seams, not run.
- Menu and dialog keyboard in the final build; mobile output tablist arrows and focus wrap; local cue propagation; reduced-motion captures; 200% zoom; screen reader; composite contrast reconciliation (package 14, D11).
- Password manager and password visibility toggle behaviour.
- Hawkscan: `HAWK_API_KEY` and runtime not configured, so no scan ran.
- External debt unchanged: live provider and auth-role proof, shared migration and settings, DNS and deployment, ingestion and alerts, legal approval.

## Codex review request

Not issued. The batch does not meet its own acceptance criteria, because KF-023 is open and several browser proofs are missing. Issuing a request now would ask for a verdict on an incomplete tree.
