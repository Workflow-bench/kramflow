"use client";

import { createContext, useContext } from "react";

// The current event an authenticated operator is managing — set once at
// app/e/[eventId]/layout.tsx (after that layout has already verified the
// signed-in user owns it) and read by useEventStore()/useSessions() and
// every operator component that calls them (ProgramList, ControlsPanel,
// CommandPalette, ...). A context, not a hook parameter, for the same
// reason lib/display-engine/context.tsx exists: these are called directly
// by many nested components that have no natural way to receive an eventId
// prop without threading it through every intermediate layer. Only ever
// used by authenticated operator surfaces — the anonymous share-link
// display pages use lib/use-display-view.ts instead, which takes its own
// token/eventId explicitly and never touches this context.

const EventContext = createContext<string | null>(null);

export function EventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  return <EventContext.Provider value={eventId}>{children}</EventContext.Provider>;
}

export function useEventId(): string {
  const eventId = useContext(EventContext);
  if (!eventId) {
    throw new Error("useEventStore()/useSessions() was called outside an <EventProvider>");
  }
  return eventId;
}

// Report finding #26 — the signed-in user's role on *this* event, resolved
// once server-side in the layout (same request that already checks they
// have any access at all) and handed down for UI adaptation: hiding
// controls a viewer/editor can't use is a courtesy so they don't have to
// click-and-fail to discover that, not the actual security boundary — the
// real enforcement is server-side, in every API route's
// requireEventAccess() call. A separate context from EventContext rather
// than widening its shape, so every existing useEventId() call site (there
// are many) is unaffected.
export type EventRole = "viewer" | "editor" | "owner";
const EventRoleContext = createContext<EventRole>("owner");

export function EventRoleProvider({ role, children }: { role: EventRole; children: React.ReactNode }) {
  return <EventRoleContext.Provider value={role}>{children}</EventRoleContext.Provider>;
}

export function useEventRole(): EventRole {
  return useContext(EventRoleContext);
}
