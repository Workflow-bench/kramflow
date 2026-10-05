"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ProductShot } from "./product-shot";
import { useTransitionMotion } from "./motion-state";
import type { ShotKey } from "./product-shot";

/**
 * One recorded product capture, swapped for another with a directional reveal.
 *
 * This is a **presentation** transition between two genuine recorded states. It is
 * deliberately not a simulation: there is no countdown, no fake network delay, no
 * autoplay and no implied synchronisation speed. The wipe says "this state replaced
 * that one", nothing about how fast the product does it.
 *
 * The wipe runs 260ms (inside the 220–320ms contract). Under reduced motion the new
 * capture is simply there — the content still changes, it just does not travel.
 *
 * Both captures occupy the same absolutely-positioned box at a fixed aspect ratio,
 * so swapping never reflows the page and never shifts layout (CLS stays at 0).
 */
export function RecordedView({
  shot,
  ratio,
  sizes,
  className = "",
  priority = false,
}: {
  shot: ShotKey;
  /** width / height of the capture, so the box never changes size between states. */
  ratio: number;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const animate = useTransitionMotion();

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: String(ratio) }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={shot}
          className="absolute inset-0"
          initial={animate ? { clipPath: "inset(0 0 0 100%)" } : false}
          animate={{ clipPath: "inset(0 0 0 0%)" }}
          transition={animate ? { duration: 0.26, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        >
          <ProductShot shot={shot} sizes={sizes} priority={priority} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
