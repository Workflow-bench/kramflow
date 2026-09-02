"use client";

import { useState } from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useDisplayEngine } from "@/lib/display-engine/store";
import { newId } from "@/lib/display-engine/store";
import type { DisplayProfile, DisplayWidget } from "@/lib/display-engine/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Panel } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const ORIENTATION_OPTIONS = [
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
];

const ALL_WIDGETS: DisplayWidget[] = [
  "timer",
  "clock",
  "program-title",
  "program-subtitle",
  "next-program",
  "progress-ring",
  "speaker",
  "room",
  "messages",
  "stage-status",
  "alerts",
  "running-order",
  "session-name",
];

function widgetLabel(widget: DisplayWidget): string {
  return widget.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// A miniature of the real display, not the real thing — the settings here
// (font scale, orientation, which widgets show) have no live show data to
// render against at this level, and standing up an iframe of an actual
// display route just to preview a profile isn't worth the cost that
// StageTimer's own Output Links preview pays for, where the thing being
// previewed already has a real target to show. What matters per
// senior-ux-layout-standards's preview-next-to-controls reasoning is that
// a toggle here is felt immediately, right next to the control that caused
// it — not that the mockup is pixel-accurate to the real display.
function ProfilePreview({ profile }: { profile: DisplayProfile }) {
  const showTitle = profile.visibleWidgets.includes("program-title");
  const showSubtitle = profile.visibleWidgets.includes("program-subtitle");
  const showTimer = profile.visibleWidgets.includes("timer");
  const otherWidgets = profile.visibleWidgets.filter(
    (w) => !["program-title", "program-subtitle", "timer"].includes(w)
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-console-meta text-muted-2">Preview</span>
      <div
        // rounded-card, deliberately: this box is a miniature of an actual
        // Stage display (see the function comment above), so it should use
        // the real Stage-surface radius to look authentic rather than the
        // Console rounded-panel this file otherwise uses for its own chrome.
        className={cn(
          // eslint-disable-next-line no-restricted-syntax
          "relative rounded-card bg-background border border-line-soft overflow-hidden flex flex-col items-center justify-center gap-3 p-4",
          profile.layout.orientation === "landscape" ? "aspect-video" : "aspect-[9/16] mx-auto w-40"
        )}
      >
        {profile.layout.showClock && (
          <span className="absolute top-2.5 right-3 flex items-center gap-1 text-console-meta text-muted-2">
            <Clock className="h-3 w-3" strokeWidth={2} />
            12:34
          </span>
        )}

        {profile.layout.showProgressRing && (
          <svg viewBox="0 0 36 36" className="h-14 w-14 shrink-0" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-line-soft)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 15.5 * 0.65} ${2 * Math.PI * 15.5}`}
              transform="rotate(-90 18 18)"
            />
          </svg>
        )}

        {showTimer && (
          <p className="tnum text-primary font-semibold" style={{ fontSize: `${1.5 * profile.layout.fontScale}rem` }}>
            04:12
          </p>
        )}

        {showTitle && (
          <p
            className="text-primary font-medium text-center leading-tight"
            style={{ fontSize: `${1 * profile.layout.fontScale}rem` }}
          >
            Welcome Speech
          </p>
        )}
        {showSubtitle && (
          <p className="text-muted-2 text-center" style={{ fontSize: `${0.75 * profile.layout.fontScale}rem` }}>
            Opening Remarks
          </p>
        )}

        {!showTitle && !showTimer && !profile.layout.showProgressRing && (
          // Same authentic-preview exception as this box's own radius above.
          // eslint-disable-next-line no-restricted-syntax
          <p className="text-caption text-muted-2">No widgets visible</p>
        )}
      </div>

      {otherWidgets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {otherWidgets.map((w) => (
            <Badge key={w} tone="muted">
              {widgetLabel(w)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function blankProfile(): DisplayProfile {
  return {
    id: newId("profile"),
    name: "New Profile",
    builtIn: false,
    layout: { fontScale: 1, showProgressRing: true, showClock: true, orientation: "landscape" },
    visibleWidgets: ["timer", "clock"],
    colorOverrides: {},
    refreshMs: 15000,
  };
}

/**
 * Display Profiles management — reusable presentation presets, built on
 * top of the profile data model already used by BUILT_IN_PROFILES
 * (lib/display-engine/defaults.ts). Built-in profiles are read-only;
 * operators create/edit/delete their own from here, then assign them to
 * displays from the Display Manager list above.
 */
export function ProfileEditor() {
  const { state: engine, saveProfile, deleteProfile } = useDisplayEngine();
  const [editing, setEditing] = useState<DisplayProfile | null>(null);

  const profiles = Object.values(engine.profiles).sort((a, b) => Number(a.builtIn) - Number(b.builtIn));

  function toggleWidget(widget: DisplayWidget) {
    if (!editing) return;
    const has = editing.visibleWidgets.includes(widget);
    setEditing({
      ...editing,
      visibleWidgets: has ? editing.visibleWidgets.filter((w) => w !== widget) : [...editing.visibleWidgets, widget],
    });
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <SectionLabel>Display Profiles</SectionLabel>
        <Button variant="secondary" size="sm" onClick={() => setEditing(blankProfile())}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New Profile
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {profiles.map((profile) => (
          <Panel key={profile.id} className="px-5 py-4 min-w-[220px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-console-sm text-primary font-medium">{profile.name}</p>
                <p className="text-console-meta text-muted-2 mt-0.5">
                  {profile.builtIn ? "Built-in" : "Custom"} • {profile.layout.fontScale}x • {profile.visibleWidgets.length} widgets
                </p>
              </div>
              {!profile.builtIn && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" square onClick={() => setEditing(profile)} aria-label="Edit profile">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    square
                    onClick={() => deleteProfile(profile.id)}
                    aria-label="Delete profile"
                    className="hover:text-status-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>

      {/* Was a fully hand-rolled overlay (own backdrop, own Escape
          handling, no focus trap at all) instead of the canonical Modal —
          the reason was Modal's widest size (max-w-2xl) not being wide
          enough for this editor's two-column layout, not a deliberate
          choice to skip Modal's focus-trap/stacked-overlay Escape
          handling. Added a genuine `xl` size to Modal instead of carrying
          that gap forward. */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit Profile" size="xl">
        {editing && (
          <>
            {/* Preview sits beside the controls that shape it, the same
                proximity StageTimer's Output Links panel uses for its own
                live iframe (senior-ux-layout-standards's
                preview-next-to-controls reasoning) — every toggle below is
                felt immediately, in the same glance, instead of requiring a
                trip to Display Manager's separate Preview button to see
                what changed. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-console-meta text-muted-2">Name</span>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-console-meta text-muted-2">Font Scale</span>
                    <Input
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={3}
                      value={editing.layout.fontScale}
                      onChange={(e) =>
                        setEditing({ ...editing, layout: { ...editing.layout, fontScale: Number(e.target.value) } })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-console-meta text-muted-2">Orientation</span>
                    <Select
                      value={editing.layout.orientation}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          layout: { ...editing.layout, orientation: v as "landscape" | "portrait" },
                        })
                      }
                      options={ORIENTATION_OPTIONS}
                      searchable={false}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-6">
                  <Checkbox
                    checked={editing.layout.showProgressRing}
                    onChange={(v) => setEditing({ ...editing, layout: { ...editing.layout, showProgressRing: v } })}
                    label="Show progress ring"
                  />
                  <Checkbox
                    checked={editing.layout.showClock}
                    onChange={(v) => setEditing({ ...editing, layout: { ...editing.layout, showClock: v } })}
                    label="Show clock"
                  />
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-console-meta text-muted-2">Refresh Interval (ms)</span>
                  <Input
                    type="number"
                    min={1000}
                    step={1000}
                    value={editing.refreshMs}
                    onChange={(e) => setEditing({ ...editing, refreshMs: Number(e.target.value) })}
                  />
                </label>

                <div>
                  <span className="text-console-meta text-muted-2">Visible Widgets</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_WIDGETS.map((widget) => (
                      <Button
                        key={widget}
                        type="button"
                        variant={editing.visibleWidgets.includes(widget) ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => toggleWidget(widget)}
                        className="rounded-full"
                      >
                        {widget}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <ProfilePreview profile={editing} />
            </div>

            <div className="flex items-center gap-2 mt-8">
              <Button
                variant="primary"
                onClick={() => {
                  // The Font Scale/Refresh Interval inputs' min/max are
                  // cosmetic-only (a bare `type="number"` input never
                  // enforces them, and typing e.g. "0" or clearing the
                  // field passes it straight through) — clamped here so a
                  // real display assigned this profile can't end up with
                  // fontScale: 0 (invisible text) or refreshMs below 1000.
                  const fontScale = Number.isFinite(editing.layout.fontScale)
                    ? Math.min(3, Math.max(0.5, editing.layout.fontScale))
                    : 1;
                  const refreshMs = Number.isFinite(editing.refreshMs) ? Math.max(1000, editing.refreshMs) : 15000;
                  saveProfile({ ...editing, layout: { ...editing.layout, fontScale }, refreshMs });
                  setEditing(null);
                }}
              >
                Save Profile
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
