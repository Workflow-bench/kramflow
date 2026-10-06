"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ProductShot, type ShotKey } from "./product-shot";
import { useTransitionMotion } from "./motion-state";

/**
 * One recorded product capture, replaced by another with a directional reveal.
 *
 * This is a **presentation** transition between two genuine recorded states. There is no
 * countdown, no simulated network delay, no autoplay and no implied synchronisation
 * speed: the wipe says "this state replaced that one" and nothing about how fast the
 * product does it.
 *
 * **Handoff (HOME-R06).** Two layers, each keyed by its own shot, so an image element is
 * created once and never has its `src` swapped underneath it:
 *
 * - the requested shot mounts immediately at opacity 0 and loads;
 * - the previously settled shot stays painted beneath it the whole time;
 * - only the new image's `load` event starts the reveal, which runs *over* the old
 *   pixels, so the transition can never pass through an empty frame;
 * - once revealed, the old layer unmounts and the new element — already decoded — simply
 *   stays. Promotion never re-decodes, so the painted pixels always match the announced
 *   state. (An earlier version swapped the base layer's `src` on promotion, which made
 *   the browser re-decode and briefly re-show the previous capture.)
 *
 * Each request carries a token: selecting again while one is still loading supersedes the
 * earlier request, so a slow earlier image can never overwrite a newer selection.
 *
 * **Crop (HOME-R02).** `crop` frames a region of the original capture using uniform scale
 * and overflow clipping only. No pixel inside the image is altered, recoloured or
 * repainted; the component only decides which part of the real screenshot is on screen.
 *
 * Both layers occupy the same fixed-ratio box, so a swap never reflows the page.
 */

// Inside the 220-320ms contract for the cue reveal.
const REVEAL_MS = 260;

export interface CropBox {
  /** Region of the source capture, in the source's own pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The source capture's full dimensions, so the scale can be derived. */
  imageWidth: number;
  imageHeight: number;
}

function cropStyle(crop: CropBox): React.CSSProperties {
  return {
    position: "absolute",
    width: `${(crop.imageWidth / crop.width) * 100}%`,
    height: "auto",
    left: `${-(crop.left / crop.width) * 100}%`,
    top: `${-(crop.top / crop.height) * 100}%`,
    maxWidth: "none",
  };
}

export function RecordedView({
  shot,
  ratio,
  sizes,
  crop,
  className = "",
  priority = false,
}: {
  shot: ShotKey;
  /** width / height of the visible box, so it never changes size between states. */
  ratio: number;
  sizes: string;
  crop?: CropBox;
  className?: string;
  priority?: boolean;
}) {
  const animate = useTransitionMotion();
  // The capture still painted from the last settled state, kept until the new one shows.
  const [previous, setPrevious] = useState<ShotKey | null>(null);
  const [ready, setReady] = useState(false);
  const settled = useRef<ShotKey>(shot);
  const request = useRef(0);

  useEffect(() => {
    if (shot === settled.current) {
      // Selected back to what is already settled: cancel any in-flight handoff.
      request.current += 1;
      setPrevious(null);
      setReady(false);
      return;
    }
    request.current += 1;
    setPrevious(settled.current);
    setReady(false);
    settled.current = shot;
  }, [shot]);

  // Drop the old layer only once the new one has been revealed over it.
  useEffect(() => {
    if (!previous || !ready) return;
    const token = request.current;
    const id = window.setTimeout(
      () => {
        if (token !== request.current) return;
        setPrevious(null);
        setReady(false);
      },
      animate ? REVEAL_MS : 0
    );
    return () => window.clearTimeout(id);
  }, [previous, ready, animate]);

  const layerStyle = crop ? cropStyle(crop) : undefined;
  const layerClass = crop ? "" : "absolute inset-0 h-full w-full object-cover object-top";

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: String(ratio) }}>
      {/* The outgoing capture: still real pixels, never a blank box. */}
      {previous && (
        <ProductShot key={previous} shot={previous} sizes={sizes} className={layerClass} style={layerStyle} />
      )}

      {/* The requested capture. Keyed, so this element is created once and kept. */}
      <motion.div
        key={shot}
        className="absolute inset-0 overflow-hidden"
        initial={previous && animate ? { clipPath: "inset(0 0 0 100%)" } : { clipPath: "inset(0 0 0 0%)" }}
        animate={!previous || ready ? { clipPath: "inset(0 0 0 0%)" } : undefined}
        transition={animate ? { duration: REVEAL_MS / 1000, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        style={{ opacity: previous && !ready ? 0 : 1 }}
      >
        <ProductShot
          shot={shot}
          sizes={sizes}
          priority={priority}
          className={layerClass}
          style={layerStyle}
          onLoad={() => {
            // A late arrival from a superseded selection is discarded. The comparison is
            // against the currently settled shot rather than a token captured during
            // render: effects run after render, so a render-time token is always one
            // step behind and would reject the very load it was meant to accept.
            if (settled.current !== shot) return;
            setReady(true);
          }}
        />
      </motion.div>
    </div>
  );
}
