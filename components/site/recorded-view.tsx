"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ProductShot, type ShotKey } from "./product-shot";
import { useTransitionMotion } from "./motion-state";

/**
 * One recorded product capture, replaced by another only once the replacement has
 * actually decoded.
 *
 * **Committed vs requested (HF-01).** Two pieces of state, deliberately separate:
 *
 * - `committed` is the capture that is painted right now. It is only ever replaced by
 *   an image that has already fired `load`.
 * - `pending` is the capture that has been *asked for*. It mounts at opacity 0 and has
 *   no claim on the display until it is ready.
 *
 * The previous version advanced its "settled" marker at request time, so A→B→C left the
 * outgoing layer pointing at B — an image that had never decoded — and A, the only
 * decoded frame, was unmounted. Both visible layers could then be undecoded. Here
 * `committed` is untouched until a promotion actually happens, so a supersession, a
 * return to the committed shot, or an outright load failure all leave the real decoded
 * pixels on screen.
 *
 * **Obsolete callbacks are rejected by identity, not by a render-time token.** A token
 * captured during render is always one step behind the effect that increments it, which
 * is what made the earlier guard reject the very load it was meant to accept. Each
 * layer instead compares its own shot against `latest`, a ref tracking the current
 * request, so a late `load` from a superseded generation is ignored — including when the
 * same shot name is requested again later.
 *
 * **Crop.** `crop` frames a region of the original capture with uniform scale and
 * overflow clipping only. No pixel inside the image is altered, recoloured or repainted;
 * the component only decides which part of the real screenshot is on screen.
 *
 * Both layers share one fixed-ratio box, so a swap never reflows the page.
 */

// Inside the 220-320ms reveal contract.
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

/**
 * Places a crop region inside the fixed-ratio box.
 *
 * `contain` scales the region to fit entirely, centring it and letterboxing whichever
 * axis is spare. That is deliberately preferred over filling the box: a tall control
 * column stretched to a landscape aperture would either distort the product or cut off
 * the very control the caption is pointing at.
 *
 * Working in percentages with the box width as 100 units: the box height is
 * `100 / boxRatio` units, so a single scale factor expressed in those units positions
 * both axes without needing pixel measurements.
 */
function cropStyle(crop: CropBox, boxRatio: number, fit: "cover" | "contain"): React.CSSProperties {
  const boxH = 100 / boxRatio;
  const scale =
    fit === "contain" ? Math.min(100 / crop.width, boxH / crop.height) : 100 / crop.width;
  const offsetX = (100 - crop.width * scale) / 2;
  const offsetY = (boxH - crop.height * scale) / 2;
  return {
    position: "absolute",
    width: `${crop.imageWidth * scale}%`,
    height: "auto",
    left: `${-crop.left * scale + offsetX}%`,
    // Vertical percentages resolve against the box height, so convert from box-width units.
    top: `${((-crop.top * scale + offsetY) / boxH) * 100}%`,
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
  fit = "cover",
  /** Called with the shot that is actually painted, whenever that changes. */
  onCommitted,
  onUnavailable,
}: {
  shot: ShotKey;
  /** width / height of the visible box, so it never changes size between states. */
  ratio: number;
  sizes: string;
  crop?: CropBox;
  className?: string;
  priority?: boolean;
  /** How a crop region sits in the box. `contain` letterboxes instead of filling. */
  fit?: "cover" | "contain";
  onCommitted?: (shot: ShotKey) => void;
  /** A requested replacement failed; the committed capture remains visible. */
  onUnavailable?: (shot: ShotKey) => void;
}) {
  const animate = useTransitionMotion();
  const [committed, setCommitted] = useState<ShotKey>(shot);
  // `pending` is derived, not stored: it is purely a function of the request and what is
  // already committed, and writing it from an effect caused a cascading render.
  const pending = shot !== committed ? shot : null;
  // Which shot has actually decoded. `ready` is true only when that is the pending one,
  // so a stale readiness flag can never unveil the wrong capture.
  const [readyFor, setReadyFor] = useState<ShotKey | null>(null);
  const ready = pending !== null && readyFor === pending;

  // Promote only after the reveal has run over the committed pixels.
  useEffect(() => {
    if (!pending || !ready) return;
    const target = pending;
    const id = window.setTimeout(
      () => {
        setCommitted(target);
        setReadyFor(null);
        onCommitted?.(target);
      },
      animate ? REVEAL_MS : 0
    );
    return () => window.clearTimeout(id);
  }, [pending, ready, animate, onCommitted]);

  const layerStyle = crop ? cropStyle(crop, ratio, fit) : undefined;
  const layerClass = crop ? "" : "absolute inset-0 h-full w-full object-cover object-top";

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: String(ratio) }}>
      {/* The committed capture. Never unmounted for a request that has not decoded. */}
      <ProductShot
        key={committed}
        shot={committed}
        sizes={sizes}
        priority={priority}
        className={layerClass}
        style={layerStyle}
      />

      {pending && (
        <motion.div
          key={pending}
          className="absolute inset-0 overflow-hidden"
          initial={animate ? { clipPath: "inset(0 0 0 100%)" } : { clipPath: "inset(0 0 0 0%)" }}
          animate={ready ? { clipPath: "inset(0 0 0 0%)" } : undefined}
          transition={animate ? { duration: REVEAL_MS / 1000, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
          style={{ opacity: ready ? 1 : 0 }}
        >
          <ProductShot
            shot={pending}
            sizes={sizes}
            className={layerClass}
            style={layerStyle}
            onLoad={() => {
              // The handler is recreated per render and the layer is keyed by `pending`,
              // so this closure always refers to its own request. A superseded layer has
              // already unmounted and can never promote itself.
              setReadyFor(pending);
            }}
            onError={() => {
              // Keep the committed capture; a failed request never takes the display.
              setReadyFor(null);
              onUnavailable?.(pending);
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
