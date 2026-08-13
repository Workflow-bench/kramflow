import { z } from "zod";

const formFieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const formFieldConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "select", "checkbox", "color-swatch", "duration"]),
  required: z.boolean(),
  options: z.array(formFieldOptionSchema).optional(),
  visibleIf: z.object({ field: z.string().min(1), equals: z.string() }).optional(),
  group: z.enum(["Basics", "Presenter", "Timing", "Production", "Remarks"]),
});

export const eventFormConfigSchema = z.object({
  eventName: z.string().min(1),
  fields: z.array(formFieldConfigSchema).min(1),
});

export type EventFormConfigInput = z.infer<typeof eventFormConfigSchema>;
