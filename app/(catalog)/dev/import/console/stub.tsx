"use client";

import { useSyncExternalStore } from "react";
import { HARNESS_STORE_KEY, type HarnessStore } from "../harness";

// Reads the controlled store through useSyncExternalStore: null on the server and
// during hydration, the stored value on the client. No effect, no hydration mismatch.
function subscribe() {
  return () => {};
}
// Stable snapshot: the same raw string returns the same object (required by
// useSyncExternalStore; a fresh object per call loops the render).
let cachedRaw: string | null | undefined;
let cachedStore: HarnessStore | null = null;
function readClient(): HarnessStore | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(HARNESS_STORE_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStore = raw ? (JSON.parse(raw) as HarnessStore) : null;
  }
  return cachedStore;
}

export function ConsoleStub() {
  const store = useSyncExternalStore(subscribe, readClient, () => null);
  return (
    <div className="p-6 flex flex-col gap-2">
      <p data-harness-banner className="text-[12px] uppercase tracking-[0.16em] text-status-orange">
        Synthetic Console stub, development only. Not the real Console.
      </p>
      <p data-console-live className="text-console-sm text-primary">
        {store && store.activeSessionId ? `Live session: ${store.activeSessionId}` : "No session is live."}
      </p>
      <p data-console-started className="text-console-meta text-muted">{store && store.started ? "Show started" : "Not started"}</p>
    </div>
  );
}
