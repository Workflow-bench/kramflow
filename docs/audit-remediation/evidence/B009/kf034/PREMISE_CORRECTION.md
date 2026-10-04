# KF-034: decoder behaviour and the corrected safety claim (B009)

Earlier commit messages (`e5e3bba`, `1838df0`) say fflate "keeps streaming" after an
exception thrown in `ondata`, so output and input continue after a refusal. That is not
supported by the decoder as installed (fflate 0.8.2, `esm/index.mjs`):

1. `UnzipInflate.push` wraps the inflater in `try { this.i.push(...) } catch (e) { this.ondata(e, null, final) }`.
   An exception from our callback is caught once and delivered as `err`.
2. Our `err` branch re-throws the recorded refusal. That second throw is raised from inside the
   `catch` block, so it is not caught again and propagates out of `Unzip.push` into our feed loop's
   `try`. The feed loop exits and the refusal is rethrown.
3. Consequence in the fixture: feeding stops at the refusal, as measured (`fed - refusedFed <= 1024`
   and `fed < archive length`). Output retained stops at the refusal (`retained == refusedRetained`).
   Both held with and without the in-callback `if (pending) return` guard, so that guard is defence in
   depth, not the mechanism that stops feeding.

Safety properties that are proven by tests (`lib/xlsx-archive.test.ts`, instrumented case):
- Input after refusal: at most one 1 KiB feed (loop guard plus escaping exception).
- Output retained after refusal: none (retention snapshot equals final).
- Retained at refusal: at most the 16 MiB member budget plus one chunk.
- Allocation unit: no single decoder callback exceeds 1032 KiB. Deflate expands one input byte by at
  most 1032 bytes, and feeds are 1 KiB, so output per feed is bounded by 1032 KiB. Measured max chunk is
  reported by the probe.

NOT proven, carried as uncertainty for Codex:
- Process heap and GC behaviour under the budget (only the probe counters are measured).
- Behaviour of a future fflate version that changes the `UnzipInflate` error path. The dependency is
  pinned at 0.8.2 exactly.
- The negative-control premise: no fixture in this repo reproduces continued streaming, so no test claims
  to demonstrate the in-callback guard. KF-034 is not closed on a defect; it is closed or left open by
  independent review of this corrected claim.
