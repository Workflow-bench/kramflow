"use client";

import { useEffect, useRef } from "react";
import { useReduced } from "@/components/site/motion";

/**
 * A canvas dot field that grows and darkens toward the pointer — adapted from Osmo's
 * "Interactive Dots Grid Background" (osmo.supply/resource/interactive-dots-grid-background),
 * fetched and inspected for this session. The original's own account: vanilla canvas, no
 * GSAP, no plugins. Faithfully reused here, not reinvented:
 *
 * - Dots never move; only scale and color respond to the pointer.
 * - Scale grows toward `dotMaxScale` (1.75) within `hoverRadius` (12 grid spacings),
 *   linear falloff by distance, up to `pressScale` (1.5x on top) while pressed.
 * - Color blends from an inactive to an active RGBA across all four channels.
 * - The pointer's influence center follows with exponential smoothing (a slight lag),
 *   and both hover and press transitions ease with a quartic ease-out over 0.5s.
 * - Grid pitch is `gap` (1em) plus `dotSize` (0.125em); colors adapted to this brand
 *   (cream at low alpha resting, brass at higher alpha active) in place of the
 *   reference's black-on-white.
 * - Interaction is gated to `(hover: hover) and (pointer: fine)` — elsewhere the grid
 *   renders once, statically, exactly as the source does, so touch devices get the
 *   texture without a dead pointer-math loop running.
 * - `prefers-reduced-motion` skips the animation loop entirely (not in the source,
 *   added here — this project never ships continuous motion without that check).
 */

const GAP_EM = 1;
const DOT_SIZE_EM = 0.125;
const HOVER_RADIUS_SPACINGS = 12;
const DOT_MAX_SCALE = 1.75;
const PRESS_SCALE = 1.5;
const EASE_DURATION_S = 0.5;
const MAX_DPR = 2;

const INACTIVE: [number, number, number, number] = [244, 239, 229, 0.12]; // cream, resting
const ACTIVE: [number, number, number, number] = [217, 183, 122, 0.55]; // brass, near pointer

function quarticOut(p: number) {
  const inv = 1 - p;
  return 1 - inv * inv * inv * inv;
}

function lerpColor(a: typeof INACTIVE, b: typeof INACTIVE, t: number): string {
  const r = a[0] + (b[0] - a[0]) * t;
  const g = a[1] + (b[1] - a[1]) * t;
  const bch = a[2] + (b[2] - a[2]) * t;
  const al = a[3] + (b[3] - a[3]) * t;
  return `rgba(${r}, ${g}, ${bch}, ${al})`;
}

export function InteractiveDotsGrid({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = useReduced();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // `host` is pointer-events:none on purpose (it must never block the real,
    // interactive page it decorates), so it can never receive pointer events itself.
    // The listener lives on its parent — the actual visible surface — and coordinates
    // are translated into host's own box, which shares the parent's rect exactly
    // (host is `absolute inset-0`).
    const listenTarget: HTMLElement = host.parentElement ?? host;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.prepend(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    // em -> px via a hidden probe, so the grid honours the root font size like the source.
    const probe = document.createElement("div");
    probe.style.width = "1em";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    host.appendChild(probe);
    const pxPerEm = probe.getBoundingClientRect().width || 16;
    probe.remove();

    const gap = GAP_EM * pxPerEm;
    const dotSize = DOT_SIZE_EM * pxPerEm;
    const pitch = gap + dotSize;

    const canInteract = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pointer = { x: -9999, y: -9999, target: { x: -9999, y: -9999 } };
    let pressed = false;
    let raf = 0;
    let visible = true;
    let hovering = false;
    const start = performance.now();
    let hoverStartedAt = -Infinity;
    let hoverEndedAt = -Infinity;
    let pressStartedAt = -Infinity;
    let pressEndedAt = -Infinity;

    function resize() {
      const rect = host!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height);
      const t = (now - start) / 1000;
      // Exponential smoothing toward the real pointer position (a slight trailing lag).
      const delta = 1 / 60;
      const smoothing = 1 - Math.exp((-delta * 6) / EASE_DURATION_S);
      pointer.x += (pointer.target.x - pointer.x) * smoothing;
      pointer.y += (pointer.target.y - pointer.y) * smoothing;

      const hoverElapsed = (now - hoverStartedAt) / 1000;
      const hoverFadeElapsed = (now - hoverEndedAt) / 1000;
      const hoverP = hovering
        ? Math.min(1, hoverElapsed / EASE_DURATION_S)
        : Math.max(0, 1 - hoverFadeElapsed / EASE_DURATION_S);
      const hoverEase = quarticOut(Math.max(0, Math.min(1, hoverP)));

      const pressElapsed = (now - pressStartedAt) / 1000;
      const pressFadeElapsed = (now - pressEndedAt) / 1000;
      const pressP = pressed
        ? Math.min(1, pressElapsed / EASE_DURATION_S)
        : Math.max(0, 1 - pressFadeElapsed / EASE_DURATION_S);
      const pressEase = quarticOut(Math.max(0, Math.min(1, pressP)));

      const cols = Math.ceil(width / pitch) + 1;
      const rows = Math.ceil(height / pitch) + 1;
      const maxScale = 1 + (DOT_MAX_SCALE - 1) * hoverEase * (1 + (PRESS_SCALE - 1) * pressEase);
      const hoverRadiusPx = HOVER_RADIUS_SPACINGS * pitch;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * pitch + dotSize / 2;
          const y = r * pitch + dotSize / 2;
          let influence = 0;
          if (hoverEase > 0.001) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            influence = Math.max(0, 1 - dist / hoverRadiusPx) * hoverEase;
          }
          const scale = 1 + (maxScale - 1) * influence;
          const radius = (dotSize / 2) * scale;
          ctx!.beginPath();
          ctx!.fillStyle = lerpColor(INACTIVE, ACTIVE, influence);
          ctx!.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      void t;
    }

    function loop(now: number) {
      if (!visible) {
        raf = 0;
        return;
      }
      draw(now);
      // `raf` doubles as "a loop is currently scheduled". Whenever this frame decides
      // not to reschedule itself, it must clear that flag — otherwise it's left holding
      // a stale, already-fired frame id forever, and every later `if (!raf)` check
      // (onPointerMove restarting the loop after it goes idle) reads it as "still
      // running" and never schedules a new frame. Measured: without this, hovering
      // after the loop's first natural stop never redrew the dots at all.
      if (canInteract && !reduced && hovering) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    }

    function onPointerMove(e: PointerEvent) {
      const rect = host!.getBoundingClientRect();
      pointer.target = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!hovering) {
        hovering = true;
        hoverStartedAt = performance.now();
        if (!raf) raf = requestAnimationFrame(loop);
      }
    }
    function onPointerLeave() {
      hovering = false;
      hoverEndedAt = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function onPointerDown() {
      pressed = true;
      pressStartedAt = performance.now();
    }
    function onPointerUp() {
      pressed = false;
      pressEndedAt = performance.now();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(host);
    resize();

    if (canInteract && !reduced) {
      listenTarget.addEventListener("pointermove", onPointerMove);
      listenTarget.addEventListener("pointerleave", onPointerLeave);
      listenTarget.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      ro.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      listenTarget.removeEventListener("pointermove", onPointerMove);
      listenTarget.removeEventListener("pointerleave", onPointerLeave);
      listenTarget.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.remove();
    };
  }, [reduced]);

  return <div ref={hostRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} />;
}
