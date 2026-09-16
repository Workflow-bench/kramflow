import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";

export async function requireBroadcastDisplayAccess(
  broadcastId: string,
  token: string | undefined,
  requestedEventId: string | undefined
): Promise<NextResponse | { eventId: string }> {
  const admin = supabaseAdmin();
  const { data: broadcast, error } = await admin
    .from("display_broadcasts")
    .select("event_id")
    .eq("id", broadcastId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!broadcast) {
    return NextResponse.json({ ok: false, error: "Broadcast not found" }, { status: 404 });
  }

  const access = await verifyDisplayAccess(token, requestedEventId);
  if (!access.ok || access.eventId !== broadcast.event_id) {
    return NextResponse.json({ ok: false, error: "Broadcast not found" }, { status: 404 });
  }

  return { eventId: broadcast.event_id as string };
}
