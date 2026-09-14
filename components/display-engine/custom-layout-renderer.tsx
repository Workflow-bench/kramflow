import type { Program, Session } from "@/lib/types";
import type { DisplayProfile, WidgetType } from "@/lib/display-engine/types";
import { getZoneTemplate } from "@/lib/display-engine/types";
import type { StageStatus } from "@/components/display-engine/stage-status-pill";
import { NowPlayingWidget } from "@/components/display-engine/widgets/now-playing-widget";
import { UpNextWidget } from "@/components/display-engine/widgets/up-next-widget";
import { StatusPillWidget } from "@/components/display-engine/widgets/status-pill-widget";
import { ScheduleListWidget } from "@/components/display-engine/widgets/schedule-list-widget";
import { CustomTextWidget } from "@/components/display-engine/widgets/custom-text-widget";
import { cn } from "@/lib/utils";

export interface CustomLayoutData {
  session: Session | undefined;
  currentOrder: number | null;
  live: Program | null;
  next: Program | null;
  isFinished: boolean;
  timerLabel: string | null;
  timerColor: string;
  isOverrun: boolean;
  stageStatus: StageStatus;
}

// Grid shape per template — the one place a template's visual arrangement
// is defined, matched 1:1 against getZoneTemplate()'s zone id list so the
// two can never drift (a template with N zone ids always gets exactly N
// grid cells, in the same order).
const TEMPLATE_GRID_CLASS: Record<string, string> = {
  "hero-sidebar": "grid-cols-[1.6fr_1fr]",
  "grid-3up": "grid-cols-3",
  "full-bleed": "grid-cols-1",
};

function renderWidget(widget: WidgetType | null | undefined, data: CustomLayoutData, customText: string | null) {
  if (!widget) return null;
  switch (widget) {
    case "now-playing":
      return (
        <NowPlayingWidget
          live={data.live}
          isFinished={data.isFinished}
          timerLabel={data.timerLabel}
          timerColor={data.timerColor}
          isOverrun={data.isOverrun}
          viewingDistance="far"
        />
      );
    case "up-next":
      return <UpNextWidget next={data.next} />;
    case "status-pill":
      return <StatusPillWidget status={data.stageStatus} />;
    case "schedule-list":
      return <ScheduleListWidget session={data.session} currentOrder={data.currentOrder} />;
    case "custom-text":
      return <CustomTextWidget text={customText} />;
    default:
      return null;
  }
}

/** Renders a DisplayProfile's chosen template + per-zone widget
 *  assignments against live show data — the generic counterpart to each
 *  fixed display client's own hand-built JSX tree. viewingDistance is
 *  threaded through here (not hardcoded per widget) so the same widget
 *  reads correctly whether this profile is a close console monitor or a
 *  far-across-the-room TV. */
export function CustomLayoutRenderer({ profile, data }: { profile: DisplayProfile; data: CustomLayoutData }) {
  const template = getZoneTemplate(profile.template);
  const close = profile.viewingDistance === "close";

  return (
    <div
      className={cn("flex-1 grid gap-10 min-h-0 mt-8", TEMPLATE_GRID_CLASS[template.id])}
      style={profile.accentColor ? ({ "--color-accent": profile.accentColor } as React.CSSProperties) : undefined}
    >
      {template.zones.map((zone) => {
        const widget = profile.zones[zone.id];
        const content = renderWidget(widget, data, profile.customText);
        return (
          <div key={zone.id} className={cn("min-h-0 flex flex-col justify-center", close && "text-sm")}>
            {content ?? <p className="text-body text-muted-2 italic">This zone has no widget assigned.</p>}
          </div>
        );
      })}
    </div>
  );
}
