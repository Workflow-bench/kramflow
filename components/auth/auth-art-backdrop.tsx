"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/**
 * Replaces the auth split's old warm amber/brown radial-gradient mesh
 * (`.auth-art-glow` in globals.css - a leftover from before the landing
 * redesign's green/liquid language) with the same real animated fluid
 * surface used across the new homepage (components/site/hero-gradient-
 * backdrop.tsx, components/site/new-landing.tsx's ClosingBackdrop): the
 * product's own three tokens only, `type="waterPlane"` for genuine wave
 * motion, `pixelDensity={1.75}`.
 *
 * No bottom fade-mask here, unlike the hero's version - this panel's own
 * box is the whole extent of the background (no viewport-height edge
 * behind it to fade before, same reasoning the removed `.auth-art-glow`
 * comment already gave for skipping a mask).
 */
export function AuthArtBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }} pixelDensity={1.6} fov={40} pointerEvents="none">
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.1}
          uStrength={1.8}
          uDensity={1.3}
          uFrequency={3.8}
          uAmplitude={1.3}
          cAzimuthAngle={200}
          cPolarAngle={70}
          cDistance={4.8}
          cameraZoom={1}
          lightType="3d"
          brightness={0.2}
          reflection={0.03}
          grain="off"
          wireframe={false}
          color1="#0c0b09"
          color2="#30d158"
          color3="#17140f"
        />
      </ShaderGradientCanvas>
      <div className="absolute inset-0" style={{ background: "rgba(6,7,6,0.4)" }} />
    </div>
  );
}
