"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import {
  ListChecks,
  QrCode,
  Bell,
  CalendarDays,
  RefreshCw,
  Activity,
  SkipForward,
  Users,
  ClipboardList,
  SlidersHorizontal,
  Layers,
  Tv,
  RotateCcw,
  Rows3,
} from "lucide-react";
import { ConsoleReplica, CUE_STATE, type Cue } from "@/components/site/replica/console-replica";
import { PresenterReplica, AVReplica, GreenRoomReplica, GeneralReplica } from "@/components/site/replica/display-replicas";
import { BeforeDoors } from "@/components/site/before-doors";

let scrollTriggerRegistered = false;

/* Lenis (github.com/darkroomengineering/lenis) replaces the browser's own wheel
   scrolling with an eased, interpolated one - the actual mechanism behind the
   "fluid" scroll feel on most GSAP showcase sites, not just slower CSS transitions
   on individual elements. Wired to GSAP's own ticker (the documented integration
   recipe) so ScrollTrigger's scroll position stays in sync with Lenis's eased
   value instead of the raw, unsmoothed one. */
function useLenisSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const lenis = new Lenis({
      duration: 1.3,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);
}

/**
 * The public homepage, replacing the previous Navbar/HeroSection/RoomScene/
 * WhenPlansChange/TheRoom/ClosingSection/Footer composition wholesale.
 * Promoted from the dev-only exploration at app/(catalog)/dev/hero-concept
 * (worked out from a standalone artifact prototype,
 * docs/landing-redesign-v2/prototypes/hero-nav-v1.html, then iterated
 * section by section against this project's own real tokens, real
 * .glass-chrome recipe, and real replica components) - this file is that
 * harness's content, unchanged apart from its own name, now wired into
 * app/page.tsx directly instead of a gated dev route.
 *
 * Scroll ownership: this page brings its own smooth scroll (Lenis, see
 * useLenisSmoothScroll below), replacing the previous homepage's GSAP
 * ScrollSmoother (components/site/smooth-scroll.tsx) rather than running
 * both - two scroll owners on one page fight each other. That component,
 * and the Arrival/MotionFlag/ScrollProgress machinery built around it,
 * stay in the tree unused rather than deleted, in case any other route
 * still depends on them.
 *
 * The ShaderGradient background (github.com/ruucm/shadergradient) is scoped
 * to the hero's own wrapper, not fixed to the viewport - it does not follow
 * the visitor past the hero into every section below. Dark + systemGreen
 * only, no third hue from the library's own demo palette.
 */

const BG = "#0c0b09";
const CARD = "#17140f";
const LINE_SOFT = "#211d16";
const PRIMARY = "#f4efe5";
const MUTED = "#a79d8b";
const ACCENT = "#30d158"; // the product's own systemGreen "live" signal, not a new brand color

/* Every hover/transition on this page shares one duration and curve: 0.8s,
   cubic-bezier(0.19,1,0.22,1) - a quint-out "liquid" curve, long smooth tail rather
   than a quick snap. A fast hover feels like a toggle switch; this is deliberately
   closer to air settling than a UI click. */
const CINEMATIC = "0.8s cubic-bezier(0.19, 1, 0.22, 1)";

const BUTTON_STYLES = `
  .hc-btn-primary { background: ${PRIMARY}; color: #0c0b09; transition: background ${CINEMATIC}, color ${CINEMATIC}; }
  .hc-btn-primary:hover { background: ${ACCENT}; color: #06130c; }
  /* Underline alone read thin against the gradient. A soft pill-background now
     fades in behind the label too (liquid-glass highlight, not a hard outline),
     plus a 1px lift - two cues instead of one, both on the same slow curve. */
  .hc-btn-ghost { border: none; text-decoration: none; background: rgba(244,239,229,0); transition: color ${CINEMATIC}, background ${CINEMATIC}, transform ${CINEMATIC}; }
  .hc-btn-ghost:hover { text-decoration: underline; text-underline-offset: 4px; background: rgba(244,239,229,0.08); transform: translateY(-1px); }
  /* Inline style="color:inherit" on these anchors used to out-specificity this
     class's own :hover color rule - an inline style attribute always beats a
     stylesheet rule, pseudo-class or not, so the hover color was dead code.
     Color lives only here, not inline, so :hover can actually win. */
  .hc-nav-link { color: ${MUTED}; transition: color ${CINEMATIC}; }
  .hc-nav-link:hover { color: ${PRIMARY}; }
  .hc-pulse { animation: hc-pulse 1.8s ease-in-out infinite; }
  @keyframes hc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .hc-pulse { animation: none; } }

  /* Infinite marquee: the track holds two copies of the card list back to
     back, and the keyframe slides exactly one copy's width (-50%) before
     looping - at that instant the two copies are pixel-identical, so the
     loop point is invisible. Linear timing, not an eased curve: an eased
     loop visibly lurches at the seam every cycle, linear is what makes
     "infinite" actually read as continuous. */
  .hc-marquee-track { animation: hc-marquee 38s linear infinite; }
  .hc-marquee-row:hover .hc-marquee-track, .hc-marquee-row:focus-within .hc-marquee-track { animation-play-state: paused; }
  @keyframes hc-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (prefers-reduced-motion: reduce) {
    .hc-marquee-track { animation: none; }
  }

  .hc-reach-card { transition: transform ${CINEMATIC}, border-color ${CINEMATIC}, box-shadow ${CINEMATIC}; }
  .hc-reach-card:hover { transform: translateY(-6px); border-color: rgba(48,209,88,0.45); box-shadow: 0 32px 70px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(48,209,88,0.08); }
  .hc-reach-card .hc-reach-icon { transition: background ${CINEMATIC}, border-color ${CINEMATIC}; }
  .hc-reach-card:hover .hc-reach-icon { background: rgba(48,209,88,0.16); border-color: rgba(48,209,88,0.35); }

  /* Closing CTA: same liquid easing, plus a lift and the arrow nudging right -
     one extra beat of motion for the page's last, highest-intent button. */
  .hc-closing-cta { display: inline-flex; align-items: center; box-shadow: 0 0 0 0 rgba(48,209,88,0); }
  .hc-closing-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 40px -16px rgba(48,209,88,0.35); }
  .hc-closing-cta svg { transition: transform ${CINEMATIC}; }
  .hc-closing-cta:hover svg { transform: translateX(3px); }

  .hc-rail-item:hover .hc-rail-label, .hc-rail-item:focus-visible .hc-rail-label { opacity: 1; }
  @media (max-width: 1240px) { .hc-rail { display: none !important; } }
  @media (prefers-reduced-motion: reduce) { .hc-rail-item span:first-child { transition: none; } }

  /* Responsive pass - this harness was built desktop-first section by section,
     and never got a mobile audit until now. Below 860px: every multi-column
     grid collapses to one column (CSS !important beats the inline
     grid-template-columns these sections already set, so no per-section
     refactor needed), section padding shrinks so the stacked single-column
     layout doesn't carry desktop-scale whitespace, the one-line "Everything
     an operator reaches for mid-show" heading wraps instead of forcing
     horizontal scroll, and the nav's middle links hide behind just the
     wordmark + CTA (a real hamburger is future work, not this pass). */
  .hc-stack-mobile { }
  @media (max-width: 860px) {
    .hc-stack-mobile { grid-template-columns: 1fr !important; }
    .hc-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
    section { padding-top: 72px !important; padding-bottom: 72px !important; }
    .hc-nav-links { display: none !important; }
    .hc-reach-heading { white-space: normal !important; }
  }

  /* Real glass recipe (app/globals.css's own .glass-panel token values -
     rgba(23,20,15,0.55), 24px blur, saturate 1.3, the same 1px top
     highlight), not an invented frosted-glass look. Backdrop-filter only
     reads as "glass" when there's something varied behind it to diffuse,
     which is what .hc-glow supplies - without one, a blurred flat color is
     indistinguishable from a solid fill. */
  .hc-glass {
    background: rgba(23, 20, 15, 0.55);
    backdrop-filter: blur(24px) saturate(1.3);
    -webkit-backdrop-filter: blur(24px) saturate(1.3);
    box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.06);
  }
  /* Scale only - an animated "opacity" keyframe value overrides whatever
     opacity each AmbientGlow call passes inline (the animated property wins
     outright, it doesn't multiply the base), which is what silently made
     every instance pulse back up to the same brightness regardless of its
     own prop. Centering (translate -50%,-50%) lives on the element's own
     inline transform instead of only inside the keyframe, so it still
     centers correctly even with the animation off (reduced motion). */
  .hc-glow { animation: hc-glow-drift 14s ease-in-out infinite; }
  @keyframes hc-glow-drift {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.12); }
  }
  @media (prefers-reduced-motion: reduce) { .hc-glow { animation: none; } }

  /* Magnetic CTA: the button visually follows the cursor within a small
     radius (JS sets --mx/--my per mousemove), eased back to center on
     leave by the transition below rather than a second JS tween. */
  .hc-magnetic { transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1); transform: translate(var(--mx, 0px), var(--my, 0px)); }
  @media (prefers-reduced-motion: reduce) { .hc-magnetic { transform: none !important; transition: none; } }
`;

