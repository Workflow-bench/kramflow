import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySessionAccess } from "@/lib/server/verify-display-access";

// PATCH the speaker-ready toggle. Owner only. Session only: a Share
// Display token is read-only and never authorizes this (see
// verifySessionAccess).
//
// Was previously left at the default "viewer" floor on the theory that
// this is presence/check-in rather than a show mutation, and that the
// Remote page's own copy documented it as a deliberate exception. Codex's
// independent Phase 1 review (KF-001/R1) rejected that reasoning: the
// master remediation contract is "owner operates live state, editor edits
// permitted cue data, viewer reads only" with no named exception for this
// route, and Settings' own collaborator copy makes the same unqualified
// promise to users ("Viewers can only look."). Inconsistent product copy
// documenting a gap is exactly what the original audit flagged in the
// first place, not a basis for carving out an exception unilaterally. See
// the Remote page's own comment for the corresponding UI change — a
// non-owner still sees the current ready/not-ready state, just can't
// change it, matching hold/timer.
export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await verifySessionAccess(typeof body.eventId === "string" ? body.eventId : undefined, "owner");
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
