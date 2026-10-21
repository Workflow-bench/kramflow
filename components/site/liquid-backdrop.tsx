"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/**
 * The shared animated fluid-surface backdrop for every non-app, non-
 * homepage page (404, pricing, about) that wants the same liquid-glass
 * language as the homepage and the auth split - same three product
 * tokens, same `type="waterPlane"`, same `pixelDensity={1.75}`, just a
 * quieter `brightness` than the hero's own (these pages are a single
 * centered composition, not a full scroll journey, so the glow stays
 * further back). See components/site/hero-gradient-backdrop.tsx and
 * components/auth/auth-art-backdrop.tsx for the two other call sites of
 * this same recipe - kept as separate small components rather than one
 * shared one, since each needed different mask/fade behavior for its own
 * layout; this one is for a full-bleed, centered page background.
 */
export function LiquidBackdrop({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ opacity }}>
      <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }} pixelDensity={1.5} fov={40} pointerEvents="none">
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.09}
          uStrength={1.8}
          uDensity={1.3}
          uFrequency={3.8}
          uAmplitude={1.3}
          cAzimuthAngle={200}
          cPolarAngle={70}
          cDistance={4.8}
          cameraZoom={1}
          lightType="3d"
          brightness={0.24}
          reflection={0.03}
          grain="off"
          wireframe={false}
          color1="#0c0b09"
          color2="#30d158"
          color3="#17140f"
        />
      </ShaderGradientCanvas>
    </div>
  );
}
