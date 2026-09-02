"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, Send, Star, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useEventRole } from "@/lib/event-context";
import { EventNav } from "@/components/operator/event-nav";
import { EventIdentity } from "@/components/operator/event-identity";
import { useDisplayEngine, useTransportStatus } from "@/lib/display-engine/store";
import { getDisplayStatus, type DisplayHealth } from "@/lib/display-engine/use-register-display";
import type { TransportStatus } from "@/lib/display-engine/transport";
import {
  EMERGENCY_PRESETS,
  type BroadcastDraft,
  type BroadcastTargetKind,
  type BroadcastType,
  type DisplayType,
} from "@/lib/display-engine/types";
import { BROADCAST_TYPE_META, BROADCAST_TYPE_OPTIONS } from "@/lib/display-engine/broadcast-style";
import { TargetHealthSummary } from "@/components/display-engine/target-health-summary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Tooltip } from "@/components/ui/tooltip";
import { ConnectionBadge, type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// The 4 canonical display types — see app/page.tsx.
const DISPLAY_TYPES: { value: DisplayType; label: string }[] = [
  { value: "presenter", label: "Presenter" },
  { value: "green-room", label: "Green Room" },
  { value: "av", label: "AV" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

const PRIORITY_OPTIONS = [
  { value: "1", label: "Low" },
  { value: "2", label: "Normal" },
  { value: "3", label: "High" },
];

const TARGET_KIND_OPTIONS = [
  { value: "all", label: "All Displays" },
  { value: "type", label: "Display Type" },
  { value: "display", label: "Specific Display" },
  { value: "group", label: "Group" },
];

const EMPTY_DRAFT: BroadcastDraft = {
  type: "info",
  title: "",
  message: "",
  icon: null,
  priority: 2,
  target: { kind: "all" },
  expiresInMinutes: null,
  durationSeconds: null,
  acknowledgementRequired: false,
  persistent: false,
  scheduledFor: null,
};

// `<input type="datetime-local">`'s `min` wants local time with no
// timezone suffix — a plain `toISOString()` would be UTC and silently let
// operators in timezones behind UTC pick a slot that's already past.
function minScheduleValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

// Same mapping Displays uses for its own header — the Display Engine's
// realtime transport is a different signal from any one display's
// heartbeat health, but gets the same three-word vocabulary either way.
function toConnectionStatus(status: TransportStatus): ConnectionBadgeStatus {
  if (status === "open") return "connected";
  if (status === "connecting") return "reconnecting";
  return "disconnected";
}

type Tab = "history" | "scheduled" | "templates" | "drafts";
type DestructiveAction =
  | { kind: "clear-emergencies" }
  | { kind: "cancel-scheduled"; id: string; title: string }
  | { kind: "delete-template"; id: string; name: string }
  | { kind: "delete-draft"; index: number; title: string };

const PERMISSION_NOTE = "Only the event owner can send broadcasts.";

export default function BroadcastCenterPage() {
  const { lock } = useAuth();
  const toast = useToast();
  const transportStatus = useTransportStatus();
  // Broadcasts are owner-gated server-side (requireEventAccess(eventId,
  // "owner") in api/display-engine/broadcasts/route.ts) — an editor filling
  // out the whole composer would otherwise only discover that on Send's
  // 403. Draft/template save (local-only, no server call) stay available
  // to everyone; only the actions that actually hit that route are gated
  // here, as a courtesy on top of the real server-side boundary.
  const readOnly = useEventRole() !== "owner";
  const {
    state: engine,
    sendBroadcast,
    scheduleBroadcast,
    cancelScheduled,
    dismissBroadcast,
    clearEmergencies,
    saveTemplate,
    deleteTemplate,
    toggleFavoriteTemplate,
    saveDraft,
    deleteDraft,
  } = useDisplayEngine();

  const registeredCount = Object.keys(engine.registry).length;
  const registeredHealthCounts = useMemo(() => {
    const counts: Record<DisplayHealth, number> = { online: 0, stale: 0, offline: 0 };
    for (const d of Object.values(engine.registry)) counts[getDisplayStatus(d, Date.now())]++;
    return counts;
  }, [engine.registry]);

  const [draft, setDraft] = useState<BroadcastDraft>(EMPTY_DRAFT);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  // A spam-click storm (5 clicks in the same synchronous burst) fires all 5
  // as separate live broadcasts — confirmed live. `sending` (useState) can't
  // stop it: state updates are deferred, so every click in the same burst
  // still reads the stale `false` from the render that was current when the
  // burst started. A ref mutates immediately, so the second click in the
  // same burst already sees it flipped.
  const sendingRef = useRef(false);
  const [tab, setTab] = useState<Tab>("history");
  const [search, setSearch] = useState("");
  const emergencyConfirm = useConfirmDialog<(typeof EMERGENCY_PRESETS)[number]>();
  const destructiveConfirm = useConfirmDialog<DestructiveAction>();
  // Report finding #38 — the composer's own Send/Schedule button had zero
  // confirmation regardless of what was about to happen, including for a
  // manually-composed emergency-type message (only the pre-built
  // EMERGENCY_PRESETS quick buttons below went through emergencyConfirm)
  // and including scheduling, where a wrong date/time would otherwise fire
  // unattended with nothing having asked "are you sure" first. Routine,
  // immediate, non-emergency sends stay exactly as fast as before — this
  // only adds a checkpoint where the consequence is either delayed
  // (scheduled) or elevated (emergency).
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [emergencySending, setEmergencySending] = useState(false);
  const [destructiveLoading, setDestructiveLoading] = useState(false);
  // Same rapid-multi-click gap as sendingRef above, just not yet closed on
  // these two confirms — `loading` alone doesn't stop a burst of clicks
  // that all land before React commits the first one's disabled state.
  const emergencySendingRef = useRef(false);
  const destructiveLoadingRef = useRef(false);

  function patchDraft(patch: Partial<BroadcastDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function patchTarget(kind: BroadcastTargetKind, value?: string) {
    patchDraft({ target: { kind, value } });
  }

  function resetCompose() {
    setDraft(EMPTY_DRAFT);
    setScheduleEnabled(false);
  }

  const isScheduling = scheduleEnabled && Boolean(draft.scheduledFor);
  const needsSendConfirm = isScheduling || draft.type === "emergency";

  // "Schedule for later" checked but no date/time picked yet still has
  // isScheduling === false, which previously fell through to sending
  // immediately on click — contradicting the still-checked checkbox with no
  // error at all. Same check catches a scheduled time that's already in the
  // past (the datetime-local input's `min` stops most of these, but not a
  // stale value left over from before the clock ticked past it, or manual
  // entry bypassing the picker).
  function scheduleValidationError(): string | null {
    if (!scheduleEnabled) return null;
    if (!draft.scheduledFor) {
      return 'Pick a date and time to schedule this broadcast, or turn off "Schedule for later" to send now.';
    }
    if (new Date(draft.scheduledFor).getTime() <= Date.now()) {
      return "That date and time has already passed — pick one in the future.";
    }
    return null;
  }

  function requestSend() {
    if (!draft.title.trim() || sendingRef.current || readOnly) return;
    const scheduleError = scheduleValidationError();
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    if (needsSendConfirm) {
      setConfirmSendOpen(true);
      return;
    }
    void handleSend();
  }

  async function handleSend() {
    if (!draft.title.trim() || sendingRef.current || readOnly) return;
    const scheduleError = scheduleValidationError();
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    const res = isScheduling ? await scheduleBroadcast(draft, draft.scheduledFor!) : await sendBroadcast(draft);
    sendingRef.current = false;
    setSending(false);
    if (res && res.ok) {
      toast.success(isScheduling ? "Broadcast scheduled" : "Broadcast sent");
      resetCompose();
    } else {
      toast.error("Couldn't send the broadcast — try again");
    }
  }

  function loadIntoCompose(source: BroadcastDraft) {
    setDraft({ ...source, scheduledFor: null });
    setScheduleEnabled(false);
    setTab("history");
  }

  async function handleDestructiveConfirm() {
    const action = destructiveConfirm.pending;
    if (!action || destructiveLoadingRef.current) return;
    destructiveLoadingRef.current = true;
    try {
      await runDestructiveAction(action);
    } finally {
      destructiveLoadingRef.current = false;
    }
  }

  async function runDestructiveAction(action: DestructiveAction) {
    switch (action.kind) {
      case "clear-emergencies": {
        setDestructiveLoading(true);
        const results = await clearEmergencies();
        setDestructiveLoading(false);
        if (results.some((r) => !r || !r.ok)) toast.error("Some emergency broadcasts couldn't be cleared — try again");
        break;
      }
      case "cancel-scheduled": {
        setDestructiveLoading(true);
        const res = await cancelScheduled(action.id);
        setDestructiveLoading(false);
        if (res && res.ok) toast.success("Scheduled broadcast cancelled");
        else toast.error("Couldn't cancel — try again");
        break;
      }
      case "delete-template":
        deleteTemplate(action.id);
        toast.success("Template deleted");
        break;
      case "delete-draft":
        deleteDraft(action.index);
        toast.success("Draft deleted");
        break;
    }
    destructiveConfirm.cancel();
  }

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = q
      ? engine.broadcasts.history.filter(
          (m) => m.title.toLowerCase().includes(q) || m.message.toLowerCase().includes(q)
        )
      : engine.broadcasts.history;
    return items.slice(0, 50);
  }, [engine.broadcasts.history, search]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = q
      ? engine.broadcasts.templates.filter((t) => t.name.toLowerCase().includes(q))
      : engine.broadcasts.templates;
    return [...items].sort((a, b) => {
      const aFav = engine.broadcasts.favorites.includes(a.id) ? 0 : 1;
      const bFav = engine.broadcasts.favorites.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [engine.broadcasts.templates, engine.broadcasts.favorites, search]);

  const previewMeta = BROADCAST_TYPE_META[draft.type];
  const PreviewIcon = previewMeta.Icon;
  const activeEmergency = engine.broadcasts.active.find((m) => m.type === "emergency");

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-12 py-4 xl:py-6 border-b border-white/5 flex-wrap">
        <div className="min-w-0">
          <EventIdentity />
          <div className="flex items-center flex-wrap gap-2.5 mt-1.5">
            <h1 className="text-console-lg text-primary">Broadcast Center</h1>
            <ConnectionBadge status={toConnectionStatus(transportStatus)} variant="console" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <EventNav />
          <Button variant="ghost" size="sm" onClick={lock}>
            Lock
          </Button>
        </div>
      </header>

      {/* Emergency quick-send — a bordered zone, not just red buttons, so it
          reads as categorically different from routine compose actions
          below it. Real Button (danger tier) instead of a hand-tinted
          pill — same guardrail weight DESIGN.md's tier table gives every
          other destructive control in the product, not a one-off style. */}
      <div className="mx-4 sm:mx-6 xl:mx-12 mt-6 rounded-panel border-2 border-status-red/40 bg-status-red/[0.04] px-6 py-5">
        <SectionLabel>Emergency Broadcast — Overrides Every Display</SectionLabel>
        <p className="text-console-meta text-muted-2 mt-1">
          Takes over all {registeredCount} registered display{registeredCount === 1 ? "" : "s"} immediately
          {registeredHealthCounts.offline > 0
            ? ` — ${registeredHealthCounts.offline} currently offline will show it the moment they reconnect.`
            : "."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EMERGENCY_PRESETS.map((preset) => (
            <MaybeTooltip key={preset.label} when={readOnly} content={PERMISSION_NOTE}>
              <Button variant="danger" onClick={() => emergencyConfirm.request(preset)} disabled={readOnly}>
                <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                {preset.label}
              </Button>
            </MaybeTooltip>
          ))}
        </div>

        {activeEmergency && (
          <div className="mt-4 rounded-control bg-status-red/10 border border-status-red/30 px-6 py-3 flex items-center justify-between gap-4">
            <p className="text-console-meta text-status-red font-medium">
              &ldquo;{activeEmergency.title}&rdquo; is currently active on every targeted display.
            </p>
            <MaybeTooltip when={readOnly} content={PERMISSION_NOTE}>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={() => destructiveConfirm.request({ kind: "clear-emergencies" })}
              >
                Clear
              </Button>
            </MaybeTooltip>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-8 px-4 sm:px-6 xl:px-12 py-8">
        {/* Compose — ordered Content -> Audience -> Severity -> Duration ->
            Preview -> Send, so an operator reads what/who/how-serious/how-
            long before ever reaching the button that commits to it. */}
        <div>
          <SectionLabel>Compose</SectionLabel>
          <div className="mt-4 flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <FormField label="Title">
                <Input
                  value={draft.title}
                  onChange={(e) => patchDraft({ title: e.target.value })}
                  placeholder="Broadcast title"
                />
              </FormField>
              <FormField label="Message">
                <Textarea
                  value={draft.message}
                  onChange={(e) => patchDraft({ message: e.target.value })}
                  placeholder="Message body"
                  rows={3}
                  className="resize-none"
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-3 pt-1 border-t border-line-soft">
              <SectionLabel className="mt-3">Audience</SectionLabel>
              <FormField label="Target">
                <Select
                  value={draft.target.kind}
                  onChange={(v) => patchTarget(v as BroadcastTargetKind, undefined)}
                  options={TARGET_KIND_OPTIONS}
                  searchable={false}
                />
              </FormField>

              {draft.target.kind === "type" && (
                <FormField label="Display Type">
                  <Select
                    value={draft.target.value ?? ""}
                    onChange={(v) => patchTarget("type", v)}
                    options={DISPLAY_TYPES}
                    placeholder="Select a type"
                    searchable={false}
                  />
                </FormField>
              )}

              {draft.target.kind === "display" && (
                <FormField label="Display">
                  <Select
                    value={draft.target.value ?? ""}
                    onChange={(v) => patchTarget("display", v)}
                    options={Object.values(engine.registry).map((d) => ({ value: d.id, label: d.name }))}
                    placeholder="Select a display"
                    searchable={false}
                  />
                </FormField>
              )}

              {draft.target.kind === "group" && (
                <FormField label="Group">
                  <Select
                    value={draft.target.value ?? ""}
                    onChange={(v) => patchTarget("group", v)}
                    options={Object.values(engine.groups).map((g) => ({ value: g.id, label: g.name }))}
                    placeholder="Select a group"
                    searchable={false}
                  />
                </FormField>
              )}

              <TargetHealthSummary target={draft.target} registry={engine.registry} groups={engine.groups} />
            </div>

            <div className="flex flex-col gap-4 pt-1 border-t border-line-soft">
              <SectionLabel className="mt-3">Severity</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Type">
                  <Select
                    value={draft.type}
                    onChange={(v) => {
                      const type = v as BroadcastType;
                      // Emergency is inherently max-priority — the preset
                      // buttons above already hardcode this; letting a
                      // manually-composed emergency sit at "Low" priority
                      // would be a confusing dead combination the product
                      // never actually means.
                      patchDraft(type === "emergency" ? { type, priority: 3 } : { type });
                    }}
                    options={BROADCAST_TYPE_OPTIONS}
                    searchable={false}
                  />
                </FormField>
                <FormField label="Priority">
                  <Select
                    value={String(draft.priority)}
                    onChange={(v) => patchDraft({ priority: Number(v) as 1 | 2 | 3 })}
                    options={PRIORITY_OPTIONS}
                    searchable={false}
                    disabled={draft.type === "emergency"}
                  />
                </FormField>
              </div>
              <FormField label="Icon (optional)">
                <Input
                  value={draft.icon ?? ""}
                  onChange={(e) => patchDraft({ icon: e.target.value || null })}
                  placeholder="e.g. 📢"
                  className="max-w-40"
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-4 pt-1 border-t border-line-soft">
              <SectionLabel className="mt-3">Duration &amp; Persistence</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Expires in (min)">
                  <Input
                    type="number"
                    min={0}
                    value={draft.expiresInMinutes ?? ""}
                    onChange={(e) => patchDraft({ expiresInMinutes: e.target.value ? Number(e.target.value) : null })}
                    placeholder="No expiry"
                  />
                </FormField>
                <FormField label="Duration (sec)">
                  <Input
                    type="number"
                    min={0}
                    value={draft.durationSeconds ?? ""}
                    onChange={(e) => patchDraft({ durationSeconds: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Until dismissed"
                  />
                </FormField>
              </div>

              <div className="flex items-center gap-6">
                <Checkbox
                  checked={draft.acknowledgementRequired}
                  onChange={(v) => patchDraft({ acknowledgementRequired: v })}
                  label="Require acknowledgement"
                />
                <Checkbox checked={draft.persistent} onChange={(v) => patchDraft({ persistent: v })} label="Persistent" />
              </div>

              <div>
                <Checkbox
                  checked={scheduleEnabled}
                  onChange={(v) => {
                    setScheduleEnabled(v);
                    if (!v) patchDraft({ scheduledFor: null });
                  }}
                  label="Schedule for later"
                />
                {scheduleEnabled && (
                  <Input
                    type="datetime-local"
                    min={minScheduleValue()}
                    onChange={(e) =>
                      patchDraft({ scheduledFor: e.target.value ? new Date(e.target.value).toISOString() : null })
                    }
                    className="mt-3"
                  />
                )}
              </div>
            </div>

            {/* Preview — the same styling BroadcastOverlay itself renders
                with (BROADCAST_TYPE_META), not a separately-invented
                mockup. Emergency's real behavior is a full-screen takeover,
                which this panel can't and shouldn't literally reproduce
                inline — so it says so in words instead of faking it. */}
            <div className="pt-1 border-t border-line-soft">
              <SectionLabel className="mt-3">Preview</SectionLabel>
              <Panel className="mt-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex items-center justify-center h-9 w-9 rounded-full shrink-0",
                      previewMeta.accentClass
                    )}
                  >
                    <PreviewIcon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-console-sm text-primary font-semibold truncate">
                      {draft.title.trim() || "Untitled broadcast"}
                    </p>
                    {draft.message.trim() && (
                      <p className="text-console-meta text-muted truncate">{draft.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-console-meta text-muted-2 mt-3">
                  {draft.type === "emergency"
                    ? "Takes over the full screen on every targeted display until acknowledged or cleared — not a corner banner like other types."
                    : `Appears as a banner on each targeted display${
                        draft.persistent
                          ? " until dismissed."
                          : draft.durationSeconds
                            ? ` for ${draft.durationSeconds}s.`
                            : "."
                      }`}
                </p>
              </Panel>
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <MaybeTooltip when={readOnly} content={PERMISSION_NOTE}>
                <Button
                  variant="primary"
                  onClick={requestSend}
                  disabled={readOnly || !draft.title.trim()}
                  loading={sending}
                >
                  <Send className="h-4 w-4" strokeWidth={2} />
                  {isScheduling ? "Schedule" : "Send Now"}
                </Button>
              </MaybeTooltip>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!draft.title.trim()) return;
                  saveDraft(draft);
                  toast.success("Draft saved");
                }}
              >
                Save Draft
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!draft.title.trim()) return;
                  saveTemplate(draft.title, draft);
                  toast.success("Template saved");
                }}
              >
                Save as Template
              </Button>
            </div>
          </div>
        </div>

        {/* History / Scheduled / Templates / Drafts */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1 rounded-full bg-card p-1">
              <TabButton active={tab === "history"} onClick={() => setTab("history")}>
                History
              </TabButton>
              <TabButton active={tab === "scheduled"} onClick={() => setTab("scheduled")}>
                Scheduled ({engine.broadcasts.scheduled.length})
              </TabButton>
              <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
                Templates
              </TabButton>
              <TabButton active={tab === "drafts"} onClick={() => setTab("drafts")}>
                Drafts ({engine.broadcasts.drafts.length})
              </TabButton>
            </div>
            {(tab === "history" || tab === "templates") && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full sm:w-56"
              />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {tab === "history" &&
              (filteredHistory.length === 0 ? (
                <EmptyState title="No broadcasts sent yet" />
              ) : (
                filteredHistory.map((m) => {
                  const isActive = engine.broadcasts.active.some((a) => a.id === m.id);
                  return (
                    <BroadcastRow
                      key={m.id}
                      meta={
                        <>
                          <TypeBadge type={m.type} />
                          <span className="text-console-meta text-muted-2">{new Date(m.createdAt).toLocaleString()}</span>
                          <Badge tone={isActive ? "green" : "muted"}>{isActive ? "Active" : "Dismissed"}</Badge>
                        </>
                      }
                      title={m.title}
                      message={m.message}
                      footer={
                        m.acknowledgementRequired ? `Acknowledged by ${m.acknowledgedBy.length}` : undefined
                      }
                      actions={
                        <>
                          <IconButton label="Duplicate into compose" onClick={() => loadIntoCompose(toDraft(m))}>
                            <Copy className="h-4 w-4" strokeWidth={2} />
                          </IconButton>
                          {isActive && (
                            <IconButton label="Dismiss" onClick={() => dismissBroadcast(m.id)}>
                              <X className="h-4 w-4" strokeWidth={2} />
                            </IconButton>
                          )}
                        </>
                      }
                    />
                  );
                })
              ))}

            {tab === "scheduled" &&
              (engine.broadcasts.scheduled.length === 0 ? (
                <EmptyState title="No broadcasts scheduled" />
              ) : (
                engine.broadcasts.scheduled.map((m) => (
                  <BroadcastRow
                    key={m.id}
                    meta={
                      <>
                        <TypeBadge type={m.type} />
                        <span className="text-console-meta text-muted-2">
                          fires {m.scheduledFor ? new Date(m.scheduledFor).toLocaleString() : "—"}
                        </span>
                      </>
                    }
                    title={m.title}
                    message={m.message}
                    actions={
                      <IconButton
                        label={readOnly ? PERMISSION_NOTE : "Cancel"}
                        disabled={readOnly}
                        onClick={() => destructiveConfirm.request({ kind: "cancel-scheduled", id: m.id, title: m.title })}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </IconButton>
                    }
                  />
                ))
              ))}

            {tab === "templates" &&
              (filteredTemplates.length === 0 ? (
                <EmptyState title="No templates saved yet" />
              ) : (
                filteredTemplates.map((t) => (
                  <BroadcastRow
                    key={t.id}
                    meta={<TypeBadge type={t.draft.type} />}
                    title={t.name}
                    actions={
                      <>
                        <IconButton
                          label={engine.broadcasts.favorites.includes(t.id) ? "Unfavorite" : "Favorite"}
                          onClick={() => toggleFavoriteTemplate(t.id)}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              engine.broadcasts.favorites.includes(t.id) && "fill-status-orange text-status-orange"
                            )}
                            strokeWidth={2}
                          />
                        </IconButton>
                        <IconButton label="Use template" onClick={() => loadIntoCompose(t.draft)}>
                          <Copy className="h-4 w-4" strokeWidth={2} />
                        </IconButton>
                        <IconButton
                          label="Delete"
                          onClick={() => destructiveConfirm.request({ kind: "delete-template", id: t.id, name: t.name })}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </IconButton>
                      </>
                    }
                  />
                ))
              ))}

            {tab === "drafts" &&
              (engine.broadcasts.drafts.length === 0 ? (
                <EmptyState title="No drafts saved" />
              ) : (
                engine.broadcasts.drafts.map((d, i) => (
                  <BroadcastRow
                    key={i}
                    meta={<TypeBadge type={d.type} />}
                    title={d.title || "Untitled draft"}
                    actions={
                      <>
                        <IconButton label="Load" onClick={() => loadIntoCompose(d)}>
                          <Copy className="h-4 w-4" strokeWidth={2} />
                        </IconButton>
                        <IconButton
                          label="Delete"
                          onClick={() => destructiveConfirm.request({ kind: "delete-draft", index: i, title: d.title || "Untitled draft" })}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </IconButton>
                      </>
                    }
                  />
                ))
              ))}
          </div>
        </div>
      </div>

      {/* Shows the exact broadcast body and a real target-health summary,
          not just the preset name and a generic "every display" claim —
          the 2026-09-01 audit's KF-031 specifically wanted "exact target/
          affected-display summary" before a venue-wide emergency override
          arms. Registered-display count, not an online-filtered one: for a
          decision this consequential, undercounting (a display that just
          reconnected) is the more dangerous direction to round toward. */}
      <ConfirmDialog
        open={emergencyConfirm.isOpen}
        title={`Send "${emergencyConfirm.pending?.title}" to every display?`}
        description={`"${emergencyConfirm.pending?.message}" — takes over ${registeredCount} registered display${registeredCount === 1 ? "" : "s"} immediately (${registeredHealthCounts.online} online, ${registeredHealthCounts.stale} stale, ${registeredHealthCounts.offline} offline). Send an update or Clear afterward if needed.`}
        confirmLabel="Send Emergency"
        tone="danger"
        loading={emergencySending}
        onConfirm={async () => {
          const preset = emergencyConfirm.pending;
          if (!preset || emergencySendingRef.current) return;
          emergencySendingRef.current = true;
          setEmergencySending(true);
          const res = await sendBroadcast({
            ...EMPTY_DRAFT,
            type: "emergency",
            title: preset.title,
            message: preset.message,
            priority: 3,
            target: { kind: "all" },
            acknowledgementRequired: true,
            persistent: true,
          });
          emergencySendingRef.current = false;
          setEmergencySending(false);
          emergencyConfirm.cancel();
          if (res && res.ok) toast.success("Emergency broadcast sent");
          else toast.error("Couldn't send the emergency broadcast — try again immediately");
        }}
        onCancel={emergencyConfirm.cancel}
      />

      <ConfirmDialog
        open={confirmSendOpen}
        title={
          isScheduling && draft.type === "emergency"
            ? "Schedule this emergency broadcast?"
            : isScheduling
              ? "Schedule this broadcast?"
              : "Send this emergency broadcast now?"
        }
        description={
          isScheduling
            ? `This fires automatically at ${draft.scheduledFor ? new Date(draft.scheduledFor).toLocaleString() : "the selected time"} with no further confirmation — double check the date and time. You can cancel it from the Scheduled tab any time before then.${draft.type === "emergency" ? " As an emergency broadcast, it will take over every connected screen the moment it fires." : ""}`
            : "This takes over every connected screen immediately."
        }
        confirmLabel={isScheduling ? "Schedule" : "Send Emergency"}
        tone={draft.type === "emergency" ? "danger" : "default"}
        loading={sending}
        onConfirm={async () => {
          await handleSend();
          setConfirmSendOpen(false);
        }}
        onCancel={() => setConfirmSendOpen(false)}
      />

      <ConfirmDialog
        open={destructiveConfirm.isOpen}
        title={
          destructiveConfirm.pending?.kind === "clear-emergencies"
            ? "Clear the active emergency broadcast?"
            : destructiveConfirm.pending?.kind === "cancel-scheduled"
              ? `Cancel "${destructiveConfirm.pending.title}"?`
              : destructiveConfirm.pending?.kind === "delete-template"
                ? `Delete template "${destructiveConfirm.pending.name}"?`
                : destructiveConfirm.pending?.kind === "delete-draft"
                  ? `Delete draft "${destructiveConfirm.pending.title}"?`
                  : ""
        }
        description={
          destructiveConfirm.pending?.kind === "clear-emergencies"
            ? "This removes it from every connected display."
            : "This can't be undone."
        }
        confirmLabel={destructiveConfirm.pending?.kind === "clear-emergencies" ? "Clear" : "Delete"}
        tone="danger"
        loading={destructiveLoading}
        onConfirm={handleDestructiveConfirm}
        onCancel={destructiveConfirm.cancel}
      />
    </main>
  );
}

function toDraft(m: { type: BroadcastType; title: string; message: string; icon: string | null; priority: 1 | 2 | 3; target: BroadcastDraft["target"]; durationSeconds: number | null; acknowledgementRequired: boolean; persistent: boolean }): BroadcastDraft {
  return {
    type: m.type,
    title: m.title,
    message: m.message,
    icon: m.icon,
    priority: m.priority,
    target: m.target,
    expiresInMinutes: null,
    durationSeconds: m.durationSeconds,
    acknowledgementRequired: m.acknowledgementRequired,
    persistent: m.persistent,
    scheduledFor: null,
  };
}


function TypeBadge({ type }: { type: BroadcastType }) {
  const meta = BROADCAST_TYPE_META[type];
  const Icon = meta.Icon;
  return (
    <Badge tone={meta.tone}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {meta.label}
    </Badge>
  );
}

function BroadcastRow({
  meta,
  title,
  message,
  footer,
  actions,
}: {
  meta: React.ReactNode;
  title: string;
  message?: string;
  footer?: string;
  actions: React.ReactNode;
}) {
  return (
    <Panel className="px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">{meta}</div>
        <p className="text-console-sm text-primary font-medium mt-1.5">{title}</p>
        {message && <p className="text-console-meta text-muted mt-1 line-clamp-2">{message}</p>}
        {footer && <p className="text-console-meta text-muted-2 mt-1">{footer}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </Panel>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "primary" : "ghost"} size="sm" onClick={onClick} className="rounded-full">
      {children}
    </Button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <Button type="button" variant="ghost" size="sm" square onClick={onClick} disabled={disabled} aria-label={label}>
        {children}
      </Button>
    </Tooltip>
  );
}

// Wraps a control in the canonical Tooltip only while `when` is true — the
// permission note only needs saying at the moment a control is actually
// disabled by it. Same helper as app/e/[eventId]/displays/page.tsx's own
// MaybeTooltip.
function MaybeTooltip({ when, content, children }: { when: boolean; content: string; children: React.ReactElement }) {
  return when ? <Tooltip content={content}>{children}</Tooltip> : children;
}
