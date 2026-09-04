"use client";

import { createContext, useContext } from "react";
import type { DisplayType } from "./types";

// Display Engine state is now per-event (display_state/display_registry/
// display_broadcasts all carry event_id), but useDisplayEngine() is called
// directly by many nested components (BroadcastOverlay, ProfileEditor,
// OperatorBroadcastPanel, use-display-timer.ts, ...) that have no natural
// way to receive an eventId/token prop without threading it through every
// intermediate component. A context — set once per page, at the same
// level the four display pages and the operator pages already resolve
// their identity — lets useDisplayEngine() read it directly instead.

export interface DisplayEngineIdentity {
  eventId?: string;
  token?: string;
  // Which of the four real display types this instance renders as — set
  // by each of the four display client pages (general/av/green-room/
  // presenter), left undefined by Console pages (Operator, Displays,
  // Broadcast Center), which never read engine.hold/engine.timer at all
  // (confirmed via a full grep — only the display clients do). Threads
  // through to identityBody()/identityQuery() so the server knows which
  // display_type_state row a timer/hold PATCH or a display-view GET
  // applies to (2026-09 blocker remediation — display_type_state.sql).
  // 'custom' isn't a valid value here: DISPLAY_TYPES already documents it
  // as falling back to Presenter's own route, so a custom display renders
  // via presenter-display-client.tsx, which declares "presenter" like any
  // other Presenter instance.
  displayType?: Exclude<DisplayType, "custom">;
}

const DisplayEngineContext = createContext<DisplayEngineIdentity | null>(null);

export function DisplayEngineProvider({
  eventId,
  token,
  displayType,
  children,
}: DisplayEngineIdentity & { children: React.ReactNode }) {
  return (
    <DisplayEngineContext.Provider value={{ eventId, token, displayType }}>{children}</DisplayEngineContext.Provider>
  );
}

export function useDisplayEngineIdentity(): DisplayEngineIdentity {
  const ctx = useContext(DisplayEngineContext);
  if (!ctx) {
    throw new Error("useDisplayEngine() was called outside a <DisplayEngineProvider>");
  }
  return ctx;
}
