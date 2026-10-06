# Scroll scene, operations chapter, navigation — one batch

Three design lanes plus the HF-01…HF-07 correction debt. Not self-approved; pending independent Codex review.

## Identity

| Item | Value |
|---|---|
| `BASE_SHA` | `6f898aaea3de16e99bc41750c8b6d353f7070e42` (matched the expected starting HEAD) |
| Branch | `integrate/ui-revamp-landing` |
| Tree at start | Tracked tree clean; nine pre-existing untracked paths, all preserved and excluded |
| Restoration source | `one-cue-section.tsx`, byte-identical to the cached `origin/ui-revamp` ref `6d69834` (verified by empty diff). That is a **local cached ref, not a claim about the remote tip.** |
| Build served for evidence | Production `next build` of the committed tree, `next start -p 3961`. Port 3000 untouched. |
| Baseline for comparison | `6f898aa` built in a separate worktree, same bundler and settings, served on 3962. |

Lanes were worked sequentially by one implementer. No agents were launched, so no delegation is claimed.

## Lane A — the scroll scene restored (`components/site/room-scene.tsx`)

Adapted from the stored scene rather than rebuilt: real console left, the four real receiving views right, scroll driving a pinned desktop stage. The manual Advance/Replay scene and its giant crop are gone (`call-the-show.tsx` deleted), and `PlayableShow` stays unmounted.

Measured at 1440×900 on the production build:

| Scroll | Label | Console after | Displays shown |
|---|---|---|---|
| 1200 | Before the cue · Opening Keynote | false | 0 |
| 2100 | Console cut · Product Launch Demo | true | 0 |
| 2400 | Reaching the room | true | 1 |
| 2700 | Reaching the room | true | 2 |
| 3000 | Reaching the room | true | 3 |
| 3300 | Display views updated | true | 4 |

Reversing produced the same sequence backwards (3600 → 4 shown; 2600 → 2; 2100 → 0 with the console still cut; 1600 → fully before). **Zero label contradictions** across every sampled position in both directions.

Two defects were found and fixed during this work, both by measurement rather than reading:

1. `tl.call()` does not fire dependably while scrubbing backwards, so a callback-driven caption drifted out of agreement with the frames — observed saying "Display views updated" while the displays had already cut back to their before captures.
2. Deriving the caption inside the **ScrollTrigger's** `onUpdate` read stale DOM, because under `scrub` the trigger reports a new scroll position up to 0.6s before the playhead applies the values, and then stops firing once scrolling ends — the label never advanced at all.

Both are resolved by deriving the phase from the painted opacities inside the **timeline's** own `onUpdate`, so the caption cannot describe a state the stage has not painted, in either direction.

Other Lane A results: pin gated on desktop width and effective motion — under Pause the pin spacer is removed (2880 → 0) and a readable resolved scene remains; the same under OS reduced motion, and allowing motion again at runtime restores the pin. Mobile builds no pin at all (section 861px at 375 vs 2881px pinned at 1440) and uses a verified crop of the real console plus an accessible view selector — the old 320vw treatment was not restored. Anchor entry lands at 88px against a 65px header, unobscured. The scene keeps a full-console inspection with Escape and focus return. Staging is labelled as editorial order, and the written narrative (`sr-only`) carries the meaning for assistive technology instead of a live region firing per scroll pixel.

## Lane B — operations chapter recomposed (`when-plans-change.tsx`)

Asymmetric 36/64: a single-open accordion left, one stable proof aperture right. Heading is now "The plan changes. The show keeps running." The disconnected permissions paragraph is gone; that wording lives in the **Keep control clear** case. Selection is a cream rule plus weight and expansion — the green status dot is removed, and real status colours stay inside the screenshots.

Four situation → operation stories, each with its own measured crop verified against source pixels:

| Operation | Situation | Crop (source px) | What it shows |
|---|---|---|---|
| Adjust the timer | A speaker needs more time. | console 1700,180 985×812 | Countdown, full ±0:30/±0:10 row, cue context; ends at the column divider so no neighbouring words are clipped |
| Hold the room | The next cue needs to wait. | console 2690,150 670×900 | Whole controls column — Next, Previous and Hold complete |
| Send a notice | The booth needs an update. | broadcast 10,840 1180×760 | Composer and target selector. The capture reads **All Displays**, and the caption says so rather than implying an AV-only send |
| Keep control clear | Another operator takes over. | console 2690,150 670×420 | Ownership strip: who holds control, and the release affordance |

Crops letterbox (`fit="contain"`) rather than fill, so a tall control column is never stretched or cut. Each selection renders a different crop (measured rendered widths 2376 / 2144 / 1726 / 4175 px). Rapid switching settles on the last choice with the aperture never empty. Accordion semantics are real buttons with `aria-expanded` and controlled `role="region"` panels, arrow/Home/End navigation, and exactly one open region at a time. "No capture exists yet" is removed from the public page; the missing hold-state evidence is recorded here instead.

## Lane C — navigation decluttered (`navbar.tsx`)

One fixed-height bar: measured **65px** at 1280/1440/1920 and 66px on mobile (target ~64). Two short links — **Product** → the scroll scene, **Features** → the operations chapter — plus a quiet Log in and one Start free. The GSAP padding-travel tween is removed entirely; only the background and border change, driven by a passive scroll listener, so navigation no longer carries a motion engine. `aria-current` marks the active destination. Mobile keeps Escape-to-close with focus return and native anchor scrolling.

