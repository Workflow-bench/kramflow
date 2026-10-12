import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { revealSection } from "./reveal";

// Only DOM splitting is substituted in this Node suite. Real GSAP still owns
// tweens/contexts; browser QA must verify actual wrapping, fonts and accessible names.
vi.mock("gsap/SplitText", () => ({ SplitText: { create: vi.fn() } }));

// Node fixture for layout/events; real GSAP contexts/tweens exercise their ownership.
class Target extends EventTarget {
  opacity = 1;
  y = 0;
  yPercent = 0;
  clipPath = "inset(0% 0% 0% 0%)";
  hasLink = false;
  querySelector() { return this.hasLink ? {} : null; }
  children: Target[] = [];
  top = 1000;
  getBoundingClientRect() { return { top: this.top }; }
}
let owner: gsap.Context;
let entries: { onEnter: () => void; kill: ReturnType<typeof vi.fn> }[];
let create: ReturnType<typeof vi.fn>;
let frames: Map<number, FrameRequestCallback>;
type SplitFixture = {
  lines: Target[];
  vars: SplitText.Vars;
  animation?: gsap.core.Tween;
  resplit: () => void;
  revert: ReturnType<typeof vi.fn>;
};
let splits: SplitFixture[];

function flushFrames() {
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach((callback) => callback(0));
}

function mount(groups: Record<string, Target[]>, reduced = false) {
  const scope = {
    querySelectorAll: (selector: string) => groups[selector.match(/"(.*?)"/)![1]] ?? [],
  } as unknown as HTMLElement;
  owner = gsap.context(() => {});
  owner.add(() => revealSection(scope, {
    gsap, reduced, ScrollTrigger: { create } as unknown as typeof ScrollTrigger,
  }));
}

