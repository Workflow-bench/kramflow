import type { supabaseAdmin } from "@/lib/supabase/server";

// Hold and timer live in display_type_state, one row per (event, display type).
// Only events that existed when migration 20260909091740 ran were backfilled,
// and new events were never given rows, so a hold or timer write found no row
// (KF-031). Provisioning is idempotent: existing rows are left as they are.
export const DISPLAY_TYPES = ["presenter", "green-room", "av", "general"] as const;

type Admin = ReturnType<typeof supabaseAdmin>;

// Creates any missing display_type_state rows for an event, seeded from that
// event's display_state row, as the migration backfill does. Returns an error
// string instead of throwing so callers can refuse the write loudly.
export async function provisionDisplayTypeRows(
  admin: Admin,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: shared, error: sharedError } = await admin
    .from("display_state")
    .select("hold, timer, timer_version")
    .eq("event_id", eventId)
    .maybeSingle();
  if (sharedError) return { ok: false, error: sharedError.message };
  if (!shared) return { ok: false, error: "display_state row missing for event" };

  const rows = DISPLAY_TYPES.map((displayType) => ({
    event_id: eventId,
    display_type: displayType,
    hold: shared.hold,
    timer: shared.timer,
    timer_version: shared.timer_version,
  }));
  const { error } = await admin
    .from("display_type_state")
    .upsert(rows, { onConflict: "event_id,display_type", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
