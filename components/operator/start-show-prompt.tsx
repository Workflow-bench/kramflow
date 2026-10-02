"use client";

import { useState } from "react";
import { FileSpreadsheet, Play } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useEventId } from "@/lib/event-context";
import { useSessions } from "@/lib/use-sessions";
import { useSelectSession } from "@/components/operator/session-switcher";

/**
 * What the Console shows before any session is live. Picking a session takes
 * control and opens it in one step (see useSelectSession), so a first-time
 * operator is never stuck on a dead card. With no sessions at all, it points
 * at the Cue Sheet instead.
 */
export function StartShowPrompt() {
  const eventId = useEventId();
  const sessions = useSessions();
  const selectSession = useSelectSession();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No sessions yet."
        body="Build the running order first, then come back here to run it."
        action={
          <LinkButton href={`/e/${eventId}/operator/cue-sheet`} variant="primary" size="sm">
            <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
            Go to Cue Sheet
          </LinkButton>
        }
      />
    );
  }

  return (
    <EmptyState
      title="Choose a session to run."
      body="Opening a session takes control of the show. Nothing goes live until you press Next."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {sessions.map((s, i) => (
            <Button
              key={s.id}
              variant={i === 0 ? "primary" : "secondary"}
              size="sm"
              loading={busyId === s.id}
              onClick={async () => {
                setBusyId(s.id);
                await selectSession(s.id);
                setBusyId(null);
              }}
            >
              <Play className="h-3.5 w-3.5" strokeWidth={2} />
              {s.dayLabel} · {s.sessionLabel}
            </Button>
          ))}
        </div>
      }
    />
  );
}
