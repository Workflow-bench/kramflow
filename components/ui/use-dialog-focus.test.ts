import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inertOutside, __inertMarkCount } from "./use-dialog-focus";

// The fake element is only ever passed to inertOutside, which uses no HTMLElement API.
const asEl = (e: El) => e as unknown as HTMLElement;

// Minimal DOM for node: enough for inertOutside (parent/children/attributes).
class El {
  tagName: string;
  children: El[] = [];
  parentElement: El | null = null;
  private attrs = new Map<string, string>();
  constructor(tag: string) {
    this.tagName = tag;
  }
  append(child: El): El {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  get inert() {
    return this.attrs.has("inert");
  }
}

let body: El;
let page: El;
let lower: El;
let lowerContent: El;
let upper: El;
let upperSibling: El;

beforeEach(() => {
  body = new El("BODY");
  page = body.append(new El("MAIN"));
  // Layout A: the upper dialog is nested inside the lower dialog's content.
  lower = body.append(new El("DIV"));
  lowerContent = lower.append(new El("DIV"));
  upper = lowerContent.append(new El("DIV"));
  upperSibling = lowerContent.append(new El("SPAN"));
  vi.stubGlobal("document", { body });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nested dialogs (upper inside lower)", () => {
  it("closing the upper dialog keeps the page excluded while the lower remains open", () => {
    const closeLower = inertOutside(asEl(lower));
    const closeUpper = inertOutside(asEl(upper));
    expect(page.inert).toBe(true);
    closeUpper();
    expect(page.inert).toBe(true); // lower still open: background stays excluded
    expect(upperSibling.inert).toBe(false); // lower's own content is active again
    closeLower();
    expect(page.inert).toBe(false);
    expect(__inertMarkCount()).toBe(0);
  });

  it("closing the lower dialog first keeps the content under the upper dialog excluded", () => {
    const closeLower = inertOutside(asEl(lower));
    const closeUpper = inertOutside(asEl(upper));
    closeLower();
    expect(page.inert).toBe(true); // upper still open: page must stay excluded
    closeUpper();
    expect(page.inert).toBe(false);
    expect(__inertMarkCount()).toBe(0);
  });
});

describe("sibling dialogs (share-link Modal with a Revoke ConfirmDialog on top)", () => {
  it("closing the upper sibling reactivates the lower dialog, which is still open", () => {
    const sibling = body.append(new El("DIV")); // the upper dialog is a DOM sibling of lower
    const upperDlg = sibling.append(new El("DIV"));
    const closeLower = inertOutside(asEl(lower));
    const closeUpper = inertOutside(asEl(upperDlg));
    expect(lower.inert).toBe(true); // lower is excluded while the upper one is open
    closeUpper();
    expect(lower.inert).toBe(false); // lower is open again
    expect(page.inert).toBe(true); // background still excluded by lower
    closeLower();
    expect(page.inert).toBe(false);
    expect(lower.inert).toBe(false);
  });
});

describe("restoration", () => {
  it("restores an element that was already inert before any dialog opened", () => {
    page.setAttribute("inert", "");
    const close = inertOutside(asEl(lower));
    close();
    expect(page.inert).toBe(true); // was inert before: left as it was
  });

  it("leaves no marks behind after every dialog closes, in any order", () => {
    const a = inertOutside(asEl(lower));
    const b = inertOutside(asEl(upper));
    const c = inertOutside(asEl(upperSibling));
    b();
    a();
    c();
    expect(__inertMarkCount()).toBe(0);
    expect(page.inert).toBe(false);
    expect(lowerContent.inert).toBe(false);
  });
});
