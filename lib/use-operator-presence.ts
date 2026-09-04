"use client";

import { useEffect, useRef, useState } from "react";
import type { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase/client";
import { getClientId } from "./client-id";
import { useEventId } from "./event-context";
import { resolveDisplayName } from "./shared/display-name";

// Two /operator tabs can drive the same show
// with zero indication to either person that someone else is connected —
// confirmed live (Tab A's Hold got silently cleared by Tab B's ordinary
// Next). This is the presence/coordination signal; the actual control lock
// that prevents the silent-override case is separate state on live_state
// itself (controllerId/controllerClaimedAt in lib/store.tsx), not part of
// this presence channel — presence answers "who's connected," the lock
// answers "who's allowed to drive right now."
//
// Uses a Supabase Realtime Presence channel — same client/connection
// lib/store.tsx already opens (supabaseBrowser() is a singleton), just a
// different named channel, since presence and postgres_changes are
// different Realtime features on the same underlying socket. No schema
// change, nothing persisted. Channel name is per-event: this used to be a
// single global "operator-presence" channel, which meant two operators
// managing two completely different events would see each other's
// presence count and "Another operator: ..." action broadcasts — a real
// cross-tenant leak caught while converting to multi-tenancy, not a
// hypothetical one.

export interface OperatorActionEvent {
  clientId: string;
  message: string;
  at: number;
}

export interface ConnectedOperator {
  clientId: string;
  name: string;
}

export function useOperatorPresence(enabled: boolean) {
  const eventId = useEventId();
  const [operators, setOperators] = useState<ConnectedOperator[]>([]);
  const [lastAction, setLastAction] = useState<OperatorActionEvent | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>["channel"]> | null>(null);
  const clientIdRef = useRef<string>(getClientId());

  useEffect(() => {
    if (!enabled) return;

    const channel = supabaseBrowser().channel(`operator-presence:${eventId}`, {
      config: { presence: { key: clientIdRef.current } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ name?: string }>>;
        setOperators(
          Object.entries(state).map(([clientId, entries]) => ({
            clientId,
            name: entries[0]?.name || "An operator",
          }))
        );
      })
      .on("broadcast", { event: "operator-action" }, ({ payload }: { payload: { clientId: string; message: string } }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          setLastAction({ clientId: payload.clientId, message: payload.message, at: Date.now() });
        }
      })
      .subscribe(async (status: `${REALTIME_SUBSCRIBE_STATES}`) => {
        if (status === "SUBSCRIBED") {
          // Presence is ephemeral (nothing written to Postgres), so naming
          // it with the signed-in user's own display name carries none of
          // live_state's "public/anonymous readers" concern — this channel
          // is only ever joined by authenticated operators (`enabled` is
          // status === "unlocked").
          const {
            data: { user },
          } = await supabaseBrowser().auth.getUser();
          await channel.track({ online_at: new Date().toISOString(), name: resolveDisplayName(user) });
        }
      });

    return () => {
      supabaseBrowser().removeChannel(channel);
      channelRef.current = null;
      setOperators([]);
    };
  }, [enabled, eventId]);

  const count = Math.max(1, operators.length);

  function broadcastAction(message: string) {
    channelRef.current?.send({
      type: "broadcast",
      event: "operator-action",
      payload: { clientId: clientIdRef.current, message },
    });
  }

  return { count, operators, lastAction, broadcastAction };
}
