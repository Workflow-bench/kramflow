import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireBroadcastDisplayAccess } from "@/lib/server/require-broadcast-display-access";

// POST promotes a scheduled broadcast to sent, once its scheduledFor time
// has passed. No requireAuth() — this is called by the client-side
// scheduler poll (lib/display-engine/store.tsx's ensureSchedulerRunning),
// which runs in whichever tab happens to have the store loaded, including
// public display pages, not just an authenticated operator tab. Same
// "no server-side cron" known limitation as before — see
// docs/DISPLAY_ENGINE.md.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access = await requireBroadcastDisplayAccess(
    id,
    typeof body.token === "string" ? body.token : undefined,
    typeof body.eventId === "string" ? body.eventId : undefined
  );
  if (access instanceof NextResponse) return access;

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("display_broadcasts")
    .update({ status: "sent" })
    .eq("id", id)
    .eq("event_id", access.eventId)
    .eq("status", "scheduled");
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
