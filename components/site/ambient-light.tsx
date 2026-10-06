"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { MeshGradientProps } from "@paper-design/shaders-react";
import { useAmbientMotion } from "./motion-state";

/**
 * The page's one moving light: a warm stage wash behind the product, never over it.
 *
 * Four rules this component exists to keep:
 *
 * 1. **The static layer is the real one.** `.ambient-light-*` (globals.css) are plain
 *    CSS radial gradients in the server HTML and are never removed. The WebGL mesh
 *    only ever fades in on top. Reduced motion, Pause, absent WebGL, a lost context,
 *    a failed chunk and a slow device therefore all land on the same composed image
 *    instead of on a hole where a background should be.
 * 2. **It must actually be visible.** The previous settings (speed 0.12, swirl 0.08,
 *    opacity 0.4, tight mask) were measurably imperceptible over several seconds.
 *    These are tuned so the field's shape and position change observably within a
 *    few seconds while still taking ~10s to travel a full cycle.
 * 3. **It stays off the reading column.** The brightest region sits right of and
 *    below the copy; contrast is measured against the composited result, not
 *    assumed.
 * 4. **It is never a status light.** Operational green and amber mean live and
 *    standby inside the product, so the palette here is graphite, brown, ember and
 *    dimmed cream only — no saturated green, no pulsing indicator.
 *
 * Paper Shaders (`@paper-design/shaders-react`, pinned 0.0.81, Apache-2.0) runs a
 * canvas shader with no Three.js stack. Its ShaderMount already pauses on
 * `visibilitychange` and through its own IntersectionObserver, and disposes GL
 * resources on unmount — so unmounting on Pause or reduced motion is also the GPU
 * release path. It throws when WebGL2 is missing, so support is probed before
 * mounting and an error boundary catches anything later (context loss).
 */

// Explicit KramFlow palette. No demo preset is retained.
const COLORS = ["#0c0b09", "#241a11", "#4a3117", "#8a5a1e", "#6e6354"];

// Bounded cost: one shader, half-resolution ceiling, hard pixel cap.
const MAX_PIXEL_COUNT = 1280 * 720;
const MIN_PIXEL_RATIO = 1;

function webgl2Available() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function AmbientLight({
  variant = "hero",
  className = "",
}: {
  /** `hero` is the full field; `echo` is the quieter closing restatement. */
  variant?: "hero" | "echo";
  className?: string;
}) {
  const allowed = useAmbientMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [Mesh, setMesh] = useState<React.FC<MeshGradientProps> | null>(null);

  useEffect(() => {
    if (!allowed || !webgl2Available()) return;
    let cancelled = false;
    let idle: number | undefined;
    const host = hostRef.current;
    if (!host) return;

    const load = () => {
      const run = () => {
        if (cancelled) return;
        import("@paper-design/shaders-react")
          .then((m) => {
            if (!cancelled) setMesh(() => m.MeshGradient);
          })
          .catch(() => {
            /* the static layer stands in */
          });
      };
      // After first paint, while idle: the page must be readable first and the
      // shader must never gate content.
      idle = window.requestIdleCallback ? window.requestIdleCallback(run) : window.setTimeout(run, 300);
    };

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
      { rootMargin: "200px" }
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
  }, [allowed]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 ${variant === "hero" ? "ambient-light-hero" : "ambient-light-echo"} ${className}`}
    >
      {Mesh && allowed && (
        <ShaderBoundary>
          <Mesh
            colors={COLORS}
            // Tuned by eye against the rendered page, then verified by frame
            // sampling at 0s/2s/4s: enough distortion and swirl that the field's
            // shape changes observably in two seconds, slow enough that a full
            // drift takes roughly ten.
            distortion={1}
            swirl={0.55}
            grainMixer={0}
            grainOverlay={0}
            speed={variant === "hero" ? 0.5 : 0.3}
            minPixelRatio={MIN_PIXEL_RATIO}
            maxPixelCount={MAX_PIXEL_COUNT}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            className={variant === "hero" ? "ambient-shader-hero" : "ambient-shader-echo"}
          />
        </ShaderBoundary>
      )}
    </div>
  );
}
