import { describe, expect, it } from "vitest";
import { inviteDestination, recoverySetPath, validatedNext, withNext } from "./continuation";

const TOKEN = "abcDEF123_-abcDEF123_-abcDEF123_-abcDEF123_-abc"; // 43 chars, base64url shape

describe("inviteDestination", () => {
  it("encodes a well-formed token as one path segment", () => {
    expect(inviteDestination(TOKEN)).toBe(`/invite/${TOKEN}`);
  });
  it("refuses malformed tokens instead of building a path", () => {
    for (const bad of ["x?y=1", "a#frag", "a/b/c", "..", "../admin", "a\\b", "a%2Fb", "tab\there", "", null, undefined, "short"]) {
      expect(inviteDestination(bad as string | null | undefined)).toBeNull();
    }
  });
});

describe("validatedNext", () => {
  it("keeps same-origin paths and drops unsafe or absent values", () => {
    expect(validatedNext("/invite/abc")).toBe("/invite/abc");
    expect(validatedNext("//evil.example")).toBeNull();
    expect(validatedNext("https://evil.example")).toBeNull();
    expect(validatedNext(null)).toBeNull();
  });
});

describe("withNext and recoverySetPath", () => {
  it("round-trips a validated next through the query string", () => {
    const href = withNext("/login", "/invite/abc?x=1");
    const param = new URL(href, "https://k.test").searchParams.get("next");
    expect(param).toBe("/invite/abc?x=1");
  });
  it("carries next through the recovery callback target", () => {
    expect(recoverySetPath("/e/1/remote")).toBe("/set-password?next=%2Fe%2F1%2Fremote");
    expect(recoverySetPath("//evil.example")).toBe("/set-password");
    expect(recoverySetPath(undefined)).toBe("/set-password");
  });
});
