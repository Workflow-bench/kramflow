import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";
import { programUpdateSchema, toProgramRow } from "@/lib/validation/program";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = (json as Record<string, unknown> | null)?.eventId;
  const auth = await requireEventOwner(typeof eventId === "string" ? eventId : null);
  if (auth instanceof NextResponse) return auth;

  const parsed = programUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const clientVersion = (json as Record<string, unknown>).version;
  if (typeof clientVersion !== "number") {
    return NextResponse.json({ ok: false, error: "Missing version" }, { status: 400 });
  }

  // event_id is included in the match, not just id — id alone is a
  // sufficiently random uuid that guessing one is impractical, but this is
  // the difference between "impractical" and "impossible": without it, a
  // known/leaked program id from a *different* event would still update
  // here as long as the version happened to match.
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("programs")
    .update({ ...toProgramRow(parsed.data), updated_at: new Date().toISOString(), version: clientVersion + 1 })
    .eq("id", id)
    .eq("event_id", auth.eventId)
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventOwner(eventId);
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("programs").delete().eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
