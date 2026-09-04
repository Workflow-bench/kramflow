import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivityAs } from "@/lib/server/activity-log";

// Atomically swaps two programs' sort_order — see supabase/schema.sql's
// swap_program_order for why this needs to be a single transaction, and
// for its own internal check that idA/idB belong to the same event (which
// says nothing about whether *that* event is the caller's — confirmed
// here first).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, idA, idB } = (body ?? {}) as Record<string, unknown>;
  const auth = await requireEventAccess(typeof eventId === "string" ? eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  if (typeof idA !== "string" || typeof idB !== "string") {
    return NextResponse.json({ ok: false, error: "idA and idB are required" }, { status: 400 });
  }

  const uniqueIds = [...new Set([idA, idB])];
  const supabase = supabaseAdmin();
  const { data: owned, error: ownedError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("event_id", auth.eventId)
    .in("id", uniqueIds);
  if (ownedError) return NextResponse.json({ ok: false, error: ownedError.message }, { status: 500 });
  if (!owned || owned.length !== uniqueIds.length) {
    return NextResponse.json({ ok: false, error: "One or both items don't belong to this event" }, { status: 403 });
  }

  const { error } = await supabase.rpc("swap_program_order", { p_id_a: idA, p_id_b: idB });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const nameA = owned.find((p) => p.id === idA)?.name ?? "an item";
  const nameB = owned.find((p) => p.id === idB)?.name ?? "an item";
  await logActivityAs(supabase, auth.eventId, auth.userId, "programSwap", `Swapped order of "${nameA}" and "${nameB}"`);
  return NextResponse.json({ ok: true });
}
