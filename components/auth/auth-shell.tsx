import Link from "next/link";
import { Wordmark } from "@/components/site/wordmark";
import { LiquidBackdrop } from "@/components/site/liquid-backdrop";
import { AuthArt } from "./auth-art";

/**
 * One composition for login, signup, recovery and confirmation states.
 *
 * A single unified card (the composition pattern named directly from two
 * references: a dark product-preview panel beside a lighter form panel,
 * both living inside one rounded, bordered card, floating on a plain
 * surrounding page rather than running edge to edge) - not the previous
 * pass's borderless centered card, and not the split-screen's original
 * full-bleed two-column page either. Kramflow is dark-mode-only end to
 * end (a standing product constraint, see PRODUCT.md), so the "lighter"
 * side of the reference becomes a slightly raised dark tone instead of a
 * literal white panel - same contrast relationship, this product's own
 * palette.
 *
 * Below 900px: the showcase panel (AuthArt) drops out entirely and the
 * card becomes one column, form only - same breakpoint behavior as
 * before, just inside the new card shape.
 */
export function AuthShell({
  title,
  support,
  children,
  footer,
  showArt = true,
}: {
  title: string;
  support?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showArt?: boolean;
}) {
  return (
    <div className="relative min-h-dvh bg-background text-primary">
      <LiquidBackdrop opacity={0.3} />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-10 sm:py-16">
        <div
          className={`auth-form-enter grid w-full overflow-hidden rounded-panel border border-line shadow-[0_60px_160px_-48px_rgba(0,0,0,0.9)] ${
            showArt ? "max-w-[1040px] grid-cols-1 min-[900px]:grid-cols-[1.08fr_1fr]" : "max-w-[460px] grid-cols-1"
          }`}
        >
          {showArt && <AuthArt className="hidden min-h-[640px] min-[900px]:flex min-[900px]:flex-col" />}
          <main className="glass-panel flex flex-col justify-center px-8 py-12 sm:px-12 sm:py-14">
            <div className="mx-auto w-full max-w-[360px]">
              {/* One wordmark per card. The showcase panel carries its own (top-left,
                  inside AuthArt) when shown; this one only renders when there's no
                  showcase panel to carry it (the single-column states). */}
              {!showArt && (
                <Link
                  href="/"
                  className="-ml-2 mb-8 inline-block rounded-chip p-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Wordmark />
                </Link>
              )}
              <h1 className="font-display text-[26px] leading-[32px] text-primary sm:text-[28px] sm:leading-[36px]">
                {title}
              </h1>
              {support && <p className="mt-2 text-[15px] leading-6 text-muted">{support}</p>}
              <div className="mt-8">{children}</div>
              {footer && <div className="mt-6 text-[14px] leading-5 text-muted-2">{footer}</div>}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
