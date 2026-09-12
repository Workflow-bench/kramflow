import Image, { type StaticImageData } from "next/image";

import consoleShot from "../../public/product/console.png";
import consolePrevShot from "../../public/product/console-prev.png";
import cueSheetShot from "../../public/product/cue-sheet.png";
import displaysShot from "../../public/product/displays.png";
import broadcastShot from "../../public/product/broadcast.png";
import rehearsalShot from "../../public/product/rehearsal.png";
import remoteShot from "../../public/product/remote.png";
import generalShot from "../../public/product/display-general.png";
import presenterShot from "../../public/product/display-presenter.png";
import avShot from "../../public/product/display-av.png";
import speakerReadyShot from "../../public/product/display-speaker-ready.png";
import generalPrevShot from "../../public/product/display-general-prev.png";
import presenterPrevShot from "../../public/product/display-presenter-prev.png";
import avPrevShot from "../../public/product/display-av-prev.png";
import speakerReadyPrevShot from "../../public/product/display-speaker-ready-prev.png";

/**
 * Real product captures, presented as objects rather than as evidence
 * pasted into a box.
 *
 * Every image here is a genuine screenshot of Kramflow running the seeded
 * "Northwind Summit 2026" event — see scripts/capture-product.mjs. That
 * matters more than it sounds: an earlier version of this page rebuilt
 * each surface as a hand-written DOM approximation, which was accurate but
 * inevitably *flatter* than the product. A recreation only contains what
 * someone remembered to recreate. The real console carries the rundown, a
 * live countdown, a projected finish, a control lease, a fleet health chip
 * and an activity log at once, and that density is the single most
 * persuasive thing this product has.
 *
 * **Static imports, not string paths.** These used to be
 * `/product/console.png` string srcs with hand-written width/height. Two
 * things went wrong, both structural rather than slips: the dimensions had
 * to be re-edited by hand every time a capture viewport changed (and were
 * silently wrong in between), and because the URL never changes when a
 * capture is re-shot, Next's image optimizer kept serving a stale variant
 * — the hero spent a while showing "No one has control" from a capture two
 * runs old, and a CDN would have done exactly the same thing in
 * production. Static imports give Next the real intrinsic dimensions and a
 * content-hashed filename, so refreshing the captures busts the cache by
 * construction.
 *
 * The presentation rule: a screenshot in a `rounded-xl border` reads as an
 * illustration of software. A screenshot cropped by the viewport edge, or
 * running underneath a headline, reads as software. So the default here
 * has no border and no visible frame — just the capture and the shadow it
 * throws onto the page. Rounding is opt-in, and used only where the object
 * genuinely is a device (the phone) or a screen mounted in a room.
 */

interface Shot {
  img: StaticImageData;
  alt: string;
}

export const SHOTS = {
  console: {
    img: consoleShot,
    alt: "Kramflow Operator Console running Northwind Summit 2026: the rundown on the left, the live item and its countdown in the centre, and the show controls on the right.",
  },
  consolePrev: { img: consolePrevShot, alt: "The same Operator Console one cue earlier, with the Opening Keynote live." },
  cueSheet: {
    img: cueSheetShot,
    alt: "The Kramflow Cue Sheet: every item in the session with its owner, start time and duration, the live item highlighted.",
  },
  displays: { img: displaysShot, alt: "The Kramflow display fleet: four venue screens with their type, health and last-seen time." },
  broadcast: { img: broadcastShot, alt: "Kramflow Broadcast Center, showing messages sent to the venue's screens." },
  rehearsal: { img: rehearsalShot, alt: "Kramflow Rehearsal mode, running the show without touching the live displays." },
  remote: { img: remoteShot, alt: "The Kramflow remote on a phone: the live item, its countdown, and a full-width Next button." },
  general: { img: generalShot, alt: "The lobby display: what is on stage now, who is presenting, and what is next." },
  presenter: { img: presenterShot, alt: "The stage confidence monitor: a very large countdown showing time remaining in the current item." },
  av: { img: avShot, alt: "The AV booth display: the current cue with its microphone, video, lighting and curtain requirements." },
  speakerReady: { img: speakerReadyShot, alt: "The speaker ready room display: what is on stage now, the operator's notes, and what is on deck." },
  generalPrev: { img: generalPrevShot, alt: "The lobby display one cue earlier, showing the Opening Keynote." },
  presenterPrev: { img: presenterPrevShot, alt: "The stage confidence monitor one cue earlier, counting down the Opening Keynote." },
  avPrev: { img: avPrevShot, alt: "The AV booth display one cue earlier, listing the Opening Keynote's requirements." },
  speakerReadyPrev: { img: speakerReadyPrevShot, alt: "The speaker ready room display one cue earlier, showing the Opening Keynote on stage." },
} satisfies Record<string, Shot>;

export type ShotKey = keyof typeof SHOTS;

interface ProductShotProps {
  shot: ShotKey;
  className?: string;
  /** Get this right, or the browser downloads a 4K PNG to paint a 600px object. */
  sizes?: string;
  priority?: boolean;
}

export function ProductShot({ shot, className = "", sizes = "100vw", priority = false }: ProductShotProps) {
  const s = SHOTS[shot];
  return (
    <Image src={s.img} alt={s.alt} sizes={sizes} priority={priority} quality={90} className={`h-auto w-full ${className}`} />
  );
}

/**
 * A capture presented as a screen mounted in the venue: a hairline edge and
 * a black ground behind it, so four of them read as four screens in a room
 * rather than four cards in a grid. Deliberately not a laptop or TV mockup
 * with a bezel and a stand — those are stock-illustration clichés, and they
 * shrink the actual pixels to make room for decoration.
 */
export function VenueScreen({
  shot,
  label,
  className = "",
  sizes = "(min-width: 1024px) 45vw, 90vw",
}: {
  shot: ShotKey;
  label: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <figure className={`relative ${className}`}>
      <div className="relative overflow-hidden rounded-[0.5rem] bg-black ring-1 ring-line-soft">
        <ProductShot shot={shot} sizes={sizes} />
      </div>
      <figcaption className="mt-3 text-console-label uppercase text-muted-2">{label}</figcaption>
    </figure>
  );
}
