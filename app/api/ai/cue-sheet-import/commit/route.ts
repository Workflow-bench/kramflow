import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { checkCueSheetIntegrity, commitCueSheet, parsedCueSheetSchema } from "@/lib/server/cue-sheet-commit";

// POST { eventId, sheet } — saves what the operator confirmed on the AI
// import review screen. No model call happens here: the browser holds the
// reviewed rows, so they are re-validated from scratch (same row schema as
// the Excel path, plus cross-reference checks) before anything is written.
// Like the Excel import it replaces the affected sessions' items wholesale.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  const parsed = parsedCueSheetSchema.safeParse(body.sheet);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: `Invalid cue sheet: ${parsed.error.issues[0]?.message ?? "bad shape"}` },
      { status: 400 }
    );
  }
  const sheet = { ...parsed.data, programs: parsed.data.programs.map((p) => ({ ...p, curtains: p.curtains ?? null, color_tag: p.color_tag ?? null })) } as Parameters<typeof checkCueSheetIntegrity>[0];
  if (sheet.programs.length === 0) return NextResponse.json({ ok: false, error: "Nothing to import." }, { status: 400 });
  const integrityError = checkCueSheetIntegrity(sheet);
  if (integrityError) return NextResponse.json({ ok: false, error: integrityError }, { status: 400 });

  const result = await commitCueSheet(
    auth.eventId,
    sheet,
    `AI import: ${sheet.sessions.length} sessions, ${sheet.programs.length} programs`
  );
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionsWritten: result.sessionsWritten, programsWritten: result.programsWritten });
}
