import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Atomically swaps two programs' sort_order — see
// supabase/schema.sql's swap_program_order for why this needs to be a
// single transaction rather than two sequential PATCHes.
export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { idA, idB } = (body ?? {}) as Record<string, unknown>;
  if (typeof idA !== "string" || typeof idB !== "string") {
    return NextResponse.json({ ok: false, error: "idA and idB are required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.rpc("swap_program_order", { p_id_a: idA, p_id_b: idB });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
