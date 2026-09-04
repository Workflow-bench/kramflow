"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useDisplayEngine, targetMatchesDisplay } from "@/lib/display-engine/store";
import { BROADCAST_TYPE_META } from "@/lib/display-engine/broadcast-style";
import type { BroadcastMessage, DisplayType } from "@/lib/display-engine/types";
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
                  {!message.persistent && (
                    <button
                      type="button"
                      onClick={() => dismissBroadcast(message.id)}
                      className={cn(
                        "text-muted hover:text-primary cursor-pointer shrink-0",
                        size === "large" ? "text-body" : "text-caption"
                      )}
                    >
                      Dismiss
                    </button>
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
