import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

// GET — list *my* events only. Relies on "owner select" RLS as the real
// boundary (supabase/schema.sql) — filtering by owner_id here too is
// belt-and-suspenders, not the only thing standing between operators.
export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("events")
    .select("*")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, events: data });
}

// POST — create a new event, owned by the caller. Provisions its
// live_state/display_state rows in the same request (every other column
// on both tables has a DB default — see the migration — so this is a
// bare insert of just event_id).
export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: { name?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // name is optional — falls back below.
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Untitled Event";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data: event, error } = await admin.from("events").insert({ owner_id: user!.id, name }).select("*").single();
  if (error || !event) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Failed to create event" }, { status: 500 });
  }

  const [liveStateResult, displayStateResult] = await Promise.all([
    admin.from("live_state").insert({ event_id: event.id }),
    admin.from("display_state").insert({ event_id: event.id }),
  ]);
  if (liveStateResult.error || displayStateResult.error) {
    // Roll back the event row rather than leave a half-provisioned event
    // an operator can select but that 500s the moment they open it.
    await admin.from("events").delete().eq("id", event.id);
    const message = liveStateResult.error?.message ?? displayStateResult.error?.message ?? "Failed to provision event";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event });
}
