"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Canonical tooltip — the audit counted 56 native title= uses across the
// app as its own kind of fragmentation: browser-timed, invisible on
// touch, and never reachable by keyboard focus (a title= attribute has no
// focus-triggered equivalent). This wraps a single child element, showing
// a real, styled tooltip on hover *and* focus, so it degrades usefully
// for keyboard and screen-reader users instead of silently disappearing.
//
// Required, not optional, for an icon-only control per DESIGN.md's
// component table — an IconButton with only an aria-label has a name for
// assistive tech but nothing sighted-mouse users can read without
// guessing; this pairs the two rather than picking one.
export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: string;
  children: React.ReactElement;
  side?: "top" | "bottom";
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {(() => {
        const child = children as React.ReactElement<{
          "aria-describedby"?: string;
          onFocus?: React.FocusEventHandler;
          onBlur?: React.FocusEventHandler;
        }>;
        return {
          ...child,
          props: {
            ...child.props,
            "aria-describedby": id,
            onFocus: (e: React.FocusEvent) => {
              setVisible(true);
              child.props.onFocus?.(e);
            },
            onBlur: (e: React.FocusEvent) => {
              setVisible(false);
              child.props.onBlur?.(e);
            },
          },
        };
      })()}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-control bg-raised border border-line px-2 py-1 text-console-meta text-primary shadow-float transition-opacity duration-100",
          side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          visible ? "opacity-100" : "opacity-0"
        )}
      >
        {content}
      </span>
    </span>
  );
}
