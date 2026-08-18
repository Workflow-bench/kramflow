import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

// PATCH the speaker-ready toggle — still no requireAuth() (Green Room's
// own unauthenticated toggle), event_id-resolved the same way as
// display-engine/hold/route.ts.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifyDisplayAccess(
    typeof body.token === "string" ? body.token : undefined,
    typeof body.eventId === "string" ? body.eventId : undefined
  );
  if (!access.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

  const programId = body.programId;
  if (typeof programId !== "string" || typeof body.ready !== "boolean") {
    return NextResponse.json({ ok: false, error: "programId and ready are required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: row, error: fetchError } = await supabase
    .from("display_state")
    .select("speaker_ready")
    .eq("event_id", access.eventId)
    .single();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });

  const speakerReady = { ...(row.speaker_ready as Record<string, boolean>), [programId]: body.ready };
  const { error } = await supabase
    .from("display_state")
    .update({ speaker_ready: speakerReady })
    .eq("event_id", access.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
