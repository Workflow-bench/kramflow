"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Eye, Maximize, Megaphone, Presentation, RotateCw, Send, Trash2, Tv, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEventId, useIsOwner } from "@/lib/event-context";
import { useDisplayEngine, useTransportStatus } from "@/lib/display-engine/store";
import { getDisplayStatus, type DisplayHealth } from "@/lib/display-engine/use-register-display";
import type { TransportStatus } from "@/lib/display-engine/transport";
import { DISPLAY_TYPES, type DisplayInstance, type DisplayType } from "@/lib/display-engine/types";
import { EventShellHeader } from "@/components/operator/event-shell-header";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalStatus } from "@/components/ui/operational-status";
import { type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MaybeTooltip, Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatRelativeAge } from "@/lib/utils";

// Everything about outputs in one place — previews, the connected-display
// registry, and Broadcast Center — rather than previews sitting as flat
// top-level tabs while the registry and broadcast lived one click further
// away in an overflow menu. See kramflow_nav_layout_ground_up.md.
const PREVIEW_LINKS: { path: string; label: string; icon: typeof Tv }[] = [
  { path: "/general", label: "General", icon: Tv },
  { path: "/av", label: "AV", icon: Tv },
  { path: "/green-room", label: "Green Room", icon: Tv },
  { path: "/presenter", label: "Presenter", icon: Presentation },
];

function routeFor(type: DisplayType): string {
  return DISPLAY_TYPES.find((t) => t.value === type)?.route ?? "/presenter";
}

function typeLabel(type: DisplayType): string {
  return DISPLAY_TYPES.find((t) => t.value === type)?.label ?? type;
}

// The Display Engine's own live-connection transport (this browser tab's
// Realtime channel to the registry) is a different signal from any one
// display's heartbeat-derived health below — this maps it onto the same
// three-word vocabulary the rest of Kramflow already uses for "is this
// screen actually talking to the server," rather than the page's previous
// bespoke Wifi/WifiOff icon-and-caption pair.
function toConnectionStatus(status: TransportStatus): ConnectionBadgeStatus {
  if (status === "open") return "connected";
  if (status === "connecting") return "reconnecting";
  return "disconnected";
}

const FILTERS: { id: "all" | DisplayHealth; label: string }[] = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "stale", label: "Stale" },
  { id: "offline", label: "Offline" },
];

type ConfirmAction =
  | { kind: "reassign-type"; id: string; name: string; type: DisplayType }
  | { kind: "reload"; id: string; name: string }
  | { kind: "remove"; id: string; name: string }
  | { kind: "reload-all-offline"; ids: string[] }
  | { kind: "remove-all-offline"; ids: string[] };

// P1 permission-truth fix (2026-09) — every mutating fleet action
// (rename, type/room reassignment, the three diagnose commands, remove
// single/all-offline) routes through app/api/display-engine/registry/
// [id]/route.ts's PATCH or DELETE, both requireEventAccess(..., "owner")
// uniformly — no per-action distinction there. Registering/heartbeating
// (the display client's own background process, not an operator action)
// and Preview/Capture Screen (read-only, no mutating call) are the only
// things on this page that aren't owner-gated.
const OWNER_ONLY_NOTE = "Only the event owner can manage the display fleet.";

// Gating above should make a 403 unreachable in normal use — a stale role
// (permission changed while this tab stayed open) or a bypassed disabled
// control is the only way to still hit one, so say that plainly instead of
// a generic failure that leaves the operator guessing why a click that
// looked available just failed.
function forbiddenAware(res: Response | null | undefined | void, genericMessage: string): string {
  return res?.status === 403 ? "You no longer have permission to perform this action." : genericMessage;
}

