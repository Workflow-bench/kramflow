import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Sets a section's start_time — the anchor item 6b's duration cascade
// (lib/schedule.ts's computeScheduledTimes) walks forward from for any
// item in the section with time_is_computed on. Only start_time is
// editable here; label/reordering go through the Excel-import replace
// path and aren't part of this request's scope.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { start_time } = body;
  if (start_time !== null && typeof start_time !== "string") {
    return NextResponse.json({ ok: false, error: "start_time must be a string or null" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("partitions").update({ start_time }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
