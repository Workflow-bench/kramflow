"use client";

import { useEffect, useRef, useState } from "react";
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

export type DisplayConnectionStatus = "connected" | "reconnecting" | "disconnected";

// Derived from real poll outcomes, not a separate heartbeat — one failed
// poll reads as "reconnecting" (a single missed beat is normal on venue
// wifi and not worth alarming over), two or more consecutive failures
// escalate to "disconnected" (report finding #34 — this is specifically
// what was missing: nothing on any display screen distinguished "current"
// from "stale, still showing the last thing it heard"). Mirrors the same
// threshold shape lib/store.tsx's Realtime-based useConnectionStatus()
// uses for the Operator Console, just driven by poll success/failure
// instead of a channel-subscription callback, since these two surfaces
// use genuinely different sync mechanisms.
const DISCONNECTED_AFTER_FAILURES = 2;

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
  connectionStatus: DisplayConnectionStatus;
}

export function useDisplayView(params: { token?: string; eventId?: string }): DisplayViewResult {
  const { token, eventId: requestedEventId } = params;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [liveState, setLiveState] = useState<LiveState>(initialLiveState);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DisplayConnectionStatus>("connected");
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    if (!token && !requestedEventId) return;
    let cancelled = false;

    function recordFailure() {
      consecutiveFailures.current += 1;
      setConnectionStatus(consecutiveFailures.current >= DISCONNECTED_AFTER_FAILURES ? "disconnected" : "reconnecting");
    }
    function recordSuccess() {
      consecutiveFailures.current = 0;
      setConnectionStatus("connected");
    }

    async function poll() {
      try {
        const qs = token ? `token=${encodeURIComponent(token)}` : `eventId=${encodeURIComponent(requestedEventId!)}`;
        const res = await fetch(`/api/display-view?${qs}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.reason ?? data.error ?? "Failed to load");
          setLoading(false);
          // A resolved-but-unauthorized response (bad/revoked share-link
          // token) is a real access error, not a network blip — retrying on
          // the same interval will never fix it, so it shouldn't cycle the
          // connection badge between reconnecting/disconnected the way an
          // actual dropped connection should.
          if (!data.reason) recordFailure();
          return;
        }
        setSessions(data.sessions ?? []);
        setLiveState(mapLiveState(data.liveState));
        setResolvedEventId(data.eventId);
        setError(null);
        setLoading(false);
        recordSuccess();
      } catch {
        if (!cancelled) {
          setError("network");
          recordFailure();
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, requestedEventId]);

  return { sessions, liveState, eventId: resolvedEventId, loading, error, connectionStatus };
}