export function NewLanding() {
  useLenisSmoothScroll();
  return (
    <div style={{ background: BG, color: PRIMARY, minHeight: "100vh", fontFamily: "var(--font-sans), -apple-system, sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{BUTTON_STYLES}</style>
      {/* Nav + hero share one relatively-positioned block, which is what the
          gradient's own "absolute" fill measures itself against - scoped to the
          hero's own height, same as any other section background, instead of
          fixed to the viewport and following the visitor everywhere. */}
      <div id="hero" style={{ position: "relative", overflow: "hidden" }}>
        <HeroBackdrop />
        <Nav />
        <Hero />
      </div>
      <SyncSection />
      <NarrativeSection />
      <StatsSection />
      <CapabilitiesSection />
      <ReachSection />
      {/* Real site component, unchanged - components/site/before-doors.tsx. The
          actual "Get the rundown ready." section from the live homepage, real
          recorded captures (Cue Sheet / Rehearsal Mode), not a replica - reused
          as-is so this matches the real app pixel for pixel. */}
      <BeforeDoors />
      <ReliabilitySection />
      <ClosingSection />
      <NewLandingFooter />
      <ScrollRail />
    </div>
  );
}

const RAIL_ITEMS = [
  { id: "hero", label: "Hero" },
  { id: "console", label: "Console" },
  { id: "how-it-works", label: "How it works" },
  { id: "capabilities", label: "Capabilities" },
  { id: "quick-actions", label: "Quick actions" },
  { id: "prepare", label: "Prepare" },
  { id: "reliability", label: "Reliability" },
  { id: "start", label: "Get started" },
] as const;

/**
 * A fixed left-edge progress rail, one dot per section - idea pulled from
 * interfere.com's own left-edge icon rail (the vertical stack that
 * highlights which app surface you're looking at). The gap this closes:
 * everything past the hero/console had its own one-shot entrance animation
 * but nothing that stayed alive *between* them - once a section's reveal
 * finished, the page gave no further feedback that it was still a living
 * page rather than a long static document. This runs continuously for the
 * whole scroll, independent of any single section's own motion.
 *
 * IntersectionObserver, not scroll position math: each section is watched
 * with a thin horizontal band at viewport center (rootMargin), and
 * whichever one is crossing that band is "active" - cheaper than reading
 * getBoundingClientRect on every scroll tick, and it doesn't fight Lenis's
 * own rAF loop for the scroll value.
 */
function ScrollRail() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const els = RAIL_ITEMS.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className="hc-rail"
      style={{
        position: "fixed",
        left: 22,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {RAIL_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => goTo(item.id)}
            aria-label={`Jump to ${item.label}`}
            aria-current={isActive}
            className="hc-rail-item"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              padding: 4,
              cursor: "pointer",
            }}
          >
            <span
              className={isActive ? "hc-pulse" : undefined}
              style={{
                width: isActive ? 7 : 5,
                height: isActive ? 7 : 5,
                borderRadius: "50%",
                background: isActive ? ACCENT : "rgba(167,157,139,0.4)",
                boxShadow: isActive ? "0 0 0 3px rgba(48,209,88,0.18)" : "none",
                transition: `width ${CINEMATIC}, height ${CINEMATIC}, background ${CINEMATIC}, box-shadow ${CINEMATIC}`,
                display: "block",
              }}
            />
            <span
              className="hc-rail-label"
              style={{
                position: "absolute",
                left: "calc(100% + 10px)",
                top: "50%",
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: isActive ? PRIMARY : MUTED,
                background: CARD,
                border: `1px solid ${LINE_SOFT}`,
                borderRadius: 6,
                padding: "4px 8px",
                opacity: 0,
                pointerEvents: "none",
                transition: `opacity ${CINEMATIC}`,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A soft, slowly-drifting radial glow - the thing a `.hc-glass` surface
 *  actually needs behind it to read as frosted glass rather than a flat
 *  translucent fill. One per section that wants the glass treatment,
 *  sized and positioned per call site. */
// A muted, near-black-green rather than the live-state ACCENT itself - the
// accent at any real opacity read as a bright stage-light wash (too loud
// for ambience); this stays dark enough to only ever show as depth behind
// a glass surface, never as a colored glow in its own right.
const DARK_GLOW = "#0f2416";

function AmbientGlow({ size = 520, color = DARK_GLOW, top = "50%", left = "50%", opacity = 0.14 }: { size?: number; color?: string; top?: string; left?: string; opacity?: number }) {
  return (
    <div
      aria-hidden
      className="hc-glow"
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity,
        filter: "blur(40px)",
        pointerEvents: "none",
        zIndex: 0,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

/** Cursor-following lift for one element, within a small radius - the
 *  "liquid" micro-interaction interfere.com/giga.ai both lean on for their
 *  primary CTA. Pure transform, no layout writes, so it's cheap enough to
 *  run every mousemove; resets to center on leave via the element's own
 *  CSS transition (see .hc-magnetic), not a second animation loop here. */
function useMagnetic<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      el!.style.setProperty("--mx", `${relX * strength}px`);
      el!.style.setProperty("--my", `${relY * strength}px`);
    }
    function onLeave() {
      el!.style.setProperty("--mx", "0px");
      el!.style.setProperty("--my", "0px");
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);
  return ref;
}

function HeroBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 75%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 75%)",
      }}
    >
      {/* type="waterPlane" (not "plane") for the actual fluid-surface wave math the
          library ships, rather than the faceted/low-poly-reading plane deformation.
          pixelDensity bumped from 1 to 1.75: the mesh itself was fine, but the
          canvas was rendering under-resolution and getting upscaled, which is most
          of what read as "choppy" rather than smooth. */}
      <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }} pixelDensity={1.75} fov={40} pointerEvents="none">
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.12}
          uStrength={2.2}
          uDensity={1.4}
          uFrequency={4.2}
          uAmplitude={1.6}
          cAzimuthAngle={200}
          cPolarAngle={70}
          cDistance={4.8}
          cameraZoom={1}
          lightType="3d"
          brightness={0.26}
          reflection={0.04}
          grain="off"
          wireframe={false}
          color1={BG}
          color2={ACCENT}
          color3={CARD}
        />
      </ShaderGradientCanvas>
      {/* A flat scrim on top of the shader, not instead of it - the plane alone still
          let bright patches through where the wave peaked, which fought with white
          text. This holds overall darkness down without flattening the motion. */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,7,6,0.35)" }} />
    </div>
  );
}

