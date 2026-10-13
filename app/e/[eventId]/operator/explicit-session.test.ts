import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KF-006: the Console never starts a show by guessing a session. Its active session
// comes only from the live state row; with none set, the page shows the explicit
// "Select a session" state. Source-level check (the page needs an authenticated
// event). Comments are stripped so only code is checked.
const raw = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("operator console session selection is explicit (KF-006)", () => {
  it("derives the active session only from the live state's activeSessionId", () => {
    expect(code).toContain("getSessionById(sessions, state.activeSessionId)");
  });

  it("never falls back to the first session", () => {
    expect(code).not.toMatch(/sessions\[0\]/);
    expect(code).not.toMatch(/activeSessionId\s*\?\?\s*sessions/);
  });

  it("shows the explicit choice state when sessions exist but none is active", () => {
    expect(code).toContain('"Select a session to get started."');
  });
});
