import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Could not sign out. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
