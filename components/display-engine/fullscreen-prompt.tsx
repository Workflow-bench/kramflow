"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Maximize, X } from "lucide-react";

/**
 * QA_REPORT_ROUND3.md: "Force Fullscreen" as a remote command can never
 * actually work — requestFullscreen() requires a genuine user gesture on
 * the device itself, which a Realtime-delivered command can never provide
 * (see use-fullscreen.ts). Rather than removing the feature, the remote
 * command now shows this prompt on the target display; tapping "Enter
 * Fullscreen" here IS a real gesture on that device, so it actually works.
 */
export function FullscreenPrompt({
  visible,
  onEnter,
  onDismiss,
}: {
  visible: boolean;
  onEnter: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-6 left-6 right-6 z-40 flex items-center gap-4 rounded-card bg-card/95 backdrop-blur shadow-lg px-6 py-4"
        >
          <span className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-primary shrink-0">
            <Maximize className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body text-primary font-semibold">The operator asked this display to go fullscreen</p>
            <p className="text-caption text-muted-2 mt-0.5">Browsers only allow this from a tap on the screen itself</p>
          </div>
          <button
            type="button"
            onClick={onEnter}
            className="rounded-full bg-primary text-background px-5 py-2.5 text-body font-semibold cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Enter Fullscreen
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-muted-2 hover:text-primary cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
