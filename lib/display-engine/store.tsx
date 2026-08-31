"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getTransport, type TransportStatus } from "./transport";
import { supabaseBrowser } from "@/lib/supabase/client";
import { createInitialEngineState } from "./defaults";
import { useDisplayEngineIdentity, type DisplayEngineIdentity } from "./context";
import type {
  BroadcastDraft,
  BroadcastMessage,
  BroadcastTarget,
  BroadcastTemplate,
  BroadcastType,
  DisplayCommand,
  DisplayEngineState,
  DisplayGroup,
  DisplayInstance,
  DisplayProfile,
  DisplayType,
  EngineMessage,
  HoldState,
  TimerMode,
  TimerState,
  TimerThresholds,
} from "./types";

// ---------------------------------------------------------------------------
// This store now has two halves, not one:
//
// - Hold/Timer/Speaker-Ready/Registry/active+scheduled+history Broadcasts
//   live in Supabase (supabase/schema.sql's display_state/display_registry/
//   display_broadcasts) — one row/set per *event* now, not a global
//   singleton, so the remote slice is a per-identity instance (keyed by
//   eventId or share-link token, mirroring lib/store.tsx's per-eventId
//   instance map). Identity comes from <DisplayEngineProvider> (see
//   ./context.tsx) rather than a hook parameter, since many nested
//   consumers (BroadcastOverlay, ProfileEditor, OperatorBroadcastPanel,
//   use-display-timer.ts) call useDisplayEngine() directly and would
//   otherwise need eventId/token prop-drilled through every layer.
//   An authenticated operator's own instance (eventId known) reads via
//   Realtime, same as before. An anonymous share-link visitor (token,
//   no auth.uid()) can't — RLS returns nothing for a client with no
//   session — so that instance polls GET /api/display-view instead,
//   the same route lib/use-display-view.ts already established for
//   live_state/sessions.
// - Profiles/Groups/Broadcast templates/favorites/drafts stay local —
//   operator UI configuration, not live show state, out of scope for the
//   Supabase migration (see docs/DISPLAY_ENGINE.md). Same localStorage +
//   BroadcastChannel sync as before, a single global slice shared across
//   every open instance in this browser (not event-scoped — it's this
//   browser's own preferences, never sent anywhere).
//
// useDisplayEngine()'s public return shape is unchanged — every consuming
// component (HoldScreen, BroadcastOverlay, TimerRing, every display page)
// keeps working without modification, as long as it renders under a
// <DisplayEngineProvider eventId={...}> or <DisplayEngineProvider token={...}>.
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_KEY = "kramflow.display-engine.local.v1";
const CLIENT_ID_KEY = "kramflow.display-engine.client-id";
const POLL_INTERVAL_MS = 2500;

function readClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const clientId = typeof window !== "undefined" ? readClientId() : "server";

// ---------------------------------------------------------------------------
// Local slice — groups, profiles, broadcast templates/favorites/drafts.
// Global, not per-instance (see comment above).
// ---------------------------------------------------------------------------

interface LocalSlice {
  groups: Record<string, DisplayGroup>;
  profiles: Record<string, DisplayProfile>;
  templates: BroadcastTemplate[];
  favorites: string[];
  drafts: BroadcastDraft[];
}

function initialLocalSlice(): LocalSlice {
  const initial = createInitialEngineState();
  return {
    groups: initial.groups,
    profiles: initial.profiles,
    templates: initial.broadcasts.templates,
    favorites: initial.broadcasts.favorites,
    drafts: initial.broadcasts.drafts,
  };
}

let localSlice: LocalSlice = initialLocalSlice();
let localHydrated = false;
let localTransportConnected = false;

function persistLocal(slice: LocalSlice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(slice));
  } catch {
    // localStorage can throw (quota, private mode) — same-tab state still works.
  }
}

function readLocalFromStorage(): LocalSlice {
  if (typeof window === "undefined") return initialLocalSlice();
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return { ...initialLocalSlice(), ...(JSON.parse(raw) as LocalSlice) };
  } catch {
    // fall through to default
  }
  return initialLocalSlice();
}

