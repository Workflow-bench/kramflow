"use client";

import { useCallback, useRef, useState } from "react";

// Display Manager's "Test Message" command was delivered and cleared correctly on
// every display, but no display page had a case for it — the operator got a
// false "message sent" toast for a command that rendered nothing anywhere,
// removing the one built-in way to confirm a screen is actually receiving
// commands before a show. Every display page wires this the same way, so
// it's a shared hook rather than four copies of the same state.

const AUTO_DISMISS_MS = 8000;

export interface TestMessage {
  text: string;
  issuedAt: string;
}

export function useTestMessage() {
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTestMessage = useCallback((text: string, issuedAt: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTestMessage({ text, issuedAt });
    timeoutRef.current = setTimeout(() => setTestMessage(null), AUTO_DISMISS_MS);
  }, []);

  return { testMessage, showTestMessage };
}