export default function DisplayManagerPage() {
  const eventId = useEventId();
  const isOwner = useIsOwner();
  const { state: engine, renameDisplay, assignDisplay, removeDisplay, sendCommand } = useDisplayEngine();
  const transportStatus = useTransportStatus();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [previewing, setPreviewing] = useState<DisplayInstance | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | DisplayHealth>("all");
  const confirmAction = useConfirmDialog<ConfirmAction>();
  const confirmingRef = useRef<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const displays = Object.values(engine.registry).sort((a, b) => Date.parse(b.registeredAt) - Date.parse(a.registeredAt));
  const counts = displays.reduce(
    (acc, d) => {
      acc[getDisplayStatus(d, now)]++;
      return acc;
    },
    { online: 0, stale: 0, offline: 0 } as Record<DisplayHealth, number>
  );
  const offlineDisplays = displays.filter((d) => getDisplayStatus(d, now) === "offline");
  const visibleDisplays = filter === "all" ? displays : displays.filter((d) => getDisplayStatus(d, now) === filter);

  async function takeScreenshot(display: DisplayInstance) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      window.alert("Screen capture isn't supported in this browser. Use the Preview button instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Give the decoder a frame to render before capturing it.
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      track.stop();

      const link = document.createElement("a");
      link.download = `${display.name.replace(/\s+/g, "-").toLowerCase()}-screenshot.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // User cancelled the native picker, or capture failed — no-op.
    }
  }

  async function handleConfirm() {
    const action = confirmAction.pending;
    // ConfirmDialog's own confirm button has no disabled-while-submitting
    // state, so a rapid double-click fires this handler twice before either
    // the dialog closes or React commits state — both invocations would
    // otherwise still see the same `action`. A ref catches the second one;
    // confirmed live that the identical race lets a state-only guard through
    // (5 rapid clicks -> 5 live broadcasts on Broadcast Center's Send Now).
    if (!action || confirmingRef.current === action) return;
    // Visual gating (disabled + tooltip on every owner-only control below)
    // is the primary fix — this is the defense-in-depth backstop, same
    // pattern as Remote's run(), so a stale role or a bypassed control
    // never depends on a round trip to say something true.
    if (!isOwner) {
      toast.error(OWNER_ONLY_NOTE);
      confirmAction.cancel();
      return;
    }
    confirmingRef.current = action;
    setConfirming(true);
    try {
      switch (action.kind) {
        case "reassign-type": {
          const res = await assignDisplay(action.id, { type: action.type });
          if (!res || !res.ok) toast.error(forbiddenAware(res, `Couldn't change ${action.name}'s type. Try again.`));
          break;
        }
        case "reload": {
          const res = await sendCommand(action.id, { type: "reload", issuedAt: new Date().toISOString() });
          if (res && res.ok) toast.success(`Reload sent to ${action.name}`);
          else toast.error(forbiddenAware(res, `Couldn't reload ${action.name}. Try again.`));
          break;
        }
        case "remove": {
          const res = await removeDisplay(action.id);
          if (res && res.ok) toast.success(`${action.name} removed`);
          else toast.error(forbiddenAware(res, `Couldn't remove ${action.name}. Try again.`));
          break;
        }
        case "reload-all-offline": {
          const results = await Promise.all(
            action.ids.map((id) => sendCommand(id, { type: "reload", issuedAt: new Date().toISOString() }))
          );
          const failed = results.filter((res) => !res || !res.ok).length;
          const sent = action.ids.length - failed;
          if (sent > 0) toast.success(`Reload queued for ${sent} offline display${sent === 1 ? "" : "s"}. It'll apply once each reconnects.`);
          if (failed > 0) toast.error(forbiddenAware(results.find((res) => !res || !res.ok), `Couldn't queue reload for ${failed} of them. Try again.`));
          break;
        }
        case "remove-all-offline": {
          const results = await Promise.all(action.ids.map((id) => removeDisplay(id)));
          const failed = results.filter((res) => !res || !res.ok).length;
          const removed = action.ids.length - failed;
          if (removed > 0) toast.success(`Removed ${removed} offline display${removed === 1 ? "" : "s"}`);
          if (failed > 0) toast.error(forbiddenAware(results.find((res) => !res || !res.ok), `Couldn't remove ${failed} of them. Try again.`));
          break;
        }
      }
    } finally {
      confirmingRef.current = null;
      setConfirming(false);
      confirmAction.cancel();
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <EventShellHeader title="Displays" connectionStatus={toConnectionStatus(transportStatus)} />

      <div className="px-4 sm:px-6 xl:px-12 py-8">
        <SectionLabel>Preview a display</SectionLabel>
        <div className="flex flex-wrap gap-2 mt-3">
          {PREVIEW_LINKS.map(({ path, label, icon: Icon }) => (
            <LinkButton
              key={path}
              href={`${path}?eventId=${encodeURIComponent(eventId)}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {label}
            </LinkButton>
          ))}
        </div>

        <Panel className="flex items-center justify-between gap-4 flex-wrap p-5 mt-6">
          <div className="flex items-center gap-3 min-w-0">
            <Megaphone className="h-5 w-5 text-muted-2 shrink-0" strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-console-sm text-primary font-medium">Broadcast Center</p>
              <p className="text-console-meta text-muted-2">Push alerts, reminders, and emergency overrides to every display.</p>
            </div>
          </div>
          <LinkButton href={`/e/${eventId}/broadcast`} className="shrink-0" variant="secondary" size="sm">
            Open Broadcast Center
          </LinkButton>
        </Panel>

        {/* Fleet summary — triage before configuration. Real counts derived
            from each display's own heartbeat age, not a separate invented
            health system; "N online/stale/offline" only render once
            there's at least one registered display to summarize. */}
        <div className="flex items-start justify-between gap-4 flex-wrap mt-8">
          <div className="flex items-center gap-3 flex-wrap">
            <SectionLabel>Display Fleet</SectionLabel>
            {displays.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {counts.online > 0 && <OperationalStatus kind="online" label={`${counts.online} online`} />}
                {counts.stale > 0 && <OperationalStatus kind="stale" label={`${counts.stale} stale`} />}
                {counts.offline > 0 && <OperationalStatus kind="offline" label={`${counts.offline} offline`} />}
              </div>
            )}
          </div>
          {/* Reload is the recovery action — it works precisely because a
              display is unresponsive, queuing for whenever it reconnects —
              so it gets the stronger of the two bulk affordances. Remove is
              administrative cleanup, not something reached for under
              pressure, so it stays one tier quieter (ghost, not secondary)
              rather than matching or outweighing recovery (2026-09-01 audit
              finding: destructive cleanup outweighing recovery). */}
          {offlineDisplays.length > 0 && (
            <div className="flex items-center gap-2">
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isOwner}
                  onClick={() => confirmAction.request({ kind: "reload-all-offline", ids: offlineDisplays.map((d) => d.id) })}
                >
                  <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                  Reload offline ({offlineDisplays.length})
                </Button>
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isOwner}
                  onClick={() => confirmAction.request({ kind: "remove-all-offline", ids: offlineDisplays.map((d) => d.id) })}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Remove all offline
                </Button>
              </MaybeTooltip>
            </div>
          )}
        </div>

        {displays.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-4" role="group" aria-label="Filter displays by health">
            {FILTERS.filter((f) => f.id !== "stale" || counts.stale > 0).map((f) => {
              const count = f.id === "all" ? displays.length : counts[f.id];
              return (
                <Button
                  key={f.id}
                  variant={filter === f.id ? "primary" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {displays.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="No displays have registered yet"
            body="Open a display route (e.g. /presenter) on a device to see it here. Registration happens automatically, no setup step needed."
          />
        ) : visibleDisplays.length === 0 ? (
          <p className="text-console-sm text-muted-2 mt-6">No displays are currently {filter}.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {visibleDisplays.map((display) => {
              const status = getDisplayStatus(display, now);
              return (
                <DisplayRow
                  key={display.id}
                  display={display}
                  status={status}
                  now={now}
                  isOwner={isOwner}
                  expanded={expandedId === display.id}
                  onToggleExpand={() => setExpandedId(expandedId === display.id ? null : display.id)}
                  onRename={async (name) => {
                    const res = await renameDisplay(display.id, name);
                    if (!res || !res.ok) toast.error(forbiddenAware(res, `Couldn't rename ${display.name}. Try again.`));
                  }}
                  onRoom={async (room) => {
                    const res = await assignDisplay(display.id, { room });
                    if (!res || !res.ok) toast.error(forbiddenAware(res, `Couldn't update ${display.name}'s room. Try again.`));
                  }}
                  onRequestTypeChange={(type) =>
                    confirmAction.request({ kind: "reassign-type", id: display.id, name: display.name, type })
                  }
                  onPreview={() => setPreviewing(display)}
                  onScreenshot={() => void takeScreenshot(display)}
                  onForceFullscreen={async () => {
                    const res = await sendCommand(display.id, { type: "force-fullscreen", issuedAt: new Date().toISOString() });
                    if (!res || !res.ok) toast.error(forbiddenAware(res, `Couldn't force fullscreen on ${display.name}. Try again.`));
                  }}
                  onOpenMessage={() => setMessagingId(display.id)}
                  onRequestReload={() => confirmAction.request({ kind: "reload", id: display.id, name: display.name })}
                  onRequestRemove={() => confirmAction.request({ kind: "remove", id: display.id, name: display.name })}
                />
              );
            })}
          </div>
        )}
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
          <div className="w-full max-w-5xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <p className="text-console-md text-primary font-medium">{previewing.name}: live preview</p>
                <Badge tone="muted">{typeLabel(previewing.type)}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewing(null)} aria-label="Close preview">
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
            <div className="rounded-panel overflow-hidden bg-background border border-line-soft aspect-video">
              <iframe
                src={`${routeFor(previewing.type)}?eventId=${encodeURIComponent(eventId)}`}
                title={`${previewing.name} preview`}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      <TestMessageDialog
        open={messagingId !== null}
        onClose={() => setMessagingId(null)}
        onSend={async (text) => {
          const id = messagingId;
          setMessagingId(null);
          if (!id) return;
          const res = await sendCommand(id, { type: "test-message", text, issuedAt: new Date().toISOString() });
          if (res && res.ok) toast.success("Test message sent");
          else toast.error(forbiddenAware(res, "Couldn't send the test message. Try again."));
        }}
      />

      <ConfirmDialog
        open={confirmAction.isOpen}
        title={
          confirmAction.pending?.kind === "reassign-type"
            ? `Change ${confirmAction.pending.name}'s display type?`
            : confirmAction.pending?.kind === "reload"
              ? `Reload ${confirmAction.pending.name}?`
              : confirmAction.pending?.kind === "remove"
                ? `Remove ${confirmAction.pending.name}?`
                : confirmAction.pending?.kind === "reload-all-offline"
                  ? `Reload ${confirmAction.pending.ids.length} offline display${confirmAction.pending.ids.length === 1 ? "" : "s"}?`
                  : confirmAction.pending?.kind === "remove-all-offline"
                    ? `Remove ${confirmAction.pending.ids.length} offline display${confirmAction.pending.ids.length === 1 ? "" : "s"}?`
                    : ""
        }
        description={
          confirmAction.pending?.kind === "reassign-type"
            ? "This changes what content this physical display shows."
            : confirmAction.pending?.kind === "reload"
              ? "This interrupts whatever's currently on that screen."
              : confirmAction.pending?.kind === "reload-all-offline"
                ? "Each one applies the reload once its device reconnects. Nothing happens to a device that stays offline."
                : confirmAction.pending?.kind === "remove-all-offline"
                  ? "Each one will reappear automatically if its device is still open on a display route."
                  : "This removes it from the registry. It'll reappear automatically if the device is still open on a display route."
        }
        confirmLabel={
          confirmAction.pending?.kind === "reassign-type"
            ? "Change Type"
            : confirmAction.pending?.kind === "reload" || confirmAction.pending?.kind === "reload-all-offline"
              ? "Reload"
              : "Remove"
        }
        tone={confirmAction.pending?.kind === "reload-all-offline" ? "default" : "danger"}
        loading={confirming}
        onConfirm={handleConfirm}
        onCancel={confirmAction.cancel}
      />
    </main>
  );
}

