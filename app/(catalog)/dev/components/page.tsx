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
import { Tooltip } from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";

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

const ALL_STATUS_KINDS: OperationalStatusKind[] = ["live", "hold", "ready", "rehearsal", "stale", "offline", "warning", "critical"];
const ALL_CONNECTION_STATES: ConnectionBadgeStatus[] = ["connected", "reconnecting", "disconnected"];

export default function ComponentCatalogPage() {
  const [inputValue, setInputValue] = useState("");

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

      <Row title="Form field" description="Console-scale input, with focus/error states.">
        <Input
          placeholder="Type something…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-56"
        />
        <Input placeholder="Disabled" disabled className="w-56" />
        <Input placeholder="Invalid" aria-invalid className="w-56 border-status-red" />
      </Row>

      <Row title="Typography — Console scale" description="13-22px, dense, scanned not read. Never mixed with Stage tokens on this surface family (see DESIGN.md's Console-vs-Stage guardrail).">
        <div className="flex flex-col gap-2">
          <p className="text-console-lg font-bold">console-lg — Page title</p>
          <p className="text-console-md font-semibold">console-md — Panel heading</p>
          <p className="text-console-sm">console-sm — Body, form fields</p>
          <p className="text-console-row font-medium">console-row — Queue row title</p>
          <p className="text-console-meta text-muted">console-meta — Timestamps, secondary</p>
          <p className="text-console-label uppercase text-muted-2">console-label — uppercase tracked</p>
        </div>
      </Row>
    </main>
  );
}
