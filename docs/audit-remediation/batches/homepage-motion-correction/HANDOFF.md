# Homepage motion correction: handoff for independent review

**Status: READY_FOR_CODEX.** Not verified. `CODEX_VERIFIED` is not set and is not set by this batch.

| | |
|---|---|
| BASE_SHA | `9f6930ad600a3bf018d4933f523fca9156935e53` (reviewed HEAD; implementation `c5c51d4`) |
| FINAL_SHA | `73c6d818596ee0b8ea05f97d3bdb1c75d8b11612` (code and evidence commit `73c6d81`) |
| Scope | GM-01, GM-02, GM-03 corrections plus the original-batch runtime proof. No push, deploy, migration, remote fixture or seed. `capture:product` not run. Port 3000 not used. Floating Pause stays removed. No app colour or visual changed. |

## GM verdict table

| Item | Verdict | Evidence | Still open |
|---|---|---|---|
| **GM-01** Dialog inside transformed smoother | **Closed, for independent review** | `results/gm01-dialog.json`: 128/128 checks across 2 callers × 2 viewports × top/scrolled (8 contexts). Screenshots and recordings in `gm01/`. | Mobile (375) dialog not tested. Reduced-motion dialog not tested separately. |
| **GM-02** Blind 900ms correction, stale jumps | **Closed, for independent review** | `results/gm02-navigation-prod.json`: 23/23 on production. `results/gm02-navigation-dev-strict.json`: 23/23 on Strict Mode dev. Unit tests: `scroll-navigation.test.ts` (6/6). | Wheel and trackpad feel not measured. Safari and Firefox not run. |
| **GM-03** Gradient ownership, arrival | **Closed for Chromium, for independent review** | `results/gm03-gradient-arrival-prod.json`: 37/37. `results/gm03-gradient-arrival-dev-strict.json`: 36/36 (run before the interruption-timing fix; see below). Recordings in `gm03/`. | Safari `-webkit-background-clip`. Hidden-tab branch (`finish(false)`) not exercised. Browser 200% zoom not exercised. |

## Defects found during this batch, and fixed

1. **Backdrop click never closed the dialog.** The backdrop was a sibling button. `useDialogFocus` marks siblings `inert` to trap focus, and inert nodes take no pointer events. Measured: `elementFromPoint` at the gutter returned the overlay `div`. Fixed by handling the click on the overlay with a target check. Measured after fix: gutter click closes in all 8 contexts.
2. **Back into a hash route snapped 1964px about 0.7s after mount.** Trace in the Strict dev copy: our smooth write started, then Next.js's router wrote `htmlElement.scrollTop = 0` and `scrollIntoView()` (`layout-router.js`), and ScrollSmoother followed. The engine read that foreign motion as its own, waited for six still frames, then corrected. Fixed three ways: `ScrollTrigger.refresh()` before measuring a navigation; a navigation on popstate or mount waits for the window to be still for four frames (max 1500ms, cancelled by the same input and navigation paths); the engine does not settle on a scroller that has not moved yet (start position captured before the first write). After fix: scenario D lands at top 88 with range 0px.
3. **Lint errors:** `set-state-in-effect` in the dialog's mount gate (now `useSyncExternalStore`), and `prefer-const` in the scroll test. Both fixed; lint has 0 errors.
4. **Test-side artifacts, not product defects:** the first GM-01 run failed "focus returns to trigger" because the trigger was opened by DOM click, so there was no prior focus to return to. The harness now focuses the trigger first, as a real pointer click does. GM-03 sampling read the entrance before hydration, and GM-03's interruption check expected no storage write; `arrival.tsx` writes storage on visitor interruption by design (`finish(true)`), so the expectation now matches the design.

## Evidence table

All paths are under `docs/audit-remediation/batches/homepage-motion-correction/evidence/`.

