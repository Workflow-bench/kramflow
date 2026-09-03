"use client";

import { useCallback, useRef, useState } from "react";

const STORAGE_KEY = "kramflow.operator.console-layout.v1";

// Content-driven floors/ceilings, not arbitrary numbers — each one is the
// narrowest/widest a column can get while what it actually needs to show
// stays legible:
//   Program  — order #, cue title, presenter, scheduled time, duration,
//              status badge in one row (components/operator/program-list.tsx).
//   Live Now — the countdown digits, Next/On Deck, and the notes textarea
//              without every line wrapping to near-uselessness.
//   Controls — full-width transport buttons plus icon+label without
//              wrapping or icon/label collision.
export const PROGRAM_MIN = 480;
export const LIVE_NOW_MIN = 300;
export const LIVE_NOW_MAX = 560;
export const CONTROLS_MIN = 280;
export const CONTROLS_MAX = 420;

const DIVIDER_PX = 17;
const STEP_PX = 16;
const BIG_STEP_PX = 64;

// Fractions of available width, not the old layout's raw pixels — chosen
// by inspecting the fixed columns this replaces (grid-cols-[1fr_340px_280px]
// at xl, [1fr_400px_320px] at 2xl in the pre-resize OperatorGrid) across
// the practical desktop range: at 1440px this lands within a few px of the
// old 340/280 split, and at 1920px+ it tracks the old 400/320 step without
// needing a second hardcoded breakpoint — the fraction just scales.
const DEFAULT_LIVE_NOW_FRACTION = 0.24;
const DEFAULT_CONTROLS_FRACTION = 0.2;

export type ColumnPreset = "balanced" | "rundown" | "controls";

// Only the presets that meaningfully change what's easiest to do — not
// six variations on the same idea. Rundown gives Program the most room by
// letting Live Now/Controls settle at their floor; Controls does the
// opposite for a run where Notes and the transport buttons matter more
// than scanning the full list.
const PRESETS: Record<ColumnPreset, StoredLayout> = {
  balanced: { liveNow: DEFAULT_LIVE_NOW_FRACTION, controls: DEFAULT_CONTROLS_FRACTION },
  rundown: { liveNow: 0.18, controls: 0.15 },
  controls: { liveNow: 0.3, controls: 0.26 },
};

interface StoredLayout {
  liveNow: number;
  controls: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// A fraction is only trusted if it's a real, finite number strictly
// between 0 and 1 — not just typeof "number". Downstream pixel math
// clamps every derived width to its min/max regardless, but that clamp
// can't save `Infinity * 0` (innerWidth is legitimately 0 for one frame
// before the ResizeObserver's first measurement lands): that product is
// NaN, and NaN survives Math.min/Math.max untouched, unlike an
// out-of-range-but-finite value. A corrupted `1e500` (valid JSON syntax;
// overflows to Infinity on parse) reached exactly this path before this
// check existed. Rejecting non-finite/out-of-(0,1) values here, at the
// source, means the pixel math downstream only ever has to clamp
// legitimately-in-range numbers, not sanitize arbitrary ones.
function isValidFraction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1;
}

function readStoredLayout(): StoredLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLayout>;
    if (!isValidFraction(parsed.liveNow) || !isValidFraction(parsed.controls)) return null;
    return { liveNow: parsed.liveNow, controls: parsed.controls };
  } catch {
    return null;
  }
}

type DividerId = 1 | 2;

