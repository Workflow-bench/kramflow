"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A fixed-design-size replica scaled uniformly to its container.
 *
 * The replica is laid out once at its design width (the product's own proportions) and
 * scaled as a whole, so text, borders and spacing keep their relationships at every
 * viewport. Nothing is reflowed for a different width, and nothing is stretched.
 */
export function FitFrame({
  designWidth,
  designHeight,
  label,
  children,
  className = "",
}: {
  designWidth: number;
  designHeight: number;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / designWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      className={`relative w-full overflow-hidden bg-background ${className}`}
      style={{ aspectRatio: `${designWidth} / ${designHeight}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: designWidth, height: designHeight, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
