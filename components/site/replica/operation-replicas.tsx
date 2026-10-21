import { FitFrame } from "./fit-frame";

/**
 * Code replicas of the four operations' own control surfaces, for the "When plans change"
 * proof. Each is laid out from the product control it stands for (timer adjustments,
 * transport controls, the Broadcast composer, the control-lease strip) with fixture
 * values. They replace the cropped screenshots, which carried stray neighbouring text and
 * a pre-redesign control state.
 */

const W = 720;
const H = 480;

export function TimerOperation() {
  return (
    <FitFrame designWidth={W} designHeight={H} label="Timer adjustment controls, Product Launch Demo, 13:51 remaining">
      <div className="absolute inset-0 flex flex-col justify-center gap-7 px-14 text-primary">
        <div>
          <div className="text-[13px] uppercase tracking-[0.16em] text-status-green">● Live now</div>
          <div className="mt-2 text-[34px]">Product Launch Demo</div>
          <div className="text-[15px] text-muted">Rafael Costa · 1m behind schedule</div>
        </div>
        <div className="tnum text-[104px] leading-none">13:51</div>
        <div className="h-[6px] w-full rounded bg-line-soft">
          <div className="h-full w-[38%] rounded bg-status-green" />
        </div>
        <div className="flex gap-3">
          {["−0:30", "−0:10", "+0:10", "+0:30"].map((t) => (
            <span key={t} className="tnum flex h-12 flex-1 items-center justify-center rounded-control border border-line-soft bg-raised text-[17px]">
              {t}
            </span>
          ))}
        </div>
        <div className="text-[14px] text-muted">Projected finish ~11:21 AM</div>
      </div>
    </FitFrame>
  );
}

export function HoldOperation() {
  return (
    <FitFrame designWidth={W} designHeight={H} label="Transport controls including Hold">
      <div className="absolute inset-0 flex flex-col justify-center gap-4 px-16 text-primary">
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted-2">Transport</div>
        <div className="flex h-[92px] items-center justify-center rounded-control bg-primary text-[30px] font-medium text-background">
          Next ›
        </div>
        <div className="grid grid-cols-2 gap-3">
          <span className="flex h-[68px] items-center justify-center rounded-control border border-line-soft bg-raised text-[22px]">‹ Previous</span>
          <span className="flex h-[68px] items-center justify-center rounded-control border border-line-soft bg-raised text-[22px]">Hold</span>
        </div>
        <div className="mt-2 text-[14px] text-muted">Hold keeps the current item on the displays you choose.</div>
      </div>
    </FitFrame>
  );
}

export function NoticeOperation() {
  return (
    <FitFrame designWidth={W} designHeight={H} label="Broadcast composer, audience set to All Displays">
      <div className="absolute inset-0 flex flex-col gap-4 px-12 pt-10 text-primary">
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted-2">Compose</div>
        <div className="rounded-control border border-line-soft bg-raised px-4 py-3 text-[17px] text-muted">Broadcast title</div>
        <div className="h-[110px] rounded-control border border-line-soft bg-raised px-4 py-3 text-[17px] text-muted">Message body</div>
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted-2">Audience</div>
        <div className="flex items-center justify-between rounded-control border border-line-soft bg-raised px-4 py-3 text-[17px]">
          <span>All Displays</span>
          <span className="text-muted-2">▾</span>
        </div>
        <div className="text-[14px] text-muted">4 displays targeted</div>
      </div>
    </FitFrame>
  );
}

export function ControlOperation() {
  return (
    <FitFrame designWidth={W} designHeight={H} label="Control ownership strip">
      <div className="absolute inset-0 flex flex-col justify-center gap-5 px-14 text-primary">
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted-2">Controls</div>
        <div className="flex items-center justify-between rounded-control border border-status-green/30 bg-status-green/10 px-5 py-5 text-[20px] text-status-green">
          <span>You have control</span>
          <span className="text-[15px] text-muted-2">Release</span>
        </div>
        <div className="text-[17px]">4 displays targeted <span className="ml-2 rounded-chip bg-status-green/15 px-2.5 py-1 text-[12px] text-status-green">4 online</span></div>
        <div className="text-[14px] text-muted">One operator calls the cues at a time. The console names who.</div>
      </div>
    </FitFrame>
  );
}
