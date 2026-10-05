# Landing-page finding map (B009, integration b657c82 + contrast fix)

Scope: the landing page from `ui-revamp` (1587c3c) integrated into `integrate/ui-revamp-landing`. Original audit findings were recorded against the pre-ui-revamp landing. Each finding is mapped to its equivalent in the new landing, or the removal is documented. Status is self-verified; Codex review pending.

| Finding | Original element | New landing equivalent | Disposition | Evidence |
|---|---|---|---|---|
| KF-019 (room-section caption opacity) | `components/site/room-section.tsx` (deleted in b657c82) | none; the room section is not in the ui-revamp landing | Removed with the section. Caption opacity no longer exists. Contrast of new captions is measured under the contrast row below. | b657c82 `--stat` shows `room-section.tsx | 186 ----` |
| KF-019 (hero overlay) | `hero-section.tsx` overlay | `hero-section.tsx` rewritten (234 lines); the cue-light overlay is `standby-overlay.tsx`, which owns the first ~1.4 s of motion | Replaced. Overlay now a cue-light motion layer, not a text-over-image scrim. Re-verified by the contrast measurement (0 failing full-opacity text nodes, desktop and mobile). | `hero-section.tsx:16,26`; contrast results below |
| KF-021 (surfaces duplicate headings / hidden twins) | `components/site/surfaces-section.tsx` (deleted in b657c82) | none | Removed with the section. No hidden duplicate heading remains in the new components (grep: `sr-only` and `aria-hidden` used only as decorative or intentional labels; manual review of the 16 hits is still pending Codex). | b657c82 stat |
| Problem section (not a numbered finding) | `components/site/problem-section.tsx` (deleted) | none | Removed by ui-revamp. | b657c82 stat |
| KF-020 (skip link) | `app/page.tsx` before the nav | `app/page.tsx:61-71` skip link to `#main-content` with `tabIndex={-1}` target | Retained and carried into the new page. | `app/page.tsx:61-71` |
| Mobile LCP (KF-023) | one-cue mobile block (`one-cue-section.tsx`) rendered full 3360 px console at `sizes="320vw"`, lazy; mobile hero has no image | `consoleMobile` 1050x900 crop at container width, `priority`; desktop hero console no longer `priority` | Changed. Simulated mobile median 3401 -> 3308 ms (target 2500 not met). Observed devtools mobile 4.4 s -> 2.7 s. See `landing-lcp-fix/`. | `landing-lcp-fix/` |
| Contrast (new landing, not an original finding) | `text-muted-2/60`, `/70`, `/35` opacity utilities, and `text-muted-2` at 4.18:1 on small labels | solid tokens | Changed. See the table below. | `landing-contrast-fixed/` |

## Contrast changes (commit pending; uncommitted at time of writing)

| File | Line | Before | After | Reason |
|---|---|---|---|---|
| `components/site/one-cue-section.tsx` | 218 | `text-muted-2/60` | `text-muted-2` | 60% opacity dropped below 4.5:1 |
| `components/site/call-sheet.tsx` | 84 | `text-muted-2/70` (inactive) | `text-muted` (single class; ternary removed) | 70% opacity dropped below 4.5:1 |
| `components/site/playable-show.tsx` | 122 | `text-muted-2/60` (past) | `text-muted-2` | same |
| `components/site/playable-show.tsx` | 125, 138 | `text-muted-2` (11 px index, duration) | `text-muted` | `muted-2` measured 4.18:1 at 11 px |
| `components/site/hero-section.tsx` | 85 | `text-muted-2/35` (decorative "·") | `text-muted-2` with `aria-hidden="true"` | decorative separator; exempt from contrast when hidden |

Note: `call-sheet.tsx:69` and `cta-section.tsx:21` use `text-muted-2` at 11–12 px. Not changed in this pass; measured as passing in the final run (4.63:1 minimum on full-opacity nodes), so the `muted-2` token itself clears 4.5:1 on the landing background. The 4.18:1 figure was from an earlier, rgb-only measurement that did not handle `oklab()`. Codex to confirm whether that re-attribution is accepted.

## Measurements (oklab-aware, full-opacity text nodes)

- Desktop, settled after scroll: 496 nodes, 0 failing, min ratio 4.63:1.
- Mobile 375 px, settled after scroll: 491 nodes, 0 failing, min ratio 4.63:1, horizontal overflow 0 px.
- Partial-opacity nodes (excluded from the pass count) after settle: 0.

Method limits: the script measures elements with direct text-node children. It does not cover `::before`/`::after` text, SVG `<text>`, or `<input>` placeholders. Lighthouse `color-contrast` was used as the second check.

## Lighthouse (Lighthouse 13.5.0, `--only-categories=performance,accessibility`, Chrome headless, 3 runs each, production build of the fixed tree)

- Desktop: median LCP 699 ms, perf 0.99, TBT 0 ms, CLS 0, a11y 1.00, color-contrast items 0.
- Mobile: median LCP 3401 ms, perf 0.92, TBT 7 ms, CLS 0, a11y 1.00, color-contrast items 0.

Previous landing-integrated (pre-fix) baseline: mobile a11y 0.96 with 7 contrast items; desktop a11y 0.96 with 11 contrast items. See `summary.txt`.

## Open

- KF-023 mobile LCP target (2500 ms) not met: 3401 ms median. Not optimized further in this pass.
- 200% zoom: browser tool cannot set zoom; UNVERIFIED.
- Accessibility tree with hidden flags: read_page lists `display:none` nodes; UNVERIFIED.
- Screen reader pass: not available here; UNVERIFIED.
- Reduced-motion check: not run on the integrated landing in this pass.
