"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProductShot } from "./product-shot";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/**
 * The hero's presentation aperture for the real Operator Console capture.
 *
 * The capture is scaled uniformly (width-driven; the element keeps the file's own
 * 3360×2100 ratio) and clipped by a fixed-height window. Only the window's lower
 * edge fades into the page background. Nothing is stretched, warped, repainted or
 * colour-graded, and the fade is the only thing applied to the image.
 *
 * **The fade stop is computed, not chosen.** `OPAQUE_FRACTION` is the share of the
 * capture's own height that must stay fully opaque, measured from the rendered file:
 * the console's cue title sits at ~12% of image height, the countdown at ~26%, the
 * Next/Previous/Hold cluster at ~24–30%, and the timer-adjust row at ~35%. Keeping
 * 36% opaque therefore keeps every readable cue value and every recognisable control
 * out of the gradient, at any viewport size — the component measures its own box and
 * converts that fraction into a mask stop, instead of trusting a fixed percentage
 * that would silently start eating controls as the aperture changes height.
 *
 * Caption and "View full console" live outside the aperture, so no text or control is
 * ever faded. The full view is a real dialog: Escape closes it, focus is trapped
 * while open and returned to the trigger on close (shared `useDialogFocus`, the same
 * implementation the product's own Modal uses).
 */

const IMAGE_RATIO = 3360 / 2100;
const OPAQUE_FRACTION = 0.36;
// Below this the fade would be thinner than it is worth; the aperture simply ends.
const MIN_FADE_SPAN = 6;

export function ConsoleAperture() {
  const apertureRef = useRef<HTMLDivElement>(null);
  const [maskStart, setMaskStart] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    const el = apertureRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const apertureHeight = el.clientHeight;
    if (!width || !apertureHeight) return;
    const imageHeight = width / IMAGE_RATIO;
    const opaquePx = imageHeight * OPAQUE_FRACTION;
    const pct = (opaquePx / apertureHeight) * 100;
    // Never fade a control: if the aperture is shorter than the opaque band, there
    // is simply no fade. Otherwise leave at least a visible span to fade across.
    setMaskStart(pct >= 100 - MIN_FADE_SPAN ? null : Math.round(pct));
  }, []);

  useEffect(() => {
    measure();
    const el = apertureRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const mask =
    maskStart === null
      ? undefined
      : `linear-gradient(to bottom, #000 0%, #000 ${maskStart}%, transparent 100%)`;

  return (
    <>
      <div className="hero-aperture-row">
        {/* Caption and control sit above the aperture, never inside the fade. */}
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[13px] text-muted-2">Operator Console · Recorded product view</p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex h-11 items-center rounded-control px-1 text-[13px] text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            View full console
          </button>
        </div>

        <div
          ref={apertureRef}
          className="hero-aperture relative overflow-hidden rounded-t-panel border border-b-0 border-line bg-card"
          style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        >
          {/* Absolutely positioned so the capture contributes no intrinsic height:
              the aperture's size is the viewport remainder the hero gives it, and the
              image is scaled to the aperture's width and clipped by it. */}
          <ProductShot
            shot="console"
            priority
            className="hero-aperture-img"
            sizes="(min-width: 1024px) min(1360px, 92vw), 100vw"
          />
        </div>
      </div>

      {expanded && <FullConsoleDialog onClose={() => setExpanded(false)} />}
    </>
  );
}

function FullConsoleDialog({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while the full capture is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/92 p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close full console view"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Operator Console, full recorded product view"
        className="relative max-h-full w-full max-w-[1600px] overflow-auto rounded-panel border border-line bg-card"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
          <p className="text-[13px] text-muted-2">Operator Console · Recorded product view</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <ProductShot shot="console" sizes="(min-width: 1024px) 90vw, 100vw" />
      </div>
    </div>
  );
}
