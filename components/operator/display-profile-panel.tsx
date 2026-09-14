"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SectionLabel } from "@/components/ui/section-label";
import {
  ZONE_TEMPLATES,
  WIDGET_TYPES,
  getZoneTemplate,
  type DisplayProfile,
  type DisplayProfileInput,
  type ZoneTemplateId,
  type ViewingDistance,
} from "@/lib/display-engine/types";

const VIEWING_DISTANCE_OPTIONS = [
  { value: "far", label: "Far — across-the-room TV" },
  { value: "close", label: "Close — console / arm's length" },
];

const EMPTY_WIDGET_OPTION = { value: "", label: "— empty —" };
const WIDGET_OPTIONS = [EMPTY_WIDGET_OPTION, ...WIDGET_TYPES.map((w) => ({ value: w.value, label: w.label }))];

function emptyDraft(): DisplayProfileInput {
  return {
    name: "",
    template: ZONE_TEMPLATES[0].id,
    zones: {},
    viewingDistance: "far",
    accentColor: null,
    customText: null,
  };
}

/**
 * The real editor for the "Display Profiles" concept
 * app/e/[eventId]/displays/page.tsx's own comment documents as having been
 * disabled because there was nothing real to configure — see
 * supabase/migrations/0013_display_profiles.sql. Self-contained (own
 * fetch/CRUD state) the same way ShareLinkPanel is, so the parent page
 * only needs to render <DisplayProfilePanel eventId .../> and doesn't
 * carry this feature's state itself.
 */
export interface DisplayProfilePanelHandle {
  /** Opens the panel straight into "create new," skipping the list view —
   *  used by CustomDisplayPreviewMenu's own "New profile…" / "Create a
   *  profile" actions, so a sibling component can trigger this panel's
   *  create flow without owning any of its state. */
  openCreate: () => void;
}

export const DisplayProfilePanel = forwardRef<
  DisplayProfilePanelHandle,
  {
    eventId: string;
    isOwner: boolean;
    /** Fired after a create/update/delete actually succeeds — lets the
     *  parent page's own lighter profileOptions list (used by the "Preview
     *  a display" row and the per-display profile picker) stay in sync
     *  without polling or lifting this component's whole state up. */
    onChange?: () => void;
  }
>(function DisplayProfilePanel({ eventId, isOwner, onChange }, ref) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<DisplayProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DisplayProfile | "new" | null>(null);
  const [draft, setDraft] = useState<DisplayProfileInput>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisplayProfile | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/display-engine/profiles?eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (data.ok) setProfiles(data.profiles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() is stable enough here; only eventId/open should re-trigger it
  }, [open, eventId]);

  function startCreate() {
    setDraft(emptyDraft());
    setEditing("new");
  }

  useImperativeHandle(ref, () => ({
    openCreate: () => {
      setOpen(true);
      startCreate();
    },
  }));

  function startEdit(profile: DisplayProfile) {
    setDraft({
      name: profile.name,
      template: profile.template,
      zones: profile.zones,
      viewingDistance: profile.viewingDistance,
      accentColor: profile.accentColor,
      customText: profile.customText,
    });
    setEditing(profile);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew ? "/api/display-engine/profiles" : `/api/display-engine/profiles/${(editing as DisplayProfile).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, eventId }),
        }
      );
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Couldn't save. Try again.");
        return;
      }
      toast.success(isNew ? "Profile created" : "Profile updated");
      setEditing(null);
      await load();
      onChange?.();
    } finally {
      setSaving(false);
    }
  }

  async function remove(profile: DisplayProfile) {
    const res = await fetch(`/api/display-engine/profiles/${profile.id}?eventId=${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.ok) {
      toast.error(data.error ?? "Couldn't delete. Try again.");
      return;
    }
    toast.success(`Deleted "${profile.name}"`);
    setDeleteTarget(null);
    await load();
    onChange?.();
  }

  const templateDef = getZoneTemplate(draft.template);

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap py-3 border-b border-line-soft">
        <div className="flex items-center gap-3 min-w-0">
          <LayoutGrid className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-console-sm text-primary">Display Profiles</p>
            <p className="text-console-meta text-muted-2">
              Build a custom display from widgets — pick a layout, assign widgets to zones, reuse it across events.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
          Manage Profiles
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Display Profiles" size="lg">
        {editing ? (
          <div className="flex flex-col gap-5">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Lobby Branding, Stage Manager Monitor"
              aria-label="Profile name"
            />

            <div className="flex flex-col gap-2">
              <SectionLabel>Layout</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ZONE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, template: t.id as ZoneTemplateId, zones: {} }))}
                    className={`rounded-panel border px-4 py-3 text-left transition-colors ${
                      draft.template === t.id
                        ? "border-accent bg-accent/10"
                        : "border-line-soft hover:bg-card-hover"
                    }`}
                  >
                    <p className="text-console-sm text-primary">{t.label}</p>
                    <p className="text-console-meta text-muted-2 mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionLabel>Widgets</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templateDef.zones.map((zone) => (
                  <div key={zone.id} className="flex flex-col gap-1.5">
                    <label className="text-console-meta text-muted-2">{zone.label}</label>
                    <Select
                      value={draft.zones[zone.id] ?? ""}
                      onChange={(v) =>
                        setDraft((d) => ({ ...d, zones: { ...d.zones, [zone.id]: v ? (v as never) : null } }))
                      }
                      options={WIDGET_OPTIONS}
                      searchable={false}
                      aria-label={`Widget for ${zone.label}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-console-meta text-muted-2">Viewing distance</label>
                <Select
                  value={draft.viewingDistance}
                  onChange={(v) => setDraft((d) => ({ ...d, viewingDistance: v as ViewingDistance }))}
                  options={VIEWING_DISTANCE_OPTIONS}
                  searchable={false}
                  aria-label="Viewing distance"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-console-meta text-muted-2">Accent color (optional)</label>
                <Input
                  value={draft.accentColor ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, accentColor: e.target.value || null }))}
                  placeholder="#f4bf4f"
                />
              </div>
            </div>

            {Object.values(draft.zones).includes("custom-text") && (
              <div className="flex flex-col gap-1.5">
                <label className="text-console-meta text-muted-2">Custom text</label>
                <Textarea
                  value={draft.customText ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, customText: e.target.value || null }))}
                  placeholder="Wifi password, venue rules, a sponsor line..."
                  rows={3}
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
                {editing === "new" ? "Create profile" : "Save changes"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={startCreate} disabled={!isOwner}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                New profile
              </Button>
            </div>

            {loading ? (
              <p className="text-console-sm text-muted-2">Loading…</p>
            ) : profiles.length === 0 ? (
              <EmptyState
                title="No display profiles yet"
                body="Create one to build a custom display from widgets — pick a layout, assign widgets to zones, and it becomes a selectable screen at /screens."
              />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {profiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-panel border border-line-soft px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-console-sm text-primary truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge tone="muted">{getZoneTemplate(p.template).label}</Badge>
                        <span className="text-console-meta text-muted-2">
                          {Object.values(p.zones).filter(Boolean).length} widget(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" square onClick={() => startEdit(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        square
                        onClick={() => setDeleteTarget(p)}
                        disabled={!isOwner}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void remove(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Any display currently pointed at this profile will show as unconfigured until it's reassigned. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
      />
    </>
  );
});
