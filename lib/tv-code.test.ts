import { describe, expect, it } from "vitest";
import { formatTvCode, normalizeTvCode } from "./tv-code";

describe("normalizeTvCode", () => {
  it("accepts six digits, plain or grouped", () => {
    expect(normalizeTvCode("482731")).toBe("482731");
    expect(normalizeTvCode("482 731")).toBe("482731");
    expect(normalizeTvCode("  482731  ")).toBe("482731");
    expect(normalizeTvCode("012 345")).toBe("012345");
  });

  it("rejects the wrong number of digits", () => {
    for (const bad of ["", "1", "48273", "4827311", "0000000"]) expect(normalizeTvCode(bad)).toBeNull();
  });

  it("rejects letters, symbols, and non-strings", () => {
    for (const bad of ["48273a", "abcdef", "482-731", "482.731", "48273!", "١٢٣٤٥٦"]) {
      expect(normalizeTvCode(bad)).toBeNull();
    }
    for (const bad of [null, undefined, 482731, {}, [], true]) expect(normalizeTvCode(bad)).toBeNull();
  });

  it("rejects an oversized string without scanning it", () => {
    expect(normalizeTvCode("1".repeat(10_000))).toBeNull();
  });
});

describe("formatTvCode", () => {
  it("groups six digits as 3 + 3", () => {
    expect(formatTvCode("482731")).toBe("482 731");
    expect(formatTvCode("012345")).toBe("012 345");
  });

  it("leaves anything that is not six digits alone", () => {
    expect(formatTvCode("482")).toBe("482");
  });
});
