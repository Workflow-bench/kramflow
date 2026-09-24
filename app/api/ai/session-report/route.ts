import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { aiErrorResponse, guardAi } from "@/lib/server/ai-guard";
import { runStructured } from "@/lib/server/ai";
import { buildReportPrompt, reportInputSchema, reportNarrativeSchema, SESSION_REPORT_SYSTEM } from "@/lib/ai/session-report";

// POST { eventId, eventName, sessions } — turns the timing figures the
// report page already computed into a written summary. The figures come
// from the caller (the browser runs lib/timing.ts); they only ever shape
// prose returned to that same caller, so there is nothing to protect by
// recomputing them here.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = typeof (body as { eventId?: unknown })?.eventId === "string" ? (body as { eventId: string }).eventId : null;
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const input = reportInputSchema.safeParse(body);
  if (!input.success) return NextResponse.json({ ok: false, error: "Invalid report data" }, { status: 400 });

  const blocked = await guardAi(auth.userId, "session-report");
  if (blocked) return blocked;

  try {
    const narrative = await runStructured({
      system: SESSION_REPORT_SYSTEM,
      prompt: buildReportPrompt(input.data),
      schema: reportNarrativeSchema,
      maxTokens: 4000,
      effort: "medium",
    });
    return NextResponse.json({ ok: true, narrative });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
