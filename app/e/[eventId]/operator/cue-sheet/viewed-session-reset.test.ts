import { describe, expect, it } from "vitest";
import { EMPTY_VIEW_STATE, viewStateAfterSessionResolve, viewedSessionChanged } from "./viewed-session-reset";

const dirty = {
  selected: new Set(["cue-1", "cue-2"]),
  anchorId: "cue-1",
  search: "keynote",
  bulkEditOpen: true,
};

describe("viewed session reset", () => {
  it("keeps state on first resolution and on the same session", () => {
    expect(viewedSessionChanged(null, "s1")).toBe(false);
    expect(viewedSessionChanged("s1", "s1")).toBe(false);
    expect(viewStateAfterSessionResolve(null, "s1", dirty)).toBe(dirty);
    expect(viewStateAfterSessionResolve("s1", "s1", dirty)).toBe(dirty);
  });

  it("clears selection, anchor, search and bulk edit when a same-route ?session= change switches sessions", () => {
    const next = viewStateAfterSessionResolve("s1", "s2", dirty);
    expect(next).toEqual(EMPTY_VIEW_STATE);
    expect(next.selected.size).toBe(0);
    expect(next.anchorId).toBeNull();
    expect(next.bulkEditOpen).toBe(false);
  });

  it("clears on the unavailable-session fallback too", () => {
    expect(viewStateAfterSessionResolve("deleted-session", "s-current", dirty)).toEqual(EMPTY_VIEW_STATE);
  });
});
