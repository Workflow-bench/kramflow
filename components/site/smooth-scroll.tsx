"use client";

import { useEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

/**
 * The homepage's one scrolling owner.
 *
 * ScrollSmoother runs only where it is wanted: a desktop-width viewport with a fine
 * pointer and no reduced-motion preference. Touch, narrow screens and reduced motion keep
 * the browser's own scrolling untouched. Both conditions are media queries, so a change
 * (resize, a pointer swap, the OS setting) tears the smoother down or builds it again
 * without a reload.
 *
 * Only this component may own scroll. Anchor clicks on the page are routed here: with a
 * smoother active they go through its `scrollTo`, otherwise through a single native
 * `window.scrollTo`. Nothing else in the homepage calls scrollTo, and no CSS smooth
 * behaviour is set for the document, so two owners never fight over one scroll position.
 *
 * Structure: `#smooth-wrapper` > `#smooth-content`. The skip link and fixed navigation sit
 * outside, because a transformed ancestor would break their `position: fixed`. The footer
 * is inside, so it scrolls with the page.
 */

const HEADER_OFFSET = 88; // matches the scroll-margin-top on the scene anchors
const DESKTOP_SMOOTH = "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

let registered = false;

function smootherActive(): ScrollSmoother | null {
  return ScrollSmoother.get() ?? null;
}

/**
 * Scrolls to a same-page destination and moves focus there for keyboard users. Works with
 * or without the smoother, and respects the fixed-header offset.
 */
export function navigateToAnchor(hash: string): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = id ? document.getElementById(id) : null;
  if (!target) return false;

  const smoother = smootherActive();
  if (smoother) {
    // Element-based smoother targets measure through the smoother's own transform and
    // landed 16-64px off in testing. offsetTop is layout-only and ignores transforms, so
    // sum it up to the content root and scroll to that number instead.
    let y = 0;
    let el: HTMLElement | null = target;
    const root = document.getElementById("smooth-content");
    while (el && el !== root) {
      y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    const want = Math.max(0, y - HEADER_OFFSET);
    smoother.scrollTo(want, true);
    // The smooth tween can settle a little short of its target, and the transform lag
    // makes that hard to predict. Once it has had time to finish, measure the destination
    // as it is on screen and correct the remainder with one non-smooth step.
    window.setTimeout(() => {
      const current = smootherActive();
      if (!current) return;
      const delta = target.getBoundingClientRect().top - HEADER_OFFSET;
      if (Math.abs(delta) > 2) current.scrollTo(current.scrollTop() + delta, false);
    }, 900);
  } else {
    const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }

  // Skip links and same-page jumps should land focus at the destination, not only the
  // viewport. Elements without a tabindex get a temporary -1 so they can take focus.
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  return true;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
      registered = true;
    }

    const wrapper = document.getElementById("smooth-wrapper");
    const content = document.getElementById("smooth-content");
    if (!wrapper || !content) return;

    let smoother: ScrollSmoother | null = null;
    const mq = window.matchMedia(DESKTOP_SMOOTH);

    const sync = () => {
      if (mq.matches && !smoother) {
        smoother = ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 0.45,
          // No data-speed/data-lag effects: the product scenes are scrubbed by ScrollTrigger.
          effects: false,
          smoothTouch: false,
        });
        // Triggers built before the smoother existed are rebound to its scroller here.
        ScrollTrigger.refresh();
      } else if (!mq.matches && smoother) {
        smoother.kill();
        smoother = null;
        ScrollTrigger.refresh();
      }
    };
    sync();
    mq.addEventListener("change", sync);

    // Same-page anchor clicks, including the skip link. Modified clicks and middle clicks
    // keep their browser behaviour (new tab, etc.).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const hash = a.getAttribute("href") ?? "";
      if (hash.length < 2) return;
      if (!navigateToAnchor(hash)) return;
      e.preventDefault();
      // Keep the URL shareable without adding a history entry per chapter.
      history.replaceState(history.state, "", hash);
    };
    document.addEventListener("click", onClick);

    // A deep link arrives with a hash. Wait a frame so the layout (and the smoother, if any)
    // has settled before measuring the destination.
    if (location.hash) {
      // Pin spacers from the room scene are inserted after first layout. Refresh first, or
      // the destination is measured before they exist and the jump lands short.
      const frame = requestAnimationFrame(() => {
        ScrollTrigger.refresh(true);
        navigateToAnchor(location.hash);
      });
      return () => {
        cancelAnimationFrame(frame);
        mq.removeEventListener("change", sync);
        document.removeEventListener("click", onClick);
        smoother?.kill();
        smoother = null;
      };
    }

    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("click", onClick);
      smoother?.kill();
      smoother = null;
    };
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  );
}
