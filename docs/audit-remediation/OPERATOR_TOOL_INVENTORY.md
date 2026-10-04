# Operator tool inventory (KF-041, from the code)

Generated from the route tree and the access checks, not from a live setup. Verification against a real pre-show setup is still open.

## Operator pages (under `app/e/[eventId]/`, owner or accepted collaborator)

| Page | Purpose | Roles (enforced) |
| --- | --- | --- |
| `operator` | Live console: next, previous, jump, pause, alerts, notes, session start | owner only: `api/live` refuses other roles with 403 (the page UI for them was not checked) |
| `operator/cue-sheet` | Edit sessions and items; import Excel or AI | editor and owner (`api/sessions`, `api/programs`, `api/cue-sheet/upload`: `editor`) |
| `operator/cue-sheet/print` | Print the cue sheet | viewer and above (`api/cue-sheet/export`: `viewer`) |
| `operator/cue-sheet/report` | Session report | viewer and above (`api/ai/session-report`: `viewer`) |
| `rehearsal` | Rehearse in the browser; no live write | any role that opens the event; no server write to live state |
| `remote` | One-hand remote: next and countdown on a phone | owner only (live actions) |
| `displays` | Display registry and profiles | registry changes: owner; profiles: editor; reads: viewer |
| `broadcast` | Broadcast center: send and dismiss messages | owner only (`api/display-engine/broadcasts`: `owner`) |
| `settings` | Event details, collaborators, share links, integrations | owner only (`api/events/[eventId]` writes, collaborators, share links, integrations: `owner`) |

Route-level checks: `requireEventAccess` (`lib/server/require-event-access.ts`) for API routes, the layout check in `app/e/[eventId]/layout.tsx` for pages.

## Operator API surface (route handlers)

- Live state: `api/live` (requires `owner`, and each sequencing action also needs the control lease), `api/v1/events/[eventId]/state` and `.../actions/[action]` (access level not read in this pass).
- Cue sheet: `api/cue-sheet/upload`, `api/cue-sheet/export`, `api/ai/cue-sheet-import`, `api/ai/cue-sheet-import/commit`, `api/programs` (`[id]`, `bulk`, `move`, `swap`), `api/sessions` (`[id]`), `api/partitions/[id]`, `api/auditoriums`.
- Display control: `api/display-engine/hold`, `timer`, `time`, `speaker-ready`, `registry` (`[id]`), `profiles` (`[id]`), `broadcasts` (`[id]`, `acknowledge`, `dismiss`, `promote`).
- Events and sharing: `api/events` (`[eventId]`), `api/events/[eventId]/collaborators`, `api/events/[eventId]/integrations` (`[credentialId]`), `api/share-links` (`[id]`), `api/invites/[token]/accept`.
- AI assist: `api/ai/alert-draft`, `readiness-review`, `session-report`, `status`. Each sends the content it reads to Anthropic.

## External services used by these tools

- Supabase (database, auth, realtime).
- Anthropic (AI assist routes and cue-sheet import; document text is sent for reading).
- Resend (email for invites and auth flows, `lib/server/email.ts`).

## Not covered by this inventory

- Real pre-show setup with real displays and a real control lease across devices.
- Venue network behaviour (Wi-Fi, sleep modes on TV hardware).
