import { describe, expect, it } from "vitest";
import { DISPLAY_TYPES, provisionDisplayTypeRows } from "./display-type-state";

// Fake admin client: records the upsert and answers the display_state read.
function fakeAdmin(shared: Record<string, unknown> | null, sharedError: { message: string } | null = null) {
  const upserts: { rows: Record<string, unknown>[]; options: unknown }[] = [];
  const admin = {
    from(table: string) {
      if (table === "display_state") {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: shared, error: sharedError }),
        };
        return q;
      }
      return {
        upsert: async (rows: Record<string, unknown>[], options: unknown) => {
          upserts.push({ rows, options });
          return { error: null };
        },
      };
    },
  };
  return { admin: admin as unknown as Parameters<typeof provisionDisplayTypeRows>[0], upserts };
}

const shared = { hold: { active: false }, timer: { mode: "program" }, timer_version: 3 };

describe("provisionDisplayTypeRows (KF-031)", () => {
  it("creates one row per display type, seeded from the event's display_state", async () => {
    const { admin, upserts } = fakeAdmin(shared);
    const result = await provisionDisplayTypeRows(admin, "event-a");
    expect(result).toEqual({ ok: true });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].rows.map((r) => r.display_type)).toEqual([...DISPLAY_TYPES]);
    expect(upserts[0].rows.every((r) => r.event_id === "event-a" && r.timer_version === 3)).toBe(true);
  });

  it("uses ignoreDuplicates so existing rows are never overwritten", async () => {
    const { admin, upserts } = fakeAdmin(shared);
    await provisionDisplayTypeRows(admin, "event-a");
    expect(upserts[0].options).toEqual({ onConflict: "event_id,display_type", ignoreDuplicates: true });
  });

  it("refuses when the event has no display_state row", async () => {
    const { admin, upserts } = fakeAdmin(null);
    const result = await provisionDisplayTypeRows(admin, "event-a");
    expect(result.ok).toBe(false);
    expect(upserts).toHaveLength(0);
  });

  it("reports a read error instead of throwing", async () => {
    const { admin } = fakeAdmin(null, { message: "boom" });
    expect(await provisionDisplayTypeRows(admin, "event-a")).toEqual({ ok: false, error: "boom" });
  });
});