beforeEach(() => {
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("window", {
    innerHeight: 900,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  splits = [];
  vi.mocked(SplitText.create).mockReset().mockImplementation((_target, vars) => {
    const fixture: SplitFixture = {
      lines: [], vars: vars!,
      revert: vi.fn(() => fixture.animation?.revert()),
      resplit: () => {
        const time = fixture.animation?.totalTime() ?? 0;
        fixture.animation?.revert();
        fixture.lines = [new Target(), new Target()];
        const result = fixture.vars.onSplit?.(fixture as unknown as SplitText) as gsap.core.Tween | undefined;
        fixture.animation = result;
        if (time && result) result.totalTime(time);
      },
    };
    splits.push(fixture);
    fixture.resplit();
    return fixture as unknown as SplitText;
  });
  entries = [];
  create = vi.fn((vars) => {
    const entry = { onEnter: vars.onEnter, kill: vi.fn() };
    entries.push(entry);
    return entry;
  });
});
afterEach(() => { owner?.revert(); vi.unstubAllGlobals(); });

describe("scroll reveal focus and lifecycle", () => {
  it("settles a focused target synchronously without starting an animated tween", () => {
    const target = new Target();
    mount({ media: [target] });
    expect(target.opacity).toBe(0);
    target.dispatchEvent(new Event("focusin"));
    expect(target.opacity).toBe(1);
    expect(target.y).toBe(0);
    expect(entries[0].kill).toHaveBeenCalled();
    expect(gsap.getTweensOf(target).filter((t) => t.duration() > 0)).toHaveLength(0);
  });

  it("focus interrupts an already-running scroll reveal, including a stagger group", () => {
    const group = new Target();
    group.children = [new Target(), new Target()];
    mount({ stagger: [group] });
    owner.add(() => entries[0].onEnter()); // ScrollTrigger wraps callbacks in its context.
    const tween = gsap.getTweensOf(group.children)[0];
    tween.progress(0.2);
    expect(group.children[0].opacity).toBeLessThan(1);
    group.dispatchEvent(new Event("focusin"));
    for (const child of group.children) {
      expect(child.opacity).toBe(1);
      expect(child.y).toBe(0);
    }
    expect(gsap.getTweensOf(group.children).filter((t) => t.duration() > 0)).toHaveLength(0);
  });

  it("teardown removes untouched focus listeners and restores the initial content", () => {
    const target = new Target();
    mount({ media: [target] });
    owner.revert();
    expect(target.opacity).toBe(1);
    expect(target.y).toBe(0);
    target.opacity = 0.7;
    target.dispatchEvent(new Event("focusin"));
    expect(target.opacity).toBe(0.7); // No stale native listener remains.
  });

  it("completed animations remove their focus listener", () => {
    const target = new Target();
    mount({ copy: [target] });
    owner.add(() => entries[0].onEnter());
    gsap.getTweensOf(target)[0].progress(1);
    target.opacity = 0.6;
    target.dispatchEvent(new Event("focusin"));
    expect(target.opacity).toBe(0.6);
  });

  it.each(["heading", "copy", "media", "stagger"])("does not replay a completed %s after its context rebuilds below fold", (kind) => {
    const target = new Target();
    if (kind === "stagger") target.children = [new Target(), new Target()];
    mount({ [kind]: [target] });
    owner.add(() => entries[0].onEnter());
    const tween = kind === "heading" ? splits[0].animation! : gsap.getTweensOf(kind === "stagger" ? target.children : target).find(t => t.duration() > 0)!;
    tween.progress(1);
    flushFrames();
    owner.revert();
    mount({ [kind]: [target] });
    expect(create).toHaveBeenCalledTimes(1);
    expect(SplitText.create).toHaveBeenCalledTimes(kind === "heading" ? 1 : 0);
    for (const item of kind === "stagger" ? target.children : [target]) {
      expect(item.opacity).toBe(1);
      expect(item.y).toBe(0);
    }
  });

  it.each(["heading", "copy", "media", "stagger"])("keeps an interrupted %s eligible for reveal after teardown and rebuild", (kind) => {
    const target = new Target();
    if (kind === "stagger") target.children = [new Target(), new Target()];
    mount({ [kind]: [target] });
    owner.add(() => entries[0].onEnter());
    const tween = kind === "heading" ? splits[0].animation! : gsap.getTweensOf(kind === "stagger" ? target.children : target).find(t => t.duration() > 0)!;
    tween.progress(0.2);
    owner.revert();
    mount({ [kind]: [target] });
    expect(create).toHaveBeenCalledTimes(2);
    if (kind === "heading") {
      expect(SplitText.create).toHaveBeenCalledTimes(2);
      expect(splits[1].animation!.paused()).toBe(true);
      expect(splits[1].lines.every(line => line.yPercent === 105)).toBe(true);
    } else {
      for (const item of kind === "stagger" ? target.children : [target]) expect(item.opacity).toBe(0);
    }
  });

  it.each(["heading", "media"])("does not mark a pending %s complete merely because its context is reverted", (kind) => {
    const target = new Target();
    mount({ [kind]: [target] });
    owner.revert();
    mount({ [kind]: [target] });
    expect(create).toHaveBeenCalledTimes(2);
    if (kind === "heading") expect(splits[1].lines.every(line => line.yPercent === 105)).toBe(true);
    else expect(target.opacity).toBe(0);
  });

  it.each(["heading", "media"])("keeps a focus-settled %s resolved across a below-fold rebuild", (kind) => {
    const target = new Target();
    mount({ [kind]: [target] });
    target.dispatchEvent(new Event("focusin"));
    owner.revert();
    mount({ [kind]: [target] });
    expect(create).toHaveBeenCalledTimes(1);
    expect(target.opacity).toBe(1);
  });

  it.each(["heading", "media"])("does not hide an initially visible %s when later rebuilt below fold", (kind) => {
    const target = new Target();
    target.top = 300;
    mount({ [kind]: [target] });
    owner.revert();
    target.top = 1000;
    mount({ [kind]: [target] });
    expect(create).not.toHaveBeenCalled();
    expect(SplitText.create).not.toHaveBeenCalled();
    expect(target.opacity).toBe(1);
  });

  it("partial initialization removes earlier listeners before propagating the failure", () => {
    const first = new Target();
    const second = new Target();
    create.mockImplementationOnce((vars) => ({ onEnter: vars.onEnter, kill: vi.fn() }))
      .mockImplementationOnce(() => { throw new Error("controlled trigger failure"); });
    // Catch inside the context just as the hook does, then roll back recorded sets.
    owner = gsap.context(() => {});
    let failed = false;
    owner.add(() => {
      try {
        revealSection({ querySelectorAll: () => [first, second] } as unknown as HTMLElement, {
          gsap, reduced: false, ScrollTrigger: { create } as unknown as typeof ScrollTrigger,
        });
      } catch { failed = true; }
    });
    expect(failed).toBe(true);
    owner.revert();
    expect(first.opacity).toBe(1);
    expect(second.opacity).toBe(1);
    first.opacity = 0.8;
    first.dispatchEvent(new Event("focusin"));
    expect(first.opacity).toBe(0.8);
  });

  it("keeps above-fold and reduced-motion content untouched", () => {
    const visible = new Target();
    visible.top = 300;
    mount({ heading: [visible], copy: [visible], media: [visible] });
    expect(create).not.toHaveBeenCalled();
    expect(SplitText.create).not.toHaveBeenCalled();
    owner.revert();
    mount({ heading: [new Target()], copy: [new Target()], media: [new Target()] }, true);
    expect(create).not.toHaveBeenCalled();
    expect(SplitText.create).not.toHaveBeenCalled();
  });

  it("returns one masked line tween per split and preserves an active reveal's playhead", () => {
    mount({ heading: [new Target()] });
    const fixture = splits[0];
    expect(fixture.vars).toMatchObject({ type: "lines", mask: "lines", autoSplit: true, aria: "auto" });
    expect(fixture.animation?.paused()).toBe(true);
    expect(fixture.animation?.totalDuration()).toBeLessThanOrEqual(0.55);
    owner.add(() => entries[0].onEnter());
    fixture.animation!.totalTime(0.2);
    const oldTween = fixture.animation;
    owner.add(() => fixture.resplit());
    expect(create).toHaveBeenCalledTimes(1); // No trigger on disposable line elements.
    expect(fixture.animation).not.toBe(oldTween);
    expect(fixture.animation!.paused()).toBe(false);
    expect(fixture.animation!.totalTime()).toBeCloseTo(0.2);
    expect(fixture.lines[0].yPercent).toBeLessThan(105);
  });

  it("pending re-splits remain paused and release the replaced line tween", () => {
    mount({ heading: [new Target()] });
    const fixture = splits[0];
    const oldLines = fixture.lines;
    const oldTween = fixture.animation!;
    owner.add(() => fixture.resplit());
    expect(fixture.animation).not.toBe(oldTween);
    expect(fixture.animation!.paused()).toBe(true);
    expect(fixture.animation!.totalTime()).toBe(0);
    expect(fixture.lines.every((line) => line.yPercent === 105)).toBe(true);
    expect(gsap.getTweensOf(oldLines).filter((tween) => tween.duration() > 0)).toHaveLength(0);
    expect(create).toHaveBeenCalledTimes(1);
    owner.add(() => entries[0].onEnter());
    expect(fixture.animation!.paused()).toBe(false);
  });

  it("tearing down a playing split removes focus callbacks and kills its animation", () => {
    const target = new Target();
    mount({ heading: [target] });
    const fixture = splits[0];
    owner.add(() => entries[0].onEnter());
    fixture.animation!.totalTime(0.2);
    const playingLines = fixture.lines;
    owner.revert();
    expect(gsap.getTweensOf(playingLines).filter((tween) => tween.duration() > 0)).toHaveLength(0);
    expect(frames.size).toBe(0);
    const reverts = fixture.revert.mock.calls.length;
    target.dispatchEvent(new Event("focusin"));
    expect(fixture.revert).toHaveBeenCalledTimes(reverts);
  });

  it("late re-splitting never hides a completed heading and restores original markup next frame", () => {
    const target = new Target();
    mount({ heading: [target] });
    const fixture = splits[0];
    owner.add(() => entries[0].onEnter());
    fixture.animation!.progress(1);
    expect(frames.size).toBe(1);
    owner.add(() => fixture.resplit());
    expect(fixture.animation).toBeUndefined();
    expect(fixture.lines.every((line) => line.yPercent === 0)).toBe(true);
    flushFrames();
    expect(fixture.revert).toHaveBeenCalled();
    const calls = fixture.revert.mock.calls.length;
    target.dispatchEvent(new Event("focusin"));
    expect(fixture.revert).toHaveBeenCalledTimes(calls);
  });

  it("focus restores a split heading synchronously and teardown cancels deferred restoration", () => {
    const focused = new Target();
    mount({ heading: [focused] });
    focused.dispatchEvent(new Event("focusin"));
    expect(splits[0].revert).toHaveBeenCalledTimes(1);
    expect(entries[0].kill).toHaveBeenCalled();
    owner.revert();
    mount({ heading: [new Target()] });
    owner.add(() => entries[1].onEnter());
    splits[1].animation!.progress(1);
    expect(frames.size).toBe(1);
    owner.revert();
    expect(frames.size).toBe(0);
  });

  it("leaves nested interactive heading semantics unsplit", () => {
    const target = new Target();
    target.hasLink = true;
    mount({ heading: [target] });
    expect(SplitText.create).not.toHaveBeenCalled();
    expect(target.opacity).toBe(0);
    target.dispatchEvent(new Event("focusin"));
    expect(target.opacity).toBe(1);
  });

  it("focus removes the media's shallow clip immediately", () => {
    const target = new Target();
    mount({ media: [target] });
    expect(target.clipPath).toBe("inset(3% 0% 3% 0%)");
    target.dispatchEvent(new Event("focusin"));
    expect(target.clipPath).toBe("inset(0% 0% 0% 0%)");
  });
});
