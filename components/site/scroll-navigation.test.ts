import { describe, expect, it } from "vitest";
import { startNavigation, type ScrollEnv } from "./scroll-navigation";

/** Deterministic frame clock: raf queues callbacks, step() runs one frame. */
function fakeEnv(opts: { y?: number; targetTopFor?: (y: number) => number; smoothShortfall?: number; ignoreSmooth?: boolean } = {}) {
  let y = opts.y ?? 0;
  let time = 0;
  let nextId = 1;
  const queue = new Map<number, () => void>();
  const writes: Array<{ y: number; smooth: boolean }> = [];
  const env: ScrollEnv = {
    read: () => y,
    scrollTo: (to, smooth) => {
      writes.push({ y: to, smooth });
      // A smooth move can stop short of its goal, as the real smoother does.
      if (smooth && opts.ignoreSmooth) return; // the scroller dropped the write
      y = smooth ? to - (opts.smoothShortfall ?? 0) : to;
    },
    targetTop: () => (opts.targetTopFor ? opts.targetTopFor(y) : 0),
    raf: (cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    },
    cancelRaf: (id) => void queue.delete(id),
    now: () => time,
  };
  const step = (frames = 1, ms = 16) => {
    for (let i = 0; i < frames; i++) {
      time += ms;
      const pending = [...queue.entries()];
      queue.clear();
      for (const [, cb] of pending) cb();
    }
  };
  return { env, step, writes, pending: () => queue.size, setY: (v: number) => (y = v) };
}

describe("startNavigation", () => {
  it("settles and makes no correction when the destination is already right", () => {
    const f = fakeEnv({ targetTopFor: () => 88 });
    const tx = startNavigation(f.env, 800, 88);
    f.step(10);
    expect(tx.settled).toBe(true);
    expect(f.writes).toEqual([{ y: 800, smooth: true }]);
    expect(f.pending()).toBe(0);
  });

  it("makes one measured correction when the smooth move lands short", () => {
    const f = fakeEnv({ targetTopFor: (y) => 88 + (5292 - y), smoothShortfall: 64 });
    const tx = startNavigation(f.env, 5292, 88);
    f.step(40);
    const corrections = f.writes.filter((w) => !w.smooth);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].y).toBeGreaterThan(5292 - 1);
    expect(tx.settled).toBe(true);
    expect(f.pending()).toBe(0);
  });

  it("corrects a history restoration write after starting a return to the page top", () => {
    const f = fakeEnv({ y: 821, targetTopFor: (y) => 88 - y });
    const tx = startNavigation(f.env, 0, 88);
    f.setY(821); // Browser restoration races the initial top write.
    f.step(200);
    expect(f.writes).toEqual([{ y: 0, smooth: true }, { y: 0, smooth: false }]);
    expect(tx.settled).toBe(true);
    expect(f.pending()).toBe(0);
  });

  it("cancelled navigation never writes again, even if the layout would call for a correction", () => {
    const destinationMoved = true;
    const f = fakeEnv({ targetTopFor: () => (destinationMoved ? 300 : 88) });
    const tx = startNavigation(f.env, 800, 88);
    f.step(2); // mid-flight
    tx.cancel();
    const writesAtCancel = f.writes.length;
    f.step(200);
    expect(f.writes.length).toBe(writesAtCancel);
    expect(f.pending()).toBe(0);
    expect(tx.settled).toBe(false);
  });

  it("does not settle on a scroller that ignores its first write", () => {
    const f = fakeEnv({ targetTopFor: (y) => 88 + (5292 - y), ignoreSmooth: true });
    const tx = startNavigation(f.env, 5292, 88);
    f.step(10); // six still frames would have looked settled; no movement yet, so keep waiting
    expect(tx.settled).toBe(false);
    expect(f.writes.filter((w) => !w.smooth)).toHaveLength(0);
    f.step(200); // past the settle timeout, then one measured correction
    expect(f.writes.filter((w) => !w.smooth)).toHaveLength(1);
    expect(tx.settled).toBe(true);
  });

  it("a visitor's own scroll input cancels the pending correction", () => {
    const f = fakeEnv({ targetTopFor: () => 300 });
    const tx = startNavigation(f.env, 800, 88);
    f.step(3);
    f.setY(120); // user wheel moved the page away
    tx.cancel();
    f.step(100);
    expect(f.writes.every((w) => w.smooth)).toBe(true); // no corrective non-smooth write after input
  });

  it("gives up waiting for a scroll that never settles, and stops", () => {
    let y = 0;
    let time = 0;
    const queue = new Map<number, () => void>();
    let id = 1;
    const env: ScrollEnv = {
      read: () => (y += 7), // perpetually moving
      scrollTo: () => {},
      targetTop: () => 88,
      raf: (cb) => (queue.set(id, cb), id++),
      cancelRaf: (i) => void queue.delete(i),
      now: () => time,
    };
    const tx = startNavigation(env, 100, 88);
    for (let i = 0; i < 400 && queue.size; i++) {
      time += 16;
      const pending = [...queue.entries()];
      queue.clear();
      for (const [, cb] of pending) cb();
    }
    expect(queue.size).toBe(0);
    expect(tx.settled).toBe(true);
  });
});
