import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySessionAccess } from "@/lib/server/verify-display-access";

// PATCH the speaker-ready toggle. Session only: a Share Display token is
// read-only and never authorizes this (see verifySessionAccess). Any role
// with access to the event may toggle it, as the Remote page documents
// (OWNER_ONLY_NOTE there explicitly carves this out: "Only the event owner
// can control the show from here. You can still watch and mark the speaker
// ready."). Deliberately left at the default "viewer" floor — reviewed
// against the audit's SEC-02 finding (which flagged all three of hold,
// timer, and this route as a blanket "viewer can mutate state" issue) and
// kept as-is here on purpose: this is presence/check-in, not a show
// mutation, and restricting it to owner would break real, documented,
// currently-used product behavior for backstage editor/viewer
// collaborators. hold and timer moved to "owner" instead — see their own
// route files.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifySessionAccess(typeof body.eventId === "string" ? body.eventId : undefined);
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
  if (fetchError) {
    console.error(fetchError);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }

  const speakerReady = { ...(row.speaker_ready as Record<string, boolean>), [programId]: body.ready };
  const { error } = await supabase
    .from("display_state")
    .update({ speaker_ready: speakerReady })
    .eq("event_id", access.eventId);
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
