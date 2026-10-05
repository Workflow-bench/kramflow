import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The call-to-action, staged like a cue. At rest it reads STANDBY (amber);
 * on hover or keyboard focus a green fill sweeps across, the light flips to
 * GO, and the arrow steps forward. Pure CSS, so it costs no JS and the
 * global reduced-motion rule collapses every transition.
 */
export function GoLink({ href, children, size = "md" }: { href: string; children: string; size?: "md" | "lg" }) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex flex-col items-start overflow-hidden rounded-control bg-primary text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        size === "lg" ? "px-7 py-3.5" : "px-6 py-3"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left scale-x-0 bg-status-green transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 group-active:scale-x-100"
      />
      <span
        aria-hidden="true"
        className="tnum relative flex items-center gap-1.5 text-[9px] uppercase leading-none tracking-[0.2em]"
      >
        <span className="h-[5px] w-[5px] rounded-full bg-status-orange transition-colors duration-300 group-hover:bg-background group-focus-visible:bg-background" />
        <span className="grid">
          <span className="col-start-1 row-start-1 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">Standby</span>
          <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">Go</span>
        </span>
      </span>
      <span className={`relative mt-1.5 inline-flex items-center gap-2 font-medium ${size === "lg" ? "text-[17px]" : "text-[15px]"}`}>
        {children}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
      </span>
    </Link>
  );
}
