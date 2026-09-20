import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const single = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/server/require-event-access", () => ({ requireEventAccess }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insert(row);
        return { select: () => ({ single }) };
      },
    }),
  }),
}));

const { POST } = await import("./route");

const post = () =>
  POST(new Request("http://x/api/share-links", { method: "POST", body: JSON.stringify({ eventId: "e1" }) }));

beforeEach(() => {
  requireEventAccess.mockReset().mockResolvedValue({ eventId: "e1", userId: "u1" });
  single.mockReset();
  insert.mockReset();
});

describe("POST /api/share-links TV code creation", () => {
  it("inserts a six-digit tv_code alongside the token", async () => {
    single.mockResolvedValue({ data: { id: "s1" }, error: null });
    const res = await post();
    expect(res.status).toBe(200);
    const row = insert.mock.calls[0][0];
    expect(row.tv_code).toMatch(/^[0-9]{6}$/);
    expect(row.token.length).toBeGreaterThanOrEqual(40);
  });

  it("retries with a fresh code and token when the unique index reports a collision", async () => {
    single
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: { id: "s1" }, error: null });
    const res = await post();
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(3);
    const tokens = insert.mock.calls.map((c) => c[0].token);
    expect(new Set(tokens).size).toBe(3);
  });

  it("gives up with a generic 500 after repeated collisions", async () => {
    single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    const res = await post();
    expect(res.status).toBe(500);
    expect(insert).toHaveBeenCalledTimes(8);
    expect(JSON.stringify(await res.json())).not.toMatch(/[0-9]{6}/);
  });

  it("does not retry on a non-collision error and logs neither the code nor the token", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    single.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const res = await post();
    expect(res.status).toBe(500);
    expect(insert).toHaveBeenCalledTimes(1);
    const { tv_code, token } = insert.mock.calls[0][0];
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(tv_code);
    expect(logged).not.toContain(token);
    spy.mockRestore();
  });
});
