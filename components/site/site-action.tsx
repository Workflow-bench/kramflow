import Link from "next/link";

/**
 * The landing page's one action family (nav + hero + hero-adjacent links).
 *
 * Deliberately landing-scoped rather than a new variant on
 * `components/ui/button.tsx`: the product's Button carries console sizing and
 * state semantics that nothing on a marketing page should be able to shift. The
 * two surfaces share radius and type discipline, not an implementation.
 *
 * Two roles, two sizes:
 * - `primary` is the single signup action; `quiet` is everything subordinate to
 *   it (the nav's Log in, the hero's "See it in action").
 * - `hero` is 52px, `nav` is 44px — the same control at two scales, so the nav's
 *   Start free and the hero's Start free read as one object seen twice.
 *
 * No cue-light wording here. "Standby"/"Go" are real operational states inside
 * the product, and a signup control that says STANDBY reads as show state
 * rather than as a button (landing-auth design review D08/D09).
 */

type Role = "primary" | "quiet";
type Size = "hero" | "nav";

const ROLE: Record<Role, string> = {
  primary:
    "bg-primary text-background hover:bg-white focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  quiet: "text-primary border border-line hover:border-white/25 hover:bg-overlay-1",
};

const SIZE: Record<Size, string> = {
  hero: "h-[52px] px-6 text-[16px]",
  nav: "h-11 px-4 text-[15px]",
};

export function SiteAction({
  href,
  children,
  role = "primary",
  size = "nav",
  className = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  role?: Role;
  size?: Size;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-control font-medium transition-[background-color,box-shadow,transform] duration-200 ease-out hover:shadow-[0_0_0_1px_rgba(244,239,229,0.2),0_10px_28px_-14px_rgba(244,239,229,0.3)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${ROLE[role]} ${SIZE[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * A plain text link at the same 44px interaction height as the nav action, so
 * the header's targets are uniform without Log in acquiring a button's weight.
 */
export function SiteTextLink({
  href,
  children,
  onClick,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`site-text-link inline-flex h-11 items-center rounded-control px-1 text-[15px] text-muted transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {children}
    </Link>
  );
}
