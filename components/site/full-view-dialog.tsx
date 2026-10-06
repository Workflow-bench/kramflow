"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ProductShot, type ShotKey } from "./product-shot";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/**
 * Full inspection of a recorded capture: the complete, uncropped, unmodified source
 * image, so anything the page frames or crops elsewhere can always be checked against
 * the whole screenshot.
 *
 * It is a real dialog, not an overlay: focus is trapped while open and returned to the
 * trigger on close (shared `useDialogFocus`, the same implementation the product's own
 * Modal uses), Escape closes it, and the page behind does not scroll.
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
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
        aria-label={`Close ${label} full view`}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label}, full recorded product view`}
        className="relative max-h-full w-full max-w-[1600px] overflow-auto rounded-panel border border-line bg-card"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
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
        <ProductShot shot={shot} sizes="(min-width: 1024px) 90vw, 100vw" />
      </div>
    </div>
  );
}
