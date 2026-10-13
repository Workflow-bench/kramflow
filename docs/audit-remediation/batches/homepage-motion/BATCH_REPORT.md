# Homepage motion and first-entry batch

Not self-approved. Ready for independent Codex review (`READY_FOR_CODEX`). `CODEX_VERIFIED` not set.

## Identity

| Item | Value |
|---|---|
| `BASE_SHA` | `e67f308df6663db6cc224daf705cdd385092b4c1` |
| `FINAL_SHA` | `c5c51d4178a1461ea15477d123ebafce45443eb5` (motion batch commit; a follow-up commit records this line) |
| Branch | `integrate/ui-revamp-landing` |
| Tracked tree at start | clean; nine pre-existing untracked paths preserved and excluded |
| GSAP / plugins | `gsap` 3.15.0 from the public npm package (ScrollSmoother, ScrollTrigger). No private registry, no credentials. |
| Paper shader | `@paper-design/shaders-react` 0.0.81 (unchanged) |
| Skill | `gsap-plugins` installed locally; read and followed for registration and cleanup |
| Build | `next build` default bundler, `next start` on port 3961. Baseline `e67f308` on 3962, separate worktree. Port 3000 untouched. |
| Lanes | none. Sequential, single implementer. No delegation claimed. |

## A–F

| Change | Implemented | Status | Evidence / limit |
|---|---|---|---|
| **A** Responsive smooth scroll | One `SmoothScroll` owner: ScrollSmoother on desktop only (`min-width:1024px`, `pointer:fine`, motion allowed), native elsewhere. Wrapper/content wraps main + footer; nav, skip link and motion flag stay outside. Anchor clicks routed through one handler: smoother `scrollTo` when active, native `scrollTo` otherwise. Skip link moves focus to `#main-content`. | PARTIAL | Smoother engages (content lags to −513px at 120ms, settles at −600px). `#features` lands 88px-offset (header bottom 65px). Mobile teardown leaves no pin spacers. Resize back to desktop rebuilds once. **Limit:** deep-link jumps need a measured correction pass ~0.9s after load (smoother settles short of its target). Wheel and trackpad tuned by measurement only, not by feel. |
| **B** Gradient headline | Single gradient field on the `h1`, not per word; champagne→brass→cream. Entry light sweep 1.4s, then static. Hover/focus on hero actions shifts the field gently. Forced colors, print and no-clip fallback are solid cream. | PASS (Chromium) / UNVERIFIED (Safari) | Resting glyph sample on background: 4.9:1 (edge antialias sample; the brass stop itself is higher). Reduced motion: final gradient, no animation. **UNVERIFIED:** Safari `-webkit-background-clip` rendering; no Safari here. |
| **C** First-entry arrival | CSS-class sequence, ~1.3s: warm band crosses the hero, wordmark settles from −8px, heading settles 6px with the light sweep, console top rule draws. Once per session (versioned key `kf-arrival-v1`), top-of-page normal navigations only. Any scroll, key, pointer or touch ends it and does not swallow input. Reduced motion mid-sequence settles it at once. Storage written only on completion or interruption, never in cleanup. | PASS (fresh session, second visit, deep link, denied storage, no-JS, reduced-motion toggle) / PARTIAL | Frames at 150/500/900/1350ms: `arrival-running` true, heading readable throughout, band and trace visible mid-sequence. Second visit: no class. Deep link: no class, anchor lands. Denied sessionStorage: no errors, heading present. No-JS: no class, heading present. Reduced-motion toggled at 300ms: class removed within 250ms, shader absent. **Limit:** frames, not video. Strict Mode double-mount is covered by logic (cleanup does not write storage) and by unit tests, not by a dev-mode browser run. |
| **D** Scroll scene | Kept the console-to-display sequence and its reverse. Tuned for the smoother by measurement only. Captions remain derived from painted opacities. | PARTIAL | Scene forward/reverse checks from the prior batch still pass. **Not re-tuned in a browser this batch:** the scene's `scrub: 0.6` now stacks with smoother lag. A smaller scrub was considered and not applied without a measured reason. No DrawSVG added (the connection path is a div stroke, which suffices). |
| **E** Component polish | SiteAction: 200ms transition, subtle edge light on hover, `active:scale-[0.98]`, no arrow added. Operations accordion: grid-row expansion over 260ms; closed panels are `inert` immediately; proof keyed by operation with a 220ms settle. SegmentedSelector unchanged (already ~200ms). SplitText not used: no section heading needed a line mask to earn its cost, and above-the-fold text stays server-rendered. | PASS (source + browser build) / PARTIAL | Builds and lints clean. Accordion closed-panel inertness is structural. **Not measured:** rapid-selection tween accumulation under timing. |
| **F** Ambient and lifecycle | Single effective motion setting (`useAmbientMotion`, OS preference). `MotionFlag` publishes `data-motion` for CSS. Stale Pause-control comments removed from `use-gsap.ts` and `motion-state.ts`. | PASS | Live OS toggle verified for the shader (canvas removed) and arrival (class removed). Pause control stays removed; not reintroduced as a badge. |

