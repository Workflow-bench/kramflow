// Item 6d's config-driven Add Item form — a lightweight per-event field
// list (not a hardcoded set of JSX sections) that ProgramForm renders from.
// Item 6c ("production fields depend on auditorium/program type") folds
// into this rather than being a separate bespoke system: a field's
// visibility is just a visibleIf condition against another field's value,
// the same mechanism 6d needs anyway.
export interface FormFieldOption {
  value: string;
  label: string;
}

export type FormFieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "color-swatch" | "duration";

export interface FormFieldConfig {
  // A ProgramInput key (name, presenter, videoSidescreen, ...), or one of
  // the three synthetic keys the form resolves options for dynamically
  // rather than from `options` below: sessionId, partitionId, auditoriumId.
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
  visibleIf?: { field: string; equals: string };
  group: "Basics" | "Presenter" | "Timing" | "Production" | "Remarks";
}

export interface EventFormConfig {
  eventName: string;
  fields: FormFieldConfig[];
}

// A handful of fields are genuinely DB-required (see lib/validation/program.ts) —
// no per-event config is allowed to mark these optional, since submission
// would then violate the DB layer's own constraints regardless of what the
// form config says.
export const ALWAYS_REQUIRED_KEYS = new Set(["name", "type", "sessionId"]);

// Reproduces today's exact fixed field set/requiredness — used whenever no
// event has a saved config, so this redesign stays fully backward
// compatible with every event that never opts into a custom one.
export const DEFAULT_CONFIG: FormFieldConfig[] = [
  { key: "name", label: "Item name", type: "text", required: true, group: "Basics" },
  {
    key: "type",
    label: "Type",
    type: "select",
    required: true,
    group: "Basics",
    options: [
      { value: "item", label: "Item" },
      { value: "break", label: "Break" },
    ],
  },
  { key: "sessionId", label: "Session", type: "select", required: true, group: "Basics" },
  { key: "partitionId", label: "Section", type: "select", required: false, group: "Basics" },
  { key: "description", label: "Description", type: "text", required: false, group: "Basics" },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    group: "Basics",
    options: [
      { value: "confirmed", label: "Confirmed" },
      { value: "draft", label: "Draft" },
      { value: "cut", label: "Cut" },
      { value: "tbd", label: "TBD" },
    ],
  },
  { key: "colorTag", label: "Color tag", type: "color-swatch", required: false, group: "Basics" },
  { key: "presenter", label: "Presenter", type: "text", required: false, group: "Presenter" },
  { key: "presenterContact", label: "Contact", type: "text", required: false, group: "Presenter" },
  { key: "presenterRequirement", label: "Requirement", type: "text", required: false, group: "Presenter" },
  { key: "startTime", label: "Start time", type: "text", required: false, group: "Timing" },
  { key: "endTime", label: "End time", type: "text", required: false, group: "Timing" },
  { key: "duration", label: "Duration (min)", type: "duration", required: false, group: "Timing" },
  {
    key: "videoSidescreen",
    label: "Sidescreen",
    type: "select",
    required: false,
    group: "Production",
    options: [
      { value: "none", label: "None" },
      { value: "slides", label: "Slides" },
      { value: "live_feed", label: "Live Feed" },
    ],
  },
  { key: "auditoriumId", label: "Auditorium", type: "select", required: false, group: "Production" },
  { key: "cameraAngle", label: "Camera angle", type: "text", required: false, group: "Production" },
  { key: "hallLights", label: "Hall lights", type: "text", required: false, group: "Production" },
  { key: "stageLights", label: "Stage lights", type: "text", required: false, group: "Production" },
  { key: "props", label: "Props", type: "text", required: false, group: "Production" },
  {
    key: "curtains",
    label: "Curtains",
    type: "select",
    required: false,
    group: "Production",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
  },
  { key: "audioMics", label: "Mic needed", type: "checkbox", required: false, group: "Production" },
  { key: "audioTrack", label: "Audio track", type: "checkbox", required: false, group: "Production" },
  { key: "backdrop", label: "Backdrop", type: "checkbox", required: false, group: "Production" },
  { key: "videoPptNeeded", label: "PPT needed", type: "checkbox", required: false, group: "Production" },
  { key: "remarks", label: "Remarks", type: "textarea", required: false, group: "Remarks" },
];

export function resolveVisibility(field: FormFieldConfig, values: Record<string, unknown>): boolean {
  if (!field.visibleIf) return true;
  return values[field.visibleIf.field] === field.visibleIf.equals;
}
