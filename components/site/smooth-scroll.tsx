"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { startNavigation, type ScrollEnv, type Transaction } from "./scroll-navigation";

/**
 * The homepage's one scrolling owner.
 *
 * Ownership, stated once:
 * - ScrollSmoother runs only on desktop with a fine pointer and motion allowed. Touch,
 *   narrow screens and reduced motion use the browser's own scrolling.
 * - At most one navigation transaction is live at a time (scroll-navigation.ts). A new
 *   navigation, any visitor scroll intent, a breakpoint or preference change, and leaving
 *   the page all cancel it. Cancelled work never writes to the scroller again.
 * - Child scroll scenes build their ScrollTriggers from a frame after this component
 *   mounts (see use-gsap.ts). Layout effects of the parent run after the children's, so
 *   the smoother is created in the same commit and every scene sees it when it starts.
 *   That ordering is explicit, not an accident of effect order.
 *
 * Structure: `#smooth-wrapper` > `#smooth-content` wraps the main content and footer. The
 * skip link, fixed navigation, the motion flag and the arrival sequence sit outside it, and
 * so do the dialogs (FullViewDialog portals to the body), so a transform can never contain
 * a fixed overlay.
 */

const HEADER_OFFSET = 88;
const DESKTOP_SMOOTH = "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

let registered = false;
let live: Transaction | null = null;
let smootherRef: ScrollSmoother | null = null;
let quietFrame = 0;

function cancelLive() {
  live?.cancel();
  live = null;
  if (quietFrame) window.cancelAnimationFrame(quietFrame);
  quietFrame = 0;
}

/**
 * Runs `fn` once the window has been still for a few frames. A route that mounts on a hash
 * (Back, or a deep link) has its own scroll writes in the frames after mount, so starting a
 * navigation before they land makes those writes look like unexplained movement. Bounded, and
 * cancelled by the same input and navigation paths as a live transaction.
 */
function whenScrollQuiet(fn: () => void) {
  if (quietFrame) window.cancelAnimationFrame(quietFrame);
  let still = 0;
  let last = NaN;
  const started = performance.now();
  const step = () => {
    quietFrame = 0;
    const y = window.scrollY;
    still = y === last ? still + 1 : 0;
    last = y;
    if (still >= 4 || performance.now() - started > 1500) {
      fn();
      return;
    }
    quietFrame = window.requestAnimationFrame(step);
  };
  quietFrame = window.requestAnimationFrame(step);
}

/** Cancels any navigation in flight. Called by input, by teardown and by new navigations. */
export function cancelScrollNavigation() {
  cancelLive();
}

function scrollerEnv(
  s: ScrollSmoother | null,
  targetTop: () => number
): ScrollEnv {
  return {
    read: () => (s ? s.scrollTop() : window.scrollY),
    scrollTo: (y, smooth) => {
      if (s) s.scrollTo(Math.max(0, y), smooth);
      else {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduced ? "smooth" : "instant" });
      }
    },
    targetTop,
    raf: (cb) => window.requestAnimationFrame(cb),
    cancelRaf: (id) => window.cancelAnimationFrame(id),
    now: () => performance.now(),
  };
}

