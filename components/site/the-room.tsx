"use client";

import { useRef, useState } from "react";
import { FullViewDialog } from "./full-view-dialog";
import { useGsap } from "./use-gsap";
import { revealSection } from "./reveal";

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
  const root = useRef<HTMLElement>(null);

  useGsap(root, ({ gsap, ScrollTrigger, reduced }) => revealSection(root.current!, { gsap, ScrollTrigger, reduced }));

  return (
    <section ref={root} id="room" data-cue="The room" className="room-chapter relative">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div>
            <h2 data-reveal="heading" className="mt-4 max-w-[18ch] font-display text-[clamp(1.875rem,2.6vw,2.5rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Connect the screen. Choose its view.
            </h2>
          </div>
          <p data-reveal="copy" className="max-w-[42ch] text-[16px] leading-relaxed text-muted">
            Three ways in, depending on what the screen can do. Each one lands on a display you
            have already given a view.
          </p>
        </div>

        <ol data-reveal="stagger" className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line-soft bg-line-soft sm:grid-cols-3">
          {ROUTES.map((r) => (
            <li key={r.step} className="room-route flex flex-col gap-2 p-6 sm:p-8">
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
            onClick={(event) => {
              // WebKit pointer clicks do not reliably focus buttons. Capture a real
              // return target before the dialog's shared focus lifecycle begins.
              event.currentTarget.focus({ preventScroll: true });
              setInspecting(true);
            }}
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
