"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { AlertSeverity } from "@/lib/types";
import type { BroadcastType } from "@/lib/display-engine/types";

// Unsent Messages state for one event, owned above the operator console's
// responsive branches. OperatorGrid renders a different component tree at
// each breakpoint (wide / tablet / phone) and inside More Tools, so state
// kept in AlertComposer or OperatorBroadcastPanel was lost on every resize
// across a breakpoint. Memory only: nothing is persisted or sent anywhere,
// and the provider is keyed by event so one event's drafts never show in
// another. Sending and clearing still happen in the composers, unchanged.

export type MessagesMode = "alert" | "broadcast";

export interface AlertDraftState {
  message: string;
  severity: AlertSeverity;
  /** An AI rewrite is in flight; its result lands here even if the
   *  composer remounted meanwhile. */
  aiPending: boolean;
  posting: boolean;
}

export interface BroadcastDraftState {
  type: BroadcastType;
  title: string;
  message: string;
  sending: boolean;
}

export interface MessageDrafts {
  mode: MessagesMode;
  /** An emergency broadcast is being sent from the Messages panel. */
  emergencySending: boolean;
  alert: AlertDraftState;
  broadcast: BroadcastDraftState;
}

export const INITIAL_MESSAGE_DRAFTS: MessageDrafts = {
  mode: "alert",
  emergencySending: false,
  alert: { message: "", severity: "warning", aiPending: false, posting: false },
  broadcast: { type: "info", title: "", message: "", sending: false },
};

// In-flight guards. Synchronous, not state: a rapid click burst fires before
// React re-renders a disabled button, and they must survive a remount too.
export interface MessageDraftGuards {
  alertPosting: boolean;
  alertDrafting: boolean;
  broadcastSending: boolean;
  emergencySending: boolean;
}

interface Store {
  drafts: MessageDrafts;
  update: (fn: (prev: MessageDrafts) => MessageDrafts) => void;
  /** Takes an in-flight guard; false if it's already held. */
  claim: (guard: keyof MessageDraftGuards) => boolean;
  release: (guard: keyof MessageDraftGuards) => void;
}

const MessageDraftsContext = createContext<Store | null>(null);

const INITIAL_GUARDS: MessageDraftGuards = { alertPosting: false, alertDrafting: false, broadcastSending: false, emergencySending: false };

export interface GuardSet {
  claim: (guard: keyof MessageDraftGuards) => boolean;
  release: (guard: keyof MessageDraftGuards) => void;
}

/** Plain-object guards (no React), so they can be tested directly. */
export function createGuardSet(): GuardSet {
  const held: MessageDraftGuards = { ...INITIAL_GUARDS };
  return {
    claim(guard) {
      if (held[guard]) return false;
      held[guard] = true;
      return true;
    },
    release(guard) {
      held[guard] = false;
    },
  };
}

function useDraftStore(): Store {
  const [drafts, setDrafts] = useState<MessageDrafts>(INITIAL_MESSAGE_DRAFTS);
  // Created once per store; lives as long as the provider (one event page).
  const [guards] = useState(createGuardSet);
  const update = useCallback((fn: (prev: MessageDrafts) => MessageDrafts) => setDrafts(fn), []);
  return { drafts, update, claim: guards.claim, release: guards.release };
}

/** Mount with `key={eventId}` so switching events starts empty. */
export function MessageDraftsProvider({ children }: { children: React.ReactNode }) {
  const store = useDraftStore();
  return <MessageDraftsContext.Provider value={store}>{children}</MessageDraftsContext.Provider>;
}

/** The event's shared draft store, or a private one when rendered outside
 *  a provider (each composer then behaves as it did before). */
export function useMessageDrafts(): Store {
  const shared = useContext(MessageDraftsContext);
  const local = useDraftStore();
  return shared ?? local;
}

export function patchAlert(patch: Partial<AlertDraftState>) {
  return (prev: MessageDrafts): MessageDrafts => ({ ...prev, alert: { ...prev.alert, ...patch } });
}

export function patchBroadcast(patch: Partial<BroadcastDraftState>) {
  return (prev: MessageDrafts): MessageDrafts => ({ ...prev, broadcast: { ...prev.broadcast, ...patch } });
}
