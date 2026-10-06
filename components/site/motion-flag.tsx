"use client";

import { useEffect } from "react";
import { useAmbientMotion } from "./motion-state";

/**
 * Publishes the effective motion setting to CSS as `data-motion` on <html>.
 *
 * Renders nothing. Stylesheet transitions and keyframes cannot read a React hook, so
 * without this the OS preference would reach the JS engines (shader, GSAP, Framer) but
 * leave CSS travel running — which is exactly the split HF-03 was raised about. One
 * attribute keeps every engine on the same setting.
 *
 * This used to live inside the visitor-facing Pause control; that control was removed
 * from the page, so the publication moved to a headless component rendered once.
 */
export function MotionFlag() {
  const allowed = useAmbientMotion();

  useEffect(() => {
    document.documentElement.dataset.motion = allowed ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.motion;
    };
  }, [allowed]);

  return null;
}
