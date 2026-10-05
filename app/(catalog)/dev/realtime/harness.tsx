"use client";

import { useEffect, useRef, useState } from "react";
import { __testing } from "@/lib/display-engine/store";
import { fakeClient, freshServer, sentBroadcast, setStatus, type FakeServer } from "@/lib/display-engine/fake-transport";
import type { DisplayEngineIdentity } from "@/lib/display-engine/context";

const EVENT_ID = "11111111-0000-0000-0000-0000000000aa";
const IDENTITY: DisplayEngineIdentity = { eventId: EVENT_ID, displayType: "presenter" };

// Module-scope controlled server, replaced on reset so each scenario starts clean.
let server: FakeServer = freshServer(EVENT_ID);

export function RealtimeHarness() {
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);
  const note = (line: string) => setLog((l) => [...l, line]);

  // Route the real store's transport to the controlled server.
  useEffect(() => {
    __testing.reset();
    server = freshServer(EVENT_ID);
    __testing.setRemoteClient(() => fakeClient(server) as never);
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  const inst = () => __testing.getInstance(IDENTITY);
  const active = (): string[] => inst().cachedState.broadcasts.active.map((m) => m.id);
  const flush = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    setTick((t) => t + 1);
  };

  return (
    <div className="p-6 flex flex-col gap-3">
      <p data-harness-banner className="text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic harness, development only. Real display store, controlled transport. Not remote proof.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-step="subscribe" onClick={async () => {
          if (!unsubRef.current) unsubRef.current = __testing.subscribe(inst(), () => setTick((t) => t + 1));
          note("subscribe: channel opened, hydrate read");
          await flush();
        }}>1 Subscribe (hydrate)</button>
        <button type="button" data-step="send" onClick={() => {
          server.tables.display_broadcasts.push(sentBroadcast("b-1", EVENT_ID));
          note("broadcast sent after hydrate, before SUBSCRIBED (no Realtime replay)");
        }}>2 Send broadcast</button>
        <button type="button" data-step="subscribed" onClick={async () => {
          setStatus(server, "SUBSCRIBED");
          note("SUBSCRIBED delivered");
          await flush();
        }}>3 Deliver SUBSCRIBED</button>
        <button type="button" data-step="drop" onClick={async () => {
          server.tables.display_broadcasts.push(sentBroadcast("b-2", EVENT_ID));
          setStatus(server, "CHANNEL_ERROR");
          note("connection dropped; broadcast b-2 sent");
          await flush();
        }}>4 Drop + send b-2</button>
        <button type="button" data-step="reconnect" onClick={async () => {
          setStatus(server, "SUBSCRIBED");
          note("SUBSCRIBED after reconnect");
          await flush();
        }}>5 Reconnect SUBSCRIBED</button>
        <button type="button" data-step="unsubscribe" onClick={async () => {
          unsubRef.current?.();
          unsubRef.current = null;
          note("unsubscribe: channel removed at zero listeners");
          await flush();
        }}>6 Unsubscribe</button>
        <button type="button" data-step="reset" onClick={async () => {
          unsubRef.current?.();
          unsubRef.current = null;
          __testing.reset();
          server = freshServer(EVENT_ID);
          __testing.setRemoteClient(() => fakeClient(server) as never);
          setLog([]);
          await flush();
        }}>Reset</button>
      </div>
      <p data-active className="text-console-sm text-primary">{`active broadcasts: ${active().join(", ") || "none"}`}</p>
      <p data-channels className="text-console-meta text-muted">{`open channels: ${server.channels.length}`}</p>
      <ol data-log className="text-[11px] text-muted-2">{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
      <span data-tick className="hidden">{tick}</span>
    </div>
  );
}
