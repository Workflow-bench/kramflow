import "server-only";
import { ZONE_TEMPLATES, WIDGET_TYPES, type DisplayProfileInput } from "@/lib/display-engine/types";

// Shared by both display-profiles route files (list/create and
// get/update/delete) — a Next.js route.ts file may only export the HTTP
// method handlers Next recognizes, so this can't live inside either route
// file itself the way a plain server helper normally would.

export function mapProfileRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    template: row.template,
    zones: row.zones ?? {},
    viewingDistance: row.viewing_distance,
    accentColor: row.accent_color,
    customText: row.custom_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Same trust boundary as every other jsonb config column in this schema
// (see supabase/migrations/0013_display_profiles.sql's comment) —
// validated here in application code against the real template/zone/
// widget definitions, not by a jsonb schema constraint in Postgres.
export function validateProfileInput(
  body: Record<string, unknown>
): { ok: true; input: DisplayProfileInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "Name is required" };

  const templateDef = ZONE_TEMPLATES.find((t) => t.id === body.template);
  if (!templateDef) return { ok: false, error: "Invalid template" };

  const validWidgets = new Set<string>(WIDGET_TYPES.map((w) => w.value));
  const zonesInput = (body.zones && typeof body.zones === "object" ? body.zones : {}) as Record<string, unknown>;
  const zones: DisplayProfileInput["zones"] = {};
  for (const zone of templateDef.zones) {
    const value = zonesInput[zone.id];
    if (value === null || value === undefined) {
      zones[zone.id] = null;
    } else if (typeof value === "string" && validWidgets.has(value)) {
      zones[zone.id] = value as DisplayProfileInput["zones"][string];
    } else {
      return { ok: false, error: `Invalid widget for zone "${zone.id}"` };
    }
  }

  const viewingDistance = body.viewingDistance === "close" ? "close" : "far";
  const accentColor = typeof body.accentColor === "string" && body.accentColor.trim() ? body.accentColor.trim() : null;
  const customText = typeof body.customText === "string" && body.customText.trim() ? body.customText.trim() : null;

  return {
    ok: true,
    input: { name, template: templateDef.id, zones, viewingDistance, accentColor, customText },
  };
}
