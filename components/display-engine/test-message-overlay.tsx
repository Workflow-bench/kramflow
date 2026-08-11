"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import type { TestMessage } from "@/lib/display-engine/use-test-message";

/** Clearly labeled as a test, distinct from a real alert/broadcast, so it
 *  can't be mistaken for one mid-show — see use-test-message.ts. */
export function TestMessageOverlay({ message }: { message: TestMessage | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-6 left-6 right-6 z-40 flex items-center gap-4 rounded-card bg-card/95 backdrop-blur shadow-lg px-6 py-4"
        >
          <span className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-primary shrink-0">
            <MessageSquare className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-caption uppercase tracking-wide text-muted-2">Test Message from Display Manager</p>
            <p className="text-body text-primary font-semibold mt-1 truncate">{message.text}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
