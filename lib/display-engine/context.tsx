"use client";

import { createContext, useContext } from "react";

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
}

const DisplayEngineContext = createContext<DisplayEngineIdentity | null>(null);

export function DisplayEngineProvider({
  eventId,
  token,
  children,
}: DisplayEngineIdentity & { children: React.ReactNode }) {
  return <DisplayEngineContext.Provider value={{ eventId, token }}>{children}</DisplayEngineContext.Provider>;
}

export function useDisplayEngineIdentity(): DisplayEngineIdentity {
  const ctx = useContext(DisplayEngineContext);
  if (!ctx) {
    throw new Error("useDisplayEngine() was called outside a <DisplayEngineProvider>");
  }
  return ctx;
}
