import { gsap as GSAPType } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

GSAPType.registerPlugin(SplitText);

/**
 * One small, consistent reveal, shared by every quiet section that wants one
 * (section 4 of the design brief). Built directly on GSAP's own ScrollTrigger —
 * https://gsap.com/docs/v3/Plugins/ScrollTrigger/ — rather than a new engine, and
 * called from inside the project's existing `useGsap` lifecycle, so cleanup,
 * Strict Mode safety and the reduced-motion branch all come from there for free.
 *
 * What it reveals, found by a data attribute rather than a prop or a wrapper
 * component, so ordinary markup stays ordinary markup:
 * - `data-reveal="heading"` — masked lines, at most ~550ms including stagger.
 * - `data-reveal="copy"` — opacity + ~10px rise, ~350ms (no character/line split;
 *   plain paragraphs do not need SplitText to read as considered).
 * - `data-reveal="media"` — shallow clip + opacity + ~16px rise, ~500ms.
 * - `data-reveal="stagger"` — its direct children reveal together with a ~55ms
 *   stagger, each like `copy`.
 *
 * Deliberately **not** a blanket per-element entrance: a section that does not add
 * one of these attributes stays exactly as it rendered (`do not attach the same
 * entrance to every card, line and footer item`).
 *
 * The flash this guards against: `useGsap` builds its scene one frame after mount
 * (see use-gsap.ts), so anything already inside the viewport at that first frame
 * would otherwise go to `opacity: 0` and back in a single visible frame. `belowFold`
 * only ever hides what is not yet on screen; whatever the visitor can already see at
 * mount is left exactly as the server rendered it — the resolved state, not a
 * blank stage, same rule `useGsap` already holds every section to.
 *
 * Keyboard and fast scrolling can always reach the content early: a `focusin`
 * inside a still-hidden element reveals it immediately, and a ScrollTrigger with
 * `once: true` fires the instant the trigger is crossed, however fast the scroll —
 * nothing here can leave real content stuck invisible or out of the tab order's
 * visible path.
 */

type Ctx = { gsap: typeof GSAPType; ScrollTrigger: typeof ScrollTriggerType; reduced: boolean };

// A scroller/context rebuild must not replay content this DOM element has already
// shown. Weak ownership keeps route-remounted elements independent and collectible.
// Teardown deliberately does not mark pending or interrupted reveals complete.
const revealed = new WeakSet<HTMLElement>();

function belowFold(el: Element) {
  return el.getBoundingClientRect().top > window.innerHeight;
}

/** Official SplitText line-mask pattern, not character-by-character decoration.
 * https://gsap.com/docs/v3/Plugins/SplitText/#responsive-line-splitting
 * Returning the onSplit tween lets the plugin restore its playhead after fonts or
 * widths change. One trigger belongs to the heading, never to disposable lines.
 */
function revealHeading(el: HTMLElement, { gsap, ScrollTrigger }: Ctx) {
  if (revealed.has(el)) return;
  if (!belowFold(el)) {
    revealed.add(el);
    return;
  }
  // aria:auto preserves one heading name. Do not flatten nested interactive semantics.
  if (el.querySelector("a, button, input, select, textarea, [tabindex], [contenteditable]")) {
    return revealTargets(el, [el], { gsap, ScrollTrigger, reduced: false }, { y: 14, duration: 0.5 });
  }

  const context = gsap.context();
  let state: "pending" | "playing" | "settled" = "pending";
  let split: SplitText | undefined;
  let trigger: ReturnType<typeof ScrollTrigger.create> | undefined;
  let tween: ReturnType<typeof gsap.fromTo> | undefined;
  let restoreFrame: number | undefined;
  const removeFocus = () => el.removeEventListener("focusin", onFocus);
  const restore = context.add("", () => split?.revert());
  const finish = () => {
    state = "settled";
    revealed.add(el);
    trigger?.kill();
    removeFocus();
    // Reverting inside onComplete during an autoSplit playhead restore would
    // interrupt SplitText's own setup. Restore on the next frame instead.
    restoreFrame = window.requestAnimationFrame(() => restore());
  };
  const settleFocus = context.add("", () => {
    state = "settled";
    revealed.add(el);
    trigger?.kill();
    tween?.kill();
    if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame);
    split?.revert(); // Focused content is fully visible in this frame.
    removeFocus();
  });
  const onFocus = () => settleFocus();
  const cleanup = () => {
    removeFocus();
    if (restoreFrame !== undefined) window.cancelAnimationFrame(restoreFrame);
    trigger?.kill();
    tween?.kill();
    split?.revert();
  };

  try {
    split = SplitText.create(el, {
      type: "lines", mask: "lines", autoSplit: true, aria: "auto",
      linesClass: "site-reveal-line",
      onSplit(self) {
        // A late font/resize event must not re-hide completed content while its
        // original markup is waiting to be restored on the next frame.
        if (state === "settled") {
          gsap.set(self.lines, { yPercent: 0 });
          return;
        }
        tween = gsap.fromTo(self.lines, { yPercent: 105 }, {
          yPercent: 0, duration: 0.48,
          stagger: self.lines.length > 1 ? Math.min(0.045, 0.07 / (self.lines.length - 1)) : 0,
          ease: "power2.out", paused: state === "pending", onComplete: finish,
        });
        return tween;
      },
    });
    trigger = ScrollTrigger.create({
      trigger: el, start: "top 85%", once: true,
      onEnter: () => {
        if (state !== "pending") return;
        state = "playing";
        trigger?.kill();
        tween?.play();
      },
    });
    el.addEventListener("focusin", onFocus);
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}

