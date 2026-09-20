import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Archivo } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { MotionPreferences } from "@/components/motion-preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Scoped to measurement — start times, durations, countdowns, sort indices.
// See the .tnum rule in globals.css for why titles stay on Inter. IBM Plex
// Mono over the more common JetBrains Mono — a face with more mechanical,
// less "developer-tool" character (Phase 3 design system).
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// The Brand/Marketing display voice. DESIGN.md v4 recorded this as an open
// decision ("the component markup carries comments referencing Geist, but
// no Geist font is loaded anywhere — wiring an actual display face for the
// brand system is an open decision, not yet made") and the landing page
// had been setting 56px headlines in Inter, the product's UI face, ever
// since. Archivo closes it: a grotesque drawn for high-performance
// editorial display use, which is the actual register here (live
// production + editorial), where Inter is a UI face doing an impression of
// one and Geist would read as borrowed from another company's identity.
// Scoped to `.font-display` — the Operational Product and the Stage
// surfaces are untouched and still set in Inter.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const TITLE = "KramFlow";
const DESCRIPTION =
  "KramFlow is a live-event operating system for coordinating stage managers, AV operators, and performers across TV displays and mobile control.";

// Phase 8 flagged metadataBase/canonical as absent because no production
// domain was confirmed to exist yet. Phase 5 confirmed www.kramflow.me is
// live, so this fills that gap. og:image is still intentionally omitted —
// no designed 1200x630 social-card asset exists in this repo, and inventing
// one would be exactly the fabricated brand asset both passes were told not
// to create.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.kramflow.me"),
  title: {
    default: TITLE,
    template: "%s · KramFlow",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} ${archivo.variable} dark h-full antialiased`}>
      {/* overflow-x-hidden: tooltips (components/ui/tooltip.tsx) stay mounted
          at opacity-0 rather than unmounted, centered on their trigger via
          left-1/2 -translate-x-1/2 with whitespace-nowrap — one anchored
          near a viewport edge inflates document scrollWidth even while
          fully invisible. This only clips the outer page; elements with
          their own overflow-x-auto (e.g. the session switcher) still scroll. */}
      {/* `overflow-x-clip`, not `-hidden`. Same reasoning app/globals.css
          already applies to <html> and states at length there: `hidden`
          makes this element a scroll container, which silently disables
          `position: sticky` for every descendant, while `clip` contains
          the same overflow without establishing one. <html> was fixed for
          this; <body> kept `hidden` and so kept the bug — caught when the
          landing page's pinned surface index refused to stick and measured
          as sitting at its containing block's top rather than clamping to
          the scrollport. */}
      <body className="min-h-full flex flex-col overflow-x-clip bg-background text-primary">
        <MotionPreferences>
          <ToastProvider>{children}</ToastProvider>
        </MotionPreferences>
      </body>
    </html>
  );
}
