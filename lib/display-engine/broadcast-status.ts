import type { BroadcastMessage, BroadcastTarget, DisplayGroup, DisplayInstance } from "./types";

// Shared by the on-display overlay and the operator-side Messages summary so
// both use the same notion of "still showing" (R4, 2026-10 correction pass).
export function effectiveExpiry(message: Pick<BroadcastMessage, "durationSeconds" | "createdAt" | "expiresAt">): number | null {
  if (message.durationSeconds !== null) return Date.parse(message.createdAt) + message.durationSeconds * 1000;
  if (message.expiresAt) return Date.parse(message.expiresAt);
  return null;
}

export function isUnexpired(message: Pick<BroadcastMessage, "durationSeconds" | "createdAt" | "expiresAt">, now: number): boolean {
  const expiry = effectiveExpiry(message);
  return expiry === null || now <= expiry;
}

const TYPE_LABEL: Record<string, string> = {
  presenter: "Presenter",
  "green-room": "Green Room",
  av: "AV",
  general: "General",
  custom: "Custom",
};

// The audience the message was *addressed* to, in words. It says nothing
// about which physical screens received it — there is no delivery receipt.
export function describeTarget(
  target: BroadcastTarget,
  registry: Record<string, DisplayInstance>,
  groups: Record<string, DisplayGroup>
): string {
  switch (target.kind) {
    case "all":
      return "all displays";
    case "type":
      return `${TYPE_LABEL[target.value ?? ""] ?? "selected"} displays`;
    case "group": {
      const group = target.value ? groups[target.value] : undefined;
      return group ? `the “${group.name}” group` : "a display group";
    }
    case "display": {
      const display = target.value ? registry[target.value] : undefined;
      return display ? `“${display.name}”` : "one display";
    }
    default:
      return "selected displays";
  }
}
