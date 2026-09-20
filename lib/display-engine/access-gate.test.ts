import { describe, expect, it, vi } from "vitest";
import { isDefinitiveAccessDenial, whileAccessValid } from "./access-gate";

describe("isDefinitiveAccessDenial", () => {
  it("is true for every permanent denial the server reports", () => {
    for (const reason of ["revoked", "expired", "not_found", "no_token"]) {
      expect(isDefinitiveAccessDenial(reason)).toBe(true);
    }
  });

  it("is false for anything transient or absent, so those keep retrying", () => {
    for (const reason of [undefined, null, "", "server_error", 500, {}]) {
      expect(isDefinitiveAccessDenial(reason)).toBe(false);
    }
  });
});

describe("whileAccessValid (registry register and heartbeat)", () => {
  it("sends normally while access is valid, every time", async () => {
    const gate = { accessDenied: false };
    const send = vi.fn(async (id: string, latency: number | null) => ({ id, latency }));
    const heartbeat = whileAccessValid(gate, send);

    await expect(heartbeat("display-1", 20)).resolves.toEqual({ id: "display-1", latency: 20 });
    await heartbeat("display-1", 22);
    await heartbeat("display-1", null);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("stops sending the moment access is definitively denied", async () => {
    const gate = { accessDenied: false };
    const send = vi.fn(async () => "sent");
    const heartbeat = whileAccessValid(gate, send);

    await heartbeat();
    expect(send).toHaveBeenCalledTimes(1);

    gate.accessDenied = true;
    await expect(heartbeat()).resolves.toBeNull();
    await heartbeat();
    await heartbeat();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reads the gate at call time, so an already-created closure is also stopped", async () => {
    const gate = { accessDenied: false };
    const send = vi.fn(async () => "sent");
    const closureHeldByTheHook = whileAccessValid(gate, send);
    gate.accessDenied = true;
    await closureHeldByTheHook();
    expect(send).not.toHaveBeenCalled();
  });
});
