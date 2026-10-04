import { describe, expect, it } from "vitest";
import { createSliceSequencer, refetchOnSubscribe } from "./first-connect";

// Deterministic reproduction of the hydrate-to-first-SUBSCRIBED gap. The "store" is
// the banner state a display derives from broadcast rows; the server is the table.
// This is a policy-level reproduction: the store wiring is checked by review of
// lib/display-engine/store.tsx, not by a browser run.

type Row = { id: string; status: "sent" | "scheduled" };
const activeBanners = (rows: Row[]) => rows.filter((r) => r.status === "sent").map((r) => r.id);

// Replays the first-connect timeline. `refetch` is the policy under test.
function firstConnect(refetch: (status: "SUBSCRIBED") => boolean) {
  const table: Row[] = [{ id: "b1", status: "scheduled" }];
  const seq = createSliceSequencer();
  let shown: string[] = [];

  // 1. Hydrate starts and reads the table (snapshot taken now).
  const hydrateSeq = seq.begin();
  const hydrateSnapshot = table.map((r) => ({ ...r }));

  // 2. A broadcast is sent before the channel is SUBSCRIBED.
  table[0] = { id: "b1", status: "sent" };

  // 3. The channel reaches SUBSCRIBED for the first time.
  let refetchSeq: number | null = null;
  if (refetch("SUBSCRIBED")) refetchSeq = seq.begin();

  // 4. Responses arrive; the refetch (newer) answers before the older hydrate.
  if (refetchSeq !== null) seq.accept(refetchSeq, () => (shown = activeBanners(table)));
  seq.accept(hydrateSeq, () => (shown = activeBanners(hydrateSnapshot)));
  return shown;
}

describe("first-connect race (KF-036.9)", () => {
  it("reproduces the gap under the old policy: the active banner is missing on first connect", () => {
    const oldPolicy = (_status: "SUBSCRIBED") => false; // refetch only after a prior connection
    // The defect, asserted: the sent broadcast is not shown without another mutation.
    expect(firstConnect(oldPolicy)).toEqual([]);
  });

  it("with the corrected policy the banner is visible without a second mutation", () => {
    expect(firstConnect(refetchOnSubscribe)).toEqual(["b1"]);
  });
});

describe("refetch policy", () => {
  it("refetches on every SUBSCRIBED, first connection included", () => {
    expect(refetchOnSubscribe("SUBSCRIBED")).toBe(true);
  });

  it("does not refetch on channel errors or close (no false success)", () => {
    expect(refetchOnSubscribe("CHANNEL_ERROR")).toBe(false);
    expect(refetchOnSubscribe("TIMED_OUT")).toBe(false);
    expect(refetchOnSubscribe("CLOSED")).toBe(false);
  });
});

describe("stale response ordering", () => {
  it("an older response that arrives after a newer one does not overwrite it", () => {
    const seq = createSliceSequencer();
    const older = seq.begin();
    const newer = seq.begin();
    let state = "";
    seq.accept(newer, () => (state = "new"));
    const applied = seq.accept(older, () => (state = "old"));
    expect(applied).toBe(false);
    expect(state).toBe("new");
  });

  it("responses in issue order are all applied", () => {
    const seq = createSliceSequencer();
    const a = seq.begin();
    const b = seq.begin();
    let state = "";
    expect(seq.accept(a, () => (state = "a"))).toBe(true);
    expect(seq.accept(b, () => (state = "b"))).toBe(true);
    expect(state).toBe("b");
  });
});
