"use client";

// Kramflow component catalog — the visual reference DESIGN.md's
// "Component catalog" section points to. Real canonical components
// rendered with synthetic data (no auth, no live event), not a
// throwaway demo: every component here is the actual one product
// surfaces import, so this page and the product can never quietly drift
// apart the way a hand-drawn Figma reference could. Not linked from
// product navigation; reachable directly at /dev/components.

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OperationalStatus, OperationalStatusOk, type OperationalStatusKind } from "@/components/ui/operational-status";
import { ControlLeaseStatus } from "@/components/ui/control-lease-status";
import { ConnectionBadge, type ConnectionBadgeStatus } from "@/components/ui/connection-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Card, Panel } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Tooltip } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui/page-header";
import { BROADCAST_TYPE_META } from "@/lib/display-engine/broadcast-style";
import type { BroadcastType } from "@/lib/display-engine/types";
import { RunPosition } from "@/components/operator/run-position";
import type { Program } from "@/lib/types";
import { Trash2, Pencil, Copy } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OverflowMenu } from "@/components/ui/overflow-menu";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ColorTagPicker } from "@/components/ui/color-tag-picker";
import { useToast } from "@/components/ui/toast";
import { ActionBar, ActionBarClear, ActionBarCount, ActionBarSeparator, ActionBarButton } from "@/components/ui/action-bar";
import { MaybeTooltip } from "@/components/ui/tooltip";
import { StageStatusPill, type StageStatus } from "@/components/display-engine/stage-status-pill";

// Minimal synthetic Program — RunPosition only reads .title; the cast
// avoids hand-filling every cue-sheet field for a catalog swatch.
function mockProgram(title: string): Program {
  return { title } as Program;
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="mb-4 pb-3 border-b border-line-soft">
        <h2 className="text-console-md font-semibold text-primary">{title}</h2>
        {description && <p className="text-console-sm text-muted mt-1 max-w-2xl">{description}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function Swatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 bg-card border border-line-soft rounded-panel p-4 min-w-45">
      <span className="text-console-label uppercase text-muted-2">{label}</span>
      {children}
    </div>
  );
}

const ALL_STATUS_KINDS: OperationalStatusKind[] = ["live", "hold", "ready", "online", "rehearsal", "stale", "offline", "warning", "critical"];
const ALL_CONNECTION_STATES: ConnectionBadgeStatus[] = ["connected", "reconnecting", "disconnected"];
const ALL_STAGE_STATUSES: StageStatus[] = ["LIVE", "PAUSED", "ON HOLD", "STANDBY"];

const CATALOG_SELECT_OPTIONS = [
  { value: "a", label: "Friday · Evening Session" },
  { value: "b", label: "Saturday · Morning Session 1 & 2" },
  { value: "c", label: "Saturday · Afternoon Session" },
];

