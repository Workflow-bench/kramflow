import { NextResponse } from "next/server";
import { requireEventOwner } from "@/lib/server/require-event-owner";
import { supabaseAdmin } from "@/lib/supabase/server";

// DELETE — revoke a share link. Authorization is "do you own the event
// this link belongs to" — not "any authenticated operator," which is what
// this used to be before events had individual owners. The link's event_id
// isn't known until it's looked up, so this is a two-step check: find the
// link, then confirm the caller owns *that* event, before touching it.
//
// A plain column flip (revoked_at), not an actual row delete: keeping the
// row means the dashboard can still show "revoked, when" in the link
// history instead of the link just vanishing, and resolveShareLink()
// already treats revoked_at as terminal regardless of how long ago it was
// set — see supabase/schema.sql.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const admin = supabaseAdmin();
  const { data: link, error: lookupError } = await admin
    .from("share_links")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ ok: false, error: lookupError.message }, { status: 500 });
  // Same "not found" for a missing link as for one that exists but isn't
  // this operator's — an id-guessing attempt learns nothing either way.
  if (!link) return NextResponse.json({ ok: false, error: "Link not found" }, { status: 404 });

  const auth = await requireEventOwner(link.event_id);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await admin
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Link not found or already revoked." }, { status: 404 });
  return NextResponse.json({ ok: true, link: data });
}
