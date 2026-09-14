import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapProfileRow, validateProfileInput } from "@/lib/server/display-profile-validation";

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "viewer");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("display_profiles")
    .select("*")
    .eq("event_id", auth.eventId)
    .order("name", { ascending: true });
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profiles: (data ?? []).map(mapProfileRow) });
}

export async function POST(request: Request) {
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
    .insert({
      event_id: auth.eventId,
      name: validated.input.name,
      template: validated.input.template,
      zones: validated.input.zones,
      viewing_distance: validated.input.viewingDistance,
      accent_color: validated.input.accentColor,
      custom_text: validated.input.customText,
    })
    .select()
    .single();
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: mapProfileRow(data) });
}