function Nav() {
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const linkEls = linksRef.current ? Array.from(linksRef.current.querySelectorAll("a")) : [];
    const actionEls = actionsRef.current ? Array.from(actionsRef.current.querySelectorAll("a")) : [];
    const targets = [wordmarkRef.current, ...linkEls, ...actionEls].filter(Boolean) as Element[];
    if (reduced) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }
    gsap.set(wordmarkRef.current, { opacity: 0, y: -8 });
    gsap.set(linkEls, { opacity: 0, y: -8 });
    gsap.set(actionEls, { opacity: 0, y: -8 });
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(wordmarkRef.current, { opacity: 1, y: 0, duration: 0.9 })
      .to(linkEls, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 }, "-=0.65")
      .to(actionEls, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 }, "-=0.6");
  }, []);

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50 }}>
      <div
        style={{
          background: "rgba(23, 20, 15, 0.55)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderBottom: `1px solid ${LINE_SOFT}`,
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div ref={wordmarkRef} style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, fontSize: 15 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: ACCENT, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={12} height={12} stroke="#06130c" fill="none" strokeWidth={2.2}>
                <path d="M5 12l5 5L19 7" />
              </svg>
            </span>
            Kramflow
          </div>
          <div ref={linksRef} className="hc-nav-links" style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14, color: MUTED }}>
            {[
              { label: "Product", href: "#console" },
              { label: "Capabilities", href: "#capabilities" },
              { label: "For your team", href: "#quick-actions" },
              { label: "Reliability", href: "#reliability" },
            ].map(({ label, href }) => (
              <a key={label} href={href} className="hc-nav-link" style={{ textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </div>
          <div ref={actionsRef} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <a href="/login" className="hc-btn-ghost" style={{ padding: "9px 14px", fontSize: 13.5, fontWeight: 600, color: PRIMARY, borderRadius: 9 }}>
              Log in
            </a>
            <a href="/signup" className="hc-btn-primary" style={{ padding: "9px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 9, textDecoration: "none" }}>
              Start free
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const line1Ref = useRef<HTMLSpanElement>(null);
  const line2Ref = useRef<HTMLSpanElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = [eyebrowRef.current, line1Ref.current, line2Ref.current, subRef.current, actionsRef.current, shotRef.current].filter(Boolean) as Element[];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(els, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" });
      gsap.set([line1Ref.current, line2Ref.current], { yPercent: 0 });
      return;
    }
    gsap.set(eyebrowRef.current, { opacity: 0, y: 10 });
    gsap.set([line1Ref.current, line2Ref.current], { yPercent: 115 });
    gsap.set(subRef.current, { opacity: 0, y: 14 });
    gsap.set(actionsRef.current, { opacity: 0, y: 14 });
    gsap.set(shotRef.current, { opacity: 0, y: 26, scale: 0.97, filter: "blur(10px)" });

    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(eyebrowRef.current, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" })
      .to([line1Ref.current, line2Ref.current], { yPercent: 0, duration: 1.5, ease: "expo.out", stagger: 0.12 }, "-=0.45")
      .to(subRef.current, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, "-=0.95")
      .to(actionsRef.current, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, "-=0.75")
      .to(shotRef.current, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.8, ease: "expo.out" }, "-=0.6");
  }, []);

  return (
    <header style={{ position: "relative", paddingTop: 48, overflow: "hidden" }}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <div className="hc-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "end", paddingBottom: 44 }}>
          <div>
            <span ref={eyebrowRef} style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8070", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="hc-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
              LIVE EVENT OPERATIONS
            </span>
            <h1 style={{ marginTop: 14, fontSize: "clamp(2.1rem, 4.2vw, 3.3rem)", lineHeight: 1.07, fontWeight: 700, letterSpacing: "-0.015em" }}>
              <span style={{ display: "block", overflow: "hidden" }}>
                <span ref={line1Ref} style={{ display: "block" }}>Call it once.</span>
              </span>
              <span style={{ display: "block", overflow: "hidden" }}>
                <span ref={line2Ref} style={{ display: "block" }}>
                  Every screen <em style={{ fontStyle: "italic", color: ACCENT }}>follows.</em>
                </span>
              </span>
            </h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 6 }}>
            <p ref={subRef} style={{ color: MUTED, fontSize: 15.5, maxWidth: "38ch", margin: 0, lineHeight: 1.6 }}>
              Plan the cue sheet, call it live, every connected screen follows - no more spreadsheet shouted across a green room.
            </p>
            <div ref={actionsRef} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/signup" className="hc-btn-primary" style={{ padding: "12px 22px", borderRadius: 10, fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}>
                Start free
              </a>
              <a href="#console" className="hc-btn-ghost" style={{ padding: "12px 22px", borderRadius: 10, fontWeight: 600, fontSize: 14.5, color: PRIMARY }}>
                See it run
              </a>
            </div>
          </div>
        </div>

        {/* perspective on the outer, static wrapper; the slight rotateX sits on its
            own inner wrapper so GSAP (which owns the whole transform on shotRef for
            the entrance animation) never fights it for the same property. Full
            container width now, not an extra inset max-width - this is meant to be
            the dominant object in the viewport, same as the real landing page's own
            console image, not a smaller inset preview of it. */}
        <div style={{ perspective: 1400 }}>
          <div style={{ transform: "rotateX(2.5deg)", transformOrigin: "center top" }}>
            <div
              ref={shotRef}
              style={{
                position: "relative",
                borderRadius: 16,
                // No border, no clipping container: the image floats on its own soft
                // shadow above the gradient rather than sitting in a bordered frame.
                // Three shadow layers instead of one - a tight contact shadow, a large
                // diffuse elevation shadow, and the green ambient rim - is what reads
                // as real depth rather than a single flat drop-shadow.
                boxShadow:
                  "0 2px 8px -2px rgba(0,0,0,0.5), 0 60px 120px -40px rgba(0,0,0,0.65), 0 -40px 100px -60px rgba(48,209,88,0.18)",
              }}
            >
              {/* No crop: the full capture at its own aspect ratio, exactly like the real
                  landing page's own hero image treatment - a mask-image fade on the image
                  itself, not a cropped box. The fade starts earlier (55%) than a purely
                  cosmetic fade would need, specifically so the dev-overlay badge baked
                  into the bottom of this particular capture is already near-transparent
                  by the time the eye gets there, without cutting any real content off. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/product/console-prev.png"
                alt="The Kramflow operator console, showing a live cue sheet and running timer."
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: 16,
                  opacity: 0.97,
                  // A matching fade at the TOP edge, not just the bottom: without it the
                  // capture's own app chrome (toolbar, breadcrumb) sits hard against the
                  // image's top edge with nothing easing into it, which is what reads as
                  // "a screenshot was pasted here" rather than an object floating in the
                  // scene. 10% is short enough that no real content is lost, long enough
                  // to soften the edge.
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 55%, transparent 92%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 55%, transparent 92%)",
                }}
              />
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 16, background: "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.015) 18%, transparent 32%)" }} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

const NARRATIVE_STEPS = [
  { text: "queues the show", n: "01", caption: "Before doors — the cue sheet is built and timed" },
  { text: "calls each cue live", n: "02", caption: "On air — one tap advances the cue" },
  { text: "keeps every screen in sync", n: "03", caption: "The room follows — four displays, one state" },
] as const;

/**
 * "Kramflow queues the show, calls each cue live, and keeps every screen in
 * sync." - the copy and the three-step idea are ported from docs/landing-
 * redesign-v2/prototypes/concept-4.html's "narrative" section, but the
 * execution is this page's own: that prototype sets the whole sentence in
 * one monospace block (a low-fidelity placeholder, not this site's actual
 * type system) and hard-cuts between six static screenshots. Here the
 * headline uses the same sans display type as every other heading on this
 * page (compare "One cue. The room follows." above), with the step numbers
 * kept as a small mono detail rather than driving the whole line's font.
 * The three proofs are real console/display replicas, not screenshots
 * (project convention), and they cross-dissolve on step change instead of
 * hard-cutting - all three stay mounted, only opacity/scale move, so
 * nothing pops or reflows. Step switching is still scroll-scrubbed (GSAP
 * ScrollTrigger, progress mapped to 0-2), same mechanic as the prototype's
 * own vanilla-JS onUpdate handler, just driving a softer transition.
 */
function NarrativeSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set([headRef.current, panelRef.current], { opacity: 1, y: 0 });
      return;
    }
    gsap.set(headRef.current, { opacity: 0, y: 24 });
    gsap.set(panelRef.current, { opacity: 0, y: 32, scale: 0.98 });
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true } })
        .to(headRef.current, { opacity: 1, y: 0, duration: 1, ease: "power2.out" })
        .to(panelRef.current, { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "expo.out" }, "-=0.65");

      // Not pinned (a pinned section reserves real page height for its scroll
      // distance - if the content is shorter than that reserved distance, a
      // dead gap shows above/below it, which is exactly what happened the
      // first time this was tried at minHeight:100vh). Same effect without
      // the cost: widen the trigger window past the section's own edges
      // (top 90% -> bottom 10%, instead of top/bottom center) so the natural
      // scroll already carrying the section past the viewport is what maps
      // to the three steps - slower, with no reserved space of its own.
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 90%",
        end: "bottom 10%",
        onUpdate: (self) => setStep(Math.min(2, Math.floor(self.progress * 3))),
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" style={{ position: "relative", zIndex: 1, padding: "140px 0", overflow: "hidden" }}>
      <AmbientGlow top="50%" left="72%" size={560} opacity={0.4} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <div
          className="hc-stack-mobile"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div ref={headRef}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8070", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="hc-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
              HOW IT WORKS
            </span>
            <p
              style={{
                marginTop: 14,
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: "clamp(1.6rem, 2.9vw, 2.2rem)",
                lineHeight: 1.3,
                maxWidth: "20ch",
              }}
            >
              <span style={{ color: PRIMARY }}>Kramflow </span>
              {NARRATIVE_STEPS.map((s, i) => (
                <span key={s.n}>
                  <span style={{ color: step === i ? ACCENT : MUTED, transition: `color ${CINEMATIC}` }}>
                    {s.text}
                    <sup style={{ fontFamily: "var(--font-mono)", fontSize: "0.42em", opacity: 0.55, marginLeft: 1 }}>{s.n}</sup>
                  </span>
                  <span style={{ color: PRIMARY }}>{i < NARRATIVE_STEPS.length - 1 ? (i === NARRATIVE_STEPS.length - 2 ? ", and " : ", ") : "."}</span>
                </span>
              ))}
            </p>
          </div>

          <div>
            {/* The product replica sits in its own exact-bg-match box (seam
                fix, see below) nested inside a glass "tray" - the frosting
                lives on the frame around the product, never on the product
                pixels themselves. */}
            <div className="hc-glass" style={{ position: "relative", borderRadius: 18, padding: 10 }}>
            <div
              ref={panelRef}
              style={{
                position: "relative",
                border: `1px solid ${LINE_SOFT}`,
                borderRadius: 14,
                // Matches FitFrame's own bg-background exactly (see fit-frame.tsx),
                // not the surrounding CARD tone - the three replicas each carry a
                // slightly different native aspect ratio than this box's fixed
                // 16:10, so a mismatched color here showed as a visible seam
                // around whichever edge didn't land exactly on the frame.
                background: BG,
                overflow: "hidden",
                aspectRatio: "16 / 10",
                boxShadow: "0 40px 100px -48px rgba(0,0,0,0.6)",
              }}
            >
              {/* All three proofs stay mounted; only opacity/scale move on step
                  change, so switching reads as a dissolve, not a hard cut. */}
              <div style={{ position: "absolute", inset: 0, opacity: step === 0 ? 1 : 0, transform: step === 0 ? "scale(1)" : "scale(1.015)", transition: `opacity ${CINEMATIC}, transform ${CINEMATIC}`, pointerEvents: step === 0 ? "auto" : "none" }}>
                <ConsoleReplica cue={1} label={NARRATIVE_STEPS[0].caption} />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 32,
                  opacity: step === 1 ? 1 : 0,
                  transform: step === 1 ? "scale(1)" : "scale(1.015)",
                  transition: `opacity ${CINEMATIC}, transform ${CINEMATIC}`,
                  pointerEvents: step === 1 ? "auto" : "none",
                }}
              >
                <div style={{ width: "100%", maxWidth: 360 }}>
                  <ConsoleReplica cue={3} label={NARRATIVE_STEPS[1].caption} controlsOnly />
                </div>
              </div>
              <div style={{ position: "absolute", inset: 0, opacity: step === 2 ? 1 : 0, transform: step === 2 ? "scale(1)" : "scale(1.015)", transition: `opacity ${CINEMATIC}, transform ${CINEMATIC}`, pointerEvents: step === 2 ? "auto" : "none" }}>
                <GeneralReplica cue={3} label={NARRATIVE_STEPS[2].caption} />
              </div>
            </div>
            </div>

            {/* Caption sits below the panel as plain page copy, not an overlay
                bar on top of the product chrome - the replicas are the proof,
                the caption is commentary, the two don't share one surface. */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: ACCENT, flexShrink: 0 }}>
                {NARRATIVE_STEPS[step].n}
              </span>
              <span style={{ color: MUTED, fontSize: 13.5, transition: `color ${CINEMATIC}` }}>{NARRATIVE_STEPS[step].caption}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { num: "4", label: "display surfaces, one state" },
  { num: "<1s", label: "cue-to-display sync" },
  { num: "200+", label: "cues per event, no slowdown" },
  { num: "1", label: "source of truth, for everyone in the room" },
] as const;

