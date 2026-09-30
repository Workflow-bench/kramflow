# Batch B001 (retroactive record)

B001 predates the `KRAMFLOW_CLAUDE_MASTER_PROMPT.md` ledger contract — it was implemented and handed off as free-form chat before this formal structure existed. This file is a retroactive summary for provenance, not a reconstruction of the original handoff message verbatim.

- Repository/branch/head: `fix/audit-remediation-phase1`, ending head `b72f0dd1780051bf99423cf353b90c61af0b2f33`
- Scope: KF-001 (hold/timer owner floor only — speaker-ready and broadcast-dismiss not addressed), KF-002 (shared guards `requireAuthUser`/`requireEventAccess` — invite-accept route not addressed, incorrectly reasoned as an intentional exception), KF-003 (credential creation disabled; the v1 actions/[action] route itself left unchanged, with an unverified "unconditional 423" claim)
- Self-test: 262 vitest tests, `tsc --noEmit` clean, `npm run lint` 0 errors/6 warnings (pre-existing), `npm run build` clean; one live browser check per KF against the dev Supabase project logged in as `demo1@kramflow.test`
- Verdict at handoff: self-reported READY_FOR_CODEX-equivalent (the state name didn't exist yet); no independent review had occurred

## Outcome

Independently reviewed 2026-09-30 — see `../../REVIEWS/2026-09-30_KRAMFLOW_CODEX_PHASE1_REVIEW.md`. Decision: **HOLD / NEEDS_REWORK**. Findings: R1 (speaker-ready still viewer-writable), R2 (invite-accept still bypassable, plus a wrong comment asserting it was intentional), R3 (existing credentials still reached the live-control adapter; the "unconditionally 423" claim was false due to an owner-controllable clientId collision, and hold/resume no-op branches returned 200 without a lease check), R4 (no formal ledger/manifest/evidence-index contract existed yet).

B001's commits remain in the branch history unmodified; B002 is additive on top, not a reset. See `TASK_LEDGER.md` for how each finding was reopened and resolved.
