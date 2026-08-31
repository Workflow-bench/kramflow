import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { eventFormConfigSchema } from "@/lib/validation/form-config";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin().from("events").select("*").eq("id", eventId).single();
  if (error || !data) return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  return NextResponse.json({ ok: true, event: data });
}

// Event settings (name/date/venue/timezone/form_config) and delete both
// stay owner-only — a step above "editor," which grants cue-sheet content
// access but not event-level configuration or destructive control.
export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; form_config?: unknown; event_date?: unknown; venue?: unknown; timezone?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  // lib/validation/form-config.ts exists specifically to validate this
  // shape but was never actually wired up — a malformed field (bad
  // group/type enum) previously saved unchecked and only broke silently
  // on read, when components/forms/program-form.tsx's shallow
  // Array.isArray check let it through but the field itself failed to
  // render for every collaborator on the event.
  if (body.form_config !== undefined) {
    if (body.form_config !== null) {
      const parsed = eventFormConfigSchema.safeParse(body.form_config);
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: "Invalid form_config", errors: parsed.error.flatten() }, { status: 400 });
      }
      patch.form_config = parsed.data;
    } else {
      patch.form_config = null;
    }
  }
  // All optional event-detail fields — null explicitly clears them, undefined
  // (the key omitted entirely) leaves them untouched.
  if (body.event_date !== undefined) patch.event_date = typeof body.event_date === "string" ? body.event_date : null;
  if (body.venue !== undefined) patch.venue = typeof body.venue === "string" ? body.venue.trim().slice(0, 200) : null;
  if (body.timezone !== undefined) patch.timezone = typeof body.timezone === "string" ? body.timezone : null;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin().from("events").update(patch).eq("id", eventId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event: data });
}

// Cascades everything (sessions, programs, partitions, live_state,
// display_state, share_links, activity_log, ...) via each table's
// `references events(id) on delete cascade` — one delete, no orphaned rows.
export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("events").delete().eq("id", eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
