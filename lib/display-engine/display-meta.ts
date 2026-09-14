import { Presentation, Sparkles, Sliders, Tv, LayoutGrid, type LucideIcon } from "lucide-react";
import type { DisplayType } from "./types";

export interface DisplayTypeMeta {
  desc: string;
  Icon: LucideIcon;
}

// Presentation metadata (description + icon) for each display type, kept
// separate from DISPLAY_TYPES (types.ts) the same way BROADCAST_TYPE_META
// sits beside BroadcastType in broadcast-style.ts — a plain data union
// shouldn't pull in a UI icon library, but app/screens's picker and the
// Displays fleet page's preview/provisioning rows all want the same
// label/description/icon for a given type, previously hand-duplicated in
// each place separately.
//
// "custom" now has a real entry — it used to be `Exclude<DisplayType,
// "custom">` because there was no real display behind it (routed to
// Presenter as a stub). Now that a custom display is a real, profile-
// driven output (see DisplayProfile in types.ts), it needs the same
// meta every other type gets, everywhere that meta is read from.
export const DISPLAY_TYPE_META: Record<DisplayType, DisplayTypeMeta> = {
  presenter: { desc: "Confidence monitor", Icon: Presentation },
  "green-room": { desc: "Performer display", Icon: Sparkles },
  av: { desc: "Technical requirements TV", Icon: Sliders },
  general: { desc: "Public / lobby display", Icon: Tv },
  custom: { desc: "Build your own from widgets", Icon: LayoutGrid },
};
