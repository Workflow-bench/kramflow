import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapProfileRow, validateProfileInput } from "@/lib/server/display-profile-validation";

// GET is intentionally public (no requireEventAccess) — this is the read
// path a live custom display page calls with only a share-link token, the
// same access-model split every other display-engine read already makes
// (see app/api/display-view/route.ts's own comment). Access is verified
// via the profile's own event_id matching a resolved token/eventId, not
// skipped — see the `access` check below.
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? undefined;
  const eventId = url.searchParams.get("eventId") ?? undefined;

  const access = await verifyDisplayAccess(token, eventId);
  if (!access.ok) return NextResponse.json({ ok: false, reason: access.reason }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("display_profiles")
    .select("*")
    .eq("id", id)
    .eq("event_id", access.eventId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile: mapProfileRow(data) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "editor");
  if (auth instanceof NextResponse) return auth;

  const validated = validateProfileInput(body);
  if (!validated.ok) return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("display_profiles")
    .update({
      name: validated.input.name,
      template: validated.input.template,
      zones: validated.input.zones,
      viewing_distance: validated.input.viewingDistance,
      accent_color: validated.input.accentColor,
      custom_text: validated.input.customText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("event_id", auth.eventId)
    .select()
    .maybeSingle();
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ ok: true, profile: mapProfileRow(data) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "editor");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  // Any display currently pointed at this profile is left with a
  // profile_id referencing a row that no longer exists — the same
  // "dangling reference over silent cascade" choice display_registry
  // already makes elsewhere (nothing FKs profile_id today). The custom
  // display client below treats a missing profile as "not configured yet"
  // rather than erroring, so this degrades visibly, not silently broken.
  const { error } = await supabase.from("display_profiles").delete().eq("id", id).eq("event_id", auth.eventId);
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
