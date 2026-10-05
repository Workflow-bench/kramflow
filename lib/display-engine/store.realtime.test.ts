import { beforeEach, describe, expect, it } from "vitest";
import { __testing } from "./store";
import type { DisplayEngineIdentity } from "./context";
import { emit, fakeClient, freshServer, sentBroadcast, setStatus, flush } from "./fake-transport";

// KF-036.9 through the REAL store module. The transport is the controlled fake in
// fake-transport.ts. The test controls when Realtime delivers each event.
//
// Race under test: the store reads a hydrate snapshot, a broadcast changes before
// the channel is SUBSCRIBED, and Realtime does not replay that change. The first
// SUBSCRIBED must refetch so the active broadcast appears without another mutation.
//
// Evidence class: SOURCE/TEST with a fake Supabase client. Not remote proof.

function activeIds(identity: DisplayEngineIdentity): string[] {
  const inst = __testing.getInstance(identity);
  return inst.cachedState.broadcasts.active.map((m) => m.id);
}

beforeEach(() => {
  // The store only opens remote channels when it sees a window. A minimal stub
  // is enough: the realtime path does not read anything else from it.
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: "http://localhost/" },
  };
  __testing.reset();
});

describe("first-connect race through the real store (KF-036.9)", () => {
  it("a broadcast sent between hydrate and the first SUBSCRIBED is visible without another mutation", async () => {
    const eventId = "11111111-0000-0000-0000-000000000001";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);

    // 1. Subscribe: starts the channel and the hydrate read.
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    expect(activeIds(identity)).toEqual([]); // hydrate saw no broadcast

    // 2. A broadcast is sent after the snapshot, before SUBSCRIBED. Realtime does
    //    not replay it, so no event reaches the channel.
    server.tables.display_broadcasts.push(sentBroadcast("b-1", eventId));

    // 3. The first SUBSCRIBED.
    setStatus(server, "SUBSCRIBED");
    await flush();

    expect(activeIds(identity)).toEqual(["b-1"]);
  });

  it("a later SUBSCRIBED after a reconnect also refetches and shows the change", async () => {
    const eventId = "11111111-0000-0000-0000-000000000002";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    setStatus(server, "SUBSCRIBED");
    await flush();
    // Connection drops; a change lands; the socket reconnects.
    server.tables.display_broadcasts.push(sentBroadcast("b-2", eventId));
    setStatus(server, "CHANNEL_ERROR");
    setStatus(server, "SUBSCRIBED");
    await flush();
    expect(activeIds(identity)).toEqual(["b-2"]);
  });

  it("a channel error does not refetch: the snapshot stays until a real SUBSCRIBED", async () => {
    const eventId = "11111111-0000-0000-0000-000000000003";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    server.tables.display_broadcasts.push(sentBroadcast("b-3", eventId));
    setStatus(server, "CHANNEL_ERROR");
    await flush();
    expect(activeIds(identity)).toEqual([]);
  });

  it("identity change: a second event gets its own instance and channel, and sees only its own broadcasts", async () => {
    const a = "11111111-0000-0000-0000-00000000000a";
    const b = "11111111-0000-0000-0000-00000000000b";
    const serverA = freshServer(a);
    const serverB = freshServer(b);
    serverB.tables.display_broadcasts.push(sentBroadcast("b-other", b));
    __testing.setRemoteClient(() => fakeClient(serverA) as never);
    const idA: DisplayEngineIdentity = { eventId: a, displayType: "presenter" };
    __testing.subscribe(__testing.getInstance(idA), () => {});
    await flush();
    setStatus(serverA, "SUBSCRIBED");
    await flush();
    expect(activeIds(idA)).toEqual([]);
    // Event B's broadcast is not visible under event A's identity.
    __testing.setRemoteClient(() => fakeClient(serverB) as never);
    const idB: DisplayEngineIdentity = { eventId: b, displayType: "presenter" };
    __testing.subscribe(__testing.getInstance(idB), () => {});
    await flush();
    expect(activeIds(idB)).toEqual(["b-other"]);
    expect(activeIds(idA)).toEqual([]);
  });

  it("cleanup: the unsubscribe function removes the listener and leaves no callback on the instance", async () => {
    const eventId = "11111111-0000-0000-0000-00000000000c";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    const inst = __testing.getInstance(identity);
    const unsubscribe = __testing.subscribe(inst, () => {});
    await flush();
    const before = inst.listeners.size;
    unsubscribe();
    expect(inst.listeners.size).toBe(before - 1);
  });

});

