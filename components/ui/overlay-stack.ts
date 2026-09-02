"use client";

// Shared registry of currently-open window-level-Escape overlays (Modal,
// ConfirmDialog). Without this, stacking a ConfirmDialog on top of a
// still-open Modal — a real layout, not a hypothetical: see
// components/dashboard/share-link-panel.tsx's "Manage Links" Modal with a
// per-link "Revoke" ConfirmDialog on top, deliberately a DOM *sibling* of
// Modal rather than nested inside it (so it isn't visually clipped by
// Modal's own stacking context) — means each attaches its own independent
// `window.addEventListener("keydown", ...)`, so a single Escape press fires
// both, closing the whole Modal instead of just the confirmation on top of
// it. Escape should only ever close the topmost overlay.
let stack: symbol[] = [];

export function pushOverlay(id: symbol) {
  stack.push(id);
}

export function popOverlay(id: symbol) {
  stack = stack.filter((s) => s !== id);
}

export function isTopmostOverlay(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}
