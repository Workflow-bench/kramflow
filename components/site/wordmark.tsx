/**
 * The real wordmark, replacing the placeholder that stood in since launch
 * (the square-cue-mark + "Kramflow" in Archivo — see git history for its
 * own reasoning). Bilingual lockup: ક્રમ (Gujarati, the product's actual
 * name) set beside "Flow" (Archivo, the product's own display face) - no
 * icon, no cue-mark square. Two separate font-family spans, not one string
 * in a mixed-script font, because no single typeface here carries both
 * scripts - Archivo has no Gujarati glyphs, Noto Sans Gujarati has no
 * Latin display cut worth using for "Flow".
 *
 * The Gujarati sits at ~1.13x the Latin's font-size with a small downward
 * nudge: set at equal em-size, Gujarati reads visibly smaller/lighter than
 * Latin caps (it has no true cap-height the way Latin does), so matching
 * pixel size rather than optical size reads as two mismatched weights
 * side by side.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.2em] ${className}`}>
      <span
        className="text-[19px] font-bold leading-none text-primary relative top-[1px]"
        style={{ fontFamily: "var(--font-gujarati), sans-serif" }}
      >
        ક્રમ
      </span>
      <span className="font-display text-[17px] font-bold leading-none tracking-[-0.02em] text-primary">Flow</span>
    </span>
  );
}
