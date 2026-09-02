"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Eye, Maximize, Megaphone, Presentation, RotateCw, Send, Trash2, Tv, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/auth-context";
import { useEventId } from "@/lib/event-context";
import { useDisplayEngine, useTransportStatus } from "@/lib/display-engine/store";
import { getDisplayStatus, type DisplayHealth } from "@/lib/display-engine/use-register-display";
import type { TransportStatus } from "@/lib/display-engine/transport";
import type { DisplayInstance, DisplayType } from "@/lib/display-engine/types";
import { EventNav } from "@/components/operator/event-nav";
import { EventIdentity } from "@/components/operator/event-identity";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalStatus } from "@/components/ui/operational-status";
import { ConnectionBadge, type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileEditor } from "@/components/display-engine/profile-editor";
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

// The 4 canonical display types (Operator/Remote aren't Display Engine
// surfaces, so they're not here).
const DISPLAY_TYPES: { value: DisplayType; label: string; route: string }[] = [
  { value: "presenter", label: "Presenter", route: "/presenter" },
  { value: "green-room", label: "Green Room", route: "/green-room" },
  { value: "av", label: "AV", route: "/av" },
  { value: "general", label: "General", route: "/general" },
  { value: "custom", label: "Custom", route: "/presenter" },
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

// Wraps a control in the canonical Tooltip only while `when` is true — used
// for the maintenance actions below, which are only worth explaining at the
// moment they're actually disabled. A bare native title= attribute was the
// prior implementation (2026-09-01 audit's own count of 56 such uses across
// the app); this is the real, focus-reachable replacement.
function MaybeTooltip({ when, content, children }: { when: boolean; content: string; children: React.ReactElement }) {
  return when ? <Tooltip content={content}>{children}</Tooltip> : children;
}

type ConfirmAction =
  | { kind: "reassign-type"; id: string; name: string; type: DisplayType }
  | { kind: "reload"; id: string; name: string }
  | { kind: "remove"; id: string; name: string }
  | { kind: "reload-all-offline"; ids: string[] }
  | { kind: "remove-all-offline"; ids: string[] };

export default function DisplayManagerPage() {
  const eventId = useEventId();
  const { lock } = useAuth();
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
    confirmingRef.current = action;
    setConfirming(true);
    switch (action.kind) {
      case "reassign-type": {
        const res = await assignDisplay(action.id, { type: action.type });
        if (!res || !res.ok) toast.error(`Couldn't change ${action.name}'s type — try again`);
        break;
      }
      case "reload": {
        const res = await sendCommand(action.id, { type: "reload", issuedAt: new Date().toISOString() });
        if (res && res.ok) toast.success(`Reload sent to ${action.name}`);
        else toast.error(`Couldn't reload ${action.name} — try again`);
        break;
      }
      case "remove": {
        const res = await removeDisplay(action.id);
        if (res && res.ok) toast.success(`${action.name} removed`);
        else toast.error(`Couldn't remove ${action.name} — try again`);
        break;
      }
      case "reload-all-offline": {
        const results = await Promise.all(
          action.ids.map((id) => sendCommand(id, { type: "reload", issuedAt: new Date().toISOString() }))
        );
        const failed = results.filter((res) => !res || !res.ok).length;
        const sent = action.ids.length - failed;
        if (sent > 0) toast.success(`Reload queued for ${sent} offline display${sent === 1 ? "" : "s"} — it'll apply once each reconnects`);
        if (failed > 0) toast.error(`Couldn't queue reload for ${failed} of them — try again`);
        break;
      }
      case "remove-all-offline": {
        const results = await Promise.all(action.ids.map((id) => removeDisplay(id)));
        const failed = results.filter((res) => !res || !res.ok).length;
        const removed = action.ids.length - failed;
        if (removed > 0) toast.success(`Removed ${removed} offline display${removed === 1 ? "" : "s"}`);
        if (failed > 0) toast.error(`Couldn't remove ${failed} of them — try again`);
        break;
      }
    }
    setConfirming(false);
    confirmAction.cancel();
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-12 py-4 xl:py-6 border-b border-white/5 flex-wrap">
        <div className="min-w-0">
          <EventIdentity />
          <div className="flex items-center flex-wrap gap-2.5 mt-1.5">
            <h1 className="text-console-lg text-primary">Displays</h1>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => confirmAction.request({ kind: "reload-all-offline", ids: offlineDisplays.map((d) => d.id) })}
              >
                <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                Reload offline ({offlineDisplays.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirmAction.request({ kind: "remove-all-offline", ids: offlineDisplays.map((d) => d.id) })}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Remove all offline
              </Button>
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
            body="Open a display route (e.g. /presenter) on a device to see it here — registration happens automatically, no setup step needed."
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
                  expanded={expandedId === display.id}
                  onToggleExpand={() => setExpandedId(expandedId === display.id ? null : display.id)}
                  profiles={Object.values(engine.profiles)}
                  onRename={(name) => renameDisplay(display.id, name)}
                  onRoom={(room) => assignDisplay(display.id, { room })}
                  onProfile={(profileId) => assignDisplay(display.id, { profileId })}
                  onRequestTypeChange={(type) =>
                    confirmAction.request({ kind: "reassign-type", id: display.id, name: display.name, type })
                  }
                  onPreview={() => setPreviewing(display)}
                  onScreenshot={() => void takeScreenshot(display)}
                  onForceFullscreen={async () => {
                    const res = await sendCommand(display.id, { type: "force-fullscreen", issuedAt: new Date().toISOString() });
                    if (!res || !res.ok) toast.error(`Couldn't force fullscreen on ${display.name} — try again`);
                  }}
                  onOpenMessage={() => setMessagingId(display.id)}
                  onRequestReload={() => confirmAction.request({ kind: "reload", id: display.id, name: display.name })}
                  onRequestRemove={() => confirmAction.request({ kind: "remove", id: display.id, name: display.name })}
                />
              );
            })}
          </div>
        )}

        <ProfileEditor />
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
          <div className="w-full max-w-5xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <p className="text-console-md text-primary font-medium">{previewing.name} — live preview</p>
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
          else toast.error("Couldn't send the test message — try again");
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
                ? "Each one applies the reload once its device reconnects — nothing happens to a device that stays offline."
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
  expanded,
  onToggleExpand,
  profiles,
  onRename,
  onRoom,
  onProfile,
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
  expanded: boolean;
  onToggleExpand: () => void;
  profiles: { id: string; name: string }[];
  onRename: (name: string) => void;
  onRoom: (room: string | null) => void;
  onProfile: (profileId: string | null) => void;
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

  const disabledReason = "This display is offline — nothing is listening to respond.";

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
              : `Seen ${formatRelativeAge(now - Date.parse(display.lastSeenAt))} ago`}
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
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim() && nameDraft !== display.name) onRename(nameDraft.trim());
                }}
                aria-label="Display name"
                className="w-48"
              />
              <Select
                value={display.type}
                onChange={(v) => onRequestTypeChange(v as DisplayType)}
                options={DISPLAY_TYPES}
                searchable={false}
                className="w-auto min-w-[9rem]"
                aria-label={`Display type for ${display.name}`}
              />
              <Input
                value={roomDraft}
                onChange={(e) => setRoomDraft(e.target.value)}
                onBlur={() => {
                  if (roomDraft !== (display.room ?? "")) onRoom(roomDraft || null);
                }}
                placeholder="Room (optional)"
                className="w-40"
                aria-label={`Room for ${display.name}`}
              />
              <Select
                value={display.profileId ?? ""}
                onChange={(v) => onProfile(v || null)}
                options={[{ value: "", label: "No profile" }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
                searchable={false}
                className="w-auto min-w-[9rem]"
                aria-label={`Profile for ${display.name}`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SectionLabel>Diagnose</SectionLabel>
              <span className="text-console-meta text-muted-2" title={new Date(display.lastSeenAt).toLocaleString()}>
                Last seen {formatRelativeAge(now - Date.parse(display.lastSeenAt))} ago
              </span>
            </div>
            {/* Screenshot/Force Fullscreen/Test Message all send a command
                to *this specific* connected client — with none listening,
                they previously looked identical to a working command, just
                one that silently did nothing (2026-09-01 UI/UX audit
                finding #12: "false confidence from no-op commands").
                Disabled with a reason instead of quietly eating the click. */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <MaybeTooltip when={status === "offline"} content={disabledReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onScreenshot}
                  disabled={status === "offline"}
                  aria-label={`Screenshot ${display.name}`}
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={2} />
                  Screenshot
                </Button>
              </MaybeTooltip>
              <MaybeTooltip when={status === "offline"} content={disabledReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onForceFullscreen}
                  disabled={status === "offline"}
                  aria-label={`Force fullscreen on ${display.name}`}
                >
                  <Maximize className="h-3.5 w-3.5" strokeWidth={2} />
                  Force Fullscreen
                </Button>
              </MaybeTooltip>
              <MaybeTooltip when={status === "offline"} content={disabledReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenMessage}
                  disabled={status === "offline"}
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
                  live listener to mean anything. */}
              <Button variant="secondary" size="sm" onClick={onRequestReload} aria-label={`Reload or reconnect ${display.name}`}>
                <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                Reload / Reconnect
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-line-soft">
            <p className="text-console-meta text-muted-2">Registered {new Date(display.registeredAt).toLocaleDateString()}</p>
            <Button variant="danger" size="sm" onClick={onRequestRemove} aria-label={`Remove ${display.name}`}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Remove
            </Button>
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
