import { cn } from "@/lib/utils";

// Console-scale section label — the Console equivalent of
// components/tv/section-label.tsx, which is Stage-scale (text-caption,
// 17px) and was leaking into every Console panel heading ("PROGRAM",
// "LIVE NOW", "CONTROLS", "NOTES", ...) simply because nothing stopped the
// import. This is the canonical Console one; components/tv/section-label.tsx
// stays Stage-only. See DESIGN.md's Console-vs-Stage guardrail.
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-console-label uppercase text-muted-2", className)}>
      {children}
    </p>
  );
}