function ensureLocalTransportConnected() {
  if (localTransportConnected || typeof window === "undefined") return;
  localTransportConnected = true;
  const transport = getTransport();
  transport.subscribe((message: EngineMessage) => {
    if (message.senderId === clientId) return;
    if (message.type === "state-sync") {
      localSlice = message.payload as LocalSlice;
      persistLocal(localSlice);
      rebuildAll();
    }
  });
  transport.onStatusChange((status) => {
    transportStatus = status;
    notifyStatus();
  });
  transport.connect();
}

function commitLocal(next: LocalSlice) {
  localSlice = next;
  persistLocal(next);
  ensureLocalTransportConnected();
  getTransport().send({ type: "state-sync", payload: next, senderId: clientId, sentAt: new Date().toISOString() });
  rebuildAll();
}

// ---------------------------------------------------------------------------
// Remote slice — Hold, Timer, Speaker Ready, Registry, Broadcasts
// (active/scheduled/history). Supabase-backed, per-identity instance.
// ---------------------------------------------------------------------------

interface RegistryRow {
  id: string;
  name: string;
  type: string;
  room: string | null;
  profile_id: string | null;
  latency_ms: number | null;
  registered_at: string;
  last_seen_at: string;
  pending_command: DisplayCommand | null;
}

interface DisplayStateRow {
  hold: HoldState;
  timer: TimerState;
  speaker_ready: Record<string, boolean>;
}

interface BroadcastRow {
  id: string;
  type: BroadcastType;
  title: string;
  message: string;
  icon: string | null;
  priority: 1 | 2 | 3;
  target: BroadcastTarget;
  created_at: string;
  expires_at: string | null;
  duration_seconds: number | null;
  acknowledgement_required: boolean;
  persistent: boolean;
  acknowledged_by: string[];
  scheduled_for: string | null;
  status: "scheduled" | "sent";
  dismissed_at: string | null;
}

function rowToInstance(row: RegistryRow): DisplayInstance {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DisplayType,
    room: row.room,
    profileId: row.profile_id,
    registeredAt: row.registered_at,
    lastSeenAt: row.last_seen_at,
    latencyMs: row.latency_ms,
    pendingCommand: row.pending_command,
  };
}

function rowToMessage(row: BroadcastRow): BroadcastMessage {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    icon: row.icon,
    priority: row.priority,
    target: row.target,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    durationSeconds: row.duration_seconds,
    acknowledgementRequired: row.acknowledgement_required,
    persistent: row.persistent,
    acknowledgedBy: row.acknowledged_by,
    scheduledFor: row.scheduled_for,
  };
}

interface RemoteSlice {
  registry: Record<string, DisplayInstance>;
  timer: TimerState;
  hold: HoldState;
  speakerReady: Record<string, boolean>;
  broadcastRows: BroadcastRow[];
}

function initialRemoteSlice(): RemoteSlice {
  const initial = createInitialEngineState();
  return { registry: {}, timer: initial.timer, hold: initial.hold, speakerReady: {}, broadcastRows: [] };
}

interface EngineInstance {
  key: string;
  identity: DisplayEngineIdentity;
  remoteSlice: RemoteSlice;
  cachedState: DisplayEngineState;
  listeners: Set<() => void>;
  initialized: boolean;
  remoteHydrated: boolean;
  schedulerRunning: boolean;
}

const instances = new Map<string, EngineInstance>();

function identityKey(identity: DisplayEngineIdentity): string {
  return identity.eventId ?? identity.token ?? "none";
}

function getInstance(identity: DisplayEngineIdentity): EngineInstance {
  const key = identityKey(identity);
  let inst = instances.get(key);
  if (!inst) {
    inst = {
      key,
      identity,
      remoteSlice: initialRemoteSlice(),
      cachedState: createInitialEngineState(),
      listeners: new Set(),
      initialized: false,
      remoteHydrated: false,
      schedulerRunning: false,
    };
    instances.set(key, inst);
  }
  return inst;
}