/** Splits a stat string into the part that counts up (a plain integer) and
 *  the prefix/suffix glyphs around it, so "<1s" and "200+" animate their
 *  digits while keeping the "<" and "+" static. */
function parseStat(num: string): { prefix: string; digits: number; suffix: string } {
  const match = num.match(/^(\D*)(\d+)(\D*)$/);
  if (!match) return { prefix: "", digits: 0, suffix: num };
  return { prefix: match[1], digits: Number(match[2]), suffix: match[3] };
}

/** Also ported from concept-4.html's "stats" section - same four numbers,
 *  same wording - but refined past the prototype's plain static digits:
 *  each number counts up from 0 on reveal (an eased GSAP tween writing the
 *  DOM directly, not React state, so four independent counters don't
 *  thrash re-renders) and draws in its own short accent rule underneath,
 *  matching the small accent-dot/line detailing used in every other
 *  section's eyebrow on this page rather than inventing a new motif. */
function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ruleRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = rowRef.current ? Array.from(rowRef.current.children) : [];
    if (reduced) {
      gsap.set(items, { opacity: 1, y: 0 });
      gsap.set(ruleRefs.current.filter(Boolean), { scaleX: 1 });
      STATS.forEach((s, i) => {
        const el = numRefs.current[i];
        if (el) el.textContent = s.num;
      });
      return;
    }
    gsap.set(items, { opacity: 0, y: 20 });
    gsap.set(ruleRefs.current.filter(Boolean), { scaleX: 0 });
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 85%", once: true },
      });
      tl.to(items, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power2.out" }).to(
        ruleRefs.current.filter(Boolean),
        { scaleX: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" },
        "<0.1"
      );
      STATS.forEach((s, i) => {
        const { prefix, digits, suffix } = parseStat(s.num);
        const el = numRefs.current[i];
        if (!el) return;
        const counter = { val: 0 };
        tl.to(
          counter,
          {
            val: digits,
            duration: 1.1,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = `${prefix}${Math.round(counter.val)}${suffix}`;
            },
          },
          i * 0.1
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} style={{ position: "relative", zIndex: 1, padding: "128px 0", overflow: "hidden" }}>
      <AmbientGlow top="50%" left="50%" size={700} opacity={0.32} />
      <div
        ref={rowRef}
        className="hc-stats-grid"
        style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}
      >
        {STATS.map((s, i) => (
          <div key={s.label} className="hc-glass" style={{ position: "relative", overflow: "hidden", borderRadius: 14, padding: "22px 24px" }}>
            {/* A quiet per-card accent instead of four identical flat tiles - layered
                on top of .hc-glass's own background (not replacing it, which would
                lose the backdrop-filter translucency that makes it read as glass at
                all) - the same green ambient glow this page already uses elsewhere,
                just small and corner-anchored so it reads as a materials choice, not
                four competing hero glows. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(120px 90px at 100% 0%, rgba(48,209,88,0.12), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              ref={(el) => {
                ruleRefs.current[i] = el;
              }}
              style={{ width: 24, height: 2, borderRadius: 1, background: ACCENT, marginBottom: 14, transformOrigin: "left center" }}
            />
            <span
              ref={(el) => {
                numRefs.current[i] = el;
              }}
              className="tnum"
              style={{ display: "block", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "clamp(1.6rem, 2.9vw, 2.2rem)", color: PRIMARY }}
            >
              {s.num}
            </span>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const CAPABILITIES = [
  { title: "A real cue sheet, not a timer list", body: "Drag-reorder, bulk edit, and a schedule that recalculates when one item runs long.", Icon: ClipboardList },
  { title: "Keep every cue's details together", body: "Mic requirements, slides, lighting, camera angle - the Add Item form adapts to the production.", Icon: SlidersHorizontal },
  { title: "Organize multi-part shows", body: "Multi-day, multi-session events with partitions, not one flat list pretending to scale.", Icon: Layers },
  { title: "No-login venue displays", body: "A share link, QR code, or 6-digit TV code - nobody in the room needs an account.", Icon: Tv },
  { title: "Rehearsal without the risk", body: "Run the full sequence end to end without ever touching a connected display.", Icon: RotateCcw },
  { title: "Built for 200+ item events", body: "Not a countdown tool retrofitted with a queue - the queue was the starting point.", Icon: Rows3 },
] as const;

/** "There's more to running a show than a countdown." - also ported from
 *  concept-4.html's "capabilities" section (same heading, same six items).
 *  The prototype's icon-badge row was originally dropped for lacking a
 *  chosen icon set; now reuses the exact badge this page settled on for
 *  ReachSection (36px, rounded-10, rgba(48,209,88,0.08) fill, same green
 *  stroke) instead of inventing a second icon treatment. A plain
 *  two-column list with the project's own border-top rhythm (same divider
 *  used throughout this page), not the prototype's own card styling. */
function CapabilitiesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = listRef.current ? Array.from(listRef.current.children) : [];
    if (reduced) {
      gsap.set([headRef.current, ...items], { opacity: 1, y: 0 });
      return;
    }
    gsap.set(headRef.current, { opacity: 0, y: 20 });
    gsap.set(items, { opacity: 0, y: 18 });
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true } })
        .to(headRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
        .to(items, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: "power2.out" }, "-=0.45");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="capabilities" style={{ position: "relative", zIndex: 1, padding: "140px 0" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <div ref={headRef} style={{ maxWidth: "50ch", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "0 0 12px", color: PRIMARY }}>
            There&apos;s more to running a show than a countdown.
          </h2>
          <p style={{ color: MUTED, fontSize: 15.5, margin: 0, lineHeight: 1.6 }}>
            The queue is the product. Timers, displays and rehearsal are properties of it, not bolted-on extras.
          </p>
        </div>

        <div ref={listRef} className="hc-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 48px" }}>
          {CAPABILITIES.map((c) => (
            <div key={c.title} style={{ paddingTop: 16, borderTop: `1px solid ${LINE_SOFT}` }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(48,209,88,0.08)",
                  border: "1px solid rgba(48,209,88,0.18)",
                  color: ACCENT,
                  marginBottom: 14,
                }}
              >
                <c.Icon size={17} strokeWidth={2} />
              </span>
              <h3 style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, margin: "0 0 7px", color: PRIMARY }}>{c.title}</h3>
              <p style={{ color: MUTED, fontSize: 14.5, margin: 0, lineHeight: 1.55 }}>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const REACH_ITEMS = [
  { title: "Bulk edit", body: "Multi-select and change timing, owner or status across items at once.", Icon: ListChecks },
  { title: "Share link and QR", body: "Generate or revoke display access in one click, per event.", Icon: QrCode },
  { title: "Live alerts", body: "Broadcast a note to the whole crew without leaving the console.", Icon: Bell },
  { title: "Multi-day events", body: "Friday Evening, Saturday Morning - each its own session, one event.", Icon: CalendarDays },
  { title: "Auto-recalculating schedule", body: "One item runs long, the rest of the queue shifts for everyone.", Icon: RefreshCw },
  { title: "Status at a glance", body: "Current, next, on deck, done - every item's state, without asking.", Icon: Activity },
  { title: "Hold or jump, freely", body: "Hold on an item or jump to any point - displays follow instantly.", Icon: SkipForward },
  { title: "Multi-tenant by default", body: "Any operator signs up and runs their own events, isolated by design.", Icon: Users },
] as const;

/**
 * "Everything an operator reaches for mid-show." - ported from concept-4.
 * html's own pill-scroll section (same eight capabilities, same copy), but
 * that prototype's version is a manually drag-scrolled row with a snap
 * point per card and a fade only on the right edge - a static list someone
 * has to reach out and scrub through. This upgrades it to what "mid-show,
 * reflexive" actually calls for: the row drifts on its own (CSS keyframe,
 * not GSAP - a plain linear loop is cheaper and reads smoother than
 * animating this many elements every frame), looping seamlessly (two
 * copies of the list back to back, translated by exactly one copy's
 * width), and pauses the instant a cursor or focus lands on it so nothing
 * scrolls out from under someone mid-read. Each card also gets its own
 * hover: a lift, an accent border, and its icon tinting to the product's
 * live-green, matching the hover language already used on this page's
 * buttons and nav links (same CINEMATIC easing, not a new motion feel).
 */
function ReachSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set([headRef.current, rowRef.current], { opacity: 1, y: 0 });
      return;
    }
    gsap.set(headRef.current, { opacity: 0, y: 20 });
    gsap.set(rowRef.current, { opacity: 0, y: 24 });
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true } })
        .to(headRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
        .to(rowRef.current, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, "-=0.45");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="quick-actions" style={{ position: "relative", zIndex: 1, padding: "140px 0", overflow: "hidden" }}>
      <AmbientGlow top="30%" left="15%" size={480} opacity={0.22} />
      <AmbientGlow top="70%" left="85%" size={480} opacity={0.22} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto" }}>
        <div ref={headRef} style={{ padding: "0 24px", marginBottom: 48 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8070", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="hc-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
            QUICK ACTIONS
          </span>
          <h2 className="hc-reach-heading" style={{ marginTop: 14, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "clamp(1.4rem, 2.6vw, 2.3rem)", lineHeight: 1.2, margin: "14px 0 0", color: PRIMARY, whiteSpace: "nowrap" }}>
            Everything an operator reaches for mid-show.
          </h2>
        </div>

        <div
          ref={rowRef}
          className="hc-marquee-row"
          style={{
            position: "relative",
            maskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
            padding: "4px 24px",
          }}
        >
          <div className="hc-marquee-track" style={{ display: "flex", gap: 20, width: "max-content" }}>
            {[...REACH_ITEMS, ...REACH_ITEMS].map(({ title, body, Icon }, i) => (
              <div
                key={`${title}-${i}`}
                className="hc-reach-card hc-glass"
                tabIndex={0}
                style={{
                  flex: "0 0 auto",
                  width: 272,
                  borderRadius: 14,
                  border: `1px solid ${LINE_SOFT}`,
                  padding: 22,
                }}
              >
                <span
                  className="hc-reach-icon"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(48,209,88,0.08)",
                    border: "1px solid rgba(48,209,88,0.18)",
                    color: ACCENT,
                    marginBottom: 16,
                  }}
                >
                  <Icon size={17} strokeWidth={2} />
                </span>
                <h4 style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, margin: "0 0 8px", color: PRIMARY, letterSpacing: "-0.01em" }}>{title}</h4>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const RELIABILITY_FACTS = [
  { title: "Real-time, not polled-and-hoped", body: "Every connected display reflects the live state within about a second of a cue change." },
  { title: "Isolated by tenant, at the database layer", body: "Multi-tenant since day one, not a UI toggle bolted on after the fact." },
  { title: "Three seconds to understand", body: "Every display answers exactly two questions: what's happening now, and what's next." },
] as const;

/** "Built the way a live show actually demands it." - ported from concept-4.
 *  html's "reliability" section (same heading, same three facts). Two
 *  columns, same as its source: a heading+subcopy on the left, the facts
 *  stacked with a border-top rule on the right - this page's own recurring
 *  divider rhythm (same treatment as CapabilitiesSection's list), not a
 *  card grid. Anchored id="reliability" since Nav already links here. */
function ReliabilitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const factsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const facts = factsRef.current ? Array.from(factsRef.current.children) : [];
    if (reduced) {
      gsap.set([headRef.current, headingRef.current, ...facts], { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" });
      return;
    }
    gsap.set(headRef.current, { opacity: 0, y: 20 });
    // Same cinematic focus-pull as the hero's own product shot (blur + scale
    // + rise) rather than a plain fade - the one thing on the page that
    // genuinely earns a heavier reveal is the heading claiming reliability,
    // so it gets the heaviest piece of motion vocabulary on the page for it.
    gsap.set(headingRef.current, { opacity: 0, y: 34, scale: 0.96, filter: "blur(14px)" });
    gsap.set(facts, { opacity: 0, y: 18 });
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true } })
        .to(headRef.current, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" })
        .to(headingRef.current, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.3, ease: "expo.out" }, "-=0.4")
        .to(facts, { opacity: 1, y: 0, duration: 0.6, stagger: 0.09, ease: "power2.out" }, "-=0.7");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="reliability" style={{ position: "relative", zIndex: 1, padding: "140px 0", overflow: "hidden" }}>
      {/* The left column is headline + one paragraph against a lot of empty
          vertical space (the right column's three facts run taller) - this
          fills that weight with the same ambient glow language the page
          already uses, rather than leaving the column feeling unfinished
          next to the denser one beside it. */}
      <AmbientGlow top="30%" left="8%" size={460} opacity={0.2} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <div className="hc-stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "start" }}>
          <div ref={headRef}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8070", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="hc-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
              RELIABILITY
            </span>
            <h2 ref={headingRef} style={{ marginTop: 14, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "clamp(1.7rem, 3vw, 2.3rem)", lineHeight: 1.2, margin: "14px 0 14px", maxWidth: "16ch", color: PRIMARY }}>
              Built the way a live show actually demands it.
            </h2>
            <p style={{ color: MUTED, fontSize: 15, margin: 0, lineHeight: 1.6, maxWidth: "38ch" }}>
              No analytics dashboards, no settings-heavy admin on the TV surfaces. Dark mode only. Readable from fifteen feet, understood in three seconds.
            </p>
          </div>

          <div ref={factsRef} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {RELIABILITY_FACTS.map((f) => (
              <div key={f.title} style={{ paddingTop: 16, borderTop: `1px solid ${LINE_SOFT}` }}>
                <h4 style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 700, margin: "0 0 4px", color: PRIMARY }}>{f.title}</h4>
                <p style={{ fontSize: 13.5, color: MUTED, margin: 0, lineHeight: 1.55 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Stop shouting the spreadsheet across the room." - ported from concept-4.
 *  html's "close-section" (same heading, same two CTAs), centered, same as
 *  its source. Reuses the hc-btn-primary/hc-btn-ghost classes Nav and Hero
 *  already define, at Hero's CTA sizing, so this closing pair reads as the
 *  same buttons the visitor already clicked past twice, not a third style. */
/** Bookends HeroBackdrop at the other end of the page - same waterPlane
 *  shader, same three product colors, but quieter (lower brightness/
 *  strength, no scrim needed) and masked on both edges so it reads as an
 *  ambient glow behind the close rather than a second hero. */
function ClosingBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        maskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
      }}
    >
      <ShaderGradientCanvas style={{ position: "absolute", inset: 0 }} pixelDensity={1.5} fov={40} pointerEvents="none">
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.08}
          uStrength={1.6}
          uDensity={1.2}
          uFrequency={3.6}
          uAmplitude={1.2}
          cAzimuthAngle={200}
          cPolarAngle={70}
          cDistance={4.8}
          cameraZoom={1}
          lightType="3d"
          brightness={0.2}
          reflection={0.04}
          grain="off"
          wireframe={false}
          color1={BG}
          color2={ACCENT}
          color3={CARD}
        />
      </ShaderGradientCanvas>
    </div>
  );
}

function ClosingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const magneticRef = useMagnetic<HTMLAnchorElement>(0.3);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const actionEls = actionsRef.current ? Array.from(actionsRef.current.children) : [];
    if (reduced) {
      gsap.set([headingRef.current, copyRef.current, ...actionEls], { opacity: 1, y: 0, scale: 1 });
      return;
    }
    gsap.set(headingRef.current, { opacity: 0, y: 28 });
    gsap.set(copyRef.current, { opacity: 0, y: 18 });
    gsap.set(actionEls, { opacity: 0, y: 14, scale: 0.97 });
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: sectionRef.current, start: "top 82%", once: true } })
        .to(headingRef.current, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out" })
        .to(copyRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.75")
        .to(actionEls, { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08, ease: "power2.out" }, "-=0.5");
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="start" style={{ position: "relative", zIndex: 1, overflow: "hidden", textAlign: "center", padding: "160px 0" }}>
      <ClosingBackdrop />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <h2
          ref={headingRef}
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 800,
            fontSize: "clamp(2.2rem, 4.2vw, 3.4rem)",
            maxWidth: "18ch",
            margin: "0 auto 18px",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            color: PRIMARY,
          }}
        >
          Stop shouting the spreadsheet across the room.
        </h2>
        <p ref={copyRef} style={{ color: MUTED, fontSize: 16, margin: "0 0 32px" }}>
          Free for your first event. No credit card.
        </p>
        <div ref={actionsRef} style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            ref={magneticRef}
            href="/signup"
            className="hc-btn-primary hc-closing-cta hc-magnetic"
            style={{ padding: "18px 32px", borderRadius: 12, fontWeight: 600, fontSize: 17, textDecoration: "none" }}
          >
            Start free
            <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={2.2} style={{ marginLeft: 8, verticalAlign: -3 }}>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <a href="#" className="hc-btn-ghost" style={{ padding: "18px 32px", borderRadius: 12, fontWeight: 600, fontSize: 17, color: PRIMARY }}>
            Talk to us
          </a>
        </div>
      </div>
    </section>
  );
}

