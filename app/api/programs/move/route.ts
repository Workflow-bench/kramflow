import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Arbitrary-position reorder for the Cue Sheet editor's drag-and-drop — see
// supabase/schema.sql's move_program for why this needs to be a single
// transaction with a deferred unique constraint rather than client-computed
// sort_order arithmetic. move_program itself checks p_id and p_after_id
// belong to the same event (raises otherwise); this route additionally
// confirms p_id and p_partition_id both belong to the *authorized* event
// before calling it — the RPC's internal consistency check alone doesn't
// know who's asking, only that the two ids it was given agree with each
// other.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, id, afterId, partitionId } = (body ?? {}) as Record<string, unknown>;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  if (afterId !== null && afterId !== undefined && typeof afterId !== "string") {
    return NextResponse.json({ ok: false, error: "afterId must be a string or null" }, { status: 400 });
  }
  if (partitionId !== null && partitionId !== undefined && typeof partitionId !== "string") {
    return NextResponse.json({ ok: false, error: "partitionId must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: ownedProgram, error: ownedError } = await supabase
    .from("programs")
    .select("id")
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .maybeSingle();
  if (ownedError) return NextResponse.json({ ok: false, error: ownedError.message }, { status: 500 });
  if (!ownedProgram) return NextResponse.json({ ok: false, error: "Program not found" }, { status: 404 });

  if (partitionId) {
    const { data: ownedPartition, error: partitionError } = await supabase
      .from("partitions")
      .select("id")
      .eq("id", partitionId)
      .eq("event_id", auth.eventId)
      .maybeSingle();
    if (partitionError) return NextResponse.json({ ok: false, error: partitionError.message }, { status: 500 });
    if (!ownedPartition) return NextResponse.json({ ok: false, error: "Partition not found" }, { status: 404 });
  }

  const { error } = await supabase.rpc("move_program", {
    p_id: id,
    p_after_id: afterId ?? null,
    p_partition_id: partitionId ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
