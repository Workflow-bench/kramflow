import { describe, expect, it, vi } from "vitest";

// Focus-target policy (CB-F4). A stub element class stands in for the DOM. The chooser reads
// only isConnected, closest('[inert]'), disabled, getClientRects and attributes, so the stub
// is faithful for this decision.

class StubEl {
  isConnected = true;
  disabled = false;
  inert = false;
  rendered = true;
  tabIndex = 0;
  attrs = new Map<string, string>();
  constructor(public id: string) {}
  visibility = "visible";
  tagName = "BUTTON";
  fieldsetDisabled = false;
  closest(sel: string) {
    return sel === "[inert]" && this.inert ? this : null;
  }
  // Models native :disabled: own disabled, or a disabled ancestor fieldset.
  matches(sel: string) {
    return sel === ":disabled" && (this.disabled || this.fieldsetDisabled);
  }
  getClientRects() {
    return this.rendered ? [{}] : [];
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
}

class StubHTMLElement extends StubEl {}
vi.stubGlobal("HTMLElement", StubHTMLElement);
vi.stubGlobal("document", { body: {}, documentElement: {} });
vi.stubGlobal("getComputedStyle", (el: StubEl) => ({ visibility: el.visibility }));

const { chooseFocusTarget, isFocusEligible } = await import("./use-dialog-focus");

const el = (id: string, patch: Partial<StubEl> = {}) => Object.assign(new StubHTMLElement(id), patch) as unknown as HTMLElement;

describe("focus eligibility", () => {
  it("rejects detached, inert, disabled, hidden and non-element nodes", () => {
    expect(isFocusEligible(el("a"))).toBe(true);
    expect(isFocusEligible(el("b", { isConnected: false }))).toBe(false);
    expect(isFocusEligible(el("c", { inert: true }))).toBe(false);
    expect(isFocusEligible(el("d", { disabled: true }))).toBe(false);
    expect(isFocusEligible(el("e", { rendered: false }))).toBe(false);
    expect(isFocusEligible(null)).toBe(false);
  });

  it("rejects visibility:hidden and collapse (CD-F1)", () => {
    expect(isFocusEligible(el("h", { visibility: "hidden" }))).toBe(false);
    expect(isFocusEligible(el("i", { visibility: "collapse" }))).toBe(false);
  });

  it("rejects a button or input disabled by a fieldset (native :disabled)", () => {
    expect(isFocusEligible(el("j", { fieldsetDisabled: true }))).toBe(false);
    expect(isFocusEligible(el("k", { tagName: "INPUT", fieldsetDisabled: true }))).toBe(false);
  });

  it("keeps a link or tabindex element inside a disabled fieldset eligible (WIP-F1)", () => {
    expect(isFocusEligible(el("a1", { tagName: "A", fieldsetDisabled: true }))).toBe(true);
    expect(isFocusEligible(el("t1", { tagName: "DIV", tabIndex: 0, fieldsetDisabled: true }))).toBe(true);
  });
});

describe("chooseFocusTarget", () => {
  it("upper-first close with a surviving lower dialog: focus the lower dialog's first control", () => {
    const lowerControl = el("lower-first");
    const trigger = el("trigger");
    expect(chooseFocusTarget({ trigger, survivorFirstControl: lowerControl, pageFallback: el("page") })).toBe(lowerControl);
  });

  it("lower-first close with a surviving upper dialog: focus the upper dialog's control, not the detached trigger", () => {
    const upperControl = el("upper-cancel");
    const detachedTrigger = el("revoke", { isConnected: false });
    expect(chooseFocusTarget({ trigger: detachedTrigger, survivorFirstControl: upperControl, pageFallback: el("page") })).toBe(upperControl);
  });

  it("both dialogs removed: the trigger when it is still connected and eligible", () => {
    const trigger = el("manage");
    expect(chooseFocusTarget({ trigger, survivorFirstControl: null, pageFallback: el("page") })).toBe(trigger);
  });

  it("missing trigger (detached): falls back to a connected, visible, non-inert page target", () => {
    const page = el("main");
    expect(chooseFocusTarget({ trigger: el("gone", { isConnected: false }), survivorFirstControl: null, pageFallback: page })).toBe(page);
  });

  it("disabled trigger: falls back to the page target", () => {
    const page = el("main");
    expect(chooseFocusTarget({ trigger: el("disabled", { disabled: true }), survivorFirstControl: null, pageFallback: page })).toBe(page);
  });

  it("inert page fallback is never chosen; with nothing eligible the result is null (no focus on a hidden node)", () => {
    expect(chooseFocusTarget({ trigger: el("gone", { isConnected: false }), survivorFirstControl: null, pageFallback: el("inert", { inert: true }) })).toBeNull();
  });

  it("a surviving dialog whose only control is inert is not a target; the trigger is used instead", () => {
    const trigger = el("t");
    expect(chooseFocusTarget({ trigger, survivorFirstControl: el("inert-ctl", { inert: true }), pageFallback: el("p") })).toBe(trigger);
  });
});
