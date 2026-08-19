import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Item 5's bulk-edit — two shapes depending on what's being changed:
//   { eventId, ids, field, value }   -> bulk_update_programs (color/status/etc.)
//   { eventId, ids, partitionId }    -> bulk_move_programs_to_partition
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, ids, field, value, partitionId } = (body ?? {}) as Record<string, unknown>;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ ok: false, error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // bulk_update_programs has no event-scoping of its own (see
  // supabase/schema.sql) — an id list mixing this event's programs with
  // another event's would otherwise silently edit both. Verified here,
  // once, before either RPC runs: every id must resolve to a program that
  // actually belongs to the authorized event.
  const { data: owned, error: ownedError } = await supabase
    .from("programs")
    .select("id")
    .eq("event_id", auth.eventId)
    .in("id", ids);
  if (ownedError) return NextResponse.json({ ok: false, error: ownedError.message }, { status: 500 });
  if (!owned || owned.length !== ids.length) {
    return NextResponse.json({ ok: false, error: "One or more items don't belong to this event" }, { status: 403 });
  }

  if (typeof field === "string") {
    if (value !== null && typeof value !== "string") {
      return NextResponse.json({ ok: false, error: "value must be a string or null" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("bulk_update_programs", { p_ids: ids, p_field: field, p_value: value });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, programs: data });
  }

  if (partitionId !== undefined) {
    if (partitionId !== null && typeof partitionId !== "string") {
      return NextResponse.json({ ok: false, error: "partitionId must be a string or null" }, { status: 400 });
    }
    const { error } = await supabase.rpc("bulk_move_programs_to_partition", { p_ids: ids, p_partition_id: partitionId });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Provide either { field, value } or { partitionId }" }, { status: 400 });
}