function revealTargets(
  el: HTMLElement,
  targets: HTMLElement[],
  { gsap, ScrollTrigger }: Ctx,
  { y, duration, stagger = 0, clip = false }: { y: number; duration: number; stagger?: number; clip?: boolean }
) {
  if (!targets.length || revealed.has(el)) return;
  if (!belowFold(el)) {
    revealed.add(el);
    return;
  }

  const context = gsap.context();
  let fired = false;
  let trigger: ReturnType<typeof ScrollTrigger.create> | undefined;
  let tween: ReturnType<typeof gsap.to> | undefined;
  const removeFocus = () => el.removeEventListener("focusin", onFocus);
  const finish = () => {
    revealed.add(el);
    removeFocus();
  };
  const settleFocus = () => {
    fired = true;
    revealed.add(el);
    trigger?.kill();
    tween?.kill();
    // Focus must be visible this frame, even if the scroll reveal already started.
    gsap.set(targets, { opacity: 1, y: 0, ...(clip ? { clipPath: "inset(0% 0% 0% 0%)" } : {}) });
    removeFocus();
  };
  // ScrollTrigger already scopes its callbacks. Native events need their own wrapper.
  const focusInContext = context ? context.add("", settleFocus) : settleFocus;
  const onFocus = () => focusInContext();
  const cleanup = () => {
    removeFocus();
    trigger?.kill();
    tween?.kill();
  };

  gsap.set(targets, { opacity: 0, y, ...(clip ? { clipPath: "inset(3% 0% 3% 0%)" } : {}) });
  try {
    trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      once: true,
      onEnter: () => {
        if (fired) return;
        fired = true;
        trigger?.kill();
        tween = gsap.to(targets, {
          opacity: 1, y: 0, duration, stagger, ease: "power2.out", overwrite: true,
          ...(clip ? { clipPath: "inset(0% 0% 0% 0%)" } : {}),
          onComplete: finish,
        });
      },
    });
    el.addEventListener("focusin", onFocus);
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}

export function revealSection(scope: HTMLElement, ctx: Ctx) {
  if (ctx.reduced) return; // The resolved state is already on screen; nothing to animate.

  const cleanups: (() => void)[] = [];
  const cleanup = () => cleanups.forEach((dispose) => dispose());
  try {
    scope.querySelectorAll<HTMLElement>('[data-reveal="heading"]').forEach((el) => {
      const dispose = revealHeading(el, ctx);
      if (dispose) cleanups.push(dispose);
    });
    for (const [kind, y, duration] of [
      ["copy", 10, 0.35], ["media", 16, 0.5],
    ] as const) {
      scope.querySelectorAll<HTMLElement>(`[data-reveal="${kind}"]`).forEach((el) => {
        const dispose = revealTargets(el, [el], ctx, { y, duration, clip: kind === "media" });
        if (dispose) cleanups.push(dispose);
      });
    }
    scope.querySelectorAll<HTMLElement>('[data-reveal="stagger"]').forEach((group) => {
      const dispose = revealTargets(group, [...group.children] as HTMLElement[], ctx, {
        y: 10, duration: 0.35, stagger: 0.055,
      });
      if (dispose) cleanups.push(dispose);
    });
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}
