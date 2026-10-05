# KramFlow homepage: "Call the show" — implementation batch report

Implementation of the supplied homepage design direction. Not self-approved; pending independent Codex review and the user's visual judgment.

## Identity

| Item | Value |
|---|---|
| `BASE_SHA` | `b383b3ef07e0e2ca5114ce8fbefdd8f07d1eff99` |
| `FINAL_SHA` | recorded in the commit that carries this file |
| Branch | `integrate/ui-revamp-landing` |
| Dirty state at start | Clean tracked tree at `b383b3e`; nine pre-existing untracked paths preserved and excluded |
| Dirty state at finish | Clean after commit; the same untracked paths untouched |

Intervening changes: none. HEAD matched the research baseline exactly, so nothing had to be preserved beyond the untracked paths.

## Task table

| # | Area | Task | Status |
|---|---|---|---|
| A1 | Hero | Remove `StandbyOverlay` from the homepage | DONE |
| A2 | Hero | Copy, category label, two actions, caption per brief | DONE |
| A3 | Hero | `100svh` including header; product pixels in the first viewport | DONE |
| A4 | Hero | Bounded aperture, uniform scale, computed fade stop | DONE |
| A5 | Hero | "View full console" expansion with keyboard, Escape, focus containment and return | DONE |
| A6 | Nav | Labels, real destinations, header clearance, legacy anchors | DONE |
| B | Before doors | Asymmetric editorial + homepage-owned Prepare/Rehearse selectors | DONE |
| C | Call the show | Shared cue state over real console A/B and selected output pair | DONE |
| D | When plans change | Ruled operational list + one contextual capture | DONE |
| E | The room | Displays capture + three verified connection paths | DONE |
| F | Closing | Statement, actions, quiet light echo, footer preserved | DONE |
| M1 | Motion | Visible ambient light drift, measured | DONE |
| M2 | Motion | 260ms directional cue reveal | DONE |
| M3 | Motion | Selection indicator + output change, full keyboard | DONE |
| M4 | Motion | Pause control, reduced motion, runtime preference change, fallbacks | DONE |
| P1 | Provenance | Route, date, dimensions, SHA-256, state, drift per asset | DONE |
| P2 | Provenance | Refresh stale captures | **BLOCKED** (see Blockers) |
| Q1 | Checks | Viewports, contrast, keyboard, anchors, performance, gates | DONE |

Lanes: none. No agent tools were used; this was built sequentially by one implementer.

## Applied reference rationale

| Reference | Concrete pattern applied |
|---|---|
| Teenage Engineering TX–6 | The unchanged instrument carries the identity: the hero's aperture gives the real console the bottom half of the opening viewport, and the surrounding type stays quiet rather than competing with it. |
| Ableton Push 3 | Task-led chronology (prepare → call → adapt → connect) and a **visible, permanent Pause control** for the continuous light, rather than motion the visitor cannot stop. |
| Rive | Concrete labelled outputs: one readable venue display at a time with its canonical role name (Presenter / AV / Green Room / General) and a plain-language subtitle, instead of four decorative miniatures. |
| Lusion | One dominant motion scene (the ambient field plus the cue reveal) with everything around it still; its loader, 3D spectacle and cursor dependence deliberately excluded. |

## Source and licence manifest

| Source | Use | Licence |
|---|---|---|
| `@paper-design/shaders-react@0.0.81` (already installed, pinned exact) | The one ambient mesh gradient | Apache-2.0 (`node_modules/@paper-design/shaders-react/LICENSE`) |
| Motion Primitives `animated-background` | Pattern reference for the travelling selection indicator; reimplemented on the Framer Motion already in the project, attribution in `segmented-selector.tsx` | MIT |
| Watermelon Continuous Tabs | Same behaviour family; **not** installed or copied — the registry source was not fetched, so nothing was adapted from it | n/a |
| React Bits Color Bends | Not used (adds Three; MIT + Commons Clause) | n/a |

No new runtime dependency was added. `package.json` is unchanged by this pass.

## Claims manifest

