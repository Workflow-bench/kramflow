import { AlertTriangle, Bell, CheckCircle2, Info, MessageSquare, type LucideIcon } from "lucide-react";
import type { BroadcastType } from "./types";

// The one type→color/icon/label mapping for broadcasts — previously
// duplicated three ways with drifting subsets: broadcast-overlay.tsx's own
// TYPE_STYLES (the actual on-display rendering — authoritative), operator-
// broadcast-panel.tsx's QUICK_TYPES (a hand-tinted 4-value subset), and
// broadcast/page.tsx's compose/history UI, which had no color mapping at
// all — type showed as plain muted caption text everywhere, so a warning
// and an info message read identically until opened. This is now the
// single source every one of those three consumes, so "what does orange
// mean here" has one answer across compose, history, the Console quick-
// panel, and the display itself.
export const BROADCAST_TYPE_META: Record<
  BroadcastType,
  { label: string; tone: "blue" | "orange" | "green" | "red" | "muted"; accentClass: string; Icon: LucideIcon }
> = {
  info: { label: "Information", tone: "blue", accentClass: "bg-status-blue/15 text-status-blue", Icon: Info },
  reminder: { label: "Reminder", tone: "blue", accentClass: "bg-status-blue/15 text-status-blue", Icon: Bell },
  warning: { label: "Warning", tone: "orange", accentClass: "bg-status-orange/15 text-status-orange", Icon: AlertTriangle },
  success: { label: "Success", tone: "green", accentClass: "bg-status-green/15 text-status-green", Icon: CheckCircle2 },
  emergency: { label: "Emergency", tone: "red", accentClass: "bg-status-red text-white", Icon: AlertTriangle },
  custom: { label: "Custom", tone: "muted", accentClass: "bg-white/10 text-primary", Icon: MessageSquare },
};

// Explicit order, not Object.entries() — emergency sits last, after custom,
// so it isn't the path of least resistance while scanning the dropdown;
// the manual "type: emergency" path is still fully gated by the same
// send-confirmation as everything else (needsSendConfirm), but ordering it
// last is a free, honest nudge toward the dedicated preset buttons instead.
export const BROADCAST_TYPE_OPTIONS: { value: BroadcastType; label: string }[] = (
  ["info", "reminder", "warning", "success", "custom", "emergency"] as BroadcastType[]
).map((value) => ({ value, label: BROADCAST_TYPE_META[value].label }));
