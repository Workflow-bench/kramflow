"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase/client";

// QA_REPORT_ROUND2.md R2-BUG-1: two /operator tabs can drive the same show
// with zero indication to either person that someone else is connected —
// confirmed live (Tab A's Hold got silently cleared by Tab B's ordinary
// Next). This is a lightweight presence signal, not conflict resolution —
// per the fix prompt, real session locking/handoff is a separate design
// decision out of scope here. Knowing someone else is driving is enough for
// operators to coordinate themselves in the common case.
//
// Uses a Supabase Realtime Presence channel — same client/connection
// lib/store.tsx already opens (supabaseBrowser() is a singleton), just a
// different named channel, since presence and postgres_changes are
// different Realtime features on the same underlying socket. No schema
// change, nothing persisted.

const CLIENT_ID_KEY = "kramflow-operator-client-id";

function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `op-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export interface OperatorActionEvent {
  clientId: string;
  message: string;
  at: number;
}

export function useOperatorPresence(enabled: boolean) {
  const [count, setCount] = useState(1);
  const [lastAction, setLastAction] = useState<OperatorActionEvent | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>["channel"]> | null>(null);
  const clientIdRef = useRef<string>(getClientId());

  useEffect(() => {
    if (!enabled) return;

    const channel = supabaseBrowser().channel("operator-presence", {
      config: { presence: { key: clientIdRef.current } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setCount(Math.max(1, Object.keys(state).length));
      })
      .on("broadcast", { event: "operator-action" }, ({ payload }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          setLastAction({ clientId: payload.clientId, message: payload.message, at: Date.now() });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabaseBrowser().removeChannel(channel);
      channelRef.current = null;
      setCount(1);
    };
  }, [enabled]);

  function broadcastAction(message: string) {
    channelRef.current?.send({
      type: "broadcast",
      event: "operator-action",
      payload: { clientId: clientIdRef.current, message },
    });
  }

  return { count, lastAction, broadcastAction };
}
