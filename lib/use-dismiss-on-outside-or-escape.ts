import { useEffect, type RefObject } from "react";

// Was hand-copied into components/ui/select.tsx and components/ui/
// overflow-menu.tsx (the latter's own comment already pointed at the
// former as "the same reason"), plus a third, partial copy in
// components/dashboard/help-menu.tsx that only handled the outside-click
// half — dropdown/menu dismissal drifting apart is exactly the kind of
// gap that duplication invites: help-menu.tsx had no Escape-to-close at
// all until this was unified.
export function useDismissOnOutsideOrEscape(rootRef: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Scoped to this dropdown's own DOM subtree (not window) and stops
      // the keypress from bubbling further — otherwise a parent Modal's own
      // window-level Escape listener (see components/ui/modal.tsx) fires on
      // the same keypress and closes the whole form behind this dropdown,
      // discarding whatever the operator had typed.
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    const root = rootRef.current;
    root?.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      root?.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, onClose]);
}
