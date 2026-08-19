"use client";

import { useEffect, useRef, useState } from "react";
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase/client";
import { getClientId } from "./client-id";

// Report finding #36 — two operators editing the same cue-sheet item at
// once previously had no live warning at all, only a reactive one: a 409
// conflict on Save (see program-form.tsx's version-based optimistic
// concurrency), which tells you *after* you've already lost time filling
// out a form that's about to be rejected. This is the proactive half —
// live presence, so both operators see the collision the moment the
// second one opens the same item, before either has typed anything.
//
// Same Realtime Presence pattern as lib/use-operator-presence.ts (a
// per-event channel, one tracked key per browser tab via getClientId()),
// scoped to a second, dedicated channel rather than piggybacking on the
// existing operator-presence one — that channel's payload is about
// "who's connected," this one is about "who's editing what," and a
// program can be edited by someone who never opened /operator directly by
// this route's own reasoning (e.g. a future editor-only role, see finding
// #26) — keeping them separate avoids coupling one concept's shape to the
// other's as either evolves.
export function useItemEditingPresence(eventId: string, programId: string | null): boolean {
  const [othersEditing, setOthersEditing] = useState(false);
  const clientIdRef = useRef(getClientId());

  useEffect(() => {
    if (!programId) return;

    const channel = supabaseBrowser().channel(`item-editing:${eventId}`, {
      config: { presence: { key: clientIdRef.current } },
    });

    function recompute() {
      const state = channel.presenceState() as Record<string, { programId: string }[]>;
      const someoneElse = Object.entries(state).some(
        ([key, metas]) => key !== clientIdRef.current && metas.some((m) => m.programId === programId)
      );
      setOthersEditing(someoneElse);
    }

    channel
      .on("presence", { event: "sync" }, recompute)
      .subscribe(async (status: `${REALTIME_SUBSCRIBE_STATES}`) => {
        if (status === "SUBSCRIBED") await channel.track({ programId });
      });

    return () => {
      supabaseBrowser().removeChannel(channel);
    };
  }, [eventId, programId]);

  return othersEditing;
}
