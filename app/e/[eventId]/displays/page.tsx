"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Eye, Link2, Maximize, Megaphone, RotateCw, Send, Trash2, X } from "lucide-react";
import { useEventId, useIsOwner } from "@/lib/event-context";
import { useDisplayEngine, useTransportStatus } from "@/lib/display-engine/store";
import { getDisplayStatus, type DisplayHealth } from "@/lib/display-engine/use-register-display";
import type { TransportStatus } from "@/lib/display-engine/transport";
import { DISPLAY_TYPES, type DisplayInstance, type DisplayType } from "@/lib/display-engine/types";
import { DISPLAY_TYPE_META } from "@/lib/display-engine/display-meta";
import { EventShellHeader } from "@/components/operator/event-shell-header";
import { ShareLinkPanel } from "@/components/dashboard/share-link-panel";
import { DisplayProfilePanel, type DisplayProfilePanelHandle } from "@/components/operator/display-profile-panel";
import { CustomDisplayPreviewMenu } from "@/components/operator/custom-display-preview-menu";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { OperationalStatus } from "@/components/ui/operational-status";
import { type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { MaybeTooltip, Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { isTopmostOverlay, popOverlay, pushOverlay } from "@/components/ui/overlay-stack";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelativeAge } from "@/lib/utils";

// Everything about outputs in one place — previews, the connected-display
// registry, and Broadcast Center — rather than previews sitting as flat
// top-level tabs while the registry and broadcast lived one click further
// away in an overflow menu. See kramflow_nav_layout_ground_up.md. Sourced
// from DISPLAY_TYPES/DISPLAY_TYPE_META (same as app/screens's picker)
// instead of a hand-duplicated array.
const PREVIEW_LINKS = DISPLAY_TYPES.filter((t) => t.value !== "custom").map((t) => ({
  path: t.route,
  label: t.label,
  icon: DISPLAY_TYPE_META[t.value as Exclude<DisplayType, "custom">].Icon,
}));

// A registered custom display's own profile_id decides which profile it
// renders (?profileId=...) — the 4 fixed types still resolve to their one
// static route.
function routeFor(display: { type: DisplayType; profileId: string | null }): string {
  const base = DISPLAY_TYPES.find((t) => t.value === display.type)?.route ?? "/presenter";
  return display.type === "custom" && display.profileId ? `${base}?profileId=${display.profileId}` : base;
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
  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  const profilePanelRef = useRef<DisplayProfilePanelHandle>(null);
  // Just the id/name pairs a custom display's own type row needs to offer
  // a profile picker — DisplayProfilePanel owns the full list/create/edit/
  // delete flow independently; this is a separate, lighter fetch rather
  // than lifting that panel's whole state up, so the two stay decoupled.
  const [profileOptions, setProfileOptions] = useState<{ id: string; name: string }[]>([]);
  function reloadProfileOptions() {
    fetch(`/api/display-engine/profiles?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setProfileOptions(data.profiles.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
  }
  useEffect(() => {
    reloadProfileOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadProfileOptions is redefined each render but only eventId should re-trigger the initial load; DisplayProfilePanel's onChange covers the "list changed" case
  }, [eventId]);
  const confirmAction = useConfirmDialog<ConfirmAction>();
  const confirmingRef = useRef<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Preview lightbox: not a Modal (its fixed max-w-5xl/aspect-video shell
  // doesn't fit Modal's sm/md/lg/xl sizes), but a real overlay all the
  // same — it gets the same Escape/overlay-stack/focus-trap wiring Modal
  // and ConfirmDialog share (components/ui/overlay-stack.ts,
  // use-dialog-focus.ts) rather than inventing a third, thinner standard.
  const [previewOverlayId] = useState(() => Symbol("preview"));
  const previewDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(previewing !== null, previewDialogRef);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!previewing) return;
    pushOverlay(previewOverlayId);
    return () => popOverlay(previewOverlayId);
  }, [previewing, previewOverlayId]);

  useEffect(() => {
    if (!previewing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isTopmostOverlay(previewOverlayId)) setPreviewing(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewing, previewOverlayId]);

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
          {/* A single "+" trigger for custom displays, not one tile per
              profile — a flat list of profile-name tiles read as just
              more fixed screens next to Presenter/AV/etc. This opens a
              dropdown to pick an existing profile to preview, or jump
              straight into creating one (under your own name) when there
              isn't one yet — see CustomDisplayPreviewMenu's own comment. */}
          <CustomDisplayPreviewMenu
            eventId={eventId}
            profiles={profileOptions}
            onCreateProfile={() => profilePanelRef.current?.openCreate()}
          />
        </div>

        {/* Phase 7d: Share Display Link and Broadcast Center were each their
            own bordered Panel, stacked above the fleet — two entry-point
            "cards" competing with the fleet itself for the first thing an
            operator's eye lands on. Same unboxed row treatment now, driven
            by the same field/row grammar as the rest of the redesigned
            product; ShareLinkPanel's own Modal/ConfirmDialog (unchanged) is
            just externally triggered instead of wrapped in a second card. */}
        <div className="mt-6 flex flex-col">
          <div className="flex items-center justify-between gap-4 flex-wrap py-3 border-b border-line-soft">
            <div className="flex items-center gap-3 min-w-0">
              <Link2 className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
              <div className="min-w-0">
                <p className="text-console-sm text-primary">Share Display Link</p>
                <p className="text-console-meta text-muted-2">No-login link + QR for a TV or tablet to pick a screen.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setShareLinkOpen(true)}>
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
              Manage Links
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap py-3 border-b border-line-soft">
            <div className="flex items-center gap-3 min-w-0">
              <Megaphone className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
              <div className="min-w-0">
                <p className="text-console-sm text-primary">Broadcast Center</p>
                <p className="text-console-meta text-muted-2">Push alerts, reminders, and emergency overrides to every display.</p>
              </div>
            </div>
            <LinkButton href={`/e/${eventId}/broadcast`} className="shrink-0" variant="secondary" size="sm">
              Open Broadcast Center
            </LinkButton>
          </div>
          <DisplayProfilePanel ref={profilePanelRef} eventId={eventId} isOwner={isOwner} onChange={reloadProfileOptions} />
        </div>
        <ShareLinkPanel eventId={eventId} open={shareLinkOpen} onOpenChange={setShareLinkOpen} />

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
          <div className="mt-5 flex flex-col border-t border-line-soft">
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
                  profileOptions={profileOptions}
                  onProfile={async (profileId) => {
                    const res = await assignDisplay(display.id, { profileId });
                    if (!res || !res.ok) toast.error(forbiddenAware(res, `Couldn't update ${display.name}'s profile. Try again.`));
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
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewing(null);
          }}
        >
          <div
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${previewing.name}: live preview`}
            tabIndex={-1}
            className="w-full max-w-5xl outline-none"
          >
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
                src={`${routeFor(previewing)}${routeFor(previewing).includes("?") ? "&" : "?"}eventId=${encodeURIComponent(eventId)}`}
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
  profileOptions,
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
  isOwner: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRename: (name: string) => void;
  onRoom: (room: string | null) => void;
  profileOptions: { id: string; name: string }[];
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

  const disabledReason = "This display is offline. Nothing is listening to respond.";
  // Two independent reasons a diagnose command can be unavailable — not
  // owner, or the display isn't listening — combined into one disabled
  // state with whichever reason is actually true (owner takes priority:
  // it's the more fundamental gate, and remains true regardless of the
  // display's own online/offline status).
  const diagnoseDisabled = !isOwner || status === "offline";
  const diagnoseReason = !isOwner ? OWNER_ONLY_NOTE : disabledReason;
  // Reused from the same canonical per-type vocabulary the Preview links
  // above and app/screens's picker already use — not a second display-icon
  // set invented for this row (custom type has no entry in DISPLAY_TYPE_META
  // and isn't reachable from a real display client, so it has no icon here).
  const TypeIcon = display.type === "custom" ? null : DISPLAY_TYPE_META[display.type].Icon;

  return (
    // Phase 7d: was its own rounded-panel/bg-card/border box per display —
    // the exact "every display wrapped in a card" pattern this phase was
    // asked to remove. Border-b row now, matching Dashboard/Cue Sheet's
    // grammar, but deliberately not flattened as far as those: a fleet row
    // still needs identity + type + health scannable in one glance, so the
    // status dot, type icon, and a persistent tint while expanded all stay —
    // "fleet console," not a plain table. Named region, not just a visual
    // grouping — every action button inside still carries its own
    // device-specific aria-label too (below), but a screen-reader user
    // landing on this group via rotor/landmark navigation gets "AV Waiting
    // Room" immediately rather than needing to read every button label
    // first to figure out which display they're in.
    <div
      className={cn("border-b border-line-soft transition-colors duration-[110ms]", expanded && "bg-card-hover/60")}
      role="group"
      aria-label={display.name}
    >
      {/* SCAN row — always visible, never requires expanding. Preview sits
          outside the expand toggle on purpose (a sibling button, not
          nested inside it): it's the one action reached for constantly
          while checking a show is on track, so it can't be gated behind
          "first open this device's settings." */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${display.name}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
        >
          <OperationalStatus kind={status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-console-row font-medium text-primary truncate">{display.name}</span>
              <span className="flex items-center gap-1 text-console-meta text-muted-2 shrink-0">
                {TypeIcon && <TypeIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
                {typeLabel(display.type)}
              </span>
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
        <div className="px-3 pb-5 pt-1 flex flex-col gap-5">
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
              {/* Display Profiles are real now (supabase/migrations/
                  20260909091744_display_profiles.sql — see that migration and
                  components/operator/display-profile-panel.tsx for the
                  full "why" this was previously disabled and what
                  changed) — only shown for a "custom" display, since the
                  4 fixed types have no profile concept of their own. */}
              {display.type === "custom" && (
                <MaybeTooltip when={!isOwner} content={OWNER_ONLY_NOTE}>
                  <Select
                    value={display.profileId ?? ""}
                    onChange={(v) => onProfile(v || null)}
                    options={[{ value: "", label: "No profile assigned" }, ...profileOptions.map((p) => ({ value: p.id, label: p.name }))]}
                    searchable={false}
                    disabled={!isOwner}
                    className="w-auto min-w-[10rem]"
                    aria-label={`Profile for ${display.name}`}
                  />
                </MaybeTooltip>
              )}
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
//
// Phase 7d: was its own hand-rolled framer-motion overlay — the one
// non-canonical dialog implementation left on this page, with none of
// Modal's Escape/overlay-stack/focus-trap wiring. Migrated onto the shared
// Modal shell; no behavior change (still clears its own field on each
// open, still submits on Enter).
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
    <Modal open={open} onClose={onClose} title="Send a test message" size="sm">
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message to show on this display"
        aria-label="Test message"
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
    </Modal>
  );
}
