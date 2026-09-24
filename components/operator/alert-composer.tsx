"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEventStore } from "@/lib/store";
import type { AlertSeverity } from "@/lib/types";
import { SectionLabel } from "@/components/ui/section-label";
import { useToast } from "@/components/ui/toast";
import { AlertBanner } from "@/components/ui/alert-banner";
import { cn } from "@/lib/utils";
import { useAiEnabled } from "@/lib/use-ai-enabled";
import { useAlertDraft } from "./use-alert-draft";

const severities: { value: AlertSeverity; label: string; tone: string }[] = [
  { value: "info", label: "Info", tone: "bg-status-blue/15 text-status-blue" },
  { value: "warning", label: "Warning", tone: "bg-status-orange/15 text-status-orange" },
  { value: "critical", label: "Critical", tone: "bg-status-red/15 text-status-red" },
];

export function AlertComposer() {
  const { state, setAlert, dismissAlert } = useEventStore();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("warning");
  const [posting, setPosting] = useState(false);
  // Ref, not just the `posting` state — a rapid click burst fires every
  // click before React re-renders with the disabled button, so a state-only
  // guard lets all of them through. Confirmed live on the identical pattern
  // in app/(operator)/broadcast/page.tsx (5 clicks -> 5 live broadcasts).
  const postingRef = useRef(false);
  const aiEnabled = useAiEnabled();
  const { draft, drafting } = useAlertDraft();

  // Rewrites whatever the operator typed (even a rough note like "10 min
  // behind, tell green room") into a clear alert and picks a severity. It
  // only fills the form — Post Alert is still the operator's call.
  async function handleDraft() {
    const result = await draft(message);
    if (!result) return;
    setMessage(`${result.title}. ${result.message}`);
    setSeverity(result.type === "emergency" ? "critical" : result.type === "warning" ? "warning" : "info");
    toast.success("Drafted. Check it before posting.");
  }

  async function handlePost() {
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    const ok = await setAlert({ message: message.trim(), severity });
    postingRef.current = false;
    setPosting(false);
    if (ok) {
      setMessage("");
    } else {
      toast.error("Couldn't post the alert. Try again.");
    }
  }

  if (state.alert) {
    return (
      <div>
        <SectionLabel>Active Alert</SectionLabel>
        <AlertBanner alert={state.alert} className="mt-3" />
        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={dismissAlert}>
          <X className="h-4 w-4" strokeWidth={2} />
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Raise Alert</SectionLabel>
      <div className="mt-3 flex flex-col gap-3">
        <Input
          placeholder="e.g. Drama Team, please report Stage Left"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Alert message"
        />
        <div className="flex flex-wrap gap-2">
          {severities.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              aria-pressed={severity === s.value}
              className={cn(
                "rounded-full px-3 py-1.5 text-console-meta font-semibold uppercase tracking-wide transition-opacity cursor-pointer whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                s.tone,
                severity !== s.value && "opacity-40"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {aiEnabled && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={message.trim().length < 3 || posting}
            loading={drafting}
            onClick={handleDraft}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            Draft with AI
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          disabled={!message.trim()}
          loading={posting}
          onClick={handlePost}
        >
          Post Alert
        </Button>
      </div>
    </div>
  );
}
