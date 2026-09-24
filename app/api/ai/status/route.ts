import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/server/ai";

// Lets the UI hide AI buttons on deployments with no ANTHROPIC_API_KEY.
// Reveals only whether the feature is on, never anything about the key.
export async function GET() {
  return NextResponse.json({ enabled: isAiConfigured() });
}
