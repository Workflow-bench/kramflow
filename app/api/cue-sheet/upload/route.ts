import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { parseCueSheet, type ParsedPartition, type ParsedProgram, type ParsedSession } from "@/lib/parse-cuesheet";
import { commitCueSheet, validateRows } from "@/lib/server/cue-sheet-commit";

// POST a .xlsx file (multipart/form-data, field name "file").
// ?dryRun=1 parses + validates without writing, returning the parsed rows
// and any validation errors for a review step (docs/USER_FLOW.md's
// "Import Excel -> Review Program" step). Without it, commits to Supabase:
// upserts sessions, replaces each affected session's programs wholesale
// (same "delete then insert" reasoning as scripts/seed.ts — the parser
// doesn't assign stable per-row ids across re-uploads).

// xlsx (SheetJS) has two open, unfixed high-severity advisories (prototype
// pollution, ReDoS — GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) with no
// upstream patch available. This route is the only place untrusted bytes
// reach it, so bound the blast radius here: reject anything past a size a
// real cue sheet has no reason to approach (the bundled reference sheet is
// well under 1MB) before it ever reaches XLSX.read.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  let file: File | null = null;
  let eventId: string | null = null;
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    if (entry instanceof File) file = entry;
    const eventIdEntry = formData.get("eventId");
    if (typeof eventIdEntry === "string") eventId = eventIdEntry;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const auth = await requireEventAccess(eventId, "editor");
  if (auth instanceof NextResponse) return auth;

  if (!file) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). The limit is 10MB.` },
      { status: 413 }
    );
  }

  let parsed: { sessions: ParsedSession[]; partitions: ParsedPartition[]; programs: ParsedProgram[] };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseCueSheet(buffer);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Failed to parse file: ${(err as Error).message}` }, { status: 400 });
  }

  const rowErrors = validateRows(parsed.programs);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      sessions: parsed.sessions,
      programs: parsed.programs,
      errors: rowErrors,
    });
  }

  if (rowErrors.length > 0) {
    return NextResponse.json({ ok: false, error: "Validation failed", errors: rowErrors }, { status: 400 });
  }

  const result = await commitCueSheet(
    auth.eventId,
    parsed,
    `Uploaded ${file.name}: ${parsed.sessions.length} sessions, ${parsed.programs.length} programs`
  );
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    sessionsWritten: result.sessionsWritten,
    programsWritten: result.programsWritten,
  });
}
