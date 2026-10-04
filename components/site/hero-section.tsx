"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ProductShot } from "./product-shot";
import { AppWindow } from "./app-window";
import { GoLink } from "./go-link";
import { EASE, useHydrated, useReduced } from "./motion";
import { SplitFlap } from "./split-flap";

/**
 * The hero. Type sits in its own band at the top; the real console owns
 * everything below it, and nothing overlaps or dims (see git history for why
 * a scrim over the product was removed).
 *
 * Motion is staged as a show start. The cue-light overlay (StandbyOverlay)
 * runs first; the headline lines then rise out of their masks one cue apart,
 * and a live wall-clock in split-flap digits ticks in the telemetry line.
 * Scroll pushes the console up a touch and lets the copy fall away.
 */

// One shared breakpoint-aware `sizes` string so the desktop and mobile <img>
// elements resolve to the same srcset candidate and the second is a cache hit.
const CONSOLE_SIZES = "(min-width: 1024px) 96vw, 320vw";

// The overlay owns the first ~1.4s; entrances start behind it.
const AFTER_STANDBY = 1.25;

const TELEMETRY = ["LIVE", "DAY 1 MORNING", "4 / 7", "1M BEHIND", "4 SCREENS SYNCED"];

function useWallClock() {
  const [now, setNow] = useState<Date | null>(null);
  const reduce = useReduced();
  useEffect(() => {
    // Wall time exists only in the browser; the first read must happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    if (reduce) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [reduce]);
  if (!now) return "--:--:--";
  const f = (n: number) => String(n).padStart(2, "0");
  return `${f(now.getHours())}:${f(now.getMinutes())}:${f(now.getSeconds())}`;
}

export function HeroSection() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReduced();
  const hydrated = useHydrated();
  const clock = useWallClock();
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end start"] });

  // Flat output ranges under reduced motion, rather than dropping `style`:
  // Framer keeps the last transform it applied when a value disappears.
  const lift = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -46]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.58], reduce ? [1, 1] : [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.58], reduce ? [0, 0] : [0, -40]);

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: hydrated ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    transition: reduce ? { duration: 0 } : { duration: 0.8, delay: AFTER_STANDBY + delay, ease: EASE },
  });
  const line = (delay: number) => ({
    initial: { y: "105%" },
    animate: hydrated ? { y: "0%" } : { y: "105%" },
    transition: reduce ? { duration: 0 } : { duration: 0.9, delay: AFTER_STANDBY + delay, ease: EASE },
  });

  return (
    <section data-cue="Standby" ref={root} className="relative overflow-hidden border-b border-line-soft lg:h-[100svh]">
      <motion.div
        style={{ opacity: copyOpacity, y: copyY }}
        className="relative z-10 mx-auto w-full max-w-[1600px] px-6 pt-[104px] will-change-transform sm:px-10 sm:pt-[124px]"
      >
        <motion.p
          {...enter(0)}
          className="tnum flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-l border-status-green/50 pl-3 text-[10px] leading-none tracking-[0.2em] text-muted-2 sm:text-[11px]"
        >
          {TELEMETRY.map((value, i) => (
            <span key={value} className={i === 0 ? "text-status-green" : undefined}>
              {i === 0 ? "● " : null}
              {value}
              <span aria-hidden="true" className="ml-2.5 text-muted-2">·</span>
            </span>
          ))}
          <SplitFlap value={clock} className="text-[11px] tracking-normal text-muted sm:text-[12px]" />
        </motion.p>

        <div className="mt-6 flex flex-col gap-x-16 gap-y-7 sm:mt-7 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="font-display text-[clamp(2.75rem,7vw,6rem)] text-primary">
            <span className="block overflow-hidden pb-[0.08em]">
              <motion.span {...line(0.1)} className="block">
                Run the show
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <motion.span {...line(0.28)} className="block">
                from one screen.
              </motion.span>
            </span>
          </h1>

          <div className="shrink-0 lg:pb-3">
            <motion.p {...enter(0.5)} className="max-w-[34ch] text-base leading-relaxed text-muted sm:text-lg">
              The live operations system for stage managers, AV operators and presenters.
            </motion.p>
            <motion.div {...enter(0.65)} className="mt-6">
              <GoLink href="/signup">Start free</GoLink>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Desktop: the console in a window frame, cropped by the viewport. */}
      <div className="relative mt-12 hidden overflow-hidden lg:block lg:h-full">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={hydrated ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={reduce ? { duration: 0 } : { duration: 1, delay: AFTER_STANDBY + 0.4, ease: EASE }}
          className="mx-auto w-full max-w-[1600px] px-6 sm:px-10"
        >
          <motion.div style={{ y: lift }} className="will-change-transform">
            <AppWindow label="/e/northwind-summit-2026/operator">
              <ProductShot shot="console" sizes={CONSOLE_SIZES} priority />
            </AppWindow>
          </motion.div>
        </motion.div>
      </div>


      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[14%] lg:block"
        style={{ background: "linear-gradient(to top, #0c0b09 18%, transparent 100%)" }}
      />
    </section>
  );
}