describe("stale responses and cleanup (KF-036.9)", () => {
  it("an older broadcast response that arrives after a newer one does not overwrite it", async () => {
    const eventId = "11111111-0000-0000-0000-00000000000d";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    setStatus(server, "SUBSCRIBED");
    await flush();
    server.deferred = true;
    // Request A: snapshot taken while no broadcast exists. A thenable is read in a
    // later microtask, so flush before the table changes.
    emit(server, "display_broadcasts");
    await flush();
    // A broadcast is sent; request B: snapshot includes it.
    server.tables.display_broadcasts.push(sentBroadcast("b-stale", eventId));
    emit(server, "display_broadcasts");
    await flush();
    expect(server.pending).toHaveLength(2);
    // Deliver B (newer) first, then A (older).
    server.pending[1]();
    await flush();
    expect(activeIds(identity)).toEqual(["b-stale"]);
    server.pending[0]();
    await flush();
    expect(activeIds(identity)).toEqual(["b-stale"]);
  });

  it("unsubscribe while a request is outstanding: the late response is dropped and the channel is removed", async () => {
    const eventId = "11111111-0000-0000-0000-00000000000e";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    const inst = __testing.getInstance(identity);
    const unsubscribe = __testing.subscribe(inst, () => {});
    await flush();
    setStatus(server, "SUBSCRIBED");
    await flush();
    server.deferred = true;
    server.tables.display_broadcasts.push(sentBroadcast("b-late", eventId));
    emit(server, "display_broadcasts");
    await flush();
    expect(server.pending).toHaveLength(1);
    unsubscribe();
    expect(server.channels).toHaveLength(0);
    server.pending[0]();
    await flush();
    // The response arrived after teardown, so nothing was applied to the instance.
    expect(inst.remoteSlice.broadcastRows).toEqual([]);
    expect(inst.closed).toBe(true);
  });

  it("identity change while a request is outstanding: the old instance's late response does not reach the new identity", async () => {
    const a = "11111111-0000-0000-0000-00000000000f";
    const b = "11111111-0000-0000-0000-000000000010";
    const serverA = freshServer(a);
    const serverB = freshServer(b);
    serverB.tables.display_broadcasts.push(sentBroadcast("b-of-B", b));
    const idA: DisplayEngineIdentity = { eventId: a, displayType: "presenter" };
    const idB: DisplayEngineIdentity = { eventId: b, displayType: "presenter" };
    __testing.setRemoteClient(() => fakeClient(serverA) as never);
    const instA = __testing.getInstance(idA);
    const unsubA = __testing.subscribe(instA, () => {});
    await flush();
    setStatus(serverA, "SUBSCRIBED");
    await flush();
    serverA.deferred = true;
    serverA.tables.display_broadcasts.push(sentBroadcast("b-of-A", a));
    emit(serverA, "display_broadcasts");
    await flush();
    // The viewer moves to event B before A's response returns.
    unsubA();
    __testing.setRemoteClient(() => fakeClient(serverB) as never);
    __testing.subscribe(__testing.getInstance(idB), () => {});
    await flush();
    serverA.pending[0]();
    await flush();
    expect(activeIds(idB)).toEqual(["b-of-B"]);
    expect(instA.remoteSlice.broadcastRows).toEqual([]);
  });

  it("resubscribe after teardown opens one fresh channel and hydrates again", async () => {
    const eventId = "11111111-0000-0000-0000-000000000011";
    const identity: DisplayEngineIdentity = { eventId, displayType: "presenter" };
    const server = freshServer(eventId);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    const unsub = __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    unsub();
    expect(server.channels).toHaveLength(0);
    server.tables.display_broadcasts.push(sentBroadcast("b-again", eventId));
    __testing.subscribe(__testing.getInstance(identity), () => {});
    await flush();
    expect(server.channels).toHaveLength(1);
    expect(activeIds(identity)).toEqual(["b-again"]);
  });
});
