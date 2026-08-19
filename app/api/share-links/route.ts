import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/server/require-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/server/share-links";

const ALLOWED_EXPIRY_DAYS = [1, 3, 7, 30] as const;
const DEFAULT_EXPIRY_DAYS = 7;

// GET — list share links for one event (?eventId=...). Ownership of that
// event is required to see its links at all — a link belongs to the event
// it grants access to, not to "any operator" globally, now that different
// operators' events are isolated from each other.
export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId");
  const auth = await requireEventAccess(eventId, "owner");
  if (auth instanceof NextResponse) return auth;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("event_id", auth.eventId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, links: data });
}

// POST — generate a new share link for one event. Body: { eventId, expiresInDays?, label? }.
export async function POST(request: Request) {
  let body: { eventId?: unknown; expiresInDays?: unknown; label?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const auth = await requireEventAccess(typeof body.eventId === "string" ? body.eventId : null, "owner");
  if (auth instanceof NextResponse) return auth;

  const expiresInDays = ALLOWED_EXPIRY_DAYS.includes(body.expiresInDays as (typeof ALLOWED_EXPIRY_DAYS)[number])
    ? (body.expiresInDays as (typeof ALLOWED_EXPIRY_DAYS)[number])
    : DEFAULT_EXPIRY_DAYS;
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : null;

  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("share_links")
    .insert({ token, label, event_id: auth.eventId, created_by: auth.userId, expires_at: expiresAt })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, link: data });
}
