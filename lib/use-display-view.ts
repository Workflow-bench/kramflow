"use client";

import { useEffect, useState } from "react";
import type { Alert, LiveState, Session } from "./types";

// The read path for the four public TV displays — polls
// app/api/display-view/route.ts every ~2.5s instead of subscribing to
// Supabase Realtime directly. See that route's comment for why: RLS now
// scopes reads to the signed-in owner, so an anonymous share-link visitor
// (no auth.uid()) would get nothing from a direct client subscription.
// Used uniformly whether the display was reached via share-link token or
// an operator's own logged-in preview — see the approved multi-tenant
// plan's "one code path, easier to audit" reasoning.

const POLL_INTERVAL_MS = 2500;

interface LiveStateRow {
  active_session_id: string | null;
  paused_at: string | null;
  alert: Alert | null;
  progress_by_session: LiveState["progressBySession"];
  notes_overrides: LiveState["notesOverrides"];
  controller_id: string | null;
  controller_claimed_at: string | null;
}

function mapLiveState(row: LiveStateRow): LiveState {
  return {
    activeSessionId: row.active_session_id ?? "",
    progressBySession: row.progress_by_session ?? {},
    pausedAt: row.paused_at,
    alert: row.alert,
    notesOverrides: row.notes_overrides ?? {},
    controllerId: row.controller_id ?? null,
    controllerClaimedAt: row.controller_claimed_at ?? null,
  };
}

const initialLiveState: LiveState = {
  activeSessionId: "",
  progressBySession: {},
  pausedAt: null,
  alert: null,
  notesOverrides: {},
  controllerId: null,
  controllerClaimedAt: null,
};

export interface DisplayViewResult {
  sessions: Session[];
  liveState: LiveState;
  eventId: string | null;
  loading: boolean;
  error: string | null;
}

export function useDisplayView(params: { token?: string; eventId?: string }): DisplayViewResult {
  const { token, eventId: requestedEventId } = params;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [liveState, setLiveState] = useState<LiveState>(initialLiveState);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token && !requestedEventId) return;
    let cancelled = false;

    async function poll() {
      try {
        const qs = token ? `token=${encodeURIComponent(token)}` : `eventId=${encodeURIComponent(requestedEventId!)}`;
        const res = await fetch(`/api/display-view?${qs}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.reason ?? data.error ?? "Failed to load");
          setLoading(false);
          return;
        }
        setSessions(data.sessions ?? []);
        setLiveState(mapLiveState(data.liveState));
        setResolvedEventId(data.eventId);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled) setError("network");
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, requestedEventId]);

  return { sessions, liveState, eventId: resolvedEventId, loading, error };
}
