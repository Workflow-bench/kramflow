import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Item 5's bulk-edit — two shapes depending on what's being changed:
//   { ids, field, value }        -> bulk_update_programs (color/status/etc.)
//   { ids, partitionId }         -> bulk_move_programs_to_partition (move
//                                    the whole selection into a section)
// Kept as one route/one PATCH verb since both are "apply one bulk-edit
// operation to a set of ids" — the discriminator is just which fields the
// body carries, mirroring how app/api/live/route.ts uses one endpoint for
// several related mutations rather than one route per action.
export async function PATCH(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { ids, field, value, partitionId } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ ok: false, error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

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
