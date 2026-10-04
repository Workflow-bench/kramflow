import { describe, expect, it } from "vitest";
import { isSafeRedirect, safeNext } from "./safe-redirect";

describe("isSafeRedirect", () => {
  it("accepts same-origin paths", () => {
    for (const p of ["/", "/dashboard", "/e/abc/operator?tab=1", "/invite/xyz#top"]) expect(isSafeRedirect(p)).toBe(true);
  });

  it("rejects anything that can leave the site", () => {
    for (const p of ["//evil.com", "//evil.com/path", "/\\evil.com", "https://evil.com", "http://evil.com", "javascript:alert(1)", "evil.com", ""]) {
      expect(isSafeRedirect(p)).toBe(false);
    }
  });

  // Browsers drop tab and newline before parsing, so these look relative but
  // resolve off-site. Each one was accepted before this check existed.
  it("rejects control characters that browsers strip into a protocol-relative URL", () => {
    for (const p of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\t/evil.com", "/\u0000/evil.com", "/\\/evil.com", "/dash\tboard"]) {
      expect(isSafeRedirect(p)).toBe(false);
    }
  });
});

describe("safeNext", () => {
  it("returns a safe target unchanged and falls back otherwise", () => {
    expect(safeNext("/e/1/remote")).toBe("/e/1/remote");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext("https://evil.com", "/login")).toBe("/login");
  });
});
