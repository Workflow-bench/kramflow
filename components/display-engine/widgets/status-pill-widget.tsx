import { StageStatusPill, type StageStatus } from "@/components/display-engine/stage-status-pill";

export function StatusPillWidget({ status }: { status: StageStatus }) {
  return (
    <div className="flex items-center justify-center h-full">
      <StageStatusPill status={status} className="text-title px-6 py-3" />
    </div>
  );
}
