import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logActivityAs } from "@/lib/server/activity-log";

// requireEventAccess(owner)-gated — only Display Manager (an authenticated
// operator managing their own event) renames/reassigns/commands/removes a
// display. Registering and heartbeating (POST ../route.ts) stay public
// since public display pages do that themselves.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "owner");
  if (auth instanceof NextResponse) return auth;

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.type === "string") patch.type = body.type;
  if (body.room !== undefined) patch.room = body.room;
  if (body.profileId !== undefined) patch.profile_id = body.profileId;
  if (body.pendingCommand !== undefined) patch.pending_command = body.pendingCommand;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("display_registry").update(patch).eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Only deliberate operator actions are worth an activity entry — not
  // every field this route can touch. pendingCommand: null is the display
  // client's own ack that it picked up and cleared a command (see
  // lib/display-engine/use-register-display.ts's clearCommand call, fired
  // automatically on every command receipt), not an operator doing
  // something; logging that would spam the feed with a noisy echo of an
  // action already logged when the command was sent.
  const detail =
    typeof body.name === "string"
      ? `Renamed display to "${body.name}"`
      : typeof body.type === "string"
        ? `Changed display type to ${body.type}`
        : body.room !== undefined
          ? `Set display room to "${body.room ?? "(none)"}"`
          : body.pendingCommand !== undefined && body.pendingCommand !== null
            ? `Sent ${(body.pendingCommand as { type?: string })?.type ?? "a"} command to display`
            : null;
  if (detail) {
    await logActivityAs(supabase, auth.eventId, auth.userId, "displayUpdate", detail);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from("display_registry").select("name").eq("id", id).eq("event_id", auth.eventId).maybeSingle();
  const { error } = await supabase.from("display_registry").delete().eq("id", id).eq("event_id", auth.eventId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await logActivityAs(supabase, auth.eventId, auth.userId, "displayRemove", `Removed display "${existing?.name ?? "unknown"}"`);
  return NextResponse.json({ ok: true });
}
