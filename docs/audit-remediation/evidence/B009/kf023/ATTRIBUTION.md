# KF-023 attribution and decisions (B009)

Build for attribution: temporary `productionBrowserSourceMaps: true`, rebuilt, config reverted
before any commit. Lighthouse 13.5.0 `unused-javascript` sub-items (mobile, one run).

Unused JavaScript, 62 KiB estimated, attributed to modules:
- chunk `1v6b_gp14sx8d.js`, wasted 33 KB: framer-motion / motion-dom drag, pan and projection code
  (`create-projection-node.ts` 6.9 KB, `VisualElementDragControls.ts` 2.5 KB, `JSAnimation.ts`,
  `VisualElement.ts`, `PanSession.ts`). Reached through `motion.*` in components on the landing
  path: `components/site/navbar.tsx`, `components/ui/toast.tsx` (root layout provider).
- chunk `2an2wfzpfvjzb.js`, wasted 27 KB: `react-dom/cjs/react-dom-client.production.js`
  (framework code, not reducible in-app).

Attempted fix and decision:
- `LazyMotion features={domAnimation}` in `components/motion-preferences.tsx`, with navbar and toast
  moved to `m.div`. Unused JS fell 62 to 29 KiB. Mobile LCP worsened: median 3839 ms (runs 3951,
  3839, 3838) against 3317 ms (runs 3313, 3317, 3880) for the reverted build. REVERTED. Cause not
  established; not pursued further in this batch.

Reproduction: `after-lazymotion/` and `revert-lazymotion/` hold the raw runs; `after-hero-crop/`
holds the committed `22074f2` series. Revision identities in each `revision.txt`.
