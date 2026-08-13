import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("auditoriums").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, auditoriums: data });
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { name } = body;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("auditoriums").insert({ name: name.trim() }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, auditorium: data });
}
