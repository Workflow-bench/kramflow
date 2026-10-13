import { describe, expect, it } from "vitest";
import { PostgrestClient } from "@supabase/postgrest-js";

// Syntax check against the REAL PostgREST client used by supabase-js (node_modules),
// not the route's unit fake. A custom fetch captures the exact HTTP request. Server
// semantics (PostgREST translating col->>key=eq.value to SQL) are checked separately
// on local Postgres (docs/audit-remediation/migrations/tests/hold/).

interface Captured { method: string; url: string; body: unknown; prefer: string | null }

function client(captured: Captured[]) {
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      prefer: new Headers(init?.headers).get("prefer"),
    });
    return new Response(JSON.stringify([{ hold: { active: false } }]), { status: 200, headers: { "content-type": "application/json" } });
  };
  return new PostgrestClient("https://example.test/rest/v1", { fetch: fetchImpl as typeof fetch });
}

describe("hold conditional update: real PostgREST client syntax", () => {
  it("eq on a JSON field path is emitted as hold->>rev=eq.<value>", async () => {
    const captured: Captured[] = [];
    await client(captured)
      .from("display_type_state")
      .update({ hold: { active: false, rev: null } })
      .eq("event_id", "event-a")
      .eq("display_type", "presenter")
      .eq("hold->>rev", "rev-9")
      .select("hold");
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("PATCH");
    const url = decodeURIComponent(captured[0].url);
    expect(url).toContain("hold->>rev=eq.rev-9");
    expect(url).toContain("event_id=eq.event-a");
    expect(url).toContain("display_type=eq.presenter");
    expect(captured[0].body).toEqual({ hold: { active: false, rev: null } });
  });

  it("is(…, null) on a JSON field path is emitted as hold->>activatedAt=is.null", async () => {
    const captured: Captured[] = [];
    await client(captured)
      .from("display_type_state")
      .update({ hold: { active: false } })
      .eq("event_id", "event-a")
      .eq("display_type", "presenter")
      .is("hold->>activatedAt", null)
      .select("hold");
    const url = decodeURIComponent(captured[0].url);
    expect(url).toContain("hold->>activatedAt=is.null");
  });

  it("select after update asks for the representation, so the route can count matched rows", async () => {
    const captured: Captured[] = [];
    await client(captured)
      .from("display_type_state")
      .update({ hold: {} })
      .eq("event_id", "event-a")
      .select("hold");
    expect(captured[0].url).toContain("select=hold");
  });
});
