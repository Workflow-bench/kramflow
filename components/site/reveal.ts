import type { gsap as GSAPType } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

/**
 * One small, consistent reveal, shared by every quiet section that wants one
 * (section 4 of the design brief). Built directly on GSAP's own ScrollTrigger —
 * https://gsap.com/docs/v3/Plugins/ScrollTrigger/ — rather than a new engine, and
 * called from inside the project's existing `useGsap` lifecycle, so cleanup,
 * Strict Mode safety and the reduced-motion branch all come from there for free.
 *
 * What it reveals, found by a data attribute rather than a prop or a wrapper
 * component, so ordinary markup stays ordinary markup:
 * - `data-reveal="heading"` — opacity + ~14px rise, ~500ms.
 * - `data-reveal="copy"` — opacity + ~10px rise, ~350ms (no character/line split;
 *   plain paragraphs do not need SplitText to read as considered).
 * - `data-reveal="media"` — opacity + ~16px rise, ~500ms, for one screenshot frame.
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

function belowFold(el: Element) {
  return el.getBoundingClientRect().top > window.innerHeight;
}

function revealOne(
  el: HTMLElement,
  { gsap, ScrollTrigger }: Ctx,
  { y, duration }: { y: number; duration: number }
) {
  if (!belowFold(el)) return; // Already visible at mount: leave it as rendered.

  gsap.set(el, { opacity: 0, y });
  let fired = false;
  const trigger = ScrollTrigger.create({
    trigger: el,
    start: "top 85%",
    once: true,
    onEnter: fire,
  });
  function fire() {
    if (fired) return;
    fired = true;
    trigger.kill();
    gsap.to(el, { opacity: 1, y: 0, duration, ease: "power2.out", overwrite: true });
  }
  // A keyboard user tabbing ahead of the scroll trigger must not land on an
  // invisible-but-focusable target.
  el.addEventListener("focusin", fire, { once: true });
}

export function revealSection(scope: HTMLElement, ctx: Ctx) {
  if (ctx.reduced) return; // The resolved state is already on screen; nothing to animate.

  scope
    .querySelectorAll<HTMLElement>('[data-reveal="heading"]')
    .forEach((el) => revealOne(el, ctx, { y: 14, duration: 0.5 }));
  scope
    .querySelectorAll<HTMLElement>('[data-reveal="copy"]')
    .forEach((el) => revealOne(el, ctx, { y: 10, duration: 0.35 }));
  scope
    .querySelectorAll<HTMLElement>('[data-reveal="media"]')
    .forEach((el) => revealOne(el, ctx, { y: 16, duration: 0.5 }));

  scope.querySelectorAll<HTMLElement>('[data-reveal="stagger"]').forEach((group) => {
    if (!belowFold(group)) return;
    const items = [...group.children] as HTMLElement[];
    if (!items.length) return;
    const { gsap, ScrollTrigger } = ctx;
    gsap.set(items, { opacity: 0, y: 10 });
    let fired = false;
    const trigger = ScrollTrigger.create({ trigger: group, start: "top 85%", once: true, onEnter: fire });
    function fire() {
      if (fired) return;
      fired = true;
      trigger.kill();
      gsap.to(items, { opacity: 1, y: 0, duration: 0.35, stagger: 0.055, ease: "power2.out", overwrite: true });
    }
    group.addEventListener("focusin", fire, { once: true });
  });
}
