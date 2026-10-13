import { afterEach, expect, it, vi } from "vitest";
import { gsap } from "gsap";

const effects: (() => void | (() => void))[] = [];
const frames = new Map<number, FrameRequestCallback>();
const scrollerQuery = new EventTarget();
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));
vi.mock("./motion-state", () => ({ useAmbientMotion: () => true }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.stubGlobal("window", {
  requestAnimationFrame: (cb: FrameRequestCallback) => { frames.set(1, cb); return 1; },
  cancelAnimationFrame: (id: number) => frames.delete(id),
  matchMedia: () => scrollerQuery,
});
const { useGsap } = await import("./use-gsap");
let teardown: (() => void) | undefined;
function commit() {
  effects.shift()!(); // Update the setup ref first.
  teardown = effects.shift()!() as (() => void);
  flushFrame();
}
function flushFrame() {
  const callback = frames.get(1)!;
  frames.delete(1);
  callback(0);
}
afterEach(() => { teardown?.(); effects.length = 0; frames.clear(); vi.restoreAllMocks(); });

it("rolls back partial setup and reports failure without leaking the active GSAP context", () => {
  const target = { opacity: 1, y: 0 };
  const failure = new Error("controlled setup failure");
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  useGsap({ current: { querySelectorAll: () => [] } as unknown as HTMLElement }, ({ gsap }) => {
    gsap.set(target, { opacity: 0, y: 16 });
    throw failure;
  });
  commit();
  expect(target.opacity).toBe(1);
  expect(target.y).toBe(0);
  expect(gsap.context()).toBeFalsy();
  expect(report).toHaveBeenCalledWith(expect.stringContaining("restored the static content"), failure);
});

it("runs native-event cleanup returned by a successful setup on teardown", () => {
  const cleanup = vi.fn();
  useGsap({ current: { querySelectorAll: () => [] } as unknown as HTMLElement }, () => cleanup);
  commit();
  expect(cleanup).not.toHaveBeenCalled();
  teardown!();
  teardown = undefined;
  expect(cleanup).toHaveBeenCalledTimes(1);
});

it("reverts the old scroller scene and defers replacement setup until after the owner switch", () => {
  let owner = "smooth";
  const events: string[] = [];
  const target = { opacity: 1 };
  useGsap({ current: { querySelectorAll: () => [] } as unknown as HTMLElement }, ({ gsap }) => {
    events.push(`build:${owner}`);
    gsap.set(target, { opacity: 0 });
    return () => events.push(`cleanup:${owner}`);
  });
  commit();
  expect(target.opacity).toBe(0);
  scrollerQuery.dispatchEvent(new Event("change"));
  expect(target.opacity).toBe(1);
  expect(events).toEqual(["build:smooth", "cleanup:smooth"]);
  // SmoothScroll's listener completes synchronously during this same event turn.
  owner = "native";
  flushFrame();
  expect(events).toEqual(["build:smooth", "cleanup:smooth", "build:native"]);
  expect(target.opacity).toBe(0);
  teardown!();
  teardown = undefined;
  expect(target.opacity).toBe(1);
  expect(events.at(-1)).toBe("cleanup:native");
});

it("cancels a deferred breakpoint rebuild and removes the media listener on unmount", () => {
  const setup = vi.fn();
  useGsap({ current: { querySelectorAll: () => [] } as unknown as HTMLElement }, setup);
  commit();
  scrollerQuery.dispatchEvent(new Event("change"));
  expect(frames.size).toBe(1);
  teardown!();
  teardown = undefined;
  expect(frames.size).toBe(0);
  scrollerQuery.dispatchEvent(new Event("change"));
  expect(frames.size).toBe(0);
  expect(setup).toHaveBeenCalledTimes(1);
});
