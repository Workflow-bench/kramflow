"use client";

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
import { patchAlert, useMessageDrafts } from "@/lib/message-drafts";

const severities: { value: AlertSeverity; label: string; tone: string }[] = [
  { value: "info", label: "Info", tone: "bg-status-blue/15 text-status-blue" },
  { value: "warning", label: "Warning", tone: "bg-status-orange/15 text-status-orange" },
  { value: "critical", label: "Critical", tone: "bg-status-red/15 text-status-red" },
];

export function AlertComposer({ embedded = false }: { embedded?: boolean } = {}) {
  const { state, setAlert, dismissAlert } = useEventStore();
  const toast = useToast();
  // Draft, severity and in-flight flags live in the event's Messages store
  // (lib/message-drafts.tsx) so a responsive remount doesn't drop them.
  const { drafts, update, claim, release } = useMessageDrafts();
  const { message, severity, posting, aiPending } = drafts.alert;
  const setMessage = (v: string) => update(patchAlert({ message: v }));
  const setSeverity = (v: AlertSeverity) => update(patchAlert({ severity: v }));
  const aiEnabled = useAiEnabled();
  const { draft, drafting: hookDrafting } = useAlertDraft();
  const drafting = hookDrafting || aiPending;

  // Rewrites whatever the operator typed (even a rough note like "10 min
  // behind, tell green room") into a clear alert and picks a severity. It
  // only fills the form — Post Alert is still the operator's call.
  async function handleDraft() {
    if (!claim("alertDrafting")) return;
    update(patchAlert({ aiPending: true }));
    try {
      const result = await draft(message);
      if (!result) return;
      update(
        patchAlert({
          message: `${result.title}. ${result.message}`,
          severity: result.type === "emergency" ? "critical" : result.type === "warning" ? "warning" : "info",
        })
      );
      toast.success("Drafted. Check it before posting.");
    } finally {
      release("alertDrafting");
      update(patchAlert({ aiPending: false }));
    }
  }

  async function handlePost() {
    // Ref guard, not just `posting` state: a rapid click burst fires every
    // click before React re-renders the disabled button (5 clicks -> 5 live
    // broadcasts was reproduced on the identical pattern). Kept in the shared
    // store so a remount mid-post can't re-arm it.
    if (!claim("alertPosting")) return;
    update(patchAlert({ posting: true }));
    let ok = false;
    try {
      ok = await setAlert({ message: message.trim(), severity });
    } finally {
      release("alertPosting");
      update(patchAlert({ posting: false, ...(ok ? { message: "" } : {}) }));
    }
    if (!ok) {
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
      {!embedded && <SectionLabel>Raise Alert</SectionLabel>}
      <div className={embedded ? "flex flex-col gap-3" : "mt-3 flex flex-col gap-3"}>
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
                // Unselected options were the tone at 40% opacity (~1.7:1 on
                // the console background). They stay full-strength neutral
                // text instead; the tone marks the selected option.
                severity === s.value ? s.tone : "border border-line-soft text-muted hover:text-primary"
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
          {embedded ? "Post quick alert" : "Post Alert"}
        </Button>
      </div>
    </div>
  );
}
