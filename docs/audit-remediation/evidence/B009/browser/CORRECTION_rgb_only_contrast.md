# Correction: rgb-only contrast parser (B009)

Original records are preserved unchanged. This file corrects their reach.

## Affected historical claims

- `browser/OBSERVATIONS.md` line 9: "73 text nodes measured, 0 failing, min 4.72:1, 0 excluded" for `/` at 1440x900.
  - Measured with the rgb-only parser. Colors in `oklab()` were silently skipped.
  - The count and minimum are not valid evidence of landing contrast. Treat as superseded.
- `landing-integrated/LANDING_FINDING_MAP.md` (earlier draft): "4.18:1 on small labels" for `text-muted-2`. This figure came from the rgb-only estimate. Lighthouse 13.5.0 (oklab-aware) did not flag those labels on the pre-fix build. Treat 4.18:1 as unvalidated.

## Not affected

- Lighthouse `color-contrast` audits (`kf023/summary.txt`, `landing-integrated/`, `landing-contrast-fixed/`). Lighthouse parses `oklab()` through Chromium; these results stand.

## Corrected measurement (oklab-aware, canvas-normalised, alpha composited over effective background)

Settled after scroll, full-opacity text nodes:

| Viewport | Nodes measured | Failing | Min ratio |
|---|---|---|---|
| Desktop 1440x900 | 496 | 0 | 4.63:1 |
| Mobile 375x812 | 491 | 0 | 4.63:1 |

Method limits: direct text-node elements only. `::before`/`::after`, SVG text and placeholders not covered.

## Original contrast findings, reconciled to replacement sections

Pre-fix Lighthouse (`landing-integrated/`): desktop 11 items, mobile 7 items. Post-fix (`landing-contrast-fixed/`, `landing-lcp-fix/`): 0 items in every run.

| Lighthouse node (pre-fix) | Replacement section and file | Current state |
|---|---|---|
| `span.tnum.mr-2.text-muted-2/60` x4 (cue index labels) | One-cue section, `one-cue-section.tsx:218` | `text-muted-2` solid |
| `span.truncate` x2 (item titles inheriting `past` row color) | Playable show, `playable-show.tsx:122,127` | row `past` color now `text-muted-2` solid |
| `span.tnum.text-right.text-[11px].text-muted-2` x1 (duration) | Playable show, `playable-show.tsx:138` | `text-muted` |
| `p.col-start-2.text-muted-2/70` x4 (call-sheet inactive lines) | Call sheet, `call-sheet.tsx:84` | `text-muted` |

Not flagged by Lighthouse, changed as precaution: `playable-show.tsx:125` index label (`text-muted`); `hero-section.tsx:85` decorative separator (`text-muted-2`, `aria-hidden`).
