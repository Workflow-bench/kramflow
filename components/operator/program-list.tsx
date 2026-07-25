"use client";

import { useEventStore } from "@/lib/store";
import { effectiveNotes, type Session, type Program } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type RowStatus = "upcoming" | "live" | "done";

export function ProgramList({ session }: { session: Session }) {
  const { state, jumpTo } = useEventStore();
  const currentOrder = state.progressBySession[state.activeSessionId]?.currentOrder ?? null;
  const jumpConfirm = useConfirmDialog<Program>();

  return (
    <div className="flex flex-col">
      {session.items.map((program, index) => {
        const status: RowStatus =
          currentOrder === null
            ? "upcoming"
            : program.order === currentOrder
              ? "live"
              : program.order < currentOrder
                ? "done"
                : "upcoming";
        const previousSection = index > 0 ? session.items[index - 1].sectionLabel : null;
        const showSectionHeader = program.sectionLabel && program.sectionLabel !== previousSection;
        const hasNotes = effectiveNotes(state, program).length > 0;

        // Clicking the already-live row would be a no-op jump — skip the
        // confirm dialog entirely rather than show a pointless prompt.
        const onClick = status === "live" ? undefined : () => jumpConfirm.request(program);

        return (
          <div key={program.id}>
            {showSectionHeader && (
              <p className="text-caption uppercase tracking-wide text-muted-2 mt-10 mb-3 px-3 first:mt-0">
                {program.sectionLabel}
              </p>
            )}
            {program.type === "break" ? (
              <BreakRow program={program} status={status} onClick={onClick} />
            ) : (
              <ItemRow program={program} status={status} hasNotes={hasNotes} onClick={onClick} />
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={jumpConfirm.isOpen}
        title={`Jump to "${jumpConfirm.pending?.title}"?`}
        description="This changes what's live on every connected display right now."
        confirmLabel="Jump Here"
        onConfirm={() => {
          if (jumpConfirm.pending) jumpTo(jumpConfirm.pending.order);
          jumpConfirm.cancel();
        }}
        onCancel={jumpConfirm.cancel}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === "live") return <Badge tone="green">Live</Badge>;
  if (status === "done") return <Badge tone="muted">Done</Badge>;
  return null;
}

function BreakRow({
  program,
  status,
  onClick,
}: {
  program: Program;
  status: RowStatus;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={status === "live" ? "true" : undefined}
      aria-label={`Jump to ${program.title}${status === "live" ? " (live)" : ""}`}
      className={cn(
        "w-full flex items-center gap-3 sm:gap-5 py-3 px-3 rounded-lg transition-colors border-b border-white/5 text-left",
        onClick ? "cursor-pointer hover:bg-card" : "cursor-default",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        status === "live" && "bg-card"
      )}
    >
      <span className="w-6 sm:w-7 text-caption text-muted-2 tabular-nums shrink-0">{program.order}</span>
      <p className="text-body text-muted-2 italic flex-1 min-w-0 truncate">{program.title}</p>
      <StatusBadge status={status} />
    </button>
  );
}

function ItemRow({
  program,
  status,
  hasNotes,
  onClick,
}: {
  program: Program;
  status: RowStatus;
  hasNotes: boolean;
  onClick?: () => void;
}) {
  const meta = [program.presenter, program.scheduledStart, program.durationMinutes > 0 ? `${program.durationMinutes}m` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={status === "live" ? "true" : undefined}
      aria-label={`Jump to ${program.title}${program.presenter ? `, ${program.presenter}` : ""}${status === "live" ? " (live)" : status === "done" ? " (done)" : ""}`}
      className={cn(
        "w-full flex items-start sm:items-center gap-3 sm:gap-5 py-4 sm:py-5 px-3 rounded-lg transition-colors border-b border-white/5 text-left",
        onClick ? "cursor-pointer hover:bg-card" : "cursor-default",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        status === "live" && "bg-card"
      )}
    >
      <span className="w-6 sm:w-7 text-caption text-muted-2 tabular-nums shrink-0 pt-0.5 sm:pt-0">
        {program.order}
      </span>

      <div className="min-w-0 flex-1">
        {program.kicker && <p className="text-caption text-muted-2 truncate">{program.kicker}</p>}
        <div className="flex items-center gap-2">
          <p className="text-body text-primary truncate">{program.title}</p>
          {hasNotes && (
            <span className="h-1.5 w-1.5 rounded-full bg-status-orange shrink-0" title="Has stage notes" />
          )}
          {program.colorTag && (
            <Badge tone="orange" className="shrink-0 normal-case">
              {program.colorTag}
            </Badge>
          )}
        </div>

        {/* Mobile: presenter/time/duration collapse under the title instead
            of fighting it for space in fixed-width columns. */}
        {meta && <p className="text-caption text-muted-2 truncate mt-0.5 sm:hidden">{meta}</p>}
        {program.presenter && (
          <p className="hidden sm:block text-caption text-muted truncate mt-0.5">{program.presenter}</p>
        )}
      </div>

      <span className="hidden sm:inline text-caption text-muted-2 tabular-nums shrink-0 w-16 text-right">
        {program.scheduledStart ?? ""}
      </span>

      <span className="hidden sm:inline text-caption text-muted-2 tabular-nums shrink-0 w-12 text-right">
        {program.durationMinutes > 0 ? `${program.durationMinutes}m` : "—"}
      </span>

      <div className="w-auto sm:w-16 flex justify-end shrink-0">
        <StatusBadge status={status} />
      </div>
    </button>
  );
}