// Body/query fields identifying which event a write applies to — merged
// into every remote-slice request. Exactly one of token/eventId is ever
// set per instance (matching how the four display pages and the operator
// pages each resolve their own identity), and every mutating route
// resolves the real event_id server-side from this rather than trusting
// anything else in the request.
function identityBody(identity: DisplayEngineIdentity): Record<string, string> {
  if (identity.token) return { token: identity.token };
  if (identity.eventId) return { eventId: identity.eventId };
  return {};
}

function identityQuery(identity: DisplayEngineIdentity): string {
  return identity.eventId ? `?eventId=${encodeURIComponent(identity.eventId)}` : "";
}

async function fetchRemoteSliceViaSupabase(inst: EngineInstance, eventId: string) {
  const client = supabaseBrowser();
  const [stateRes, registryRes, broadcastsRes] = await Promise.all([
    client.from("display_state").select("*").eq("event_id", eventId).single(),
    client.from("display_registry").select("*").eq("event_id", eventId),
    client
      .from("display_broadcasts")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  // All three are checked, not just display_state — an error on the
  // registry or broadcasts query looks identical to "nothing registered"/
  // "nothing sent" once discarded via `?? []`, silently telling an
  // operator every display is offline when it's actually a query failure.
  const failed = [stateRes, registryRes, broadcastsRes].find((r) => r.error);
  if (failed) {
    console.error("[display-engine] fetch display-engine slice failed:", failed.error);
    return;
  }
  applyRemoteRows(inst, stateRes.data as DisplayStateRow, (registryRes.data ?? []) as RegistryRow[], (broadcastsRes.data ?? []) as BroadcastRow[]);
}

async function fetchRemoteSliceViaPoll(inst: EngineInstance) {
  try {
    const qs = inst.identity.token
      ? `token=${encodeURIComponent(inst.identity.token)}`
      : `eventId=${encodeURIComponent(inst.identity.eventId!)}`;
    const res = await fetch(`/api/display-view?${qs}`);
    const data = await res.json();
    if (!data.ok || !data.displayState) return;
    applyRemoteRows(inst, data.displayState as DisplayStateRow, (data.displayRegistry ?? []) as RegistryRow[], (data.displayBroadcasts ?? []) as BroadcastRow[]);
  } catch (err) {
    console.error("[display-engine] poll failed:", err);
  }
}

function applyRemoteRows(inst: EngineInstance, stateRow: DisplayStateRow, registryRows: RegistryRow[], broadcastRows: BroadcastRow[]) {
  const registry: Record<string, DisplayInstance> = {};
  for (const row of registryRows) registry[row.id] = rowToInstance(row);

  inst.remoteSlice = {
    registry,
    timer: stateRow.timer,
    hold: stateRow.hold,
    speakerReady: stateRow.speaker_ready,
    broadcastRows,
  };
  rebuild(inst);
  runSchedulerCheck(inst);
}

function ensureRemoteConnected(inst: EngineInstance) {
  if (inst.initialized || typeof window === "undefined") return;
  inst.initialized = true;

  if (inst.identity.eventId) {
    const eventId = inst.identity.eventId;
    supabaseBrowser()
      .channel(`display-engine-sync:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "display_state", filter: `event_id=eq.${eventId}` }, () =>
        fetchRemoteSliceViaSupabase(inst, eventId)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "display_registry", filter: `event_id=eq.${eventId}` }, () =>
        fetchRemoteSliceViaSupabase(inst, eventId)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "display_broadcasts", filter: `event_id=eq.${eventId}` }, () =>
        fetchRemoteSliceViaSupabase(inst, eventId)
      )
      .subscribe();
  } else if (inst.identity.token) {
    const poll = () => fetchRemoteSliceViaPoll(inst);
    poll();
    setInterval(poll, POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Merge local + this instance's remote slice into the public
// DisplayEngineState shape.
// ---------------------------------------------------------------------------

function notify(inst: EngineInstance) {
  for (const listener of inst.listeners) listener();
}

function rebuild(inst: EngineInstance) {
  const sentRows = inst.remoteSlice.broadcastRows.filter((r) => r.status === "sent");
  inst.cachedState = {
    registry: inst.remoteSlice.registry,
    groups: localSlice.groups,
    profiles: localSlice.profiles,
    timer: inst.remoteSlice.timer,
    hold: inst.remoteSlice.hold,
    broadcasts: {
      active: sentRows.filter((r) => r.dismissed_at === null).map(rowToMessage),
      scheduled: inst.remoteSlice.broadcastRows.filter((r) => r.status === "scheduled").map(rowToMessage),
      history: sentRows.slice(0, 200).map(rowToMessage),
      templates: localSlice.templates,
      favorites: localSlice.favorites,
      drafts: localSlice.drafts,
    },
    speakerReady: inst.remoteSlice.speakerReady,
  };
  notify(inst);
}

function rebuildAll() {
  for (const inst of instances.values()) rebuild(inst);
}

let transportStatus: TransportStatus = "idle";
const statusListeners = new Set<() => void>();

function notifyStatus() {
  for (const listener of statusListeners) listener();
}

// Same hydrate-inside-subscribe() pattern as lib/store.tsx — see that
// file's comment for why hydrating inside getSnapshot() alone doesn't
// reliably trigger a re-render.
function subscribe(inst: EngineInstance, callback: () => void): () => void {
  ensureLocalTransportConnected();
  ensureRemoteConnected(inst);
  inst.listeners.add(callback);

  if (!localHydrated) {
    localHydrated = true;
    const stored = readLocalFromStorage();
    if (JSON.stringify(stored) !== JSON.stringify(localSlice)) {
      localSlice = stored;
    }
  }
  if (!inst.remoteHydrated && inst.identity.eventId) {
    inst.remoteHydrated = true;
    fetchRemoteSliceViaSupabase(inst, inst.identity.eventId).then(callback);
  }
  rebuild(inst);

  return () => inst.listeners.delete(callback);
}

// A stable reference, not a fresh createInitialEngineState() call each
// time — useSyncExternalStore requires getServerSnapshot to return the
// same reference across calls when nothing changed, or React logs "should
// be cached to avoid an infinite loop" (same bug class as lib/use-sessions.ts
// hit earlier this session; caught here via live cross-browser testing).
const SERVER_SNAPSHOT: DisplayEngineState = createInitialEngineState();

function getServerSnapshot(): DisplayEngineState {
  return SERVER_SNAPSHOT;
}

function subscribeStatus(callback: () => void): () => void {
  ensureLocalTransportConnected();
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

function getStatusSnapshot(): TransportStatus {
  return transportStatus;
}

function getServerStatusSnapshot(): TransportStatus {
  return "idle";
}

async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("[display-engine] POST failed:", url, res.status);
    return res;
  } catch (err) {
    console.error("[display-engine] POST failed:", url, err);
    return null;
  }
}

// Retries once on 409 — app/api/display-engine/timer/route.ts (the only
// route on this path with an optimistic-concurrency check today) returns
// that when timer_version changed between its read and write. Same
// reasoning as lib/store.tsx's sendAction: resending succeeds once the
// other write has landed, and a repeat conflict is vanishingly unlikely.
async function patchJson(url: string, body: unknown, attempt = 0): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409 && attempt < 2) return patchJson(url, body, attempt + 1);
    if (!res.ok) console.error("[display-engine] PATCH failed:", url, res.status);
    return res;
  } catch (err) {
    console.error("[display-engine] PATCH failed:", url, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Display registry actions — Supabase-backed
// ---------------------------------------------------------------------------

function registerDisplay(identity: DisplayEngineIdentity, input: { id: string; name: string; type: DisplayType; room?: string | null }) {
  return postJson("/api/display-engine/registry", {
    ...identityBody(identity),
    id: input.id,
    name: input.name,
    type: input.type,
    room: input.room ?? null,
  });
}

function heartbeatDisplay(identity: DisplayEngineIdentity, id: string, latencyMs: number | null) {
  return postJson("/api/display-engine/registry", { ...identityBody(identity), id, latencyMs });
}

function renameDisplay(identity: DisplayEngineIdentity, id: string, name: string) {
  return patchJson(`/api/display-engine/registry/${id}`, { ...identityBody(identity), name });
}

function assignDisplay(identity: DisplayEngineIdentity, id: string, patch: { type?: DisplayType; room?: string | null; profileId?: string | null }) {
  return patchJson(`/api/display-engine/registry/${id}`, { ...identityBody(identity), ...patch });
}

function removeDisplay(identity: DisplayEngineIdentity, id: string) {
  return fetch(`/api/display-engine/registry/${id}${identityQuery(identity)}`, { method: "DELETE" }).catch((err) =>
    console.error("[display-engine] removeDisplay failed:", err)
  );
}

function sendCommand(identity: DisplayEngineIdentity, id: string, command: DisplayCommand) {
  return patchJson(`/api/display-engine/registry/${id}`, { ...identityBody(identity), pendingCommand: command });
}

function clearCommand(identity: DisplayEngineIdentity, id: string) {
  return patchJson(`/api/display-engine/registry/${id}`, { ...identityBody(identity), pendingCommand: null });
}

// ---------------------------------------------------------------------------
// Groups — local only
// ---------------------------------------------------------------------------

function createGroup(name: string, displayIds: string[]): string {
  const id = newId("group");
  const group: DisplayGroup = { id, name, displayIds };
  commitLocal({ ...localSlice, groups: { ...localSlice.groups, [id]: group } });
  return id;
}

function updateGroup(id: string, patch: Partial<Omit<DisplayGroup, "id">>) {
  const existing = localSlice.groups[id];
  if (!existing) return;
  commitLocal({ ...localSlice, groups: { ...localSlice.groups, [id]: { ...existing, ...patch } } });
}

function deleteGroup(id: string) {
  const next = { ...localSlice.groups };
  delete next[id];
  commitLocal({ ...localSlice, groups: next });
}

// ---------------------------------------------------------------------------
// Timer engine actions — Supabase-backed
// ---------------------------------------------------------------------------

function setTimerMode(identity: DisplayEngineIdentity, mode: TimerMode) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "setMode", mode });
}

function setTimerSource(identity: DisplayEngineIdentity, source: "auto" | "manual") {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "setSource", source });
}

function startManualTimer(identity: DisplayEngineIdentity, durationSeconds: number) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "start", durationSeconds });
}

function pauseTimer(identity: DisplayEngineIdentity) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "pause" });
}

function resumeTimer(identity: DisplayEngineIdentity) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "resume" });
}

function resetTimer(identity: DisplayEngineIdentity) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "reset" });
}

function adjustTimer(identity: DisplayEngineIdentity, deltaSeconds: number) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "adjust", deltaSeconds });
}

function setTimerThresholds(identity: DisplayEngineIdentity, thresholds: TimerThresholds) {
  return patchJson("/api/display-engine/timer", { ...identityBody(identity), action: "setThresholds", thresholds });
}

// ---------------------------------------------------------------------------
// Hold mode — Supabase-backed
// ---------------------------------------------------------------------------

function activateHold(identity: DisplayEngineIdentity, input: { message: string; subMessage: string | null; continueClock: boolean }) {
  return patchJson("/api/display-engine/hold", { ...identityBody(identity), active: true, ...input });
}

function deactivateHold(identity: DisplayEngineIdentity) {
  return patchJson("/api/display-engine/hold", { ...identityBody(identity), active: false });
}

// ---------------------------------------------------------------------------
// Broadcast Center — active/scheduled/history Supabase-backed;
// templates/favorites/drafts stay local.
// ---------------------------------------------------------------------------

function sendBroadcast(identity: DisplayEngineIdentity, draft: BroadcastDraft) {
  return postJson("/api/display-engine/broadcasts", { ...identityBody(identity), draft });
}

function scheduleBroadcast(identity: DisplayEngineIdentity, draft: BroadcastDraft, scheduledFor: string) {
  return postJson("/api/display-engine/broadcasts", { ...identityBody(identity), draft, scheduledFor });
}

function cancelScheduled(identity: DisplayEngineIdentity, id: string) {
  return fetch(`/api/display-engine/broadcasts/${id}${identityQuery(identity)}`, { method: "DELETE" }).catch((err) =>
    console.error("[display-engine] cancelScheduled failed:", err)
  );
}

// Runs in whichever display-engine tab happens to have this module loaded
// — same "any open tab can process" model the rest of the store already
// relies on, now checked per-instance against that instance's own
// broadcastRows. A scheduled broadcast only fires once some tab notices it
// crossed its scheduledFor time; there is no server-side cron in this
// environment (Supabase pg_cron or a Vercel Cron Job would be needed to
// close this gap properly). Documented as a known limitation in
// docs/DISPLAY_ENGINE.md — carried forward from before this migration,
// not solved by it. dismiss/acknowledge/promote stay unauthenticated
// (keyed by the broadcast's own unguessable id), so this needs no identity.
function runSchedulerCheck(inst: EngineInstance) {
  if (inst.schedulerRunning || typeof window === "undefined") return;
  inst.schedulerRunning = true;
  setInterval(() => {
    const now = Date.now();
    const due = inst.remoteSlice.broadcastRows.filter(
      (r) => r.status === "scheduled" && r.scheduled_for && Date.parse(r.scheduled_for) <= now
    );
    for (const row of due) postJson(`/api/display-engine/broadcasts/${row.id}/promote`, {});
  }, 5000);
}

function dismissBroadcast(id: string) {
  return postJson(`/api/display-engine/broadcasts/${id}/dismiss`, {});
}

function acknowledgeBroadcast(id: string, displayId: string) {
  return postJson(`/api/display-engine/broadcasts/${id}/acknowledge`, { displayId });
}

function clearEmergencies(inst: EngineInstance) {
  const active = inst.remoteSlice.broadcastRows.filter((r) => r.status === "sent" && r.dismissed_at === null && r.type === "emergency");
  return Promise.all(active.map((row) => dismissBroadcast(row.id)));
}

function saveTemplate(name: string, draft: BroadcastDraft): string {
  const id = newId("template");
  const template: BroadcastTemplate = { id, name, draft };
  commitLocal({ ...localSlice, templates: [template, ...localSlice.templates] });
  return id;
}

function deleteTemplate(id: string) {
  commitLocal({
    ...localSlice,
    templates: localSlice.templates.filter((t) => t.id !== id),
    favorites: localSlice.favorites.filter((f) => f !== id),
  });
}

function toggleFavoriteTemplate(id: string) {
  const favorites = localSlice.favorites.includes(id)
    ? localSlice.favorites.filter((f) => f !== id)
    : [...localSlice.favorites, id];
  commitLocal({ ...localSlice, favorites });
}

function saveDraft(draft: BroadcastDraft) {
  commitLocal({ ...localSlice, drafts: [draft, ...localSlice.drafts].slice(0, 20) });
}

function deleteDraft(index: number) {
  commitLocal({ ...localSlice, drafts: localSlice.drafts.filter((_, i) => i !== index) });
}

// ---------------------------------------------------------------------------
// Speaker ready (Green Room) — Supabase-backed
// ---------------------------------------------------------------------------

function setSpeakerReady(identity: DisplayEngineIdentity, programId: string, ready: boolean) {
  return patchJson("/api/display-engine/speaker-ready", { ...identityBody(identity), programId, ready });
}

// ---------------------------------------------------------------------------
// Profiles — local only
// ---------------------------------------------------------------------------

function saveProfile(profile: DisplayProfile) {
  commitLocal({ ...localSlice, profiles: { ...localSlice.profiles, [profile.id]: profile } });
}

function deleteProfile(id: string) {
  const target = localSlice.profiles[id];
  if (!target || target.builtIn) return;
  const next = { ...localSlice.profiles };
  delete next[id];
  commitLocal({ ...localSlice, profiles: next });
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

export function useDisplayEngine() {
  const identity = useDisplayEngineIdentity();
  const inst = getInstance(identity);
  // subscribeFn/getSnapshotFn must be referentially stable across renders
  // for this same `inst` — an inline arrow function passed straight to
  // useSyncExternalStore is a *new* function every render, which forces
  // React to unsubscribe+resubscribe on every render. Combined with
  // subscribe() synchronously calling rebuild()/notify() (needed so a
  // brand-new instance renders its already-fetched state immediately
  // instead of waiting a tick), that resubscribe-every-render becomes a
  // genuine infinite loop — notify() triggers a re-render, which creates a
  // new subscribe closure, which resubscribes and notifies again. Caught
  // live via the browser ("Maximum update depth exceeded") while running
  // the multi-tenant isolation tests, not by tsc/lint/build, none of which
  // catch this class of bug.
  const subscribeFn = useMemo(() => (callback: () => void) => subscribe(inst, callback), [inst]);
  const getSnapshotFn = useMemo(() => () => inst.cachedState, [inst]);
  const state = useSyncExternalStore(subscribeFn, getSnapshotFn, getServerSnapshot);
  return {
    state,
    clientId,
    registerDisplay: (input: { id: string; name: string; type: DisplayType; room?: string | null }) => registerDisplay(identity, input),
    heartbeatDisplay: (id: string, latencyMs: number | null) => heartbeatDisplay(identity, id, latencyMs),
    renameDisplay: (id: string, name: string) => renameDisplay(identity, id, name),
    assignDisplay: (id: string, patch: { type?: DisplayType; room?: string | null; profileId?: string | null }) =>
      assignDisplay(identity, id, patch),
    removeDisplay: (id: string) => removeDisplay(identity, id),
    sendCommand: (id: string, command: DisplayCommand) => sendCommand(identity, id, command),
    clearCommand: (id: string) => clearCommand(identity, id),
    createGroup,
    updateGroup,
    deleteGroup,
    setTimerMode: (mode: TimerMode) => setTimerMode(identity, mode),
    setTimerSource: (source: "auto" | "manual") => setTimerSource(identity, source),
    startManualTimer: (durationSeconds: number) => startManualTimer(identity, durationSeconds),
    pauseTimer: () => pauseTimer(identity),
    resumeTimer: () => resumeTimer(identity),
    resetTimer: () => resetTimer(identity),
    adjustTimer: (deltaSeconds: number) => adjustTimer(identity, deltaSeconds),
    setTimerThresholds: (thresholds: TimerThresholds) => setTimerThresholds(identity, thresholds),
    activateHold: (input: { message: string; subMessage: string | null; continueClock: boolean }) => activateHold(identity, input),
    deactivateHold: () => deactivateHold(identity),
    sendBroadcast: (draft: BroadcastDraft) => sendBroadcast(identity, draft),
    scheduleBroadcast: (draft: BroadcastDraft, scheduledFor: string) => scheduleBroadcast(identity, draft, scheduledFor),
    cancelScheduled: (id: string) => cancelScheduled(identity, id),
    dismissBroadcast,
    acknowledgeBroadcast,
    clearEmergencies: () => clearEmergencies(inst),
    saveTemplate,
    deleteTemplate,
    toggleFavoriteTemplate,
    saveDraft,
    deleteDraft,
    saveProfile,
    deleteProfile,
    setSpeakerReady: (programId: string, ready: boolean) => setSpeakerReady(identity, programId, ready),
  };
}

export function useTransportStatus(): TransportStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getServerStatusSnapshot);
}

export function targetMatchesDisplay(target: BroadcastTarget, display: DisplayInstance, groups: Record<string, DisplayGroup>): boolean {
  switch (target.kind) {
    case "all":
      return true;
    case "type":
      return target.value === display.type;
    case "display":
      return target.value === display.id;
    case "group":
      return target.value ? (groups[target.value]?.displayIds.includes(display.id) ?? false) : false;
    default:
      return false;
  }
}
