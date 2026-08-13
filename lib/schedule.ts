// Item 6b's duration cascade: turns a partition's start_time anchor plus
// each item's duration into computed scheduledStart/scheduledEnd values,
// for any item that has opted into time_is_computed (see
// supabase/schema.sql's programs.time_is_computed comment for why it's an
// explicit per-row flag rather than an implicit rule).
import type { Partition, Program } from "@/lib/types";

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

export function parseTimeLabel(label: string | null): number | null {
  if (!label) return null;
  const m = TIME_RE.exec(label.trim());
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (hours === 12) hours = 0;
  if (period === "PM") hours += 12;
  return hours * 60 + minutes;
}

export function formatMinutesToLabel(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  let hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Recomputes scheduledStart/scheduledEnd for every timeIsComputed item in a
// single partition's item list (already in sort_order), cascading off a
// running clock seeded from the partition's own start_time. A literal
// (non-computed) item is never rewritten, but it does resync the clock to
// its own end_time (falling back to start_time + duration) so a later
// computed item picks up from where the literal item actually ends rather
// than an earlier stale point. Re-running this over the current order on
// every read (see lib/data/sessions.ts's fetchSessions) is what makes the
// cascade "live" — duration edits, inserts, deletes, and reorders all just
// change the input list, not a separately-stored computed result that could
// go stale.
export function computeScheduledTimes(partition: Partition, items: Program[]): Program[] {
  let clock = parseTimeLabel(partition.startTime);
  return items.map((item) => {
    if (!item.timeIsComputed) {
      const end = parseTimeLabel(item.scheduledEnd);
      const start = parseTimeLabel(item.scheduledStart);
      if (end !== null) clock = end;
      else if (start !== null) clock = start + item.durationMinutes;
      return item;
    }
    if (clock === null) return item;
    const start = clock;
    const end = start + item.durationMinutes;
    clock = end;
    return { ...item, scheduledStart: formatMinutesToLabel(start), scheduledEnd: formatMinutesToLabel(end) };
  });
}
