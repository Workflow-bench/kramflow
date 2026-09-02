"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabaseBrowser, realtimeReady } from "./supabase/client";

// "Who currently has control" resolves from activity_log's actor_name on
// the most recent claimControl row for this event, not from a column on
// live_state itself — live_state is publicly readable by no-login TV
// displays, so it deliberately carries only the anonymous per-tab
// controllerId (see migration-pilot-readiness-v2.sql). activity_log is
// operator-only after that same migration's RLS fix, so a real name is
// safe to resolve from it.
export function useControllerName(eventId: string, controllerId: string | null): string | null {
  // Only ever set from the async load() below or the realtime callback,
  // never synchronously in the effect body — the null-when-unclaimed case
  // is handled by the `controllerId ? name : null` return instead of a
  // synchronous reset here.
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!controllerId) return;

    const client = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function load() {
      const { data } = await client
        .from("activity_log")
        .select("actor_name")
        .eq("event_id", eventId)
        .eq("action", "claimControl")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setName((data as { actor_name: string | null } | null)?.actor_name ?? null);
    }
    load();

    // Belt-and-suspenders: reacts the instant the claim row lands, rather
    // than waiting on this effect to re-run off live_state's own realtime
    // update (which normally arrives around the same time anyway). Must
    // await realtimeReady() before subscribing — activity_log's RLS is
    // authenticated-members-only, and a channel that joins before the
    // signed-in session is attached joins as anon and never receives rows.
    realtimeReady().then(() => {
      if (cancelled) return;
      channel = client
        .channel(`controller-name:${eventId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_log", filter: `event_id=eq.${eventId}` },
          (payload: RealtimePostgresChangesPayload<{ action: string; actor_name: string | null }>) => {
            const row = payload.new as { action: string; actor_name: string | null };
            if (row.action === "claimControl" && !cancelled) setName(row.actor_name ?? null);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) client.removeChannel(channel);
    };
  }, [eventId, controllerId]);

  return controllerId ? name : null;
}
