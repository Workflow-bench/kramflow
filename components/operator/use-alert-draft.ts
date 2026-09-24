"use client";

import { useRef, useState } from "react";
import { useEventId } from "@/lib/event-context";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { useToast } from "@/components/ui/toast";

export interface AlertDraftResult {
  type: "info" | "reminder" | "warning" | "success" | "emergency";
  title: string;
  message: string;
  priority: 1 | 2 | 3;
  audience: "all" | "presenter" | "green-room" | "av" | "general";
  acknowledgementRequired: boolean;
}

// Asks the AI to turn a rough instruction into a ready-to-review alert or
// broadcast. Sends the current and next item names so the wording can be
// specific ("Green room, next up is ..."). Returns null on any failure
// after telling the operator why; never sends anything itself.
export function useAlertDraft() {
  const eventId = useEventId();
  const sessions = useSessions();
  const { state } = useEventStore();
  const toast = useToast();
  const [drafting, setDrafting] = useState(false);
  const draftingRef = useRef(false);

  async function draft(instruction: string): Promise<AlertDraftResult | null> {
    if (draftingRef.current || !instruction.trim()) return null;
    draftingRef.current = true;
    setDrafting(true);
    try {
      const session = sessions.find((s) => s.id === state.activeSessionId);
      const currentOrder = state.progressBySession[state.activeSessionId]?.currentOrder ?? null;
      const current = currentOrder !== null ? session?.items.find((i) => i.order === currentOrder) : undefined;
      const next = currentOrder !== null ? session?.items.find((i) => i.order === currentOrder + 1) : session?.items[0];

      const res = await fetch("/api/ai/alert-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          instruction: instruction.trim(),
          context: {
            session: session ? `${session.dayLabel} • ${session.sessionLabel}` : null,
            current: current?.title ?? null,
            next: next?.title ?? null,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? "Couldn't draft that. Try again.");
        return null;
      }
      return data.draft as AlertDraftResult;
    } catch {
      toast.error("Couldn't reach the server. Try again.");
      return null;
    } finally {
      draftingRef.current = false;
      setDrafting(false);
    }
  }

  return { draft, drafting };
}
