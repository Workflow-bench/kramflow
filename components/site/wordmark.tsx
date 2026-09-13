/**
 * A temporary but *intentional* wordmark, replacing the Lucide
 * `CirclePower` icon that had been standing in as the brand.
 *
 * Kramflow has no designed logo — `logo.svg` at the repo root is an
 * unrelated "CF Monogram" and the favicon is a different mark again. The
 * honest options were to keep dressing a generic icon-library glyph as an
 * identity, or to set the name properly and let the typography carry it
 * until a real mark exists. This is the second.
 *
 * The cue mark before the name is a square, not a circle. A circle in
 * this palette reads as a status dot — the product uses exactly that for
 * "display online" — whereas a small filled square is the mark used to
 * flag a cue. It is drawn in the live green, because the one idea the
 * brand has is that something is happening right now.
 *
 * This is a placeholder with a point of view, and it is still a launch
 * item: a real mark, a matching favicon and an OG image are unbuilt.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-[1px] bg-status-green" />
      <span className="font-display text-[17px] tracking-[-0.03em] text-primary">Kramflow</span>
    </span>
  );
}
