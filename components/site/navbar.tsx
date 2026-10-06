"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./wordmark";
import { SiteAction, SiteTextLink } from "./site-action";

/**
 * A quiet, fixed-height header.
 *
 * Three long chapter names used to fill the centre and read as another row of content.
 * Two short destinations replace them: **Product** is the scroll scene, **Features** is
 * the operations chapter. Log in stays subordinate; Start free is the single action.
 *
 * **No padding travel.** The bar used to animate its own padding from 22px to 10px
 * through GSAP on every scroll crossing, which moved the whole page's first row for no
 * informational gain and kept a motion engine wired into navigation. The height is now
 * constant and only the background and border change — a cheap passive scroll listener,
 * not an animation, so there is nothing here for Pause or reduced motion to stop.
 *
 * **The mobile panel is always mounted (HF-04).** It used to render only while open
 * inside `AnimatePresence`, so `inert={!open}` was evaluated exclusively on open
 * instances and was therefore always `false`; during the exit animation five links
 * stayed focusable and in the accessibility tree. Keeping the element mounted and
 * driving it with CSS means `inert` flips to `true` the instant the menu starts
 * closing, which is the window the review actually measured.
 */

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
];

const HEADER_H = 64;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Background state only — no tween, no layout change.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active destination, for `aria-current` on the matching link.
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.slice(1));
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: `-${HEADER_H}px 0px -55% 0px`, threshold: [0.01, 0.25] }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  // Escape closes the disclosure and returns focus to the control that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? "glass-chrome bg-background/90! border-line-soft" : "border-transparent"
      }`}
    >
      <div
        className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 sm:px-10"
        style={{ height: HEADER_H }}
      >
        <Link
          href="/"
          data-arrival="wordmark"
          className="-my-3 shrink-0 rounded-chip py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={active === link.href.slice(1) ? "true" : undefined}
              className={`inline-flex h-11 items-center rounded-control px-1 text-[15px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active === link.href.slice(1) ? "text-primary" : "text-muted hover:text-primary"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <SiteTextLink href="/login">Log in</SiteTextLink>
          <SiteAction href="/signup" role="primary" size="nav">
            Start free
          </SiteAction>
        </div>

        <button
          ref={toggle}
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

      {/* Always mounted: `inert` is real during the closing window, not only after it. */}
      <div
        id="site-menu"
        inert={!open}
        aria-hidden={!open}
        className={`site-menu overflow-hidden border-t bg-background lg:hidden ${
          open ? "site-menu-open border-line-soft" : "border-transparent"
        }`}
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
          <SiteAction href="/signup" role="primary" size="hero" onClick={() => setOpen(false)} className="my-3 w-full">
            Start free
          </SiteAction>
        </div>
      </div>
    </nav>
  );
}