export default function ComponentCatalogPage() {
  const [inputValue, setInputValue] = useState("");
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [selectValue, setSelectValue] = useState("a");
  const [colorTag, setColorTag] = useState<string | null>("green");
  const [modalOpen, setModalOpen] = useState(false);
  const confirmDemo = useConfirmDialog<void>();
  const [actionBarOpen, setActionBarOpen] = useState(false);
  const toast = useToast();

  return (
    <main className="min-h-screen bg-background text-primary px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-14">
        <p className="text-console-label uppercase text-muted-2 mb-2">Kramflow &middot; internal</p>
        <h1 className="text-console-lg font-bold text-primary">Component catalog</h1>
        <p className="text-console-sm text-muted mt-2 max-w-2xl">
          The canonical implementation of every repeated Kramflow UI concept, rendered with synthetic
          data. See <code className="text-console-meta bg-card border border-line-soft rounded-chip px-1.5 py-0.5">DESIGN.md</code> for
          the full system — this page is its visual reference, not a separate spec.
        </p>
      </header>

      <Row
        title="Operational status"
        description="One vocabulary for live position, mode, and system health — replaces the independently-invented HoldBadge, ad-hoc rehearsal chips, and Displays' own online/offline dot the 2026-09-01 audit found. Show-state kinds (live/ready) render a bare dot; system/mode kinds (rehearsal/stale/offline/warning/critical) pair the dot with an icon — see DESIGN.md's 'Operational vocabulary' for why."
      >
        {ALL_STATUS_KINDS.map((kind) => (
          <Swatch key={kind} label={kind}>
            <OperationalStatus kind={kind} />
          </Swatch>
        ))}
        <Swatch label="ok (summary context)">
          <OperationalStatusOk />
        </Swatch>
      </Row>

      <Row
        title="Connection health"
        description="Already a real system pre-dating this pass (console + stage variants, staleness escalation past 15s) — kept as-is and documented here as the canonical answer to 'is this screen connected,' not re-invented per surface."
      >
        {ALL_CONNECTION_STATES.map((status) => (
          <Swatch key={status} label={status}>
            <ConnectionBadge status={status} variant="console" />
          </Swatch>
        ))}
      </Row>
      <p className="text-console-meta text-muted-2 -mt-8 mb-14 max-w-2xl">
        The <code className="bg-card border border-line-soft rounded-chip px-1 py-0.5">stage</code> variant
        is viewport-anchored (fixed, top-center) by design — a display&rsquo;s connection state should never
        compete for space with its own content. It can&rsquo;t be meaningfully nested in a catalog swatch;
        see it live on any display route (e.g. /general?token=...).
      </p>

      <Row
        title="Control lease status"
        description="Who is authoritative right now, and what can this viewer do about it — four mutually-exclusive states, one implementation (previously duplicated inline in ControlsPanel). Remote intentionally stays lighter (a toast, not a persistent strip) — see the component's own doc comment."
      >
        <Swatch label="unclaimed">
          <ControlLeaseStatus
            role="owner"
            iHaveControl={false}
            lockedByOther={false}
            controllerName={null}
            busy={false}
            onRelease={() => {}}
            onTakeControl={() => {}}
            onTakeOver={() => {}}
          />
        </Swatch>
        <Swatch label="held by me">
          <ControlLeaseStatus
            role="owner"
            iHaveControl={true}
            lockedByOther={false}
            controllerName={null}
            busy={false}
            onRelease={() => {}}
            onTakeControl={() => {}}
            onTakeOver={() => {}}
          />
        </Swatch>
        <Swatch label="held by me, releasing (busy)">
          <ControlLeaseStatus
            role="owner"
            iHaveControl={true}
            lockedByOther={false}
            controllerName={null}
            busy={true}
            onRelease={() => {}}
            onTakeControl={() => {}}
            onTakeOver={() => {}}
          />
        </Swatch>
        <Swatch label="controlled by someone else">
          <ControlLeaseStatus
            role="owner"
            iHaveControl={false}
            lockedByOther={true}
            controllerName="Demo Operator Two"
            busy={false}
            onRelease={() => {}}
            onTakeControl={() => {}}
            onTakeOver={() => {}}
          />
        </Swatch>
        <Swatch label="read-only role (editor/viewer)">
          <ControlLeaseStatus
            role="editor"
            iHaveControl={false}
            lockedByOther={false}
            controllerName={null}
            busy={false}
            onRelease={() => {}}
            onTakeControl={() => {}}
            onTakeOver={() => {}}
          />
        </Swatch>
      </Row>

      <Row
        title="Run position — Current / Next / On Deck"
        description="Current, Next, and On Deck as one relationship, not one alone — Console previously showed only the live item in detail, with nothing about what's coming (the audit's 'Live/current/next' finding: Remote and every TV display already carried Next/On Deck; Console didn't). getLive/getNext/getOnDeck (lib/types.ts) are the shared data; this owns only the shared presentation."
      >
        <div className="bg-card border border-line-soft rounded-panel p-5 w-80">
          <RunPosition next={mockProgram("Breakfast 7:45 to 8:45")} onDeck={mockProgram("Arrival + Registration + Audience Seating")} />
        </div>
        <div className="bg-card border border-line-soft rounded-panel p-5 w-80">
          <p className="text-console-label uppercase text-muted-2 mb-2">Next only (last item — no on-deck)</p>
          <RunPosition next={mockProgram("Closing Remarks")} onDeck={null} />
        </div>
      </Row>

      <Row title="Buttons" description="One action foundation (components/ui/button.tsx) — primary/secondary/ghost/warning plus a three-step danger escalation that commits weight through one hue rather than a spreading family of destructive colors.">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="warning">Warning</Button>
        <Button variant="danger-minor">Danger (minor)</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="danger-solid">Danger (solid)</Button>
        <Button variant="primary" loading>Loading</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Tooltip content="Delete this item">
          <Button variant="danger-minor" square aria-label="Delete">
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </Button>
        </Tooltip>
        <LinkButton href="#" variant="secondary">Link button</LinkButton>
      </Row>

      <Row title="Badge" description="Generic tinted-pill primitive — the building block OperationalStatus composes on top of. Used directly for counts/labels that aren't one of the fixed operational-status meanings.">
        <Badge tone="green" dot>Green</Badge>
        <Badge tone="blue" dot>Blue</Badge>
        <Badge tone="orange" dot>Orange</Badge>
        <Badge tone="red" dot>Red</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="muted">Muted</Badge>
      </Row>

      <Row title="Surfaces" description="Panel (Console — flat, hairline border, sharp 4px radius) vs. Card (Stage — 20px radius, no border). Never mix the two within one surface family.">
        <Panel className="p-5 w-64">
          <SectionLabel>Console panel</SectionLabel>
          <p className="text-console-sm text-primary mt-2">Flat, hairline border, sharp radius.</p>
        </Panel>
        <Card className="w-64">
          <p className="text-caption text-muted-2 uppercase tracking-wide">Stage card</p>
          <p className="text-body text-primary mt-2">Soft radius, no border, read from 5-15ft.</p>
        </Card>
      </Row>

      <Row
        title="Page header"
        description="Eyebrow + title + meta + actions for document-shaped, non-Console authenticated surfaces (Dashboard/Event Home first). The Operator Console keeps its own header — EventIdentity + session strip + nav are a workspace toolbar, not a document header — so this stays scoped rather than becoming a universal AppHeader."
      >
        <div className="w-full border border-line-soft rounded-panel p-5 bg-background">
          <PageHeader
            eyebrow="Operator Dashboard"
            title="Your Events"
            meta="Signed in as demo@kramflow.test · 2 events"
            actions={
              <>
                <Button variant="secondary" size="sm">Help</Button>
                <Button variant="secondary" size="sm">Log Out</Button>
              </>
            }
          />
        </div>
      </Row>

      <Row title="Form field" description="Console-scale input, select, and textarea — one token set, so a form mixing field types reads as one system.">
        <Input
          placeholder="Type something…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-56"
        />
        <Input placeholder="Disabled" disabled className="w-56" />
        <Input placeholder="Invalid" aria-invalid className="w-56 border-status-red" />
        <Select value={selectValue} onChange={setSelectValue} options={CATALOG_SELECT_OPTIONS} className="w-56" />
        <Textarea placeholder="Notes…" className="w-56" />
      </Row>

      <Row
        title="Menus"
        description="One overflow-menu implementation (previously HelpMenu's own hand-rolled dropdown shell existed alongside this) — supports both navigation (href) and callback (onClick) items, with an optional danger tone for destructive entries."
      >
        <OverflowMenu
          label="Session"
          items={[
            { label: "Edit session", icon: Pencil, onClick: () => {} },
            { label: "Duplicate", icon: Copy, onClick: () => {} },
            { label: "Delete session", icon: Trash2, onClick: () => {}, tone: "danger" },
          ]}
        />
      </Row>

      <Row
        title="Tooltip"
        description="Wraps a single focusable child. MaybeTooltip conditionally applies one only when a `when` condition holds (e.g. explaining why a control is disabled) — previously reimplemented inline in 3 separate files before this existed."
      >
        <Tooltip content="Explains what this does">
          <Button variant="secondary" size="sm">Hover me</Button>
        </Tooltip>
        <MaybeTooltip when={true} content="Only the event owner can do this">
          <Button variant="secondary" size="sm" disabled>
            MaybeTooltip (when=true)
          </Button>
        </MaybeTooltip>
        <MaybeTooltip when={false} content="Never shown">
          <Button variant="secondary" size="sm">
            MaybeTooltip (when=false)
          </Button>
        </MaybeTooltip>
      </Row>

      <Row
        title="Color tag"
        description="Programs' optional color_tag — every option carries a dot and a word, never color alone (colorblindness, and washed-out venue monitors under stage lighting)."
      >
        <ColorTagPicker value={colorTag} onChange={setColorTag} />
      </Row>

      <Row
        title="Dialogs"
        description="Modal (arbitrary multi-step content) and ConfirmDialog (fixed confirm/cancel, tier-aware guardrail weight) share one backdrop/entrance/focus-trap/stacked-overlay system (overlay-stack.ts + use-dialog-focus.ts) — click to open either live."
      >
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open Modal
        </Button>
        <Button variant="danger" onClick={() => confirmDemo.request()}>
          Open ConfirmDialog
        </Button>
      </Row>

      <Row
        title="Empty state"
        description="Says what's true, why, and what to do next, with the control to do it right there — replaced a scattered set of single grey sentences across Displays, Broadcast Center, and the Operator Console."
      >
        <EmptyState title="No broadcasts sent yet" className="w-64" />
        <EmptyState title="No displays have registered yet" body="Open a display route on a device to see it here — registration happens automatically." className="w-72" />
        <EmptyState
          title="No sessions yet."
          action={
            <Button variant="primary" size="sm">
              Go to Cue Sheet
            </Button>
          }
          className="w-64"
        />
      </Row>

      <Row title="Toast" description="Persistent bottom-right stack (ToastProvider, mounted once at the app root) — success/error/info, with an optional button-weight action (e.g. Undo) rather than a text link.">
        <Button variant="secondary" size="sm" onClick={() => toast.success("Broadcast sent")}>
          Trigger success
        </Button>
        <Button variant="secondary" size="sm" onClick={() => toast.error("Couldn't send — try again")}>
          Trigger error
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.info("Item removed", { label: "Undo", onClick: () => {} })}
        >
          Trigger with action
        </Button>
      </Row>

      <Row
        title="Action bar"
        description="Fixed, viewport-anchored bottom pill for bulk-selection actions — floats above the toast stack's own corner so the two never collide. Can't be meaningfully boxed in a swatch (it's fixed to the viewport, not the catalog card); click to see it live at the bottom of this page."
      >
        <Button variant="secondary" size="sm" onClick={() => setActionBarOpen((v) => !v)}>
          {actionBarOpen ? "Hide" : "Show"} action bar
        </Button>
      </Row>

      <Row
        title="Stage status pill (display components)"
        description="Was hand-rolled independently in each of the four display clients (General/AV/Green Room/Presenter) with drifting opacity values before this existed — Stage-scale by design (text-caption), unlike everything else on this Console-scale catalog page."
      >
        {ALL_STAGE_STATUSES.map((status) => (
          <Swatch key={status} label={status}>
            <StageStatusPill status={status} />
          </Swatch>
        ))}
      </Row>

      <Row
        title="Broadcast type"
        description="One type→color→icon mapping (lib/display-engine/broadcast-style.ts), previously duplicated three ways — the actual on-display rendering, Broadcast Center's compose/history UI, and the Operator Console's quick-send panel each had their own drifting subset. This is the single source all three now read from."
      >
        {(Object.keys(BROADCAST_TYPE_META) as BroadcastType[]).map((type) => {
          const meta = BROADCAST_TYPE_META[type];
          const Icon = meta.Icon;
          return (
            <Swatch key={type} label={type}>
              <Badge tone={meta.tone}>
                <Icon className="h-3 w-3" strokeWidth={2.5} />
                {meta.label}
              </Badge>
            </Swatch>
          );
        })}
      </Row>

      <Row title="Checkbox" description="Broadcast Center hand-rolled this three times over (acknowledgement, persistent, schedule-for-later) before this — the one implementation every checkbox in the product should use now.">
        <Checkbox checked={checkboxValue} onChange={setCheckboxValue} label="Require acknowledgement" />
        <Checkbox checked={true} onChange={() => {}} label="Checked" />
        <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
        <Checkbox checked={true} onChange={() => {}} label="Hidden label (dense row selection)" hideLabel />
      </Row>

      <Row
        title="FormField wrapper"
        description="Label + control + optional error — Broadcast Center and the Add/Edit Item form each independently built this before this existed. The one implementation now."
      >
        <FormField label="Title" className="w-56">
          <Input placeholder="Broadcast title" />
        </FormField>
        <FormField label="Title" error="Title is required" className="w-56">
          <Input placeholder="Broadcast title" aria-invalid />
        </FormField>
      </Row>

      <Row title="Typography — Console scale" description="13-48px, dense, scanned not read. Never mixed with Stage tokens on this surface family (see DESIGN.md's Console-vs-Stage guardrail).">
        <div className="flex flex-col gap-2">
          <p className="text-console-headline tabular-nums">+20:02</p>
          <p className="text-console-meta text-muted-2 -mt-1">console-headline (48px) — the one number that matters most, e.g. the live countdown</p>
          <p className="text-console-lg font-bold mt-2">console-lg — Page title</p>
          <p className="text-console-md font-semibold">console-md — Panel heading</p>
          <p className="text-console-sm">console-sm — Body, form fields</p>
          <p className="text-console-row font-medium">console-row — Queue row title</p>
          <p className="text-console-meta text-muted">console-meta — Timestamps, secondary</p>
          <p className="text-console-label uppercase text-muted-2">console-label — uppercase tracked</p>
        </div>
      </Row>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Example Modal" size="md">
        <p className="text-console-sm text-muted">
          Arbitrary content goes here — this is the shell every multi-step configuration dialog in the product
          shares (Add/Edit Item, Event Settings sections, Edit Profile).
        </p>
        <div className="flex items-center gap-2 mt-6">
          <Button variant="primary" onClick={() => setModalOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDemo.isOpen}
        title="Delete this item?"
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDemo.cancel}
        onCancel={confirmDemo.cancel}
      />

      {actionBarOpen && (
        <ActionBar>
          <ActionBarClear onClick={() => setActionBarOpen(false)} />
          <ActionBarCount n={3}>selected</ActionBarCount>
          <ActionBarSeparator />
          <ActionBarButton tone="accent">Select all</ActionBarButton>
          <ActionBarButton tone="danger" onClick={() => setActionBarOpen(false)}>
            Delete
          </ActionBarButton>
        </ActionBar>
      )}
    </main>
  );
}
