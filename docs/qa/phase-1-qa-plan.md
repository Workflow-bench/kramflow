# Phase 1 QA Plan

This plan turns the Phase 1 feature inventory into an executable QA program. It is intentionally separate from the README: the README describes the product; this document tracks how we prove it works.

## Goals

- Cover every Phase 1 surface with automated checks at the right level: unit, route/regression, integration, E2E, and manual exploratory QA.
- Prioritize launch blockers first: auth, event isolation, cue-sheet data integrity, live control, share links, display access, broadcasts, and integration credentials.
- Add regression tests for every security-sensitive bug fixed during launch hardening.
- Keep QA work split into reviewable batches rather than one giant test PR.

## Test Levels

| Level | Purpose | Tool |
|---|---|---|
| Unit | Pure logic: parsers, validators, time math, token helpers, redirect helpers | Vitest |
| Route/regression | API handler behavior with mocked auth/database boundaries | Vitest |
| Integration | Supabase-backed workflows that need real database/RLS behavior | Playwright or targeted scripts |
| E2E | Full browser workflows against a real dev server and Supabase project | Playwright |
| Manual exploratory | TV/display behavior, venue-device behavior, visual checks, launch smoke | Human QA checklist |

## Feature Coverage Matrix

| Area | Must Cover |
|---|---|
| Auth | signup, login, logout, resend confirmation, set password, safe redirects, rate limits |
| Dashboard | event create, event delete, event cap, empty state, navigation |
| Event access | owner/editor/viewer boundaries, no cross-event reads/writes, hidden invite tokens |
| Collaborators | invite existing/new user, accept token as signed-in user, role changes, removal |
| Cue sheet import | valid Excel, malformed rows, dry-run/commit behavior, event-scoped replace |
| Program CRUD | create/update/delete validation, version conflicts, session/partition ownership |
| Reorder/bulk edit | move, swap, bulk field update, bulk partition move, cross-event ID rejection |
| Live control | claim/renew/release, start/next/previous/jump/finish, hold, timer correction, race conflicts |
| Remote | mobile control uses same live-action contract, unauthorized access fails |
| Displays | share-link access, operator preview access, token revoke/expiry, display polling |
| Display registry | heartbeat, display rename/type/room/profile, pending commands, event scoping |
| Broadcasts | create/schedule/promote/dismiss/acknowledge, token/session authority, targeting |
| Share links/TV code | create, collision retry, revoke, expiry, rate-limited TV code entry |
| Integration API | credential create/revoke, token hashing, state read, live actions, scope enforcement |
| Rehearsal | local-only progress, reset, no production display mutation |
| Migrations | fresh replay order, critical RPC signatures, RLS/policies present |
| Build/release | lint, typecheck, unit tests, production build, E2E, deployment smoke |

## Automation Batches

### Batch 1: Launch-Blocker Regression Tests

- Add route tests for live-control event scoping.
- Add route tests for bulk program move event/partition scoping.
- Add regression tests for share-link and broadcast access authority.
- Verify existing token, safe redirect, rate-limit, parser, and validation tests still pass.

### Batch 2: Auth And Access E2E

- Expand Playwright from the golden path into owner/editor/viewer workflows.
- Add invite acceptance flow.
- Add unauthorized event access assertions.
- Add logout/session redirect assertions.

### Batch 3: Cue Sheet And Live Control E2E

- Seed or upload a representative cue sheet.
- Verify session selection, start, next, previous, jump, hold, timer correction, notes, alerts.
- Verify cue-sheet edit/reorder/bulk edit updates the displayed state.

### Batch 4: Displays, Broadcasts, Share Links

- Generate a share link and verify `/screens`, `/general`, `/av`, `/green-room`, `/presenter`.
- Verify revoked/expired links fail.
- Verify broadcasts appear on display data and can be acknowledged/dismissed only by allowed callers.
- Verify display registry heartbeat and owner commands.

### Batch 5: Integration API And Migration Checks

- Test bearer-token state read and live actions.
- Test revoked/wrong-scope/wrong-event tokens.
- Add migration replay smoke instructions for local Supabase or CI.

## Manual Launch QA

- Run the app on desktop, mobile-width browser, and a TV-sized viewport.
- Open at least two operator sessions and verify control locking.
- Open at least two display types from the same share link.
- Revoke the share link and confirm every display stops receiving data.
- Run a short rehearsal, then run the same sequence in production mode.
- Confirm email invite behavior with and without Resend configured.

## Current Batch

The first implementation batch starts with route/regression tests for the most recent security-sensitive fixes: live-control event scoping and bulk program move event scoping.
