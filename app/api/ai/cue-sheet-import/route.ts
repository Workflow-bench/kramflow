import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { aiErrorResponse, guardAi } from "@/lib/server/ai-guard";
import { runStructured } from "@/lib/server/ai";
import { checkLength, DocumentTextError, extractDocumentText } from "@/lib/server/document-text";
import { validateRows } from "@/lib/server/cue-sheet-commit";
import { aiCueSheetSchema, buildImportPrompt, CUE_SHEET_IMPORT_SYSTEM, mapAiCueSheet } from "@/lib/ai/cue-sheet-import";

// A long run of show is a long generation.
export const maxDuration = 300;

// POST multipart/form-data: eventId plus either `file` (.xlsx/.csv/.txt) or
// `text` (pasted). Preview only — nothing is written. The client shows the
// result for review and sends the (possibly trimmed) rows to
// ./commit to save them.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }
  const eventIdEntry = form.get("eventId");
  const auth = await requireEventAccess(typeof eventIdEntry === "string" ? eventIdEntry : null, "editor");
  if (auth instanceof NextResponse) return auth;

  const blocked = await guardAi(auth.userId, "cue-sheet-import");
  if (blocked) return blocked;

  try {
    const file = form.get("file");
    const pasted = form.get("text");
    let documentText: string;
    if (file instanceof File && file.size > 0) documentText = await extractDocumentText(file);
    else if (typeof pasted === "string") documentText = checkLength(pasted);
    else return NextResponse.json({ ok: false, error: "Provide a file or some text." }, { status: 400 });

    const ai = await runStructured({
      system: CUE_SHEET_IMPORT_SYSTEM,
      prompt: buildImportPrompt(documentText),
      schema: aiCueSheetSchema,
      maxTokens: 64_000,
      effort: "medium",
    });
    const mapped = mapAiCueSheet(ai);
    if (mapped.programs.length === 0) {
      return NextResponse.json({ ok: false, error: "No cue-sheet items were found in that document." }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      sessions: mapped.sessions,
      partitions: mapped.partitions,
      programs: mapped.programs,
      warnings: mapped.warnings,
      errors: validateRows(mapped.programs),
    });
  } catch (err) {
    if (err instanceof DocumentTextError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    return aiErrorResponse(err);
  }
}
