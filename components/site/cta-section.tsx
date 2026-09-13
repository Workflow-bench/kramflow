import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The closing statement.
 *
 * Previous version borrowed one idea from a supplied "Cta69" pattern: an
 * oversized, very low-contrast word behind a centred close. It was
 * competent and it was the same shape as every other SaaS closing block —
 * ambient type, heading, paragraph, two buttons, a reassurance line.
 *
 * This drops the ambient layer entirely. It was decoration standing in
 * for a point of view, and with the hero now setting type *on* the real
 * product, a ghost word floating behind a centred heading reads as the
 * weaker trick. What is left is the sentence, one action, and nothing
 * else — the page's quietest moment and its largest type, which is the
 * scale contrast the rest of the page has been building toward.
 *
 * The line is Kramflow's, not an agency's: it names what the product
 * actually does rather than promising transformation. No badge, no pill
 * row, no marquee, no second paragraph.
 *
 * Capped at 6rem. An earlier pass had this at 8rem, which measured 128px
 * against the hero's 112px h1 — the closing line shouting louder than the
 * page's only h1 is a hierarchy inversion, not a crescendo.
 */
export function CTASection() {
  return (
    <section className="border-b border-line-soft">
      <div className="mx-auto max-w-[1600px] px-6 py-32 sm:px-10 lg:py-48">
        <h2 className="max-w-[13ch] font-display text-[clamp(2.5rem,7vw,6rem)] text-primary">
          When the room moves, Kramflow moves with it.
        </h2>

        <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-5">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-control bg-primary px-7 py-3.5 text-[15px] font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
          <span className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2">
            No credit card · Runs your next show
          </span>
        </div>
      </div>
    </section>
  );
}
