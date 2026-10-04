"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Shared motion helpers for the landing page. Everything here honours
 * `prefers-reduced-motion` in its own code path and renders the same DOM tree
 * for everyone, so hydration never disagrees with the server's HTML.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * `prefers-reduced-motion`, safe for server-rendered markup. The server
 * snapshot is always `false`, so hydration matches the HTML the server sent
 * and React re-renders with the real preference straight after.
 */
export function useReduced() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

/**
 * False on the server and during hydration, true from the first render after.
 * Entrances wait on it so they start only once `useReduced` has its real value.
 */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
}

/** Fade and rise once as a block scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReduced();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
