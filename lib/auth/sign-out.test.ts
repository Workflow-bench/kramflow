import { describe, it, expect } from "vitest";
import { requestSignOut } from "./sign-out";

function fakeFetch(status: number, body: unknown, { throws = false } = {}): typeof fetch {
  return (async () => {
    if (throws) throw new Error("network");
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("requestSignOut", () => {
  it("true only when the server confirms", async () => {
    expect(await requestSignOut(fakeFetch(200, { ok: true }))).toBe(true);
  });
  it("false on a server error, even with a parseable body", async () => {
    expect(await requestSignOut(fakeFetch(500, { ok: false, error: "x" }))).toBe(false);
  });
  it("false when the body does not confirm ok", async () => {
    expect(await requestSignOut(fakeFetch(200, { ok: false }))).toBe(false);
    expect(await requestSignOut(fakeFetch(200, undefined))).toBe(false);
  });
  it("false when the request itself fails", async () => {
    expect(await requestSignOut(fakeFetch(0, undefined, { throws: true }))).toBe(false);
  });
});