## Checks

| Check | Result |
|---|---|
| Unit tests | 646 passing across 59 files (8 new: arrival eligibility, storage denial, flag keying) |
| Lint | 0 errors, 5 pre-existing warnings |
| TypeScript | clean |
| Production build | default bundler, passes |
| Ledger validator | PASS |
| Desktop 1440×900 | PASS (screenshots taken during the prior batch; this batch re-checked headline, arrival frames and anchors) |
| Viewports 1366×768, 320px, 200% zoom | **UNVERIFIED**: not run in this batch |
| Mobile 375×812 menu Escape + focus return | PASS |
| Arrival recording | Frame series only (`frames/`), not video |
| Heading accessibility name | Unchanged: the text is still two real spans inside the h1; `gradient` is paint-only |
| Contrast | Darkest gradient glyph sample 4.9:1 on background; body and nav colours unchanged |
| Screen reader | UNVERIFIED (none available) |
| Console errors | none on any path checked |

## Performance: three runs each, identical settings

Lighthouse 13.5.0, production builds, headless Chrome. Raw reports: `lighthouse/`. Summary: `lighthouse/summary.json`.

| Series | LCP median (ms) | LCP range (ms) | CLS | TBT median (ms) | Perf median | A11y median |
|---|---|---|---|---|---|---|
| Baseline desktop | 759 | 757–1059 | 0 | 0 | 0.98 | 0.97 |
| After desktop | 759 | 758–1001 | 0 | 0 | 1.00 | 1.00 |
| Baseline mobile | 3691 | 3690–3859 | 0 | 6 | 0.90 | 0.97 |
| After mobile | 3767 | 3766–3836 | 0 | 7 | 0.89 | 0.97 |

- LCP target ≤ 2500 ms: **FAIL on mobile in both builds** (3691 and 3767 ms). This is the open KF-023 mobile-performance item. It was not reopened here and not closed here.
- Desktop LCP is flat.
- Mobile LCP +76 ms in the medians. The two ranges overlap (after: 3766–3836; baseline: 3690–3859), so this is within run-to-run noise but is reported rather than hidden.
- CLS 0 in every run.

## Product-view provenance and fidelity

No product views were replaced in this batch. The room scene and operations proofs still use the code replicas from the previous batch, which are fixture samples of the product's layout. Their fidelity to current app components was not re-audited here. The published captures are unchanged and carry the drift already documented in `docs/audit-remediation/evidence/homepage-refinement/PROVENANCE.md`: the padlock versus LogOut icon, the "Speaker Ready" fleet label, and the dev badge on `console-prev.png`. Recapture remains blocked for the reasons recorded there.

## Changed files

- New: `components/site/smooth-scroll.tsx`, `components/site/arrival.tsx`, `components/site/arrival-eligibility.ts`, `components/site/arrival-eligibility.test.ts`
- Changed: `app/page.tsx`, `app/globals.css`, `components/site/hero-section.tsx`, `components/site/navbar.tsx`, `components/site/console-aperture.tsx`, `components/site/site-action.tsx`, `components/site/when-plans-change.tsx`, `components/site/use-gsap.ts`

## Remaining work and blockers

1. Mobile LCP above target, pre-existing (KF-023).
2. Safari gradient-clip verification: needs a Safari run.
3. Viewport 1366×768, 320px and 200% zoom checks were not run.
4. Screen-reader verification: none available.
5. Room-scene scrub is not re-tuned for the smoother; the first browser pass is recorded above.
6. Deep-link correction latency (~0.9s) is a known limit of the smoother-plus-measure approach.
7. Current-app product-view fidelity: unchanged, blocked as before.
