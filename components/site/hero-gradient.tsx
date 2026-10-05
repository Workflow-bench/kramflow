"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { MeshGradientProps } from "@paper-design/shaders-react";
import { useReduced } from "./motion";

/**
 * The hero's one background light: a quiet charcoal/warm-amber/cream field sitting
 * behind the boundary between the headline block and the product capture.
 *
 * Three rules this component exists to keep:
 *
 * 1. **The static gradient is the real one.** `.hero-light` (globals.css) is plain
 *    CSS radial gradients, present in the server HTML, and is never removed. The
 *    WebGL mesh only ever fades in *on top of it*. So reduced motion, absent
 *    WebGL, a lost context, a slow device and a failed chunk all land on the same
 *    composed image rather than on a hole where a background should be.
 * 2. **It never touches reading or product pixels.** The field is masked to the
 *    band around the capture's top edge and sits at `z-0`; the copy and the
 *    screenshot both render above it. Contrast is measured against the static
 *    layer's brightest state, which the shader is tuned to stay under.
 * 3. **It costs nothing before the page is readable.** The shader module is
 *    imported only after first paint, only when the hero is actually on screen,
 *    and only when motion is wanted — never on the critical path.
 *
 * Paper Shaders (`@paper-design/shaders-react`, pinned 0.0.81) runs a canvas
 * shader with no Three.js scene stack. Its ShaderMount already pauses on
 * `visibilitychange` and via its own IntersectionObserver, and disposes its GL
 * resources on unmount; unmounting on reduced-motion change is therefore also the
 * GPU release path. It *throws* when WebGL2 is unavailable, so support is probed
 * before mounting and an error boundary catches anything later (context loss).
 */

// KramFlow's own palette, stated explicitly rather than inherited from a demo
// preset: graphite ground, two warm browns, one muted amber and a dimmed cream.
// Operational green/orange are deliberately absent — those mean show state.
const COLORS = ["#0c0b09", "#241a11", "#3d2a16", "#6b4a1e", "#6e6354"];

// Bounded cost: half-resolution ceiling and a hard pixel cap, so a 4K display
// does not quietly ask for a 4K shader surface for a background texture.
const MAX_PIXEL_COUNT = 1280 * 720;
const MIN_PIXEL_RATIO = 1;

function webgl2Available() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

/** Context loss or any shader error falls back to the static layer already behind it. */
class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroGradient() {
  const reduce = useReduced();
  const hostRef = useRef<HTMLDivElement>(null);
  const [Mesh, setMesh] = useState<React.FC<MeshGradientProps> | null>(null);

  useEffect(() => {
    // Reduced motion keeps the static field and never loads the module at all.
    if (reduce || !webgl2Available()) return;

    let cancelled = false;
    let idle: number | undefined;
    const host = hostRef.current;
    if (!host) return;

    const load = () => {
      // After first paint, and only while idle: the hero must be readable first.
      const start = () => {
        idle = window.requestIdleCallback
          ? window.requestIdleCallback(() => {
              if (cancelled) return;
              import("@paper-design/shaders-react")
                .then((m) => {
                  if (!cancelled) setMesh(() => m.MeshGradient);
                })
                .catch(() => {
                  /* static layer stands in */
                });
            })
          : window.setTimeout(() => {
              if (cancelled) return;
              import("@paper-design/shaders-react")
                .then((m) => {
                  if (!cancelled) setMesh(() => m.MeshGradient);
                })
                .catch(() => {});
            }, 400);
      };
      start();
    };

    // Only if the hero is actually on screen; a visitor who lands deep-linked
    // further down the page never pays for it.
    if (!("IntersectionObserver" in window)) {
      load();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "0px" }
    );
    io.observe(host);

    return () => {
      cancelled = true;
      io.disconnect();
      if (idle !== undefined) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
    };
  }, [reduce]);

  return (
    // A bounded band rather than `inset-0`: the hero is ~1500px tall once the
    // capture is included, so percentage stops measured against the whole section
    // would push the light far below the fold. This box covers the headline block
    // and the capture's top edge, which is the boundary the light belongs to.
    <div
      ref={hostRef}
      aria-hidden="true"
      className="hero-light pointer-events-none absolute inset-x-0 top-0 z-0 h-[1000px]"
    >
      {Mesh && !reduce && (
        <ShaderBoundary>
          <Mesh
            colors={COLORS}
            // Low distortion and a near-still swirl: a light field, not a lava lamp.
            distortion={0.6}
            swirl={0.08}
            grainMixer={0}
            grainOverlay={0}
            speed={0.12}
            minPixelRatio={MIN_PIXEL_RATIO}
            maxPixelCount={MAX_PIXEL_COUNT}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            className="hero-light-shader"
          />
        </ShaderBoundary>
      )}
    </div>
  );
}
