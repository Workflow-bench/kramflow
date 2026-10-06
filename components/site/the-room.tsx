"use client";

import { useState } from "react";
import { FullViewDialog } from "./full-view-dialog";

/**
 * The room — how a screen in the venue becomes a KramFlow display.
 *
 * Deliberately the shortest chapter on the page (HOME-R05). Preparation and the cue
 * stage already carry large product surfaces; repeating that here would make a fourth
 * equal-weight screenshot panel and flatten the whole page's rhythm. So this is a
 * practical strip: three routes, each described by what the *receiving device* does,
 * with the genuine Displays capture available for inspection rather than on permanent
 * display.
 *
 * Each route is verified in source, not assumed:
 * - share links — `lib/server/share-links.ts`
 * - the QR code the dashboard renders for a link — `components/dashboard/qr-code.tsx`
 * - the six-digit code — `lib/tv-code.ts` (`TV_CODE_LENGTH` 6), entered on the screen
 *   itself at `/tv` and resolved server-side by `app/api/tv/connect`, with no login
 *
 * No credential is published here: there is no real token, no working code and no
 * generated QR artwork.
 */

const ROUTES = [
  {
    step: "01",
    name: "Open a link",
    device: "On the screen's own browser",
    copy: "Paste the share link and leave it open. The screen keeps showing its view.",
  },
  {
    step: "02",
    name: "Scan a QR code",
    device: "With a phone",
    copy: "Point the camera at the share link's QR code to open that display on the phone.",
  },
  {
    step: "03",
    name: "Enter six digits",
    device: "On a TV with a remote",
    copy: "Open /tv on the screen and type the six-digit code from the Share Display card. No sign-in.",
  },
];

export function TheRoom() {
  const [inspecting, setInspecting] = useState(false);

  return (
    <section id="room" data-cue="The room" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-10 lg:py-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">04 / The room</p>
            <h2 className="mt-4 max-w-[18ch] font-display text-[clamp(1.875rem,3vw,2.875rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Connect the screen. Choose its view.
            </h2>
          </div>
          <p className="max-w-[42ch] text-[16px] leading-relaxed text-muted">
            Three ways in, depending on what the screen can do. Each one lands on a display you
            have already given a view.
          </p>
        </div>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line-soft bg-line-soft sm:grid-cols-3">
          {ROUTES.map((r) => (
            <li key={r.step} className="flex flex-col gap-2 bg-background p-6">
              <span className="tnum text-[11px] uppercase tracking-[0.16em] text-muted-2">{r.step}</span>
              <span className="text-[17px] text-primary">{r.name}</span>
              <span className="text-[12px] uppercase tracking-[0.12em] text-muted-2">{r.device}</span>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{r.copy}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setInspecting(true)}
            className="inline-flex h-11 items-center rounded-control border border-line px-4 text-[14px] text-primary transition-colors hover:border-white/25 hover:bg-overlay-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Inspect the display fleet
          </button>
          <p className="mt-2 text-[13px] text-muted-2">
            Opens the recorded Displays page: four screens, their type and whether they are online.
          </p>
        </div>
      </div>

      {inspecting && <FullViewDialog shot="displays" label="Displays" onClose={() => setInspecting(false)} />}
    </section>
  );
}
