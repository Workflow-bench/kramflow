"use client";

import { useState } from "react";
import { useRegisterDisplay } from "./use-register-display";
import { useTestMessage } from "./use-test-message";
import type { DisplayType } from "./types";

/**
 * Combines useRegisterDisplay with the standard reload/test-message/
 * force-fullscreen command handling every display page needs — was
 * hand-copied verbatim into all four display clients (general/av/
 * green-room/presenter), which meant a new command type had to be added
 * to all four switches by hand (easy to miss one, leaving that display
 * silently unresponsive to operator broadcasts).
 */
export function useDisplayCommands(name: string, type: DisplayType, room: string | null = null) {
  const { testMessage, showTestMessage } = useTestMessage();
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const display = useRegisterDisplay(name, type, room, (command) => {
    if (command.type === "reload") window.location.reload();
    if (command.type === "test-message") showTestMessage(command.text, command.issuedAt);
    if (command.type === "force-fullscreen") setFullscreenPrompt(true);
  });

  return {
    display,
    testMessage,
    fullscreenPrompt,
    dismissFullscreenPrompt: () => setFullscreenPrompt(false),
  };
}
