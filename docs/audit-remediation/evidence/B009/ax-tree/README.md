# Accessibility tree evidence (B009, KF-020 / KF-021)

Method: Chromium via Playwright; `Accessibility.getFullAXTree` over CDP (the real browser accessibility tree, not computed visibility). Production webpack build on port 3948. Script: `ax-dump.cjs`. Login toggle: `login-toggle.cjs`.

Results (`results.json`):
| Page | AX nodes (ignored) | Headings | Duplicate heading names | Landmarks | Unnamed buttons/links |
|---|---|---|---|---|---|
| Landing, 1440 px (after scroll-settle) | 504 | 11 | none | 2 | 0 |
| Landing, 375 px (after scroll-settle) | 436 | 11 | none | 2 | 0 |
| Login, 1280 px (after fix) | 46 | 1 | none | 1 (`main`) | 0 |

Login before the fix (same method, `b657c82`-era build): 0 headings, 0 landmarks. Fixed in this pass: outer container is `<main>`, subtitle is `<h1>` with the same classes plus `font-normal`. Toggle behaviour unchanged (`login-toggle` output: pressed false→true, label Show→Hide, typed value kept, paste works, no POST).

KF-021 reading: the mobile and desktop variants of the One-cue heading exist in the DOM; the hidden copy is `display:none` and absent from the AX tree (checked by AX node list, not only computed style).

Not covered: signup, reset, set-password pages (not sampled); AT announcement of live regions; actual screen-reader speech output (no screen reader in this environment).
