import { describe, expect, it } from "vitest";
import { arrivalEligible, readArrivalFlag, writeArrivalFlag, ARRIVAL_STORAGE_KEY } from "./arrival-eligibility";

const fresh = { stored: null, navigationType: "navigate", scrollY: 0, hash: "", reducedMotion: false };

describe("arrivalEligible", () => {
  it("plays for a fresh top-of-page navigation", () => {
    expect(arrivalEligible(fresh)).toBe(true);
  });

  it("never plays under reduced motion", () => {
    expect(arrivalEligible({ ...fresh, reducedMotion: true })).toBe(false);
  });

  it("plays once per session: a stored flag suppresses it", () => {
    expect(arrivalEligible({ ...fresh, stored: "1" })).toBe(false);
  });

  it("skips back/forward restoration and reloads", () => {
    expect(arrivalEligible({ ...fresh, navigationType: "back_forward" })).toBe(false);
    expect(arrivalEligible({ ...fresh, navigationType: "reload" })).toBe(false);
  });

  it("skips deep links", () => {
    expect(arrivalEligible({ ...fresh, hash: "#product" })).toBe(false);
  });

  it("skips restored or non-top scroll positions", () => {
    expect(arrivalEligible({ ...fresh, scrollY: 900 })).toBe(false);
    expect(arrivalEligible({ ...fresh, scrollY: 2 })).toBe(true);
  });
});

describe("arrival storage", () => {
  it("reads and writes the versioned key", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readArrivalFlag(storage)).toBeNull();
    writeArrivalFlag(storage);
    expect(store.get(ARRIVAL_STORAGE_KEY)).toBe("1");
    expect(readArrivalFlag(storage)).toBe("1");
  });

  it("treats denied storage as absent and never throws", () => {
    const denied = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readArrivalFlag(denied)).toBeNull();
    expect(() => writeArrivalFlag(denied)).not.toThrow();
    expect(readArrivalFlag(null)).toBeNull();
    expect(() => writeArrivalFlag(undefined)).not.toThrow();
  });
});
