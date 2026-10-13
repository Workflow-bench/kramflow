# Legal drafts: outline for counsel (NOT a privacy policy or terms)

Status: DRAFT OUTLINE, for owner review. Not legal advice. Nothing here has been reviewed by counsel, and nothing here is published. The text is not written yet, so no assurance is made.

## Facts from the code that any privacy notice must address

- Account data: email and password (Supabase Auth), display name.
- Event data: sessions, items, presenter names and contacts entered by operators (`lib/validation/program.ts`), collaborator emails.
- Uploads: cue-sheet files (Excel up to 10 MB). AI import sends the document text to Anthropic (`lib/server/ai.ts`, `lib/ai/cue-sheet-import.ts`).
- Email: invites and auth emails through Resend (`lib/server/email.ts`).
- Access logs and rate-limit records keyed by IP (`lib/server/rate-limit.ts`).

## Processors named in the code

- Supabase, Anthropic, Resend, Vercel (hosting, per the deployment docs).

## Open facts the owner must supply

- Legal entity name and contact address.
- Retention periods for event data, uploads, and logs.
- Whether the AI feature is enabled for every customer (`lib/server/ai-guard.ts`).
- Regions where data is stored and processed.
- Whether event data may include personal data of minors or venue staff.

## Sections counsel would expect (to be drafted only after the facts above)

1. Who is responsible for the data.
2. What is collected, and why.
3. Processors and transfers.
4. Retention and deletion.
5. Individual rights and how to exercise them.
6. Security measures in plain terms, without guarantees the code cannot back.
7. Changes to this notice.
