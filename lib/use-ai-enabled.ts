"use client";

import { useEffect, useState } from "react";

// One request per page load, shared by every AI button on the page.
let pending: Promise<boolean> | null = null;

function fetchEnabled(): Promise<boolean> {
  pending ??= fetch("/api/ai/status")
    .then((res) => (res.ok ? res.json() : { enabled: false }))
    .then((data) => data?.enabled === true)
    .catch(() => false);
  return pending;
}

// false until the server confirms AI is configured, so the buttons never
// flash in and then disappear.
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    fetchEnabled().then((value) => {
      if (live) setEnabled(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
