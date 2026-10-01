"use client";

import { createContext, useContext } from "react";
import type { DisplayType } from "./types";
import type { EventRole } from "@/lib/event-context";

// Display Engine state is now per-event (display_state/display_registry/
// display_broadcasts all carry event_id), but useDisplayEngine() is called
// directly by many nested components (BroadcastOverlay,
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
  // Audit remediation B002-F1 / B003 (Codex review): the caller's real,
  // server-derived event role — owner/editor/viewer — set only for a
  // session-reached viewer (never for a token viewer, who has no role at
  // all). Resolved server-side by each display page.tsx's own
  // verifyDisplayAccess() call and threaded down as an explicit prop, the
  // same way eventId/token already are — deliberately NOT read from
  // lib/event-context.tsx's EventRoleContext, whose default value of
  // "owner" (safe under the authenticated app/e/[eventId] layout, which
  // always provides it) would be silently wrong here, since these four
  // display pages (plus /custom) never wrap in that provider and a naive
  // read would default every viewer to "owner". See broadcast-overlay.tsx
  // for the one place this currently matters.
  role?: EventRole;
}

const DisplayEngineContext = createContext<DisplayEngineIdentity | null>(null);

export function DisplayEngineProvider({
  eventId,
  token,
  displayType,
  role,
  children,
}: DisplayEngineIdentity & { children: React.ReactNode }) {
  return (
    <DisplayEngineContext.Provider value={{ eventId, token, displayType, role }}>
      {children}
    </DisplayEngineContext.Provider>
  );
}

export function useDisplayEngineIdentity(): DisplayEngineIdentity {
  const ctx = useContext(DisplayEngineContext);
  if (!ctx) {
    throw new Error("useDisplayEngine() was called outside a <DisplayEngineProvider>");
  }
  return ctx;
}
