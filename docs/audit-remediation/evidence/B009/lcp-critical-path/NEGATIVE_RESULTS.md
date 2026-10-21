# KF-023: LCP crop critical path, profile and experiments (B009 r7)

Simulated Lighthouse 13.5.0, mobile, production build, median of 3, target 2500 ms (method unchanged).

## Profile (`lcp-probe.json`, throttled CDP: 1.6 Mbps, 150 ms RTT, 4x CPU; DPR 2.625)
- The LCP element is the one-cue crop `<img>` (`console-mobile-crop`, 1050x900 source). It is in the server HTML and preloaded from `<head>` (`<link rel=preload as=image imagesrcset>`). Discovery is correct: request starts at ~220 ms.
- At 220 ms, in parallel: 5 `next/font` woff2 (High, about 120 KB), 2 stylesheets, about 15 landing scripts (Low). The crop completes at ~1330 ms, after the fonts and most scripts share the link.
- Lighthouse's mobile DPR is 1.75, so the crop request there is `w=750` (17.5 KB). Under the DPR 2.625 probe it is `w=1200`. Not the same request; the probe is diagnostic only.

## Experiments (simulated median, n=3)
| Experiment | Runs (ms) | Median (ms) | Result |
|---|---|---|---|
| Baseline (GSAP deferred, shipped) | 3879, 3012, 3009 | 3012 | — |
| `fetchPriority="high"` on the crop image | 3085, 3088, 3093 | 3088 | Negative. The request does go High, but the bottleneck is shared bandwidth, not priority. Reverted. |
| `preload: false` on the three next/font families | 3797, 3389, 2181 | 3389 | Negative and unstable. Reverted. |
| Null control: edit with no effect (pattern not present) | 4209, 3013, 3012 | 3013 | Reproduces baseline. Confirms the series is stable within about 10 ms except for outliers. |
| Hero as server component (earlier) | 3163, 3161, 3158 | 3161 | Negative. See `hero-server-component/`. |

## Conclusion
- Discovery, SSR and preload are correct. Priority is not the cause.
- The remaining cost is bytes competing with the crop on the throttled link: required text fonts and about 15 landing JS chunks. Reducing those means changing the font loading strategy or the landing client bundle. Neither is a routine change, and the first experiment shows the font change is not a clear win.
- KF-023 remains OPEN. Target 2500 ms not met (simulated, 3012 ms).
