// Connection policy and stale-response guard for the display store's Realtime
// sync (KF-036.9). Pure, so the first-connect race can be reproduced without a
// browser, a socket or the store singleton.
//
// The race: the store reads a hydrate snapshot, and separately subscribes to the
// Realtime channel. A change that lands after the snapshot but before the first
// SUBSCRIBED is not replayed by Realtime. The old policy refetched only after a
// previous connection (wasEverConnected), so a first connection kept the stale
// snapshot until some later change.

export type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

// Every SUBSCRIBED refetches. A first subscription is included, because the
// snapshot that preceded it may be older than the subscription.
export function refetchOnSubscribe(status: ChannelStatus): boolean {
  return status === "SUBSCRIBED";
}

// Orders slice responses. Each request takes a sequence number; a response is
// applied only if no newer request has already been applied, so a slow, older
// snapshot cannot overwrite a newer one that arrived first (stale ordering).
export function createSliceSequencer() {
  let issued = 0;
  let applied = 0;
  return {
    begin(): number {
      issued += 1;
      return issued;
    },
    // Returns true if the response was applied, false if it was stale.
    accept(seq: number, apply: () => void): boolean {
      if (seq <= applied) return false;
      applied = seq;
      apply();
      return true;
    },
  };
}
