# KF-023 negative result: hero as a server component with CSS motion (B009)

Change tested: hero made a server component. Entrances as CSS keyframes (same durations, delays, easing), scroll lift and copy fade as CSS scroll-driven timelines with a static fallback, reduced motion as final state. Only the wall-clock digits stayed a client island. Previously the hero copy was hidden until hydration (`useHydrated`).

Verified functionally (`hero-no-js.json`): with JavaScript disabled the headline and copy render and animate to the final state; reduced motion shows the final state immediately.

Simulated Lighthouse 13.5.0, production webpack build, same method (median of 3):

| Build | Mobile LCP runs (ms) | Mobile median | Desktop median |
|---|---|---|---|
| GSAP deferred (kept baseline, a782580) | 3879, 3012, 3009 | 3012 | 704 |
| Hero as server component (this test) | 3163, 3161, 3158 | 3161 | 758 |

Result: negative. Simulated mobile median rose by about 150 ms (consistent across all three runs, so not noise). Desktop rose about 50 ms. The LCP element is the one-cue crop image, not the hero, so hero hydration was not on the LCP critical path.

Decision: reverted. The shipped landing stays the GSAP-deferred version. The no-JavaScript visibility gain is recorded here as a correctness observation, not as a performance gain.

Raw runs: `mobile-simulated-run*.json`, `desktop-simulated-run*.json` in this directory.