// Draggable-divider state for the desktop Operator Console's three
// columns (Program / Live Now / Controls). Program is always the
// flexible remainder — same shape as the fixed layout this replaces, just
// with Live Now's and Controls' widths now user-adjustable instead of
// hardcoded per breakpoint. Persisted to localStorage as a personal,
// per-workstation preference (see docs/DESIGN.md) — never event data, so
// it has no business in Supabase.
//
// Called once from OperatorGrid (app/e/[eventId]/operator/page.tsx), which
// stays mounted across every breakpoint — the desktop-only column grid
// that actually uses containerRef mounts/unmounts underneath it as the
// operator resizes their browser. Safe to read localStorage synchronously
// in the initializer below regardless: OperatorGrid itself only ever
// renders once real session data has loaded client-side (see
// OperatorPage's own sessionsLoading gate), so there is no server-rendered
// version of this subtree for a stored value to mismatch against.
export function useOperatorColumnLayout() {
  const [containerWidth, setContainerWidth] = useState(0);
  const [fractions, setFractions] = useState<StoredLayout>(
    () => readStoredLayout() ?? { liveNow: DEFAULT_LIVE_NOW_FRACTION, controls: DEFAULT_CONTROLS_FRACTION }
  );
  const [isCustomized, setIsCustomized] = useState(() => readStoredLayout() !== null);
  const [draggingDivider, setDraggingDivider] = useState<DividerId | null>(null);
  const dragState = useRef<{ divider: DividerId; startClientX: number; startX1: number; startX2: number } | null>(
    null
  );

  // A callback ref, not useRef+useEffect — the grid it measures mounts and
  // unmounts every time the operator crosses the xl breakpoint (Program/
  // Live Now/Controls swap for the tablet/mobile compositions), and this
  // hook's own call site (OperatorGrid) does not unmount with it. A
  // mount-once effect would only ever see the container from whichever
  // breakpoint was active on the very first render and miss every
  // resize-driven remount after that; a ref callback fires on each real
  // attach/detach regardless of where it's called from.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!el) {
      // The grid unmounting mid-drag (the operator crosses the xl
      // breakpoint while a pointer is still down) is the one path that
      // skips beginDrag/endDrag's own pointer-capture pairing — without
      // this, draggingDivider could stay stuck non-null in this hook's
      // state (which outlives the unmounted grid, see the module comment
      // above), showing a divider as still "active" if the operator
      // resizes back above xl later.
      dragState.current = null;
      setDraggingDivider(null);
      return;
    }
    setContainerWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

  // localStorage can throw on write even when it exists and reads fine —
  // Safari private browsing historically threw on setItem specifically,
  // and any browser can have it disabled outright. A thrown write must
  // never crash a drag/preset/reset in progress; worst case the layout
  // just doesn't survive a reload; the caller already flipped React state
  // separately (this function only persists) so the visible resize is
  // never blocked by a failed write.
  const persist = useCallback((next: StoredLayout) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort — see comment above.
    }
  }, []);

  const innerWidth = Math.max(0, containerWidth - DIVIDER_PX * 2);

  let liveNowPx = clamp(fractions.liveNow * innerWidth, LIVE_NOW_MIN, LIVE_NOW_MAX);
  let controlsPx = clamp(fractions.controls * innerWidth, CONTROLS_MIN, CONTROLS_MAX);
  let programPx = innerWidth - liveNowPx - controlsPx;
  // Defensive only — Program's floor plus both other floors and the two
  // dividers comfortably fits inside the 1280px xl breakpoint this layout
  // requires, so this never actually engages there. Guards a mid-resize
  // transition frame regardless of that math staying true forever.
  if (innerWidth > 0 && programPx < PROGRAM_MIN) {
    const deficit = PROGRAM_MIN - programPx;
    const liveNowSlack = Math.max(0, liveNowPx - LIVE_NOW_MIN);
    const controlsSlack = Math.max(0, controlsPx - CONTROLS_MIN);
    const totalSlack = liveNowSlack + controlsSlack;
    if (totalSlack > 0) {
      liveNowPx -= deficit * (liveNowSlack / totalSlack);
      controlsPx -= deficit * (controlsSlack / totalSlack);
    }
    programPx = innerWidth - liveNowPx - controlsPx;
  }

  const beginDrag = useCallback(
    (divider: DividerId) => (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      // Without this, a fast drag still fires the browser's native
      // text-selection-drag on whatever Program/Live Now/Controls text the
      // pointer crosses — pointer capture below redirects pointer *events*
      // to the divider, but doesn't on its own suppress that separate
      // browser default, which starts from the mousedown/pointerdown
      // target's selection algorithm, not from event delivery.
      e.preventDefault();
      // preventDefault above also suppresses the browser's default
      // focus-on-pointerdown behavior in some browsers — focus explicitly
      // so a mouse-started drag still leaves the divider keyboard-ready
      // (arrow keys) the instant the pointer lifts, with no separate Tab
      // needed first.
      (e.currentTarget as HTMLElement).focus();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        divider,
        startClientX: e.clientX,
        startX1: programPx,
        startX2: programPx + DIVIDER_PX + liveNowPx,
      };
      setDraggingDivider(divider);
    },
    [programPx, liveNowPx]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragState.current;
      if (!drag || innerWidth <= 0) return;
      const deltaX = e.clientX - drag.startClientX;
      if (drag.divider === 1) {
        const minX1 = Math.max(PROGRAM_MIN, drag.startX2 - DIVIDER_PX - LIVE_NOW_MAX);
        const maxX1 = drag.startX2 - DIVIDER_PX - LIVE_NOW_MIN;
        const newX1 = clamp(drag.startX1 + deltaX, minX1, maxX1);
        const newLiveNowPx = drag.startX2 - DIVIDER_PX - newX1;
        setFractions((prev) => ({ ...prev, liveNow: newLiveNowPx / innerWidth }));
      } else {
        const minX2 = Math.max(drag.startX1 + DIVIDER_PX + LIVE_NOW_MIN, innerWidth - DIVIDER_PX - CONTROLS_MAX);
        const maxX2 = Math.min(drag.startX1 + DIVIDER_PX + LIVE_NOW_MAX, innerWidth - DIVIDER_PX - CONTROLS_MIN);
        const newX2 = clamp(drag.startX2 + deltaX, minX2, maxX2);
        const newLiveNowPx = newX2 - DIVIDER_PX - drag.startX1;
        const newControlsPx = innerWidth - DIVIDER_PX - newX2;
        setFractions({ liveNow: newLiveNowPx / innerWidth, controls: newControlsPx / innerWidth });
      }
    },
    [innerWidth]
  );

  const endDrag = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    setDraggingDivider(null);
    setIsCustomized(true);
    setFractions((current) => {
      persist(current);
      return current;
    });
  }, [persist]);

  const onDividerKeyDown = useCallback(
    (divider: DividerId) => (e: React.KeyboardEvent) => {
      let delta = 0;
      if (e.key === "ArrowLeft") delta = -(e.shiftKey ? BIG_STEP_PX : STEP_PX);
      else if (e.key === "ArrowRight") delta = e.shiftKey ? BIG_STEP_PX : STEP_PX;
      else if (e.key === "Home") delta = -Infinity;
      else if (e.key === "End") delta = Infinity;
      else return;
      // Stops ControlsPanel's global Left/Right (Next/Previous) shortcut
      // from also firing — that listener is window-level (see
      // lib/display-engine/use-keyboard-shortcuts.ts) and only ignores
      // INPUT/TEXTAREA targets, which a focused separator isn't.
      e.preventDefault();
      e.stopPropagation();
      if (innerWidth <= 0) return;

      const x1 = programPx;
      const x2 = programPx + DIVIDER_PX + liveNowPx;
      let next: StoredLayout;
      if (divider === 1) {
        const minX1 = Math.max(PROGRAM_MIN, x2 - DIVIDER_PX - LIVE_NOW_MAX);
        const maxX1 = x2 - DIVIDER_PX - LIVE_NOW_MIN;
        const newX1 = clamp(x1 + delta, minX1, maxX1);
        const newLiveNowPx = x2 - DIVIDER_PX - newX1;
        next = { ...fractions, liveNow: newLiveNowPx / innerWidth };
      } else {
        const minX2 = Math.max(x1 + DIVIDER_PX + LIVE_NOW_MIN, innerWidth - DIVIDER_PX - CONTROLS_MAX);
        const maxX2 = Math.min(x1 + DIVIDER_PX + LIVE_NOW_MAX, innerWidth - DIVIDER_PX - CONTROLS_MIN);
        const newX2 = clamp(x2 + delta, minX2, maxX2);
        const newLiveNowPx = newX2 - DIVIDER_PX - x1;
        const newControlsPx = innerWidth - DIVIDER_PX - newX2;
        next = { liveNow: newLiveNowPx / innerWidth, controls: newControlsPx / innerWidth };
      }
      setFractions(next);
      setIsCustomized(true);
      persist(next);
    },
    [innerWidth, programPx, liveNowPx, fractions, persist]
  );

  const reset = useCallback(() => {
    setFractions({ liveNow: DEFAULT_LIVE_NOW_FRACTION, controls: DEFAULT_CONTROLS_FRACTION });
    setIsCustomized(false);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Best-effort — see persist()'s comment above.
    }
  }, []);

  const applyPreset = useCallback(
    (preset: ColumnPreset) => {
      const next = PRESETS[preset];
      setFractions(next);
      setIsCustomized(true);
      persist(next);
    },
    [persist]
  );

  return {
    containerRef,
    programPx,
    liveNowPx,
    controlsPx,
    dividerPx: DIVIDER_PX,
    draggingDivider,
    isCustomized,
    beginDrag,
    onPointerMove,
    endDrag,
    onDividerKeyDown,
    reset,
    applyPreset,
  };
}
