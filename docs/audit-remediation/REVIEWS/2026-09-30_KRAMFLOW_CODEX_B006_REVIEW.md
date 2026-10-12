# B006 independent review

**PARTIAL / HOLD for whole-batch completion; continue unaffected implementation.** HEAD `c67d0f34097b6635884d1dbcaf1d94b70192d039`, base `3bee9e8b07274ab76c9bae5574edee5ef2cb7553`. No app edits, shared database changes, deploy, push or flagged-account operations.

Independent verification: 377/377 Vitest tests, ledger validator, standard Turbopack production build and sequential nonincremental typecheck PASS. Lint 0 errors/6 baseline warnings. Independently initialized a disposable local Postgres cluster with a temporary Unix socket, ran the supplied SQL suite successfully, and stopped it. This proves the suite against its minimal table mirror, not a Supabase migration deployment. Reviewed generated production homepage HTML metadata. No authenticated browser replay or new Lighthouse measurement performed.

## Standards

**B006-S1 — P1: repeated-workbook import into a new event remains broken.** `lib/parse-cuesheet.ts:199` creates session IDs solely from day/session labels. The real schema keeps global `sessions.id` primary key; `(event_id,id)` is only an additional unique constraint. New RPC at `supabase/migrations/20260930000000_import_cue_sheet_atomic.sql:52–65` cannot upsert identical label-derived IDs into another event. It safely rolls back instead of overwriting, but the original new-event import acceptance remains unsatisfied. Tests explicitly expect collision failure rather than proving two events can import identical workbooks. Introduce compatible event-scoped storage identities/mapping across sessions, programs and partitions; preserve separate rejection of actual foreign tenant identifiers. Test repeated imports in each of two events and subsequent session start.

Accepted at source/local-test level: one transaction for sessions, affected program/partition replacement including empty sessions and activity log; owner/accepted-editor tenant check, service-role-only execution and pinned search_path; rollback warning requires coordinated code revert. Application RPC migration remains unapplied externally, so runtime imports are not certified.

Logout's shared confirmed-success contract and rehearsal operator-interaction tracking are source-correct in this bounded review. They still need component/browser and authenticated runtime evidence. Do not redo accepted narrow criteria.

## Spec

**B006-F1 — P2: homepage OG override loses existing fields.** `app/page.tsx:44–47` overrides the root OG object with URL only. Production generated HTML independently contains OG title/description/image/URL, but no `og:site_name` or `og:type`. Preserve complete intentional homepage OG metadata. Do not claim title/description are missing.

**B006-F2 — P2: per-route metadata inventory remains incomplete.** New auth/display layouts set title/noindex but inherit marketing OG/Twitter title and description. Dashboard/event/invitation routes still lack explicit noindex decisions; `/invite/[token]` is not uniformly authenticated. Disallowing robots does not provide authorization or guarantee discovery of noindex. Complete the inventory and deliberate header/meta/crawl policy without exposing private data or tokens in previews. This is unfinished KF-026, not a proven data leak. Verify rendered metadata at final build; image HTTP 200 alone does not prove preview cropping/legibility.

Accepted source progress: home canonical relocation, generated 1200×630 OG image, auth/display noindex additions, pruned sitemap and micro-label contrast adjustments. Full contrast, reflow, keyboard and LCP criteria remain unverified. SheetJS applicability is Claude-reported primary-source evidence in this review; its parser limits and ongoing monitoring criterion are not closed solely by the two version ranges.

Remaining scope explicitly includes multi-session import UI/refresh/start, recovery/login/navigation, accessibility/performance sweeps, local security/operational preparation, documents/decisions, secure-cookie procedure, KF-031 and KF-036.9. External Supabase/DNS/monitoring/legal approvals stay distinct from locally implementable work. No whole-parent CODEX_VERIFIED status granted by this partial review.

Standards: 1 actionable high-priority import finding. Spec: 2 metadata findings. Continue with KRAMFLOW_CLAUDE_B007_CONTINUATION.md and the accelerated prompt; do not make another choice request between lanes.
