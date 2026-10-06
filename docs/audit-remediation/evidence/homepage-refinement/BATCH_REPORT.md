# KramFlow homepage refinement — HOME-R01…R10

One integrated refinement batch against the reviewed homepage. Not self-approved; pending independent Codex review.

## Identity

| Item | Value |
|---|---|
| Base (`BASE_SHA`) | `a29ebf21685115c04de4f88150866219e9af7411` |
| Final (`FINAL_SHA`) | `06f43fa7a60009ccc4cf4c48f9712ed16aaa1bf9`, plus the follow-up commit recording it |
| HawkScan | Not run: `HAWK_API_KEY` and the hawk runtime are absent in this session |
| Branch | `integrate/ui-revamp-landing` |
| Dirty delta at start | None tracked. Nine pre-existing untracked paths, all preserved and excluded from the commit. |
| Intervening changes | None — HEAD matched the reviewed revision exactly. |
| Build served for evidence | Production `next build` of the committed tree, `next start -p 3961`. The user's port 3000 was never touched. |
| Baseline for comparison | `a29ebf2` built in a separate git worktree with the same bundler and settings, served on 3962. |

Lanes: none. No agent tools were used; built sequentially by one implementer.

## Ten-item result table

| ID | Verdict | What changed, and how it was checked |
|---|---|---|
| **R01** Opening composition | **PASS** | Headline raised to 66.6 / 92.2 / 112 px at 1280 / 1440 / 1920 inside a height-aware budget; explanation and actions tightened under it. The warm field was reshaped from a broad lateral wash into a wide, vertically tight band sitting on the console's top edge, with a second quiet pool away from the copy. Hero resolves to exactly the viewport (720 / 900 / 1080) and the cue, timer and Next/Previous/Hold stay in the opaque region at every size. |
| **R02** Readable signature scene | **PASS** | The console is now an unaltered crop (source px 1700,150 1660×670) carrying LIVE NOW, the cue title and owner, schedule variance, the countdown, the adjust row and the Next/Previous/Hold cluster — verified against both recorded states. One selected real output sits beside it. "View the whole console" opens the complete source image (measured natural ratio 1.600 = 3360×2100). Cause/consequence labels and the "Opening Keynote → Product Launch Demo" annotation are page type, outside every image. Not a timer-only crop. |
| **R03** Relevant adaptation imagery | **PASS** (one documented gap) | Each row now shows its own genuine region: timer → the console's timer and adjustments; hold → the Next/Previous/Hold cluster; notice → Broadcast Center; control → the control-ownership strip. Each has its own caption and one concrete scenario. **Gap:** no safe capture of a display *already holding* exists, so the hold row shows the control that triggers it and says so in its caption rather than implying a state never recorded. |
| **R04** Current asset fidelity | **PARTIAL — blocked** | The Next.js dev badge was measured in 13 of 14 published captures (identical 158-pixel glyph, extent x 38–113, y 39–114 from the bottom) and removed by **measured crop** on 12 of them, with before/after SHA-256 recorded. `console-prev.png` has no safe margin on either axis and still carries it. The padlock and the "Speaker Ready" fleet label need a recapture, which is blocked: the pipeline seeds and writes to hosted Supabase, and `DEMO1_PASSWORD` is absent. Full detail and exact unblock actions in `PROVENANCE.md`. |
| **R05** Whole-page rhythm | **PASS** | Measured section heights at 1440×900: hero 900, prepare 843, **call 1729**, adapt 784, room 596, closing 667. The cue stage is roughly twice any other chapter; preparation was compacted; connection became a three-step strip with the fleet behind an optional inspection rather than a fourth framed screenshot. |
| **R06** Replay and image handoff | **PASS** | The exhausted primary becomes **Replay cue change** in the same position. The displayed cue is announced (`aria-live`) and the announcement matches the painted pixels. Handoff rewritten: two layers keyed per shot, the previous capture stays painted until the new one decodes, the reveal runs over real pixels, and a superseded request is discarded — verified by a rapid three-selection test where the last choice won. Captures load on demand, not all on first paint. |
| **R07** Tab states | **PASS** | The indicator moved from `-z-10` (behind the button's own background) to `z-0` with the label at `z-10`; measured `zIndex: 0`, visible, and the selected label is 500-weight with a filled surface, so selection reads with motion on or off. Before Doors' panel now encompasses copy, image **and** caption (all three verified present). Hover never changes selection. Arrows/Home/End and roving tabindex preserved. |
| **R08** Honest motion controls | **PASS** | Pause now covers all nonessential motion, matching its label: the shader unmounts and the field measures **completely still** (mean 0.00, max 0.0 over 2s), while the cue still changes instantly under pause (new capture at 120 ms, `clip-path: none`). `useGsap` previously sampled `prefers-reduced-motion` once at setup; it now subscribes and re-runs, so an OS change mid-session is honoured — verified by flipping the preference at runtime and seeing the engines return. |
| **R09** Mobile disclosure | **PASS** | Escape now closes the menu and returns focus to the toggle (`aria-expanded` false, focus on the control owning `aria-controls="site-menu"`). Activating a chapter link closes the menu, sets the hash, scrolls natively and leaves the body unlocked. The exiting panel is `inert`, so no hidden link stays focusable. The reproduced bug no longer reproduces. |
| **R10** Useful copy | **PASS** | The operator is named exactly once ("Stage managers and AV teams", count verified = 1). "Lease" is gone, replaced with who calls cues versus what a collaborator's permission allows. "TV with no keyboard" is replaced by the verified flow: open `/tv` on the screen and enter the six digits from the Share Display card (`lib/tv-code.ts`, `app/api/tv/connect`). Each route is described by the device that receives the display. No pricing, uptime, customers or "no credit card" anywhere (checked). |

## Checks

| Check | Result |
|---|---|
| Viewports, requested vs **actual CSS viewport** and zoom | 1280×720, 1440×900, 1920×1080, 1280×600, 375×812 — actual CSS viewport equalled the request at every size, `visualViewport.scale` 1, DPR 1. No horizontal overflow anywhere. |
| Compact 1280×600 | Hero resolves to 624 px against a 600 px viewport: the copy cannot shrink further and the aperture is at its 190 px floor, so the section grows 24 px and the page scrolls. 167 px of console still sits in the first view. Content-driven growth, not clipping. |
| Cue before / after / replay, all four outputs, persistence | Verified; cue preserved across every view change; replay returns to cue 3. |
| Rapid selection | Three selections in ~180 ms: the last (Green Room) is the one displayed and announced. No stale pair. |
| Full view | Opens with focus inside, complete unchanged source image, Escape closes and focus returns to the trigger. |
| Contrast over the live gradient | 14 text targets sampled at two different gradient states against the composited background: **0 failures**, minimum 4.98:1 (13 px eyebrow), h1 15.21:1. |
| Ambient light visibility | Background-only band above the aperture: mean channel change 3.37 (0→2 s), **4.92 (2→4 s)**, peaks 19–22/255. Frames retained. |
| Reduced motion / runtime change / no WebGL | All resolve to the static field with content intact and zero page errors. |
| Console errors | Zero across every captured viewport and interaction. |
| Typecheck / tests / lint / production build / ledger | `tsc` clean; 638 tests across 58 files; ESLint 0 errors and 5 pre-existing warnings; default `next build` passes (no fallback bundler); ledger validator PASS. |
| Screen reader | **UNVERIFIED** — none available in this environment. All a11y results here are DOM/ARIA and Lighthouse checks, not assistive-technology testing. |

## Performance — controlled comparison, 3 runs each

Lighthouse 13.5.0, `--preset=desktop`, headless Chrome, production builds, own ports, no concurrent build. Raw reports in `lighthouse/`. Previous self-reported numbers were not reused; both series were measured fresh in this batch.

| Series | LCP runs (ms) | LCP median | CLS | Script | Images | A11y |
|---|---|---|---|---|---|---|
| Baseline `a29ebf2` | 1065, 793, 794 | **794** | 0 | 359 KB | 209 KB | 1.00 |
| After | 795, 793, 792 | **793** | 0 | 360 KB | 300 KB | 1.00 |

- LCP flat (−1 ms). CLS 0 in both — the two-layer handoff swaps inside fixed-ratio boxes.
- Images +91 KB: the deliberate R02 trade, since a readable console crop needs a larger served variant than a miniature did. `sizes` was corrected to state the *rendered* width of a cropped image, which is what made the crops sharp.
- Accessibility stayed 1.00. An intermediate revision of this batch dropped it to 0.90 by nesting `role="tab"` inside `<div>`/`<h3>` wrappers (`aria-required-children` / `aria-required-parent`); the tabs are now direct children of their tablist and the changing copy moved into the panel.
- First run of each series is a cold-start artifact; medians are the comparison.

## Evidence index

| Path | Contents |
|---|---|
| `after/home-*-{first-view,whole-page}.png` | Five viewports, first screen and whole page |
| `after/cue-{before,after,replay}.png`, `cue-view-*.png`, `cue-full-view.png` | The signature interaction and full inspection |
| `after/adapt-*.png` | Each adaptation row with its own imagery |
| `after/tabs-focus.png` | Selected and focused tab treatment |
| `after/ambient-region-{0,2,4}s.png` | Frames used for the light-movement measurement |
| `after/motion-paused.png`, `reduced-motion.png`, `fallback-no-webgl.png` | Motion states and fallbacks |
| `after/mobile-menu-{open,after-escape}.png`, `mobile-after-link.png` | Disclosure behaviour |
| `after/report.json`, `after/contrast.json` | Machine-readable results |
| `lighthouse/{baseline,after}-desktop-run{1,2,3}.json` | Raw reports |
| `PROVENANCE.md`, `assets.json` | Per-asset route, state, date, dimensions, SHA-256, de-badge crop, drift |
| `CHECKLIST.md`, `capture.cjs`, `contrast.cjs` | Plan and reproduction scripts |

## Blocked / open

1. **R04 asset recapture.** The padlock, the "Speaker Ready" fleet label and `console-prev.png`'s dev badge all need a fresh capture. Blocked by shared-resource writes in the pipeline and a missing `DEMO1_PASSWORD`. Exact unblock actions in `PROVENANCE.md`. Tracked separately; it did not stop the other nine items.
2. **R03 hold state.** No safe capture of a display already holding; disclosed on screen and here.
3. **1280×600** grows 24 px past the viewport by design; open for design judgment.
4. **Screen reader** verification unavailable here.

Nothing was pushed, deployed, migrated, seeded, or changed in any provider or account. No audit state was modified and `CODEX_VERIFIED` was not assigned.
