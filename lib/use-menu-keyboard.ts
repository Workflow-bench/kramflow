"use client";

import { useEffect, type RefObject } from "react";

// WAI-ARIA APG menu-button keyboard model (F11, 2026-10 review), shared by
// every role="menu" popup so they behave the same: focus moves to the first
// item on open, Arrow keys / Home / End move between items (wrapping),
// Escape closes and returns focus to the trigger, Tab closes and lets focus
// continue naturally. Items are found by role="menuitem" inside `menuRef`.
// `initialFocus: "last"` is for a trigger opened with ArrowUp (APG).
export function useMenuKeyboard({
  open,
  menuRef,
  triggerRef,
  onClose,
  initialFocus = "first",
}: {
  open: boolean;
  menuRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocus?: "first" | "last";
}) {
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const items = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
    const timer = setTimeout(() => {
      const list = items();
      (initialFocus === "last" ? list[list.length - 1] : list[0])?.focus();
    }, 0);

    function onKeyDown(e: KeyboardEvent) {
      const list = items();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(index + 1) % list.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(index - 1 + list.length) % list.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      } else if (e.key === "Tab") {
        onClose();
      }
    }

    menu.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      menu.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuRef, triggerRef, onClose, initialFocus]);
}