| Published claim | Supported by | Verdict |
|---|---|---|
| "Run your cue sheet, timers, and venue displays from one operator console." | Cue sheet, timer and display routes all exist under one console shell | SUPPORTED |
| "Organise the session, its items, timings, and people in the cue sheet." | `cue-sheet.png` shows exactly these columns | SUPPORTED |
| "Practice the cue sequence without changing the live displays." | Rehearsal Mode, `app/e/[eventId]/rehearsal` | SUPPORTED |
| "Add or remove time while the current cue is running." | `app/api/display-engine/timer`, `/time` | SUPPORTED |
| "Show a hold message on the selected displays." | `app/api/display-engine/hold` | SUPPORTED |
| "Send the right message to the right screens." | `app/api/display-engine/broadcasts` | SUPPORTED |
| "The console shows who has control." | `ControlLeaseStatus`, claim/release/renew in `controls-panel.tsx` | SUPPORTED |
| "Control is a lease… what a collaborator is allowed to do is a separate permission." | Lease in the store; owner-floor permission tests under `app/api/display-engine` | SUPPORTED |
| "Join a venue display by link, QR code, or a six-digit connection code." | `lib/server/share-links.ts`, `lib/tv-code.ts`, `components/dashboard/qr-code.tsx` | SUPPORTED |
| Four view names: Presenter / AV / Green Room / General | `DISPLAY_TYPES` in `lib/display-engine/types.ts` | SUPPORTED |
| "Recorded product preview. No live event is changed." | Statement about this page, rendered on screen | SUPPORTED |
| Spreadsheet/Excel import | Applicable behaviour not verified in this pass | **OMITTED** |
| "1s to reach every screen", "200+ items" | No measurement | **REMOVED** (those sections are gone) |
| Pricing, logos, customers, uptime, "No credit card" | Nothing confirms them | **NOT PUBLISHED** |

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS, no output |
| `npx vitest run` | PASS, 638 tests across 58 files |
| `npx eslint .` | PASS, 0 errors, 5 pre-existing warnings |
| `npx next build` (default bundler, no fallback) | PASS |
| `node docs/audit-remediation/validate_ledger.mjs` | PASS |
| `capture.cjs after` | PASS, 0 console errors, 0 page errors |
| `contrast.cjs` | PASS, 0 failures across 11 text targets × 2 gradient samples |

## Criteria

| Criterion | Verdict | Evidence |
|---|---|---|
| Whole-page desktop captures 1280×720 / 1440×900 / 1920×1080, compact 1280×600, mobile 375 | PASS | `after/home-*-whole-page.png`, `-first-viewport.png` |
| First viewport shows header, promise, both actions and meaningful product content | PASS | Hero height equals viewport exactly at 720/900/1080; aperture fully inside it (228 / 363 / 520 px); cue title, countdown and Next/Previous/Hold all in the opaque band |
| Compact 1280×600 | PARTIAL | Hero resolves to 631px against a 600px viewport: the copy block cannot shrink further and the aperture is already at its 190px floor, so the section grows by 31px and the page scrolls. 160px of console is still in the first viewport. Content-driven growth, not clipping — the behaviour the direction asks for at zoom. |
| Full-image expansion: keyboard, Escape, focus containment and return | PASS | `fullConsole`: dialog opens with focus inside and body scroll locked; Escape closes, focus returns to the trigger, scroll restored |
| Hero light visibly changes shape/position between 2s and 4s | PASS | Background-only region (500×380 clear of text and product): mean channel change 4.0 at 0→2s, 4.37 at 2→4s, local peaks 17–25/255. Frames: `ambient-light-region-{0,2,4}s.png` |
| Pause / Resume | PASS | Canvas present → paused: canvas unmounted, static field intact, heading readable, control reads "Resume motion" → resumed: canvas back |
| Reduced motion, and a runtime preference change | PASS | No shader, static field, h1 visible, control reports "Motion off · system setting"; flipping the preference mid-session brings the shader up |
| WebGL absent / context loss / library-load failure | PASS | `--disable-3d-apis`: no canvas, static field composes, h1 visible, zero page errors. Context loss and import failure both fall to the same static layer (error boundary + catch) |
| Cue before / after / reset, all four views, cue persistence, provenance label | PASS | before `console-prev` + `display-presenter-prev` "Cue 3 · Opening Keynote"; advanced `console` + `display-presenter` "Cue 4 · Product Launch Demo"; AV/Green Room/General/Presenter each resolve at the advanced cue; reset returns to cue 3; label rendered |
| Keyboard operation of the selector | PASS | Arrow Right/Left, Home, End, wrapping, selection follows focus, output follows selection |
| Navigation, legacy anchors, destinations | PASS | `#prepare`, `#call`, `#adapt`, `#room` and legacy `#one-cue`, `#product`, `#features` all land at 96px with the header bottom ≤77px; 3 signup and 2 login destinations intact |
| No horizontal overflow | PASS | `scrollWidth == innerWidth` at all five widths |
| Focus visible and returned | PASS | Every tab stop reports an outline or ring; dialog returns focus |
| Contrast over actual gradient extrema | PASS | 11 targets sampled at two different gradient states against the composited background; minimum 4.68:1 (13px eyebrow), h1 9.69–11.63:1, motion control 13.28:1 |
| No hidden readable text, no fake product controls | PASS | All controls are homepage-owned and visually distinct from app chrome; no text is faded (caption and expansion control sit outside the aperture) |
| Reflow / zoom | PASS | `min-height: max-content` on the hero lets content grow past the viewport instead of clipping |
| Screen reader | UNVERIFIED | No screen reader available in this environment; stated rather than assumed |
| Desktop LCP ≤2.5s, CLS ≤0.1, vs baseline | PASS | See below |
| Product-image fidelity to the current app | **PARTIAL / BLOCKED** | See `PROVENANCE.md` |