function DisplayRow({
  display,
  status,
  now,
  isOwner,
  expanded,
  onToggleExpand,
  onRename,
  onRoom,
  onRequestTypeChange,
  onPreview,
  onScreenshot,
  onForceFullscreen,
  onOpenMessage,
  onRequestReload,
  onRequestRemove,
}: {
  display: DisplayInstance;
  status: DisplayHealth;
  now: number;
  isOwner: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: (name: string) => void;
  onRoom: (room: string | null) => void;
  onRequestTypeChange: (type: DisplayType) => void;
  onPreview: () => void;
  onScreenshot: () => void;
  onForceFullscreen: () => void;
  onOpenMessage: () => void;
  onRequestReload: () => void;
  onRequestRemove: () => void;
}) {
  // Local draft state, committed on blur — renameDisplay/assignDisplay
  // used to fire on every keystroke (onChange), mutating the shared
  // registry (visible in Display Manager on every other device) with no
  // discrete commit step at all. Resetting the draft when the underlying
  // value changes externally is done during render (React's documented
  // "adjusting state when a prop changes" pattern), not in a useEffect.
  const [nameDraft, setNameDraft] = useState(display.name);
  const [trackedName, setTrackedName] = useState(display.name);
  if (display.name !== trackedName) {
    setTrackedName(display.name);
    setNameDraft(display.name);
  }

  const [roomDraft, setRoomDraft] = useState(display.room ?? "");
  const [trackedRoom, setTrackedRoom] = useState(display.room ?? "");
  if ((display.room ?? "") !== trackedRoom) {
    setTrackedRoom(display.room ?? "");
    setRoomDraft(display.room ?? "");
  }

  const disabledReason = "This display is offline. Nothing is listening to respond.";
  // Two independent reasons a diagnose command can be unavailable — not
  // owner, or the display isn't listening — combined into one disabled
  // state with whichever reason is actually true (owner takes priority:
  // it's the more fundamental gate, and remains true regardless of the
  // display's own online/offline status).
  const diagnoseDisabled = !isOwner || status === "offline";
  const diagnoseReason = !isOwner ? OWNER_ONLY_NOTE : disabledReason;

  return (
    // Named region, not just a visual card — every action button inside
    // still carries its own device-specific aria-label too (below), but a
    // screen-reader user landing on this group via rotor/landmark
    // navigation gets "AV Waiting Room" immediately rather than needing to
    // read every button label first to figure out which display they're in.
    <div className="rounded-panel bg-card border border-line-soft" role="group" aria-label={display.name}>
      {/* SCAN row — always visible, never requires expanding. Preview sits
          outside the expand toggle on purpose (a sibling button, not
          nested inside it): it's the one action reached for constantly
          while checking a show is on track, so it can't be gated behind
          "first open this device's settings." */}
      <div className="flex items-center gap-2 px-5 py-4">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${display.name}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <OperationalStatus kind={status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-console-row font-medium text-primary truncate">{display.name}</span>
              <Badge tone="muted" className="shrink-0">
                {typeLabel(display.type)}
              </Badge>
              {display.room && <span className="text-console-meta text-muted-2 truncate">{display.room}</span>}
            </div>
          </div>
          <span className="hidden sm:inline text-console-meta text-muted-2 tabular-nums shrink-0">
            {status === "online" && display.latencyMs !== null
              ? `${Math.round(display.latencyMs)}ms`
              : `Seen ${formatRelativeAge(now - Date.parse(display.lastSeenAt))}`}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
          )}
        </button>
        <Button variant="primary" size="sm" onClick={onPreview} className="shrink-0" aria-label={`Preview ${display.name}`}>
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Preview</span>
        </Button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-line-soft flex flex-col gap-5">
          <div>
            <SectionLabel>Configure</SectionLabel>
            {/* Rename/type/room all route through app/api/display-engine/
                registry/[id]/route.ts's PATCH, owner-gated uniformly — see
                this file's own OWNER_ONLY_NOTE comment. Disabled + tooltip
                for a non-owner rather than letting the field accept input
                that will only 403 silently on blur. */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => {
                    if (nameDraft.trim() && nameDraft !== display.name) onRename(nameDraft.trim());
                  }}
                  disabled={!isOwner}
                  aria-label="Display name"
                  className="w-48"
                />
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Select
                  value={display.type}
                  onChange={(v) => onRequestTypeChange(v as DisplayType)}
                  options={DISPLAY_TYPES}
                  searchable={false}
                  disabled={!isOwner}
                  className="w-auto min-w-[9rem]"
                  aria-label={`Display type for ${display.name}`}
                />
              </MaybeTooltip>
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Input
                  value={roomDraft}
                  onChange={(e) => setRoomDraft(e.target.value)}
                  onBlur={() => {
                    if (roomDraft !== (display.room ?? "")) onRoom(roomDraft || null);
                  }}
                  disabled={!isOwner}
                  placeholder="Room (optional)"
                  className="w-40"
                  aria-label={`Room for ${display.name}`}
                />
              </MaybeTooltip>
              {/* Display Profiles (font scale, layout, widget visibility,
                  color overrides) removed from this surface — same "false
                  confidence" failure mode as the offline-disabled commands
                  below, but worse: profile *content* lives only in the
                  editing browser's localStorage (lib/display-engine/store.tsx),
                  never reaches app/api/display-view/route.ts's payload, and
                  none of the four real display clients (Presenter/AV/Green
                  Room/General) read a profile field at all — so assigning one
                  here would look like it configures a display's real output
                  and would silently do nothing. display.profileId itself
                  (the assignment) is still persisted to display_registry —
                  intact for whenever the read path is actually built. See
                  2026-09 blocker-remediation pass, Display Profiles P2. */}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SectionLabel>Diagnose</SectionLabel>
              <span className="text-console-meta text-muted-2" title={new Date(display.lastSeenAt).toLocaleString()}>
                Last seen {formatRelativeAge(now - Date.parse(display.lastSeenAt))}
              </span>
            </div>
            {/* Force Fullscreen/Test Message send a real command to *this
                specific* connected client — with none listening, they
                previously looked identical to a working command, just one
                that silently did nothing (2026-09-01 UI/UX audit finding
                #12: "false confidence from no-op commands"). Disabled with
                a reason instead of quietly eating the click.
                "Screenshot" (still Capture Screen below) was never actually
                one of these — it never called sendCommand at all. It opens
                the *operator's own* browser's native getDisplayMedia()
                picker (see takeScreenshot() above), so it can only ever
                capture whatever screen/window/tab the operator selects on
                their own machine — unrelated to display.name unless the
                operator happens to be looking at that device's real output
                right now (e.g. via Preview in another window). Labeling it
                "Screenshot {display.name}" claimed a remote-capture
                capability that doesn't exist — same false-confidence shape
                as the other three, just not fixable by an offline-disable
                since it was never actually reaching the display in the
                first place. Relabeled instead, with a tooltip stating
                plainly what it does, and no longer gated on display
                status — that status was never actually relevant to it. */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Tooltip content="Opens your own screen-share picker, not a remote capture of this display">
                <Button variant="secondary" size="sm" onClick={onScreenshot} aria-label={`Capture your own screen (manual, not remote to ${display.name})`}>
                  <Camera className="h-3.5 w-3.5" strokeWidth={2} />
                  Capture Screen
                </Button>
              </Tooltip>
              <MaybeTooltip when={diagnoseDisabled} content={diagnoseReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onForceFullscreen}
                  disabled={diagnoseDisabled}
                  aria-label={`Force fullscreen on ${display.name}`}
                >
                  <Maximize className="h-3.5 w-3.5" strokeWidth={2} />
                  Force Fullscreen
                </Button>
              </MaybeTooltip>
              <MaybeTooltip when={diagnoseDisabled} content={diagnoseReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenMessage}
                  disabled={diagnoseDisabled}
                  aria-label={`Send test message to ${display.name}`}
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={2} />
                  Test Message
                </Button>
              </MaybeTooltip>
              {/* Reload/Reconnect stays enabled offline on purpose — it's
                  the one action that's actually *for* an unresponsive
                  display (queues a reload for whenever it comes back /
                  prompts a manual refresh), not a command that needs a
                  live listener to mean anything. Still owner-gated, same
                  as every other fleet-mutation command. */}
              <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                <Button variant="secondary" size="sm" onClick={onRequestReload} disabled={!isOwner} aria-label={`Reload or reconnect ${display.name}`}>
                  <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                  Reload / Reconnect
                </Button>
              </MaybeTooltip>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-line-soft">
            <p className="text-console-meta text-muted-2">Registered {new Date(display.registeredAt).toLocaleDateString()}</p>
            <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
              <Button variant="danger" size="sm" onClick={onRequestRemove} disabled={!isOwner} aria-label={`Remove ${display.name}`}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Remove
              </Button>
            </MaybeTooltip>
          </div>
        </div>
      )}
    </div>
  );
}

// Styled replacement for window.prompt() — typing the message is itself
// the deliberate gate (same reasoning as Alert/Broadcast composers), so
// this doesn't need a second confirm step on top, just a real component
// instead of a native browser dialog.
function TestMessageDialog({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  // Clear the field each time the dialog opens — during render (React's
  // documented "adjusting state when a prop changes" pattern), not a
  // useEffect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setText("");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-sm rounded-panel bg-card border border-line-soft p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-console-md text-primary">Send a test message</h2>
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message to show on this display"
              aria-label="Test message"
              className="mt-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) onSend(text.trim());
              }}
            />
            <div className="flex items-center gap-3 mt-6">
              <Button variant="primary" size="md" className="flex-1" disabled={!text.trim()} onClick={() => onSend(text.trim())}>
                Send
              </Button>
              <Button variant="ghost" size="md" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