/** Also ported from concept-4.html - same wordmark/link row, reusing Nav's
 *  own wordmark markup (accent square + checkmark) rather than a second
 *  logo treatment for the page's last pixel row. */
function NewLandingFooter() {
  return (
    <footer style={{ position: "relative", zIndex: 1, padding: "36px 0" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 700, fontSize: 15, color: PRIMARY, opacity: 0.7 }}>
          <span style={{ width: 20, height: 20, borderRadius: 6, background: ACCENT, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width={12} height={12} stroke="#06130c" fill="none" strokeWidth={2.2}>
              <path d="M5 12l5 5L19 7" />
            </svg>
          </span>
          Kramflow
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: MUTED }}>
          <a href="#console" className="hc-nav-link" style={{ textDecoration: "none" }}>Product</a>
          <a href="/login" className="hc-nav-link" style={{ textDecoration: "none" }}>Log in</a>
          <a href="/signup" className="hc-nav-link" style={{ textDecoration: "none" }}>Start free</a>
        </div>
      </div>
    </footer>
  );
}

const DISPLAY_LABELS: { Comp: typeof PresenterReplica; key: string; label: string }[] = [
  { Comp: PresenterReplica, key: "presenter", label: "Presenter" },
  { Comp: AVReplica, key: "av", label: "AV" },
  { Comp: GreenRoomReplica, key: "green-room", label: "Green Room" },
  { Comp: GeneralReplica, key: "general", label: "General" },
];