## HF-01 … HF-07

| ID | Status | Evidence |
|---|---|---|
| **HF-01** | **FIXED** | `recorded-view.tsx` now separates committed from requested. Under a 2.5s stall on every image request, A→B pending→C kept the decoded `console` capture mounted and complete throughout (`decodedImagePresentThroughout: true`). `pending` is derived during render, not written from an effect; a failed request clears readiness and never takes the display. |
| **HF-02** | **Superseded, truth rule kept** | The manual atomic pair is gone with `call-the-show.tsx`. Its rule survives as the scene's zero-contradiction caption check and the operations captions, which describe ready painted frames only. |
| **HF-03** | **FIXED** | `useGsap` now folds OS preference **and** Pause into one setting and rebuilds on either change; `MotionControl` publishes `data-motion="off"` so CSS travel collapses too. Measured during the menu exit: `motionAttr: "off"` with the panel already at `max-height: 0px`. |
| **HF-04** | **FIXED** | The panel is always mounted and `inert={!open}`, so it is genuinely inert during the exit. With motion **on**, sampled mid-animation at max-heights 649.6 → 312.0 → 110.0 → 24.1px, `inert: true` and `aria-hidden: "true"` at every sample; focus returned to the toggle. |
| **HF-05** | **FIXED** | Tab from the Before Doors tabs now reaches `#before-doors-panel` (`role="tabpanel"`, first stop), and the operations proof aperture is a focusable `figure` with a visible ring. Verified on the rendered components after the replacement, not on the obsolete nodes. |
| **HF-06** | **FIXED** | "at the same time" and "4 screens synced" no longer exist anywhere in the tree (both files deleted). The scene says "Connected display views follow the current item" with a "Recorded cue sequence." disclosure. |
| **HF-07** | **CORRECTED** | `homepage-refinement/BATCH_REPORT.md` amended: adapt was reported 784px, its raw `report.json` records **686px**. The original sentence is kept with an inline correction plus a dated amendment; no historical evidence file was edited. |

## Checks

| Check | Result |
|---|---|
| Viewports (requested vs **actual CSS**, zoom) | 1280×800, 1440×900, 1920×1080, 1280×620 short, 320×720, 375×812, 768×1024 — actual CSS viewport equalled the request at all seven, `visualViewport.scale` 1, no horizontal overflow |
| Duplicate IDs | None at any viewport. Canonical `#product` (scene) and `#features` (operations); `#call`, `#one-cue`, `#adapt` kept as zero-height aliases; `#prepare`, `#room` unchanged. All six legacy anchors resolve unobscured |
| Page rhythm (1440×900) | hero 900, prepare 843, **product 2881**, features 981, room 596, closing 667 — the scene dominates |
| Scene forward / reverse / release | Verified above; release returns to native scrolling |
| Pause / reduced motion / runtime change | Pin spacer 2880 → 0, static resolved scene, restored on resume and on re-enabling motion |
| Operations selection, rapid switching, keyboard | Verified; one open region; last selection wins |
| Console/page errors | Zero across every viewport and interaction |
| Tests / lint / typecheck / build / ledger | 638 tests across 58 files; ESLint **0 errors**, 5 pre-existing warnings; `tsc --noEmit` clean; default `next build` passed (no fallback bundler needed); ledger validator PASS |
| Screen reader | **UNVERIFIED** — none available here. All accessibility results are DOM/ARIA and keyboard checks |
| Current-app screenshot fidelity | **PARTIAL**, unchanged: historical captures, padlock and "Speaker Ready" drift, and `console-prev.png`'s dev badge remain. See `homepage-refinement/PROVENANCE.md` |

## Performance, 3 runs each, identical settings

Lighthouse 13.5.0, `--preset=desktop`, headless, production builds, own ports, no concurrent build. Raw reports in `lighthouse/`.

| Series | LCP runs (ms) | LCP median | CLS | Script | Images | Total | A11y |
|---|---|---|---|---|---|---|---|
| Baseline `6f898aa` | 1099, 816, 804 | **816** | 0 | 360 KB | 300 KB | 824 KB | 1.00 |
| After | 728, 754, 828 | **754** | 0 | 361 KB | 208 KB | 736 KB | 1.00 |

Independent byte capture at 1440×900, initial load and after scrolling the whole page: baseline 407 KB over 35 requests; after **315 KB over 43 requests**. The batch adds eight below-fold captures — hence the extra requests — but is **92 KB lighter in images**, because the scene requests small `22vw` variants where the replaced composition requested very large crops. So the added imagery did not cost transfer; it reduced it. First run of each series is a cold-start artifact; medians are the comparison.

## Remaining and open

1. **Asset fidelity (external).** Unchanged and still blocked: the capture pipeline seeds and writes to hosted Supabase, and `DEMO1_PASSWORD` is absent. Having credentials would not make that pipeline read-only.
2. **Hold state.** No safe capture of a display already holding exists. The hold row shows the control that triggers it; the gap is recorded here, not on the page.
3. **Screen reader** verification unavailable in this environment.
4. `inert` on the closing menu was verified by attribute and by focus return; the count of elements *inside* the inert subtree is reported as-is, since `inert` removes them from the tab order at the browser level rather than changing their `tabIndex`.

Nothing was pushed, deployed, migrated, seeded, or changed in any provider or account. No audit state was modified and `CODEX_VERIFIED` was not assigned.
