// Single source of truth for programs.color_tag's allowed values — used by
// the Add Item form's swatch picker, the cue sheet's bulk-edit panel, and
// program-list.tsx's Badge rendering, so the enum can't drift between them.
// A constrained set (not freeform text) per the item 6a brief: color tags
// exist to be scanned at a glance during a live show, which only works if
// the same tag always means the same thing and renders the same color.
export interface ColorTagOption {
  value: string;
  label: string;
  tone: "green" | "blue" | "orange" | "red";
}

export const COLOR_TAGS: ColorTagOption[] = [
  { value: "ready", label: "Ready", tone: "green" },
  { value: "vip", label: "VIP", tone: "blue" },
  { value: "needs_confirmation", label: "Needs Confirmation", tone: "orange" },
  { value: "urgent", label: "Urgent", tone: "red" },
];

export const COLOR_TAG_VALUES = COLOR_TAGS.map((t) => t.value) as [string, ...string[]];

export function colorTagTone(value: string | null): ColorTagOption["tone"] | "muted" {
  return COLOR_TAGS.find((t) => t.value === value)?.tone ?? "muted";
}

export function colorTagLabel(value: string | null): string | null {
  if (!value) return null;
  return COLOR_TAGS.find((t) => t.value === value)?.label ?? value;
}
