import { describe, it, expect } from "vitest";
import { isValidEmail, MAX_EMAIL_LENGTH } from "./email";

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("operator@kramflow.test")).toBe(true);
  });

  it("accepts a subdomain and multi-label TLD", () => {
    expect(isValidEmail("a.b@mail.example.co.uk")).toBe(true);
  });

  it("accepts uppercase (callers normalize case themselves)", () => {
    expect(isValidEmail("OPERATOR@KRAMFLOW.TEST")).toBe(true);
  });

  it("rejects whitespace inside the value (callers trim before calling)", () => {
    expect(isValidEmail(" operator@kramflow.test")).toBe(false);
    expect(isValidEmail("operator@kramflow.test ")).toBe(false);
    expect(isValidEmail("oper ator@kramflow.test")).toBe(false);
  });

  it("rejects a missing @", () => {
    expect(isValidEmail("operatorkramflow.test")).toBe(false);
  });

  it("rejects a missing domain / TLD", () => {
    expect(isValidEmail("operator@kramflow")).toBe(false);
  });

  it("rejects multiple @ characters", () => {
    expect(isValidEmail("operator@kram@flow.test")).toBe(false);
  });

  it("rejects an empty local or domain part", () => {
    expect(isValidEmail("@kramflow.test")).toBe(false);
    expect(isValidEmail("operator@")).toBe(false);
    expect(isValidEmail("operator@.test")).toBe(false);
    expect(isValidEmail("operator@kramflow.")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects non-string-shaped garbage that happens to be long", () => {
    expect(isValidEmail("a".repeat(10_000))).toBe(false);
  });

  it("enforces the RFC 5321 length cap", () => {
    const local = "a".repeat(64);
    const domain = "b".repeat(185) + ".com"; // local(64) + '@'(1) + domain(189) = 254
    const exactly254 = `${local}@${domain}`;
    expect(exactly254.length).toBe(MAX_EMAIL_LENGTH);
    expect(isValidEmail(exactly254)).toBe(true);
    expect(isValidEmail(exactly254 + "x")).toBe(false);
  });

  it("accepts unicode in the local part (no character-set false rejection)", () => {
    expect(isValidEmail("café@kramflow.test")).toBe(true);
  });

  // The exact adversarial shape CodeQL called out for the old regex,
  // /^[^\s@]+@[^\s@]+\.[^\s@]+$/ — a run-on of '.'-heavy, non-matching
  // domain content designed to maximize backtracking in an engine that
  // lets an unbounded group re-try every split point against another
  // unbounded group over the same characters. Run at 50k characters
  // (the old regex would already be well past any reasonable timeout at
  // a fraction of this size) and asserted to finish fast, so a future
  // regression here fails a test instead of shipping a slow endpoint.
  it("rejects a long pathological non-matching string in linear time", () => {
    const attack = "a@" + "!.".repeat(50_000);
    const start = performance.now();
    const result = isValidEmail(attack);
    const elapsedMs = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });

  // Same adversarial shape as above, but sized to land *under*
  // MAX_EMAIL_LENGTH so the length gate can't short-circuit it — this
  // specifically proves the split-then-check algorithm itself (indexOf/
  // lastIndexOf/split plus small anchored regexes, no two quantifiers ever
  // sharing the same characters) is linear on its own, independent of the
  // length cap being the thing doing the real work.
  it("rejects a pathological string under the length cap in linear time", () => {
    const filler = "!.".repeat(120); // 240 chars
    const attack = `a@${filler}`; // 242 chars, under MAX_EMAIL_LENGTH
    expect(attack.length).toBeLessThan(MAX_EMAIL_LENGTH);
    const start = performance.now();
    const result = isValidEmail(attack);
    const elapsedMs = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });

  it("rejects a long string of repeated non-domain characters after the @", () => {
    const attack = "a@" + "b".repeat(100_000);
    const start = performance.now();
    const result = isValidEmail(attack);
    const elapsedMs = performance.now() - start;
    expect(result).toBe(false);
    expect(elapsedMs).toBeLessThan(50);
  });
});
