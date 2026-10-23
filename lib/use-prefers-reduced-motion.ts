"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// One reactive source for the reduced-motion preference (R11). Unlike a
// one-off matchMedia().matches read at mount, this updates when the user
// changes the OS setting while the page is open. Starts false on the server
// and first client render so markup matches, then syncs after mount.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const sync = () => setReduced(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return reduced;
}
