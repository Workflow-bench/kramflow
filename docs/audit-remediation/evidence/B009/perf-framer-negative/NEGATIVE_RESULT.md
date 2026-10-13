# KF-023 negative result: framer-motion removal (B009, upper bound)

Simulated Lighthouse 13.5.0, mobile, production webpack build, n=3, same acceptance method.

| Build | Simulated mobile LCP runs (ms) | Median |
|---|---|---|
| a782580 (GSAP deferred, framer present) | 3879, 3012, 3009 | 3012 |
| Framer removed from every landing section (shim: plain elements), MotionConfig still present | 4037, 3009, 3008 | 3009 |
| Framer removed from landing sections AND the root MotionConfig (no framer on the landing route) | 4228, 3009, 3011 | 3011 |
| LazyMotion domAnimation, async features (earlier) | 4277, 3158, 3158 | 3158 |

Conclusion: removing the animation library entirely from the landing route does not move the simulated median. Framer is not the simulated LCP bottleneck. Replacing framer with CSS or IntersectionObserver alone cannot reach 2500 ms. The simulated gap is in the main-thread cost of the Next/React runtime and the landing's client-component hydration, not in animation internals.

Raw runs: `perf-upper-bound-no-framer/` and `perf-upper-bound-no-framer-no-motionconfig/`. Experiment code was not kept (shim reverted).