| Check | Result (production `next start` on 3961 unless noted) |
|---|---|
| Dialog backdrop size | Exactly the viewport: 1280×720 → `{0,0,1280,720}`; 1440×900 → `{0,0,1440,900}` |
| Dialog panel fit | 1280×720: panel top 32, bottom 688, 656px tall. Image region scrolls internally (`scrollHeight` 759 vs `clientHeight` 585). Close control visible in all contexts. |
| Page lock while open | 600px wheel while open: scrollY 0 → 0 |
| Focus trap | 30 Tab presses: 0 escapes. 10 Shift+Tab: 0 escapes. |
| Escape and focus return | Escape closes; focus returns to the trigger; `html` overflow restored to `''`; wheel scrolls the page after close |
| Product → Features → Product | `#product` top 88 (target 88 ± 2); last-second range 0px; y 1655 at 900ms and at end |
| Home key 150ms after Features click | Home scrolls to top (the key's own behaviour); range 0 in last second; y 0 at 1200ms and 2000ms |
| Wheel 240px 150ms after Features click | Settles; range 0px |
| Route exit then Back | No scroll writes on `/login` (0 → 0). Back restores `#features`; top 88; range 0px |
| Direct links | `#features` top 88; `#product` top 88 |
| Resize 1440 → 900 during navigation | Range 0px; smoother transform cleared at 900px; restored at 1440 with no errors |
| Reduced motion during navigation | Range 0px; `data-motion` = `off` |
| Viewport readback | 1440×900, 1366×768, 375×812, 320×640; `scrollWidth` = `clientWidth` in each (no horizontal scroll) |
| Shader suspension | Visible: 60 WebGL draws/s. Offscreen (scrollY 5000): 0 draws/s. |
| Live preference, reduced on | `data-motion` off; smoother transform removed; pin spacers 0; shader 0 draws/s |
| Live preference, reduced off | `data-motion` on; smoother recreated; pin spacers 1; shader 61 draws/s |
| Scene scrub forward | Caption: "Before the cue · Opening Keynote" → "Console cut · Product Launch Demo" → "Reaching the room" → "Display views updated"; scrollY peak 3600 |
| Scene scrub back | Same four captions reversed |
| Gradient | Rest 43%. Hover: 43 → 41.3 → 37.2 → 33.9 → 31.2 → 29.6 → 28.7 → 28.2 → 28 (gradual transition). Keyboard focus-visible: 28%. Focus loss: 43%. |
| Arrival, fresh | Class on during sweep; class removed at completion; `animation-name` `none`; no arrival animation running at 1.9s; storage `1` |
| Arrival, no restart | After class removal: 0 arrival animations running; checks 1 and 9 |
| Arrival, second visit / reload / Back / deep link / first-visit deep link | No class in any case; resting 43% |
| Arrival, interruption | Wheel 250ms into arrival ends it; storage `1` (by design) |
| Arrival, reduced first load | No class; resting 43% |
| Arrival, reduced live mid-sequence | Ends at once; no restart |
| Arrival, denied storage | Arrival still runs; no page errors; settles at 43% |
| Smoother before scenes | `evidence/order/ordering-capture.txt`: on load, Strict Mode remount, breakpoint rebuild and reload, every `ctx-build` follows a `smoother-create` and sees the transform. Breakpoint: kill, then rebuild without transform. |
| Pin spacers | One `.pin-spacer`, inside `#smooth-content`, one wrapper, in both Strict dev and production (`order/pin-count.txt`) |

**Ordering limit:** the order was observed through the DOM transform on `#smooth-content`, a proxy for the smoother's existence. It is not read from the ScrollSmoother instance. The ordering capture ran from a dev copy with marker logs, not the repository; the repository code is unchanged except the comment.

## Recordings

Raw Playwright recordings (webm, about 120 MB) are kept local under the evidence folder and excluded by `evidence/.gitignore`. Regenerate with the scripts in `evidence/scripts/`.

- GM-01: `evidence/gm01/video-{console,fleet}-{1280x720,1440x900}-{top,scrolled}/`
- GM-02: `evidence/gm02/video-{A-rapid,B-home,C-wheel,D-route,E-deep-*,F-resize,G-reduced}/`
- GM-03: `evidence/gm03/video-{1..7}-*/`
- Original batch: `evidence/orig/video-preferences/`, `evidence/orig/video-scene-scrub/`

Still frames: `gm01/shot-*.png`, `orig/viewport-*.png`.

## Checks

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | Pass (0) |
| `npx vitest run` | **652 passed, 60 files** (651 before; +1 regression test for an ignored first write) |
| `npx eslint .` | **0 errors**, 5 warnings (pre-existing, in `set-password`, `accept-invite-panel`, `auth-context`, and `brag-output`, none in this batch's files) |
| `node docs/audit-remediation/validate_ledger.mjs` | PASS. Its test: 7/7 |
| `npx next build` (Turbopack, default) | **Blocked by environment.** `TurbopackInternalError` while spawning and binding a PostCSS loader process: `Operation not permitted (os error 1)`. Same failure sandboxed and unsandboxed. Logs: `evidence/checks/build-turbopack-*.log`. |
| `npx next build --webpack` | **Pass.** This is a labelled fallback, not the standard build. Logs: `evidence/checks/build-webpack-*.log`. |
| Lighthouse | Not re-run. The change touches the dialog (closed at load) and navigation scripts, not first-load markup or CSS. Mobile LCP target 2500ms (KF-023) remains open. |
| HawkScan post-commit | Not run. The environment reports `HAWK_API_KEY` unset and the runtime unavailable. |

## Replica contrast failures (for follow-up, not changed here)

Lighthouse flags three `color-contrast` nodes on mobile. The same nodes appear in the baseline runs, so they predate this batch. Source: `homepage-motion/lighthouse/*.json`.

1. **"Rafael Costa" and "9:55 AM"** in the operator-console replica row (`bg-status-green/10`, text `text-muted-2`, token `#8a8070`). Computed from product tokens: **4.01:1** over card `#17140f`, **4.41:1** over background `#0c0b09`. Both are below 4.5:1 (AA, normal text).
2. **"Release"** in the "You have control" strip (`border-status-green/30 bg-status-green/10`). Lighthouse flags the strip container. The span that fails is **not confirmed**. `text-status-green` (`#30d158`) on the same surface computes to **7.72:1**, so the failing text is probably the muted label, not the button. Identify the span before choosing a fix.
3. The third node is the same strip's container, as above.

Fix options (not applied, because they change app colour): use `text-muted` (`#a79d8b`, 5.82:1 on card-green) for row metadata on green surfaces, or reduce the green tint. This is a design decision for review.

## A–F status (refreshed)

| | Batch | Status | Basis | Limits |
|---|---|---|---|---|
| **A** | Responsive smooth scroll | **PASS** (desktop Chromium) | GM-01 and GM-02 evidence above | Wheel and trackpad feel not measured. Safari and Firefox not run. Mobile native path verified only through teardown at 900px. |
| **B** | Gradient headline | **PASS** (Chromium) / UNVERIFIED (Safari) | Gradient evidence above | Safari `-webkit-background-clip` not run. |
| **C** | First-entry arrival | **PASS** (Chromium) | Arrival evidence above; Strict Mode in dev | Hidden-tab path not exercised. No-JS not re-tested. |
| **D** | Scroll scene | **PARTIAL** | Caption sequence forward and back, release reached | Caption-to-painted-opacity agreement not measured. Scrub not re-tuned (`scrub: 0.6` stacks with smoother lag). |
| **E** | Component polish | **PARTIAL**, unchanged this batch | Dialog moved to a portal; accordion and action unchanged | Rapid-selection tween accumulation not measured. |
| **F** | Ambient and lifecycle | **PASS** | Offscreen suspension; live propagation to CSS, GSAP and WebGL, and back | None new. |

## Outstanding proof and blockers

- **Standard production build** blocked by the environment (Turbopack PostCSS loader). Needs a fix in the environment, or Next upgrade, before the standard build can be called green.
- **200% browser zoom** not run. Playwright cannot emulate browser zoom. 320px and 375px viewports were used as the nearest proxy.
- **Safari and Firefox** not run for GM-01/02/03.
- **Replica contrast** (above) unresolved; needs a design decision.
- **Lighthouse** not re-run after this batch. Mobile LCP (KF-023) still open.
- **HawkScan** not run (no API key in this environment).
- **Independent review** not done. This batch is for review, not verified.

## Servers and cleanup

Production server on 3961 and the dev copy on 3971 were used for the runs. The user's dev server on 3000 was not touched. The dev copy was a temporary directory outside the repository.
