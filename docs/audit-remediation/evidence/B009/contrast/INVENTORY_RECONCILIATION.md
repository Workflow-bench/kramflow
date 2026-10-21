# Original contrast inventory reconciliation (KF-019, B009)

## Where the 27 / 10 entries are
- `docs/audit-remediation/source-package/kramflow-lighthouse-desktop.report.json` → `audits["color-contrast"].details.items`: **27** items.
- `docs/audit-remediation/source-package/kramflow-lighthouse-mobile.report.json`: **10** items.
- `docs/audit-remediation/source-package/kramflow-lighthouse-mobile-rerun.report.json`: **10** items, selectors identical to the first mobile run.
- `docs/audit-remediation/source-package/scripts/build_coverage.mjs` (lines 22–64) and `SOURCE_COVERAGE.md` record the same counts, with `finalUrl` `https://www.kramflow.me/`, fetched 2026-09-28, Lighthouse 13.5.0.
- The earlier note that the desktop count is "approximately ten" is recorded there as an undercount of the narrative.

## Breakdown of the original 27 desktop items (by node class)
| Count | Node class (snippet) | Original section (base 8a91668) | Replacement |
|---|---|---|---|
| 4 | `tnum mr-2 text-muted-2/60` (cue index, grid-area a–d) | `one-cue-section` | `one-cue-section.tsx:218`: `text-muted-2` solid, measured pass |
| 6 | `tnum text-[11px] uppercase tracking-[0.2em] text-muted-2/60` (in `div.hidden > div.pl-14`) | `surfaces-section.tsx` desktop twin | Section removed in b657c82. Same label token now solid on `cta-section.tsx:21`, measured pass |
| 5 | `h3.mt-3 font-display …` | `surfaces-section.tsx` desktop twin | Section removed in b657c82; no equivalent heading |
| 5 | `p.mt-4 max-w-[34ch] …` | `surfaces-section.tsx` desktop twin | Section removed in b657c82; no equivalent paragraph |
| 4 | `tnum text-[10px] tracking-[0.16em] text-muted-2/55` (figcaption) | `room-section.tsx` | Section removed in b657c82 |
| 3 | `text-console-label uppercase text-muted-2` (figcaption span) | `surfaces-section.tsx` figure | Section removed; the same token measured solid on the new landing |

## Breakdown of the original 10 mobile items
| Count | Node class | Original section | Replacement |
|---|---|---|---|
| 6 | `tnum text-[11px] uppercase tracking-[0.2em] text-muted-2/60` (in `div.space-y-14 > div > div.px-6`) | `surfaces-section.tsx` (`space-y-14` at base) | Section removed in b657c82 |
| 4 | `tnum text-[10px] tracking-[0.16em] text-muted-2/55` (in `div.space-y-8 > figure > figcaption`) | `room-section.tsx` (`space-y-8` at base) | Section removed in b657c82 |

Totals: 27 = 4 + 6 + 5 + 5 + 4 + 3. Mobile 10 = 6 + 4. Arithmetic checked against the raw JSON.

## Replacement evidence
- Current landing, oklab-aware computed audit: desktop 496 settled full-opacity nodes, 0 failing, min 4.63:1; mobile 491, 0 failing, min 4.63:1 (`evidence/B009/browser/CORRECTION_rgb_only_contrast.md`).
- Lighthouse 13.5.0 `color-contrast` on the current landing: 0 items, desktop and mobile, all runs (`evidence/B009/final-measurements/`).
- Note: these are measurements of the new landing, not a per-node match of the 27/10. The original node classes do not exist in the current tree (see below), so a node-for-node match is not possible.

## Manifest discrepancies (recorded, not repaired)
1. `grep` for `text-muted-2/60`, `text-muted-2/55`, `text-muted-2/70` across `8a91668` source (`components/`, `app/`) finds only `text-muted-2/60` in no component file; the exact `/55` and `/60` class strings appear only in the three Lighthouse JSON files (and their copies). The base commit's `room-section.tsx` and `surfaces-section.tsx` use different class strings for the same visual elements (for example `pl-14 pr-10` and `space-y-14` in surfaces, `space-y-8` and `tracking-[0.16em]` in room).
2. Conclusion: the Lighthouse snapshot (live `www.kramflow.me`, 2026-09-28) was rendered from source that is not the `8a91668` base tree. The repository does not contain the exact source that produced the 27/10 items. This is a provenance gap, not a measurement error.
3. The ledger's "27-node desktop inventory and 10-node mobile inventory" is therefore present as data (vendored JSON, validated by `validate_ledger.mjs` "Lighthouse pointers and raw values"), but the rendered source is not in this repository.
4. The "approximately ten" narrative count refers to the mobile set (10), per `SOURCE_COVERAGE.md` line 64.

## Result
- All 27 + 10 original entries are accounted for by class and original section. The source sections that produced them were removed by the ui-revamp integration. No original node survives in the current landing.
- KF-019 automated computed-color audit against the replacement: passed (see above). The "27 + 10 node inventory" criterion is reconciled by provenance, not by node-for-node replay. Codex decision required on whether a node-for-node replay is needed.
