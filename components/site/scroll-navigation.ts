/**
 * One same-page scroll navigation, as a transaction that can be cancelled.
 *
 * The earlier version scheduled a fixed 900ms correction after every jump with no way to
 * cancel it, so a visitor who scrolled, pressed Home or started a second navigation could
 * be pulled back to a stale destination. Here nothing runs on a timer that the transaction
 * does not own: each step is a requestAnimationFrame, and cancel() removes the pending
 * frame. A cancelled transaction performs no further scroll writes, ever.
 *
 * Environment is injected so the behaviour is tested directly, with no DOM or real clock.
 */

export interface ScrollEnv {
  /** Current scroll position of the scroller that owns the page. */
  read(): number;
  /** Move the owning scroller. `smooth` is true only for the first, animated step. */
  scrollTo(y: number, smooth: boolean): void;
  /** Where the destination sits on screen right now, measured after layout settles. */
  targetTop(): number;
  raf(cb: () => void): number;
  cancelRaf(id: number): void;
  now(): number;
}

export interface Transaction {
  cancel(): void;
  readonly settled: boolean;
}

const STABLE_FRAMES = 6;
const SETTLE_TIMEOUT_MS = 2500;
const TOLERANCE_PX = 2;

/**
 * Starts a navigation to `goalY` (the scroll position that puts the destination under the
 * header). Animates, waits for the scroll to be still, then makes at most one corrective
 * non-smooth move, measured against the destination as it actually is on screen.
 */
export function startNavigation(env: ScrollEnv, goalY: number, headerOffset: number): Transaction {
  let frame: number | null = null;
  let cancelled = false;
  let settled = false;
  let lastY = NaN;
  let stable = 0;
  let started = 0;
  let corrected = false;
  let moved = false;
  // Position before the first write, so movement is judged against where the scroll began.
  const startY = env.read();

  const stop = () => {
    cancelled = true;
    if (frame !== null) env.cancelRaf(frame);
    frame = null;
  };

  const tick = () => {
    frame = null;
    if (cancelled) return;
    const y = env.read();
    if (!started) {
      started = env.now();
    }

    if (Math.abs(y - lastY) < 0.5) stable++;
    else stable = 0;
    if (Math.abs(y - startY) >= 0.5) moved = true;
    lastY = y;

    // A still scroller is only "settled" once it has moved, unless it was already at the goal.
    // Otherwise a write the scroller ignored would read as settled and get corrected at once.
    const alreadyThere = Math.abs(goalY - y) <= TOLERANCE_PX;
    const timedOut = env.now() - started > SETTLE_TIMEOUT_MS;
    if ((stable < STABLE_FRAMES || (!moved && !alreadyThere)) && !timedOut) {
      frame = env.raf(tick);
      return;
    }

    // Settled (or gave up waiting). One measured correction at most.
    if (!corrected) {
      corrected = true;
      const delta = env.targetTop() - headerOffset;
      if (Math.abs(delta) > TOLERANCE_PX) {
        env.scrollTo(env.read() + delta, false);
        // Let the corrected position settle, then finish. Still cancellable.
        stable = 0;
        started = env.now();
        frame = env.raf(tick);
        return;
      }
    }
    settled = true;
  };

  env.scrollTo(goalY, true);
  frame = env.raf(tick);

  return {
    cancel: stop,
    get settled() {
      return settled;
    },
  };
}
