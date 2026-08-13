import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { eventFormConfigSchema } from "@/lib/validation/form-config";

// GET returns the saved config for an event, or ok:true with config:null
// when none exists — ProgramForm falls back to lib/form-config.ts's
// DEFAULT_CONFIG in that case, so every event stays on today's exact
// field set until someone opts it into a custom one.
export async function GET(_request: Request, { params }: { params: Promise<{ eventName: string }> }) {
  const { eventName } = await params;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("event_form_configs")
    .select("*")
    .eq("event_name", decodeURIComponent(eventName))
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config: data?.config ?? null });
}

// Upserts an event's form config. Validated against the shape in
// lib/validation/form-config.ts, plus a guard the plain jsonb column can't
// enforce itself: event_name must match a real sessions.event_name, so a
// typo can't silently create a config no session will ever match.
export async function PUT(request: Request, { params }: { params: Promise<{ eventName: string }> }) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { eventName } = await params;
  const decodedEventName = decodeURIComponent(eventName);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = eventFormConfigSchema.safeParse({ eventName: decodedEventName, ...(json as object) });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: eventNames, error: eventNamesError } = await supabase.from("sessions").select("event_name");
  if (eventNamesError) return NextResponse.json({ ok: false, error: eventNamesError.message }, { status: 500 });
  const knownEventNames = new Set((eventNames ?? []).map((r) => r.event_name));
  if (!knownEventNames.has(decodedEventName)) {
    return NextResponse.json(
      { ok: false, error: `"${decodedEventName}" doesn't match any session's event name` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("event_form_configs")
    .upsert({ event_name: decodedEventName, config: { fields: parsed.data.fields } });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
