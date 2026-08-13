import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Arbitrary-position reorder for the Cue Sheet editor's drag-and-drop
// (item 4) — see supabase/schema.sql's move_program for why this needs to
// be a single transaction with a deferred unique constraint rather than
// client-computed sort_order arithmetic. afterId null moves to the very
// front of the session; partitionId is the drop target's partition (the
// UI keeps drag-and-drop scoped within a single partition, but the RPC
// itself doesn't enforce that — same partition in and out is the normal
// case, this route just passes through whatever the caller asks for).
export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { id, afterId, partitionId } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  if (afterId !== null && typeof afterId !== "string") {
    return NextResponse.json({ ok: false, error: "afterId must be a string or null" }, { status: 400 });
  }
  if (partitionId !== null && typeof partitionId !== "string") {
    return NextResponse.json({ ok: false, error: "partitionId must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.rpc("move_program", {
    p_id: id,
    p_after_id: afterId,
    p_partition_id: partitionId,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
