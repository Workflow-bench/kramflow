"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ProductShot, type ShotKey } from "./product-shot";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/**
 * Full inspection of a recorded capture: the complete, uncropped, unmodified source image.
 *
 * Placement (GM-01): the dialog is portalled to <body>, so it sits outside the smoother's
 * transformed content. A fixed overlay inside a transformed ancestor takes that ancestor as
 * its containing block, which is how the backdrop ended up thousands of pixels tall in the
 * smooth wrapper. Here the overlay is bound to the viewport.
 *
 * Scroll (GM-01): while open, the smoother is paused, so the page cannot move underneath,
 * and the document's overflow is locked. Both are restored to exactly the state they were
 * in before opening, including when the dialog unmounts without a user close.
 *
 * Focus: the shared useDialogFocus trap and return. Escape and the backdrop both close.
 * The image region scrolls internally, so a tall capture never pushes the close control off
 * screen.
 */
export function FullViewDialog({
  shot,
  label,
  onClose,
}: {
  shot: ShotKey;
  label: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef);

  // Portals need the body, which only exists in the browser. Server render and hydration
  // both see `false`; the client sees `true` without a state-setting effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const smoother = ScrollSmoother.get();
    const wasPaused = smoother ? smoother.paused() : false;
    const html = document.documentElement;
    const priorOverflow = html.style.overflow;
    smoother?.paused(true);
    html.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = priorOverflow;
      if (smoother && !wasPaused) smoother.paused(false);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/92 p-4 sm:p-8"
      // A click on the gutter closes. The backdrop is handled here rather than by a sibling
      // button: the focus trap marks siblings of the panel inert, which also removes them from
      // pointer hit-testing, so a sibling backdrop button never received the click.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label}, full recorded product view`}
        className="relative flex max-h-[calc(100svh-2rem)] w-full max-w-[1600px] flex-col overflow-hidden rounded-panel border border-line bg-card sm:max-h-[calc(100svh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
          <p className="text-[13px] text-muted-2">{label} · complete recorded capture</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <ProductShot shot={shot} sizes="(min-width: 1024px) 90vw, 100vw" />
        </div>
      </div>
    </div>,
    document.body
  );
}
