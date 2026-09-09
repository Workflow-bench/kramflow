import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST dismiss. No requireAuth() — components/display-engine/broadcast-overlay.tsx
// (rendered on every public, unauthenticated display) calls this directly
// via its own "Dismiss" button. Removes the message from "active"
// everywhere (not just locally) — matches the original store's
// dismissBroadcast; it stays in history (dismissed_at is informational,
// not a delete).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("display_broadcasts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
