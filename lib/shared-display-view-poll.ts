// useDisplayView (lib/use-display-view.ts) and useDisplayEngine's
// token-identity poll path (lib/display-engine/store.tsx) both poll
// GET /api/display-view every ~2.5s independently — the route itself
// already joins everything (sessions/liveState/displayState/
// displayRegistry/displayBroadcasts) into one response, so every open
// public TV display (reached via a share-link token, the only identity
// that polls rather than using Realtime) was firing that same 7-query
// server-side join twice every tick, each half discarding the fields it
// didn't need.
//
// Coalesces concurrent/near-concurrent requests for the identical query
// string into one real fetch, shared by both callers — not a cache in
// the sense of serving stale data past the poll interval; an in-flight
// (or very-recently-resolved) request is reused, then the entry is
// dropped so the next tick always issues a fresh fetch.
const COALESCE_WINDOW_MS = 1200;

interface CacheEntry {
  promise: Promise<unknown>;
  startedAt: number;
}

const inFlight = new Map<string, CacheEntry>();

export function fetchDisplayViewPolled(qs: string): Promise<unknown> {
  const existing = inFlight.get(qs);
  if (existing && Date.now() - existing.startedAt < COALESCE_WINDOW_MS) {
    return existing.promise;
  }

  const promise = fetch(`/api/display-view?${qs}`).then((res) => res.json());
  inFlight.set(qs, { promise, startedAt: Date.now() });
  promise.finally(() => {
    if (inFlight.get(qs)?.promise === promise) inFlight.delete(qs);
  });
  return promise;
}
