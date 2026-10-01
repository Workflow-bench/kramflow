"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useDisplayEngine, targetMatchesDisplay } from "@/lib/display-engine/store";
import { useDisplayEngineIdentity } from "@/lib/display-engine/context";
import { BROADCAST_TYPE_META } from "@/lib/display-engine/broadcast-style";
import type { BroadcastMessage, DisplayType } from "@/lib/display-engine/types";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Container stays fully opaque (bg-card/95 + blur, the same floating-chrome
// convention used by the Presenter Display's own control bar) so a banner
// never lets page content bleed through and collide with its text — only
// the icon chip carries the type's accent tint. This is the authoritative
// on-display rendering — Broadcast Center's compose-time preview mirrors
// this exact styling (via the same BROADCAST_TYPE_META) rather than a
// separately-invented mockup.

function effectiveExpiry(message: BroadcastMessage): number | null {
  if (message.durationSeconds !== null) return Date.parse(message.createdAt) + message.durationSeconds * 1000;
  if (message.expiresAt) return Date.parse(message.expiresAt);
  return null;
}

export function BroadcastOverlay({
  displayId,
  displayType,
  size = "default",
}: {
  displayId: string;
  displayType: DisplayType;
  /** "large" is for displays read from a distance (the stage/Presenter monitor) — bigger icon, title, and message text, one banner at a time instead of three stacked. */
  size?: "default" | "large";
}) {
  const { state, acknowledgeBroadcast, dismissBroadcast } = useDisplayEngine();
  const toast = useToast();
  // A Share Display (token) is read-only and cannot dismiss a message for
  // everyone; only the event owner can. B002 left this as "visible to any
  // authenticated session, server enforces the real boundary on click" —
  // Codex's B002 review (B002-F1) correctly rejected that as a silent
  // failed interaction: the server denies editor/viewer, but the click
  // result was never read (see store.tsx's dismissBroadcast — it only
  // console.errors), so the banner just sat there with no explanation.
  //
  // Fixed by threading a real, server-derived role down instead of
  // reading it from lib/event-context.tsx's EventRoleContext (whose
  // "owner" default, safe under the authenticated app/e/[eventId] layout,
  // would be silently wrong here — B002's DECISIONS.md already identified
  // this risk and correctly avoided it, just left the interaction itself
  // broken). Each of the four display pages' own verifyDisplayAccess()
  // Server Component call now resolves the real role for a session viewer
  // (undefined for a token viewer — no role concept applies to them) and
  // threads it through DisplayEngineProvider as an explicit prop — see
  // lib/display-engine/context.tsx's DisplayEngineIdentity.role.
  const { token, role } = useDisplayEngineIdentity();
  const isOwnerSession = role === "owner";
  // A session viewer who isn't the owner (editor/viewer) sees Dismiss
  // disabled with a reason, matching the Remote page's own pattern for
  // owner-only controls. A token (public) viewer never sees it at all —
  // there's no "you" to explain a permission to; per-viewer role has no
  // meaning for an anonymous share-link visit.
  const showDisabledDismiss = !token && !isOwnerSession;
  const [dismissing, setDismissing] = useState<string | null>(null);

  async function handleDismiss(messageId: string) {
    if (dismissing) return;
    setDismissing(messageId);
    try {
      const res = await dismissBroadcast(messageId);
      // Generic failure text only — this is a public-reachable surface for
      // token viewers on other messages in the same overlay, and even an
      // owner's own failed attempt doesn't need (and per the dismiss
      // route's own anti-enumeration convention, the server doesn't send)
      // any detail beyond "didn't work." No optimistic removal either way
      // — the banner's presence is always driven by state.broadcasts.active
      // from the realtime store, never mutated locally, so a failed write
      // simply leaves it exactly as it was.
      if (!res || !res.ok) {
        toast.error("Couldn't dismiss. Try again.");
      }
    } finally {
      setDismissing(null);
    }
  }

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const display = state.registry[displayId];
  const targeted = state.broadcasts.active.filter((message) => {
    const expiry = effectiveExpiry(message);
    if (expiry !== null && now > expiry) return false;
    if (!display) {
      return (
        message.target.kind === "all" ||
        (message.target.kind === "type" && message.target.value === displayType)
      );
    }
    return targetMatchesDisplay(message.target, display, state.groups);
  });

  const emergency = targeted.find((m) => m.type === "emergency");
  const banners = targeted.filter((m) => m.type !== "emergency").sort((a, b) => b.priority - a.priority);

  return (
    <>
      <AnimatePresence>
        {emergency && (
          <motion.div
            key={emergency.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-status-red text-white text-center px-16"
          >
            <AlertTriangle className="h-20 w-20 mb-8" strokeWidth={1.5} />
            <h1 className="text-hero">{emergency.title}</h1>
            {emergency.message && <p className="text-title mt-6 opacity-90">{emergency.message}</p>}
            {emergency.acknowledgementRequired && !emergency.acknowledgedBy.includes(displayId) && (
              <button
                type="button"
                onClick={() => acknowledgeBroadcast(emergency.id, displayId)}
                className="mt-12 rounded-full bg-white text-status-red px-8 py-4 text-subtitle font-semibold cursor-pointer"
              >
                Acknowledge
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!emergency && banners.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col gap-3 p-6">
          <AnimatePresence>
            {banners.slice(0, size === "large" ? 1 : 3).map((message) => {
              const style = BROADCAST_TYPE_META[message.type];
              const Icon = style.Icon;
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    "flex items-center rounded-card bg-card/95 backdrop-blur shadow-lg",
                    size === "large" ? "gap-6 px-10 py-8" : "gap-4 px-6 py-4"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full shrink-0",
                      size === "large" ? "h-16 w-16" : "h-10 w-10",
                      style.accentClass
                    )}
                  >
                    <Icon className={size === "large" ? "h-9 w-9" : "h-5 w-5"} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-primary font-semibold truncate",
                        size === "large" ? "text-title" : "text-body"
                      )}
                    >
                      {message.title}
                    </p>
                    {message.message && (
                      <p className={cn("text-muted truncate", size === "large" ? "text-subtitle mt-1" : "text-caption")}>
                        {message.message}
                      </p>
                    )}
                  </div>
                  {!message.persistent && isOwnerSession && (
                    <button
                      type="button"
                      onClick={() => handleDismiss(message.id)}
                      disabled={dismissing === message.id}
                      aria-label={dismissing === message.id ? "Dismissing…" : "Dismiss"}
                      className={cn(
                        "text-muted hover:text-primary cursor-pointer shrink-0 rounded-control disabled:opacity-60 disabled:cursor-not-allowed",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        size === "large" ? "text-body" : "text-caption"
                      )}
                    >
                      {dismissing === message.id ? "Dismissing…" : "Dismiss"}
                    </button>
                  )}
                  {!message.persistent && showDisabledDismiss && (
                    // Not a disabled <button>: a disabled element is removed
                    // from the tab order and never fires focus, so wrapping
                    // one in MaybeTooltip (hover/focus-triggered) left sighted
                    // keyboard users with no way to discover the reason —
                    // Codex B003 review (B003-S3). Plain always-visible text
                    // is legible to sighted keyboard users and screen readers
                    // alike without pretending a control is operable.
                    <span
                      className={cn(
                        "text-muted-2 shrink-0 text-right",
                        size === "large" ? "text-body" : "text-caption"
                      )}
                    >
                      Only the owner can dismiss
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
