import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST acknowledge (emergency broadcasts). No requireAuth() —
// broadcast-overlay.tsx's "Acknowledge" button is on the public,
// unauthenticated emergency takeover screen.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const displayId = body.displayId;
  if (typeof displayId !== "string") {
    return NextResponse.json({ ok: false, error: "displayId is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  // acknowledge_broadcast (supabase/schema.sql) does the read-check-write
  // in one atomic UPDATE — two displays acknowledging within the same
  // round trip can no longer race a plain SELECT-then-UPDATE from here and
  // silently drop one of them. Idempotent either way (already-acknowledged
  // is a harmless no-op inside the function), so there's nothing left for
  // the route itself to branch on.
  const { error } = await supabase.rpc("acknowledge_broadcast", { p_id: id, p_display_id: displayId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