/**
 * Second section: "one console, every display follows." Earlier passes tried a
 * hand-coded hub diagram, real screenshots, a generated illustration, then a
 * scroll-scrubbed two-panel version - all replaced. This is click-driven: the
 * console's own Next/Previous/Hold buttons are real (components/site/replica/
 * console-replica.tsx took optional onNext/onPrevious/onHold props for this),
 * and clicking them cycles the actual seven-item program - Doors and Walk-in
 * Music through Closing Remarks, looping back to Doors and Walk-in Music - not
 * just the two sample cues the replicas shipped with. All four real display
 * replicas (Presenter, AV, Green Room, General) sit on the right and update
 * together with the console. A green flash across every panel plus a transient
 * "Cue changed" label marks the moment it switches, so the sync isn't just
 * implied by the numbers changing quietly.
 */
/** mm:ss -> whole seconds. */
function parseClock(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return m * 60 + s;
}

/** Whole seconds -> mm:ss, zero-floored (a cue's countdown doesn't run
 *  negative - the next click resets it). */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function SyncSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const flashRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cue, setCue] = useState<Cue>(1);
  const [held, setHeld] = useState(false);
  // Ticks the displays' clocks down for real (reset on every cue change, paused
  // on Hold) so the screens read as a running show instead of a frozen sample
  // - static digits are what made this section feel inert to interact with.
  const [secondsLeft, setSecondsLeft] = useState(() => parseClock(CUE_STATE[1].remaining));

  // Ticks every second while not held; the reset to a cue's base duration
  // happens in goNext/goPrevious below (an event handler, not an effect) the
  // moment the cue itself changes, so there's no separate cue-keyed effect.
  useEffect(() => {
    if (held) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [held]);

  const liveClock = formatClock(secondsLeft);

  useEffect(() => {
    if (!scrollTriggerRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTriggerRegistered = true;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set([headRef.current, panelsRef.current], { opacity: 1, y: 0, scale: 1 });
      return;
    }
    gsap.set(headRef.current, { opacity: 0, y: 24 });
    gsap.set(panelsRef.current, { opacity: 0, y: 36, scale: 0.97 });
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
      });
      tl.to(headRef.current, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }).to(
        panelsRef.current,
        { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: "expo.out" },
        "-=0.7"
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  /** Green flash across the four displays only - the console's own Next
   *  press is already its own feedback, so it doesn't also flash. */
  function flashDisplays() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const targets = [...flashRefs.current.filter(Boolean)];
    gsap.fromTo(targets, { opacity: 0.5 }, { opacity: 0, duration: 0.7, ease: "power2.out" });
  }

  function goNext() {
    if (held) return;
    setCue((c) => {
      const next = (c === 7 ? 1 : ((c + 1) as Cue));
      setSecondsLeft(parseClock(CUE_STATE[next].remaining));
      return next;
    });
    flashDisplays();
  }
  function goPrevious() {
    if (held) return;
    setCue((c) => {
      const prev = (c === 1 ? 7 : ((c - 1) as Cue));
      setSecondsLeft(parseClock(CUE_STATE[prev].remaining));
      return prev;
    });
    flashDisplays();
  }
  function toggleHold() {
    setHeld((h) => !h);
  }

  return (
    <section ref={sectionRef} id="console" style={{ position: "relative", zIndex: 1, padding: "140px 0" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
        <div ref={headRef} style={{ maxWidth: "52ch", marginBottom: 48 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8070", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="hc-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: "0 0 0 3px rgba(48,209,88,0.16)" }} />
            ONE CONSOLE, FOUR SCREENS
          </span>
          <h2 style={{ marginTop: 14, fontSize: "clamp(1.7rem, 3vw, 2.3rem)", fontFamily: "var(--font-sans)", fontWeight: 700, margin: "14px 0 12px", color: PRIMARY }}>
            One cue. The room follows.
          </h2>
          <p style={{ color: MUTED, fontSize: 15, margin: 0, lineHeight: 1.6, maxWidth: "46ch" }}>
            This is the real console. Call Next, call Previous, or hold - every connected display follows, live.
          </p>
        </div>

        <div
          ref={panelsRef}
          className="hc-stack-mobile"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px 1fr",
            gap: 24,
            alignItems: "center",
            justifyItems: "stretch",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {DISPLAY_LABELS.slice(0, 2).map(({ Comp, key, label }, i) => (
              <div
                key={key}
                style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE_SOFT}`, boxShadow: "0 24px 60px -30px rgba(0,0,0,0.55)" }}
              >
                <Comp cue={cue} label={`${label} display`} clockOverride={liveClock} />
                <div ref={(el) => { flashRefs.current[i] = el; }} style={{ position: "absolute", inset: 0, background: ACCENT, opacity: 0, pointerEvents: "none" }} />
              </div>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <ConsoleReplica cue={cue} label="Operator console" onNext={goNext} onPrevious={goPrevious} onHold={toggleHold} held={held} controlsOnly />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {DISPLAY_LABELS.slice(2, 4).map(({ Comp, key, label }, i) => (
              <div
                key={key}
                style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE_SOFT}`, boxShadow: "0 24px 60px -30px rgba(0,0,0,0.55)" }}
              >
                <Comp cue={cue} label={`${label} display`} clockOverride={liveClock} />
                <div ref={(el) => { flashRefs.current[i + 2] = el; }} style={{ position: "absolute", inset: 0, background: ACCENT, opacity: 0, pointerEvents: "none" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