## Performance, three runs each, identical settings

Lighthouse 13.5.0, `--preset=desktop`, headless Chrome, production builds, own ports, no concurrent build. Baseline built from `b383b3e` in a separate git worktree with the same bundler. Raw reports in `lighthouse/`.

| Series | LCP runs (ms) | LCP median | CLS | Script transfer | Main-thread | A11y |
|---|---|---|---|---|---|---|
| Baseline `b383b3e` | 1129, 804, 780 | **804** | 0 | 358 KB | 294–336 ms | 0.96 |
| After | 861, 806, 800 | **806** | 0 | 359 KB | 245–776 ms | **1.00** |

- LCP median +2 ms — inside run-to-run noise, and the first run of each series is a cold-start artifact.
- CLS 0 in both: the recorded views swap inside fixed-ratio boxes, so no state change reflows anything.
- Script transfer +1 KB despite six new sections, because the shader is still the only deferred extra and no dependency was added.
- Accessibility rose 0.96 → 1.00: the restored sections carrying `text-muted-2/60` contrast failures are gone.
- Targets: LCP ≤2.5s met (806 ms); CLS ≤0.1 met (0).

## Evidence index

| Path | Contents |
|---|---|
| `after/home-*-{first-viewport,whole-page}.png` | Five viewports, first screen and whole page |
| `after/ambient-frame-{0,2,4}s.png` | Hero frames at 0/2/4s |
| `after/ambient-light-region-{0,2,4}s.png` | Background-only crops used for the motion measurement |
| `after/motion-paused-*.png`, `reduced-motion-*.png`, `fallback-no-webgl-*.png` | Motion states and fallbacks |
| `after/cue-{before,after,reset}.png`, `view-*.png`, `view-keyboard-focus.png` | The signature interaction |
| `after/full-console-expanded.png` | Expansion dialog |
| `after/contrast.json`, `contrast-background.png` | Contrast measurements and the sampled background |
| `after/report.json` | Machine-readable check output |
| `lighthouse/{baseline,after}-desktop-run{1,2,3}.json` | Raw Lighthouse reports |
| `PROVENANCE.md`, `assets.json` | Per-asset route, date, dimensions, SHA-256, state, drift |
| `capture.cjs`, `contrast.cjs` | Reproduction scripts |

## Blockers and exact remaining actions

1. **Product-image fidelity (P2).** Published captures are genuine but older. Two confirmed visible drifts: the console header's padlock (now a `LogOut` icon) and the Displays fleet's "Speaker Ready" type label (now "Green Room"). Three more surfaces changed with visible impact not established. Refresh is blocked because `capture:product` performs shared-resource writes and `DEMO1_PASSWORD` is absent. **Exact action:** supply `DEMO1_PASSWORD` for a read-only capture, or authorise a seed, or commission a network-isolated fixture that mounts the real surfaces (the `fake-transport` seam is the starting point). Full reasoning in `PROVENANCE.md`.
2. **Compact 1280×600** resolves to 631px, documented above as content-driven growth rather than clipping. Open for design judgment.
3. **Screen reader** verification is unavailable in this environment.

Nothing was pushed, deployed, migrated, or changed in any provider or account. No audit state was modified and `CODEX_VERIFIED` was not assigned.
