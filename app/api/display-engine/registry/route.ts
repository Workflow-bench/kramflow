import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

// POST register-or-heartbeat, upsert by id. Still no requireAuth() — called
// automatically every 15s by every display page — but display_registry is
// now one event's set of connected devices, not a global list, so
// event_id is resolved via a token or an owned eventId rather than
// accepted as a bare client parameter (see display-engine/hold/route.ts).
export async function POST(request: Request) {
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

  const id = body.id;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  // use-time-sync.ts's latencyMs is roundTripMs/2 — often a non-integer
  // (e.g. 22.5) — but latency_ms is an `integer` column, which Postgres
  // rejects a fractional value for. Round it; sub-millisecond precision
  // isn't meaningful here anyway.
  const latencyMs = typeof body.latencyMs === "number" ? Math.round(body.latencyMs) : null;

  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_seen_at: now };
  if (typeof body.latencyMs === "number" || body.latencyMs === null) patch.latency_ms = latencyMs;
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.type === "string") patch.type = body.type;
  if (body.room !== undefined) patch.room = body.room;

  // Try the insert first rather than checking existence beforehand — a
  // select-then-branch here raced for real: two heartbeats for the same
  // display arriving close together (React re-mounting the registering
  // effect, a retried request) could both see "no existing row" and both
  // attempt an insert, the second failing on display_registry's primary
  // key with a 500 (confirmed live, not hypothetical). Falling back to an
  // update specifically on that unique-violation closes the race without
  // touching the update path's own semantics — it still only patches the
  // fields a given call actually sent, so a bare heartbeat (id + latency)
  // never clobbers a name set by a later rename. Requires the composite
  // (event_id, id) primary key (migration
  // display_registry_composite_primary_key) — the previous `id`-only key
  // would have let two different events' displays collide on this path.
  const { error: insertError } = await supabase.from("display_registry").insert({
    id,
    event_id: access.eventId,
    name: typeof body.name === "string" ? body.name : id,
    type: typeof body.type === "string" ? body.type : "custom",
    room: body.room ?? null,
    registered_at: now,
    last_seen_at: now,
    latency_ms: latencyMs,
  });

  if (insertError) {
    // 23505 = unique_violation — the only case that means "already
    // registered, update it instead." Anything else is a real failure.
    if (insertError.code !== "23505") {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
    const { error: updateError } = await supabase
      .from("display_registry")
      .update(patch)
      .eq("id", id)
      .eq("event_id", access.eventId);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
