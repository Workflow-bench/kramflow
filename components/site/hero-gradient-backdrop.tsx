"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/**
 * The hero's liquid backdrop - a real animated fluid-surface shader
 * (github.com/ruucm/shadergradient), not a static CSS wash. Replaces
 * `<AmbientLight variant="hero">`'s flat radial glow with the same recipe
 * worked out in the landing redesign exploration (app/(catalog)/dev/
 * hero-concept): `type="waterPlane"` for genuine wave motion rather than
 * the library's faceted "plane" deformation, `pixelDensity={1.75}` so the
 * canvas doesn't render under-resolution and read as choppy, and the
 * product's own three tokens (background/green/card) as the only three
 * colors in the gradient - no fourth hue from the library's demo palette.
 *
 * Masked to fade out by ~75% down the section and scrimmed with a flat
 * dark overlay on top, both for the same reason: the hero's headline and
 * body copy need to stay readable over a moving surface, and the fade
 * keeps the effect from bleeding into whatever section follows.
 */
export function HeroGradientBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 75%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 75%)" }}>
      <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }} pixelDensity={1.75} fov={40} pointerEvents="none">
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.12}
          uStrength={2.2}
          uDensity={1.4}
          uFrequency={4.2}
          uAmplitude={1.6}
          cAzimuthAngle={200}
          cPolarAngle={70}
          cDistance={4.8}
          cameraZoom={1}
          lightType="3d"
          brightness={0.26}
          reflection={0.04}
          grain="off"
          wireframe={false}
          color1="#0c0b09"
          color2="#30d158"
          color3="#17140f"
        />
      </ShaderGradientCanvas>
      <div className="absolute inset-0" style={{ background: "rgba(6,7,6,0.35)" }} />
    </div>
  );
}
