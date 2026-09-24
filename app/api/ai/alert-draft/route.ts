import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { aiErrorResponse, guardAi } from "@/lib/server/ai-guard";
import { runStructured } from "@/lib/server/ai";
import { ALERT_DRAFT_SYSTEM, alertDraftInputSchema, alertDraftSchema, buildAlertPrompt, PRIORITY_VALUE } from "@/lib/ai/alert-draft";

// POST { eventId, instruction, context? } — returns a draft alert or
// broadcast for the operator to review. Owner-only, like sending one: the
// people who can post an alert are the only ones who can draft it. Nothing
// is sent or stored here.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = typeof (body as { eventId?: unknown })?.eventId === "string" ? (body as { eventId: string }).eventId : null;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const input = alertDraftInputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ ok: false, error: input.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const blocked = await guardAi(auth.userId, "alert-draft");
  if (blocked) return blocked;

  try {
    const draft = await runStructured({
      system: ALERT_DRAFT_SYSTEM,
      prompt: buildAlertPrompt(input.data),
      schema: alertDraftSchema,
      maxTokens: 2000,
      tier: "fast",
      effort: "low",
    });
    return NextResponse.json({
      ok: true,
      draft: {
        type: draft.type,
        title: draft.title.trim(),
        message: draft.message.trim(),
        priority: PRIORITY_VALUE[draft.priority],
        audience: draft.audience,
        acknowledgementRequired: draft.acknowledgement_required,
      },
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
