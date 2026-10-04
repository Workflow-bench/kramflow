import { describe, expect, it, vi } from "vitest";
import { buildReport, reportError, redact } from "./report";

const EVENT = "11111111-2222-3333-4444-555555555555";
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";

describe("redaction", () => {
  it("strips emails, UUIDs, bearer tokens, long opaque tokens and key=value secrets", () => {
    const text = `owner ops@example.com for ${EVENT} auth Bearer ${TOKEN} password=hunter2 cookie=sb-abc-auth-token=xyz`;
    const out = redact(text);
    expect(out).not.toContain("ops@example.com");
    expect(out).not.toContain(EVENT);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain("hunter2");
    expect(out).toContain("[email]");
    expect(out).toContain("[id]");
  });

  it("does not strip ordinary words or short identifiers", () => {
    expect(redact("Hold activate failed for presenter")).toBe("Hold activate failed for presenter");
  });
});

describe("buildReport", () => {
  it("keeps the error name and message, with sensitive content removed", () => {
    const r = buildReport(new Error(`cue for ${EVENT} sent to ops@example.com`), { route: "/api/live", action: "next" });
    expect(r.name).toBe("Error");
    expect(r.message).not.toContain(EVENT);
    expect(r.message).not.toContain("ops@example.com");
    expect(r.route).toBe("/api/live");
    expect(r.action).toBe("next");
  });

  it("bounds the message, the stack and the context", () => {
    const long = "x".repeat(10_000);
    const err = new Error(long);
    err.stack = "Error: " + long;
    const r = buildReport(err, { route: "r".repeat(1000) });
    expect(r.message.length).toBeLessThanOrEqual(501);
    expect(r.stack!.length).toBeLessThanOrEqual(2001);
    expect(r.route!.length).toBeLessThanOrEqual(121);
  });

  it("wraps non-Error throwables without leaking their contents as a stack", () => {
    const r = buildReport("token=supersecretvalue1234567890");
    expect(r.stack).toBeUndefined();
    expect(r.message).toContain("token=[redacted]");
  });

  it("records release and environment, defaulting to unknown", () => {
    const r = buildReport(new Error("x"), { release: "abc123", environment: "production" });
    expect(r.release).toBe("abc123");
    expect(r.environment).toBe("production");
  });
});

describe("reportError with an injected sink", () => {
  it("delivers exactly one redacted report to the sink", () => {
    const sink = vi.fn();
    reportError(new Error(`for ${EVENT}`), { route: "/e/x" }, sink);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sink.mock.calls[0][0])).not.toContain(EVENT);
  });

  it("never throws into the failing request, even if the sink throws", () => {
    const sink = () => {
      throw new Error("sink down");
    };
    expect(() => reportError(new Error("boom"), {}, sink)).not.toThrow();
  });
});
