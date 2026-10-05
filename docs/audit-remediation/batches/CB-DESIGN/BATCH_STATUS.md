# CB design batch: status checkpoint (not READY_FOR_CODEX)

BASE_SHA: cb7737e. Functional repairs: 1a3511f (CB-F1..F4). Design work: this commit.
Checklist states: IMPL = code present; LOCAL = local evidence; OPEN = not done or not verified.

| Pkg | Scope | State | Notes |
|---|---|---|---|
| 1 CB-F1 identity-aware runs | auth-events.ts, identity-controller.ts, provider | IMPL + LOCAL (controller tests, 7+8) | Browser seam for auth ordering from earlier pass, rerun pending on dev server. |
| 2 CB-F2 full event domain | Record<AuthChangeEvent,true> test | IMPL + LOCAL | MFA_CHALLENGE_VERIFIED covered. |
| 3 CB-F3 legacy Hold | route predicate rev-null + activatedAt | IMPL + LOCAL (17 route tests, negative control, local Postgres ts/legacy/rev) | Live PostgREST server not run. |
| 4 CB-F4 focus restore | chooseFocusTarget, open-dialog registry | IMPL + LOCAL (16 policy tests) | Browser unmount-focus evidence not re-captured. |
| 5 public variants | Button public/hero, Input public, PasswordInput 44px | IMPL | Visually checked on auth pages. |
| 6 AuthShell | components/auth/auth-shell.tsx, auth-art.tsx | IMPL + LOCAL (structure, screenshots) | Short viewport capture taken, not reviewed in detail. |
| 7 Login | heading, support, forgot password, footer | IMPL + LOCAL | Handlers unchanged. |
| 8 Signup/recovery | signup, confirmation, reset, set-password | IMPL + LOCAL (structure) | Labels restored to original text. |
| 9 Immediate landing | Standby cover removed, hero hydration gate removed | IMPL + LOCAL (visible in HTML) | Hero is still a client component. |
| 10 Nav/actions | nav links, hero secondary "Try a cue" | IMPL | Keyboard and focus return of mobile menu not re-verified. |
| 11 Early demo | demo moved under hero, id=demo | IMPL | Cue rail/Next/pulse/reset were already present; not re-designed. |
| 12 Mobile outputs | tablist + one panel | IMPL + LOCAL (keyboard arrow test, 327px panel) | Narrative cleanup: no unsupported numeric claims found by grep. |
| 13 Motion | one-cue pin removed; no hijack | IMPL | Reduced-motion matrix not re-run. No shader (optional). |
| 14 Proof | matched before/after, perf | OPEN / REGRESSION | Simulated mobile median 4107 ms (n=3) vs 3012 ms baseline. New LCP is demo h2 text waiting on Archivo font under throttling. KF-023 OPEN. |
| 15 Package | BATCH_REPORT, TEST_RESULTS, EVIDENCE_INDEX | OPEN | Not produced. |

Gates on this revision: npm test 628 passed; tsc clean; eslint 0 errors / 6 warnings; ledger PASS; Turbopack build PASS.
Batch is not READY_FOR_CODEX until pkg 14 regression is resolved and pkg 15 is written.
