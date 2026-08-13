"use client";

import { useEventStore } from "@/lib/store";
import { effectiveNotes, type Session, type Program } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { colorTagLabel, colorTagTone } from "@/lib/color-tags";
import { cn } from "@/lib/utils";

type RowStatus = "upcoming" | "live" | "done";

export function ProgramList({ session }: { session: Session }) {
  const { state, jumpTo } = useEventStore();
  const currentOrder = state.progressBySession[state.activeSessionId]?.currentOrder ?? null;
  const jumpConfirm = useConfirmDialog<Program>();

  // Real identity, not adjacency-plus-string-equality — see
  // supabase/schema.sql's partitions table comment for the "partition
  // bleeding" bug this replaces (two runs sharing identical label text
  // merging with no visible seam; a reorder that broke label-contiguity
  // spawning a spurious duplicate header). Grouping by partitionId can't
  // exhibit either failure mode: two partitions never share an id even if
  // their labels happen to match, and a header only ever appears where a
  // partition genuinely starts.
  const partitionsById = new Map(session.partitions.map((p) => [p.id, p]));

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
        const previousPartitionId = index > 0 ? session.items[index - 1].partitionId : null;
        const showSectionHeader = program.partitionId !== null && program.partitionId !== previousPartitionId;
        const sectionHeaderLabel = program.partitionId ? partitionsById.get(program.partitionId)?.label : null;
        const hasNotes = effectiveNotes(state, program).length > 0;

        // Clicking the already-live row would be a no-op jump — skip the
        // confirm dialog entirely rather than show a pointless prompt.
        const onClick = status === "live" ? undefined : () => jumpConfirm.request(program);

        return (
          <div key={program.id}>
            {showSectionHeader && sectionHeaderLabel && (
              // Sticky, so you always know which section is on screen while
              // scrolling a long session. Matches the cue sheet's treatment
              // so the two lists read as the same object seen twice.
              <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-background/95 backdrop-blur-sm px-3 py-2 mt-6 first:mt-0 border-b border-line">
                <h3 className="text-console-label text-muted truncate">{sectionHeaderLabel}</h3>
                <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
              </div>
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
        "w-full flex items-center gap-3 sm:gap-4 py-2 px-3 min-h-11 text-left border-b border-line-soft",
        "transition-colors duration-[140ms] ease-out",
        onClick ? "cursor-pointer hover:bg-card-hover" : "cursor-default",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        status === "live" && "bg-status-green/10",
        status === "done" && "opacity-55"
      )}
    >
      <span className="tnum w-6 text-console-meta text-muted-2 shrink-0 text-right">{program.order}</span>
      {/* Breaks read as a gap in the run, not an item in it — dimmer and
          set in italic so the eye skips them when scanning for cues. */}
      <p className="text-console-meta text-muted-2 italic flex-1 min-w-0 truncate">{program.title}</p>
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
        "w-full flex items-start sm:items-center gap-3 sm:gap-4 py-2.5 px-3 min-h-11 text-left border-b border-line-soft",
        "transition-colors duration-[140ms] ease-out",
        onClick ? "cursor-pointer hover:bg-card-hover" : "cursor-default",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Position axis: the on-air row gets a full tinted fill, so it is
        // unmissable from across a gallery. Health (on time / wrapping /
        // over) is carried separately by the duration cell below, because
        // an item is routinely current *and* running long, and those are
        // two different facts that must not share one colour channel.
        status === "live" && "bg-status-green/10",
        status === "done" && "opacity-55"
      )}
    >
      <span className="tnum w-6 text-console-meta text-muted-2 shrink-0 pt-0.5 sm:pt-0 text-right">
        {program.order}
      </span>

      <div className="min-w-0 flex-1">
        {program.kicker && <p className="text-console-meta text-muted-2 truncate">{program.kicker}</p>}
        <div className="flex items-center gap-2">
          {program.colorTag && (
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                colorTagTone(program.colorTag) === "green" && "bg-status-green",
                colorTagTone(program.colorTag) === "blue" && "bg-status-blue",
                colorTagTone(program.colorTag) === "orange" && "bg-status-orange",
                colorTagTone(program.colorTag) === "red" && "bg-status-red",
                colorTagTone(program.colorTag) === "muted" && "bg-muted-2"
              )}
            />
          )}
          <p className={cn("text-console-row truncate", status === "live" ? "text-primary font-semibold" : "text-primary")}>
            {program.title}
          </p>
          {program.colorTag && <span className="sr-only">{colorTagLabel(program.colorTag)}</span>}
          {hasNotes && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-status-orange shrink-0"
              title="Has stage notes"
              aria-label="Has stage notes"
            />
          )}
        </div>

        {/* Mobile: presenter/time/duration collapse under the title instead
            of fighting it for space in fixed-width columns. */}
        {meta && <p className="text-console-meta text-muted-2 truncate mt-0.5 sm:hidden">{meta}</p>}
        {program.presenter && (
          <p className="hidden sm:block text-console-meta text-muted-2 truncate mt-0.5">{program.presenter}</p>
        )}
      </div>

      <span className="tnum hidden sm:inline text-console-meta text-muted shrink-0 w-16 text-right">
        {program.scheduledStart ?? ""}
      </span>

      <span
        className={cn(
          "tnum hidden sm:inline text-console-meta shrink-0 w-12 text-right",
          status === "live" ? "text-status-green font-semibold" : "text-muted-2"
        )}
      >
        {program.durationMinutes > 0 ? `${program.durationMinutes}m` : "—"}
      </span>

      <div className="w-auto sm:w-16 flex justify-end shrink-0">
        <StatusBadge status={status} />
      </div>
    </button>
  );
}
