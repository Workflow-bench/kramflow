"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./wordmark";
import { useGsap } from "./use-gsap";

/**
 * Navigation that gets out of the hero's way, then becomes chrome.
 *
 * Over the hero the bar is transparent and tall, so the first viewport
 * belongs to the product and the headline rather than to a header sitting
 * on top of them. Once the hero is behind you it compacts and picks up
 * `.glass-chrome` — the product's own persistent-nav material, the same
 * class `EventShellHeader` uses inside the app — so the chrome a visitor
 * ends the page with is literally the chrome they get after signing up.
 *
 * One ScrollTrigger, one toggle, one tween. Padding is animated rather
 * than height so nothing reflows the page below it, and the background
 * and border are plain CSS transitions driven by React state. Under
 * reduced motion the bar simply starts compact.
 */

const NAV_LINKS = [
  { label: "One cue", href: "#one-cue" },
  { label: "Product", href: "#product" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const root = useRef<HTMLElement>(null);

  useGsap(root, ({ gsap, ScrollTrigger, reduced }) => {
    if (reduced) {
      setCompact(true);
      gsap.set("[data-nav-inner]", { paddingTop: 10, paddingBottom: 10 });
      return;
    }

    ScrollTrigger.create({
      start: 140,
      end: 99999,
      onToggle: (self) => {
        // React state, not a data attribute. `glass-chrome` is a custom
        // class in globals.css rather than a Tailwind utility, so the
        // `data-[compact=true]:glass-chrome` variant this used to rely on
        // silently generated nothing — measured backdropFilter: none on a
        // bar that was supposedly glass.
        setCompact(self.isActive);
        gsap.to("[data-nav-inner]", {
          paddingTop: self.isActive ? 10 : 22,
          paddingBottom: self.isActive ? 10 : 22,
          duration: 0.35,
          ease: "power2.out",
        });
      },
    });
  });

  return (
    <nav
      ref={root}
      data-compact={compact}
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        compact ? "glass-chrome border-line-soft" : "border-transparent"
      }`}
    >
      <div data-nav-inner className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-[22px] sm:px-10">
        <Link
          href="/"
          className="-my-3 shrink-0 rounded-chip py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="-my-3 rounded-chip py-3 text-console-label uppercase text-muted-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/login"
            className="-my-3 rounded-chip py-3 text-console-label uppercase text-muted-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-control bg-primary px-4 py-2.5 text-console-sm font-medium text-background transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-2.5 flex h-11 w-11 items-center justify-center text-primary transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        >
          {open ? <X className="h-5 w-5" strokeWidth={2} /> : <Menu className="h-5 w-5" strokeWidth={2} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            // Opaque, not `.glass-chrome`. That class is 65%-alpha by
            // design for the persistent toolbar sliver it was built for
            // (see the comment above); this dropdown sits directly over
            // the hero at the same screen position, so translucency let
            // the hero's own "Start free" button show through, nearly
            // stacked on this panel's own "Start free" — reading as a
            // rendering glitch, not an overlay. A menu that must fully
            // replace what's under it needs a solid ground.
            className="overflow-hidden border-t border-line-soft bg-background lg:hidden"
          >
            <div className="flex flex-col px-6 py-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-line-soft py-4 text-base text-primary"
                >
                  {link.label}
                </a>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className="py-4 text-base text-primary">
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="my-3 rounded-control bg-primary py-3.5 text-center text-base font-medium text-background"
              >
                Start free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
