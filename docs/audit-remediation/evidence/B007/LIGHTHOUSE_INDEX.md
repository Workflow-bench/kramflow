# Lighthouse raw evidence index (B007-F3)

Raw JSON copied unmodified from this run's scratch directory. `sha256` is the first 16 hex characters of the file hash. Served quality is read from every console hero image URL in the report, not from build notes.

Command pattern (Lighthouse 13.5.0, Chrome headless, `--headless=new --no-sandbox`, production build, `next start -p 3919`, default simulated throttling): `npx lighthouse http://localhost:3919/ --only-categories=performance,accessibility [--preset=desktop] --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=<file>`.

| File | Build | Served quality (console URLs) | Console transfer KB (largest) | Perf | A11y | LCP ms | color-contrast items | sha256 |
|---|---|---|---|---|---|---|---|---|
| lh-desktop-after.json | B | 90 | 80 | 0.99 | 1 | 979 | 0 | 391f5e48f9e4f09f |
| lh-desktop-run1.json | B | 90 | 80 | 1 | 1 | 696 | 0 | 464e7ff0bef15fa0 |
| lh-desktop-run2.json | B | 90 | 80 | 1 | 1 | 522 | 0 | de1c1a5a9bd7d265 |
| lh-mobile-after.json | B | 90 | 157 | 0.85 | 1 | 4343 | 0 | b7579c9ab570249f |
| lh-mobile-q80fix-1.json | D | 80 | 118 | 0.83 | n/a | 4794 | 0 | 569b5c0c30fb9cdc |
| lh-mobile-q80fix-2.json | D | 80 | 118 | 0.91 | n/a | 3557 | 0 | 0dc0179f91314f31 |
| lh-mobile-q80fix-3.json | D | 80 | 118 | 0.93 | n/a | 3238 | 0 | b6a8d8c7461fb3c4 |
| lh-mobile-q90-1.json | A | 75 | 104 | 0.96 | n/a | 2737 | 0 | 3789c35548e419d8 |
| lh-mobile-q90-2.json | A | 75 | 104 | 0.88 | n/a | 3860 | 0 | 630e5a003e550d61 |
| lh-mobile-q90-3.json | A | 75 | 104 | 0.96 | n/a | 2797 | 0 | 13b068578c0fa27f |
| lh-mobile-q90b-1.json | C | 90 | 157 | 0.84 | n/a | 4609 | 0 | e43d184c1fde0ca2 |
| lh-mobile-q90b-2.json | C | 90 | 157 | 0.84 | n/a | 4590 | 0 | 512c7f8b01487868 |
| lh-mobile-q90b-3.json | C | 90 | 157 | 0.88 | n/a | 3926 | 0 | fe5859c4506a0f1e |

## Builds

- A: `images.qualities: [75, 90]`, product shot `quality={80}`. Next served 75 for the unlisted 80. Scratch names `lh-mobile-q90-*` are this build, not a quality-90 build.
- B: `images.qualities: [75, 90]`, product shot `quality={90}`. Desktop runs and `lh-mobile-after` are here: served 90, the pre-change state.
- C: `images.qualities: [75, 80, 90]`, product shot `quality={90}`. Baseline rerun after 80 was added to the list. Served 90.
- D: `images.qualities: [75, 80, 90]`, product shot `quality={80}`. Shipped setting. Served 80.

Desktop numbers are served quality 90 (build B). An earlier draft of LANE_E_EVIDENCE.md said desktop was at 75; that was wrong.
