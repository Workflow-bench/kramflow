import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { programUpdateSchema, toProgramRow } from "@/lib/validation/program";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = programUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  // version is plumbing (the row's version as of when the edit form loaded),
  // not a user-editable field, so programUpdateSchema doesn't know about it
  // — read directly off the raw body. Required: the form (this route's only
  // caller) always sends it.
  const clientVersion = (json as Record<string, unknown>).version;
  if (typeof clientVersion !== "number") {
    return NextResponse.json({ ok: false, error: "Missing version" }, { status: 400 });
  }

  // Optimistic-concurrency check — confirmed live that two operators editing
  // the same item within the same stale-data window (the form PATCHes its
  // entire snapshot, not a diff) silently overwrote each other with no
  // error to either party. Same version-column pattern as live_state/
  // display_state.
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("programs")
    .update({ ...toProgramRow(parsed.data), updated_at: new Date().toISOString(), version: clientVersion + 1 })
    .eq("id", id)
    .eq("version", clientVersion)
    .select();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { ok: false, error: "This item was changed by someone else — reload the cue sheet and try again" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, program: data[0] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
