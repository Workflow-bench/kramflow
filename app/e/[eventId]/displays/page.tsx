"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eye, Maximize, Megaphone, Presentation, RotateCw, Send, Trash2, Tv, Wifi, WifiOff, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/auth-context";
import { useEventId } from "@/lib/event-context";
import { useDisplayEngine, useTransportStatus } from "@/lib/display-engine/store";
import { getDisplayStatus } from "@/lib/display-engine/use-register-display";
import type { DisplayInstance, DisplayType } from "@/lib/display-engine/types";
import { EventNav } from "@/components/operator/event-nav";
import { EventIdentity } from "@/components/operator/event-identity";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Panel } from "@/components/ui/card";
import { SectionLabel } from "@/components/tv/section-label";
import { ProfileEditor } from "@/components/display-engine/profile-editor";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelativeAge } from "@/lib/utils";

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

type ConfirmAction =
  | { kind: "reassign-type"; id: string; name: string; type: DisplayType }
  | { kind: "reload"; id: string; name: string }
  | { kind: "remove"; id: string; name: string }
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
  const confirmAction = useConfirmDialog<ConfirmAction>();
  const confirmingRef = useRef<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const displays = Object.values(engine.registry).sort((a, b) => Date.parse(b.registeredAt) - Date.parse(a.registeredAt));
  const offlineDisplays = displays.filter((d) => getDisplayStatus(d, now) === "offline");

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
          <h1 className="text-title text-primary mt-1.5">Displays</h1>
        </div>
        <div className="flex items-center gap-4">
          <EventNav />
          <span className="hidden lg:flex items-center gap-2 text-caption text-muted-2">
            {transportStatus === "open" ? (
              <Wifi className="h-4 w-4 text-status-green" strokeWidth={2} />
            ) : (
              <WifiOff className="h-4 w-4 text-status-orange" strokeWidth={2} />
            )}
            {transportStatus === "open" ? "Sync connected" : transportStatus}
          </span>
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

        <div className="flex items-center justify-between gap-4 flex-wrap mt-8">
          <SectionLabel>Connected Displays ({displays.length})</SectionLabel>
          {offlineDisplays.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                confirmAction.request({ kind: "remove-all-offline", ids: offlineDisplays.map((d) => d.id) })
              }
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Remove all offline ({offlineDisplays.length})
            </Button>
          )}
        </div>

        {displays.length === 0 ? (
          <p className="text-body text-muted-2 mt-6">
            No displays have registered yet. Open a display route (e.g. /presenter) on a device to see it here.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            {displays.map((display) => {
              const status = getDisplayStatus(display, now);
              return (
                <DisplayRow
                  key={display.id}
                  display={display}
                  status={status}
                  now={now}
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
              <p className="text-body text-primary font-medium">{previewing.name} — live preview</p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewing(null)} aria-label="Close preview">
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>
            <div className="rounded-card overflow-hidden bg-background aspect-video">
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
                : confirmAction.pending?.kind === "remove-all-offline"
                  ? `Remove ${confirmAction.pending.ids.length} offline display${confirmAction.pending.ids.length === 1 ? "" : "s"}?`
                  : ""
        }
        description={
          confirmAction.pending?.kind === "reassign-type"
            ? "This changes what content this physical display shows."
            : confirmAction.pending?.kind === "reload"
              ? "This interrupts whatever's currently on that screen."
              : confirmAction.pending?.kind === "remove-all-offline"
                ? "Each one will reappear automatically if its device is still open on a display route."
                : "This removes it from the registry. It'll reappear automatically if the device is still open on a display route."
        }
        confirmLabel={
          confirmAction.pending?.kind === "reassign-type"
            ? "Change Type"
            : confirmAction.pending?.kind === "reload"
              ? "Reload"
              : "Remove"
        }
        tone="danger"
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
  status: "online" | "offline";
  now: number;
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

  return (
    // Named region, not just a visual card — every action button inside
    // still carries its own device-specific aria-label too (below), but a
    // screen-reader user landing on this group via rotor/landmark
    // navigation gets "AV Waiting Room" immediately rather than needing to
    // read every button label first to figure out which display they're in.
    <div className="rounded-card bg-card px-6 py-5" role="group" aria-label={display.name}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn("h-2.5 w-2.5 rounded-full shrink-0", status === "online" ? "bg-status-green" : "bg-status-red")}
            title={status}
          />
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft.trim() && nameDraft !== display.name) onRename(nameDraft.trim());
            }}
            className="font-medium min-w-0 w-auto"
            aria-label="Display name"
          />
        </div>
        <div className="flex items-center gap-4 text-caption text-muted-2 shrink-0">
          <span className={cn("uppercase tracking-wide", status === "offline" && "text-status-red")}>{status}</span>
          {/* A live-looking ms figure on a card already marked OFFLINE was
              its own false-confidence bug (2026-09-01 UI/UX audit finding
              #12) — that number is whatever the last successful ping
              measured, not a current reading, so it gets replaced with the
              thing that's actually still true: how long ago that was. */}
          <span className="tabular-nums" title={new Date(display.lastSeenAt).toLocaleString()}>
            {status === "online"
              ? display.latencyMs !== null
                ? `${Math.round(display.latencyMs)}ms`
                : "—"
              : `Last seen ${formatRelativeAge(now - Date.parse(display.lastSeenAt))}`}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
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

      {/* Preview is the one action an operator reaches for constantly while
          checking a show is on track — it gets the primary weight (Fitts's
          Law, Apple HIG's "one primary action per view"). The four
          maintenance actions are equally infrequent — none deserves more
          weight than the others, so they stay one flat secondary tier
          (Gestalt Similarity: same weight signals "peers," not a ranking).
          Remove is pulled to the far side with its own gap instead of
          sitting shoulder-to-shoulder with routine actions — the guardrail
          system's danger tier (docs/DESIGN.md) plus spatial separation
          (Von Restorff) so a misclick reaching for Reload can't land on it. */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {/* Preview opens the route in the operator's own browser — that
            works with no living connection to this device at all, so it
            stays enabled offline (and is genuinely useful there: it's how
            you check what the display *would* show once it reconnects). */}
        <Button variant="primary" size="sm" onClick={onPreview} aria-label={`Preview ${display.name}`}>
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          Preview
        </Button>
        {/* Screenshot/Force Fullscreen/Test Message all send a command to
            *this specific* connected client — with none listening, they
            previously looked identical to a working command, just one that
            silently did nothing (2026-09-01 UI/UX audit finding #12: "false
            confidence from no-op commands"). Disabled with a reason instead
            of quietly eating the click. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onScreenshot}
          disabled={status === "offline"}
          title={status === "offline" ? "This display is offline — nothing is listening to respond." : undefined}
          aria-label={`Screenshot ${display.name}`}
        >
          <Camera className="h-3.5 w-3.5" strokeWidth={2} />
          Screenshot
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onForceFullscreen}
          disabled={status === "offline"}
          title={status === "offline" ? "This display is offline — nothing is listening to respond." : undefined}
          aria-label={`Force fullscreen on ${display.name}`}
        >
          <Maximize className="h-3.5 w-3.5" strokeWidth={2} />
          Force Fullscreen
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenMessage}
          disabled={status === "offline"}
          title={status === "offline" ? "This display is offline — nothing is listening to respond." : undefined}
          aria-label={`Send test message to ${display.name}`}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          Test Message
        </Button>
        {/* Reload/Reconnect stays enabled offline on purpose — it's the one
            action that's actually *for* an unresponsive display (queues a
            reload for whenever it comes back / prompts a manual refresh),
            not a command that needs a live listener to mean anything. */}
        <Button variant="secondary" size="sm" onClick={onRequestReload} aria-label={`Reload or reconnect ${display.name}`}>
          <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
          Reload / Reconnect
        </Button>
        <Button variant="danger" size="sm" onClick={onRequestRemove} className="ml-auto" aria-label={`Remove ${display.name}`}>
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Remove
        </Button>
      </div>
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
            className="w-full max-w-sm rounded-card bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-subtitle text-primary">Send a test message</h2>
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