/** Layout-only offset of an element inside the smooth content, ignoring transforms. */
function contentOffset(target: HTMLElement): number {
  const root = document.getElementById("smooth-content");
  let y = 0;
  let el: HTMLElement | null = target;
  while (el && el !== root) {
    y += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return y;
}

/**
 * Navigates to a same-page destination. Returns false if the hash has no target, so the
 * browser's own behaviour applies. Focus moves to the destination for keyboard users, with
 * a temporary tabindex that is removed again on blur so the element's markup is unchanged.
 */
export function navigateToAnchor(hash: string): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = id ? document.getElementById(id) : null;
  if (!target) return false;

  cancelLive();
  const s = smootherRef;
  // Recover native hash/restoration writes into the fixed overflow-hidden wrapper.
  // The smoother owns the window scroll; an inner offset would desync its triggers.
  if (s) {
    const wrapper = document.getElementById("smooth-wrapper");
    if (wrapper) wrapper.scrollTop = 0;
  }
  // The smoother clamps every write to a cached maxScroll. Pinned scenes add their spacers a
  // frame after mount, so refresh before measuring, or the first smooth write clamps to the
  // stale maximum and only the measured correction moves the page.
  if (s) ScrollTrigger.refresh();
  const offset = id === "top" ? 0 : HEADER_OFFSET;
  const goal = s ? contentOffset(target) - offset : window.scrollY + target.getBoundingClientRect().top - offset;
  live = startNavigation(
    scrollerEnv(s, () => target.getBoundingClientRect().top),
    Math.max(0, goal),
    offset
  );

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
  return true;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (!registered) {
      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
      registered = true;
    }

    const mq = window.matchMedia(DESKTOP_SMOOTH);
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const create = () => {
      if (smootherRef) return;
      smootherRef = ScrollSmoother.create({
        wrapper: "#smooth-wrapper",
        content: "#smooth-content",
        smooth: 0.45,
        effects: false,
        smoothTouch: false,
      });
      ScrollTrigger.refresh();
    };
    const destroy = () => {
      if (!smootherRef) return;
      smootherRef.kill();
      smootherRef = null;
      ScrollTrigger.refresh();
    };

    const sync = () => {
      // Any change in breakpoint or preference first drops the navigation that was
      // measured against the old scroller.
      cancelLive();
      if (mq.matches && !reducedMq.matches) create();
      else destroy();
    };
    sync();
    mq.addEventListener("change", sync);
    reducedMq.addEventListener("change", sync);

    // Visitor intent always wins over a navigation still settling.
    const interrupt = () => cancelLive();
    const intentKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
    const onKey = (e: KeyboardEvent) => {
      if (intentKeys.has(e.key)) cancelLive();
    };
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("pointerdown", interrupt, true);
    window.addEventListener("keydown", onKey, true);

    // Own same-page clicks before Next Link handles them. Its native hash scroll can
    // scroll the fixed smoother wrapper independently of ScrollTrigger in production.
    // Preventing default in capture lets Next Link skip its scroll while preserving
    // React onClick callbacks (for example, closing the mobile menu).
    // Modified or non-primary clicks keep browser behaviour.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"], a[href="/"]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const href = a.getAttribute("href") ?? "";
      // Next Link treats the same home route as unchanged, even when its hero is
      // offscreen. Let the existing scroll owner handle the wordmark's top action.
      const home = href === "/" && location.pathname === "/" && !location.search;
      const hash = home ? "#top" : href;
      if (hash.length < 2 || !navigateToAnchor(hash)) return;
      e.preventDefault();
      // A new history entry per jump, so Back returns to the previous chapter.
      if (home) {
        if (location.hash) history.pushState(history.state, "", "/");
      } else if (location.hash !== hash) history.pushState(history.state, "", hash);
    };
    document.addEventListener("click", onClick, true);

    // Back/forward between chapters. A hash entry scrolls to its destination; the empty
    // entry returns to the top. Browser scroll restoration is left to the page, since the
    // smoother owns the scroll position.
    const onPop = () => {
      if (location.hash) {
        const hash = location.hash;
        cancelLive();
        whenScrollQuiet(() => navigateToAnchor(hash));
        return;
      }
      cancelLive();
      // History restoration may write after popstate. Wait for it, then measure
      // the real top so a later restoration write can still be corrected.
      whenScrollQuiet(() => {
        live = startNavigation(
          scrollerEnv(smootherRef, () => (document.getElementById("top")?.getBoundingClientRect().top ?? 0) + HEADER_OFFSET),
          0,
          HEADER_OFFSET
        );
      });
    };
    window.addEventListener("popstate", onPop);

    // Deep link: navigate once the layout exists. The frame lets the children's scenes
    // (deferred by one frame in use-gsap) register before the destination is measured.
    let frame = 0;
    if (location.hash) {
      frame = window.requestAnimationFrame(() => whenScrollQuiet(() => navigateToAnchor(location.hash)));
    }

    return () => {
      window.cancelAnimationFrame(frame);
      cancelLive();
      mq.removeEventListener("change", sync);
      reducedMq.removeEventListener("change", sync);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("pointerdown", interrupt, true);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      destroy();
    };
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  );
}
