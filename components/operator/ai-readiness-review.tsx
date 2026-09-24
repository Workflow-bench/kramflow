"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEventId } from "@/lib/event-context";
import { useAiEnabled } from "@/lib/use-ai-enabled";
import { cn } from "@/lib/utils";

interface Finding {
  severity: "warn" | "info";
  title: string;
  detail: string;
  items: { order: number; name: string }[];
}

interface Review {
  sessionId: string;
  summary: string;
  findings: Finding[];
}

// Optional second opinion next to the rule-based readiness checks: the AI
// reads the stored cue sheet for the things a rule can't see (a presenter
// booked back to back, slides mentioned but not flagged, a suspicious
// duration). Advice only — it never changes the cue sheet or blocks going
// live, and it can be wrong, which the copy says.
export function AiReadinessReview({ sessionId }: { sessionId: string }) {
  const eventId = useEventId();
  const enabled = useAiEnabled();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  if (!enabled) return null;

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/readiness-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, sessionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Couldn't run the review. Try again.");
        return;
      }
      setReview({ sessionId, summary: data.summary, findings: data.findings });
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // A review belongs to the session it was run on; switching sessions
  // shouldn't show the previous one's findings under a different rundown.
  const shown = review && review.sessionId === sessionId ? review : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={run} loading={busy}>
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          {shown ? "Re-run AI review" : "AI review"}
        </Button>
        {error && <span className="text-console-meta text-status-red">{error}</span>}
      </div>

      {shown && (
        <div className="rounded-panel border border-line-soft px-3 py-2.5 flex flex-col gap-2">
          <p className="text-console-sm text-muted">{shown.summary}</p>
          {shown.findings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {shown.findings.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", f.severity === "warn" ? "bg-status-orange" : "bg-status-blue")}
                  />
                  <div className="text-console-sm">
                    <p className="text-primary font-medium">
                      <span className="sr-only">{f.severity === "warn" ? "Fix or verify: " : "Worth a look: "}</span>
                      {f.title}
                    </p>
                    <p className="text-muted">{f.detail}</p>
                    {f.items.length > 0 && (
                      <p className="text-console-meta text-muted-2">
                        {f.items.map((it) => `#${it.order} ${it.name}`).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-console-meta text-muted-2">AI-generated. It can miss things or be wrong, so use your own judgement.</p>
        </div>
      )}
    </div>
  );
}
