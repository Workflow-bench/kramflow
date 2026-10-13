import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Local capture: the report endpoint's sink is the server log, so the capture is
// console.error. Nothing leaves the process.
const EVENT = "11111111-2222-3333-4444-555555555555";
let captured: string[];
let spy: ReturnType<typeof vi.spyOn>;

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://x/api/observability/report", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  captured = [];
  spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  });
});
afterEach(() => spy.mockRestore());

describe("client exception report endpoint (KF-010 local capture)", () => {
  it("accepts a valid report with 204 and records it redacted", async () => {
    const res = await post({ name: "TypeError", message: `failed for ${EVENT} owner ops@example.com`, route: `/e/${EVENT}/operator`, action: "render" });
    expect(res.status).toBe(204);
    expect(captured).toHaveLength(1);
    expect(captured[0]).not.toContain(EVENT);
    expect(captured[0]).not.toContain("ops@example.com");
    expect(captured[0]).toContain('"source":"client"');
  });

  it("refuses a declared oversize body with 413 and records nothing", async () => {
    const res = await post({ message: "x" }, { "content-length": "99999" });
    expect(res.status).toBe(413);
    expect(captured).toHaveLength(0);
  });

  it("refuses an oversize actual body with 413 even when the length header lies", async () => {
    const res = await post(JSON.stringify({ message: "x".repeat(9000) }));
    expect(res.status).toBe(413);
    expect(captured).toHaveLength(0);
  });

  it("refuses malformed JSON with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect(captured).toHaveLength(0);
  });

  it("caps the message and stack it records", async () => {
    // Fits under the body cap, so the per-field cap is what is exercised.
    const res = await post({ message: "m".repeat(3000), stack: "s".repeat(3000) });
    expect(res.status).toBe(204);
    const record = JSON.parse(captured[0].replace(/^\[report\]\s*/, ""));
    expect(record.message.length).toBeLessThanOrEqual(2000);
    expect(record.stack.length).toBeLessThanOrEqual(2000);
  });
});
