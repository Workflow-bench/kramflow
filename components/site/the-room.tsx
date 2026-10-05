import { ProductShot } from "./product-shot";

/**
 * The room — how a screen in the venue becomes a KramFlow display.
 *
 * Quiet and practical by design: this is the last piece of explanation before the
 * close, and it earns its place by answering one question (how does a TV in the lobby
 * end up showing the right thing) rather than by restating the cue story again.
 *
 * The three connection paths are verified in source, not assumed: share links
 * (`lib/server/share-links.ts`), the six-digit TV code that resolves to one
 * (`lib/tv-code.ts`, resolved in `share-links.ts`), and the QR code the dashboard
 * renders for a link (`components/dashboard/qr-code.tsx`).
 *
 * Nothing here publishes a live credential. There is no real token, no working code
 * and no generated QR artwork — a fake QR would be an invented product control, and a
 * real one would be a published credential. The capture is the actual Displays page;
 * the connection paths are stated in words beside it.
 */
export function TheRoom() {
  return (
    <section id="room" data-cue="The room" className="relative border-b border-line-soft">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-center lg:gap-16">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">04 / The room</p>
            <h2 className="mt-5 max-w-[16ch] font-display text-[clamp(2rem,3.4vw,3.25rem)] leading-[1.04] tracking-[-0.02em] text-primary">
              Connect the screen. Choose its view.
            </h2>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-muted">
              Join a venue display by link, QR code, or a six-digit connection code. Give each screen the
              view it needs.
            </p>

            <dl className="mt-10 grid gap-5 border-t border-line-soft pt-8 sm:grid-cols-3">
              <div>
                <dt className="text-[15px] text-primary">Link</dt>
                <dd className="mt-1.5 text-[14px] leading-relaxed text-muted-2">
                  Open a share link on the screen.
                </dd>
              </div>
              <div>
                <dt className="text-[15px] text-primary">QR code</dt>
                <dd className="mt-1.5 text-[14px] leading-relaxed text-muted-2">
                  Scan the same link from a phone.
                </dd>
              </div>
              <div>
                <dt className="text-[15px] text-primary">Six-digit code</dt>
                <dd className="mt-1.5 text-[14px] leading-relaxed text-muted-2">
                  Type the code on a TV with no keyboard.
                </dd>
              </div>
            </dl>
          </div>

          <figure className="min-w-0">
            <div className="overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
              <ProductShot shot="displays" sizes="(min-width: 1024px) 58vw, 92vw" />
            </div>
            <figcaption className="mt-3 text-[13px] text-muted-2">Displays · Recorded product view</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
