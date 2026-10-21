import type { Metadata } from "next";
import { NewLanding } from "@/components/site/new-landing";
import { GrainOverlay } from "@/components/site/grain-overlay";

// The public marketing page — proxy.ts redirects a signed-in operator straight to
// /dashboard, so this only ever renders for a logged-out visitor.
//
// Replaced wholesale (2026-10) by the landing redesign worked out at
// app/(catalog)/dev/hero-concept and promoted into components/site/new-landing.tsx.
// NewLanding owns its own scroll (Lenis) and every section from hero through
// footer, so the previous Navbar/HeroSection/BeforeDoors/RoomScene/
// WhenPlansChange/TheRoom/ClosingSection/Footer/SmoothScroll/Arrival/
// MotionFlag/ScrollProgress composition is retired from this route (the
// component files themselves are left in place, not deleted, in case
// another route still needs them - none currently does).
//
// Every product surface on this page is either the real app/before-doors.tsx
// section (real recorded captures) or this project's own code replica
// components (components/site/replica/*) - no screenshots were faked or
// invented for the new sections.

// Homepage metadata (B006-F1, B006-F2). Next merges nested metadata shallowly, so
// openGraph must repeat the root fields or the homepage loses siteName and type.
// The canonical is set here, not at the root, so private routes do not inherit it.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "KramFlow",
    description:
      "KramFlow is a live-event operating system for coordinating stage managers, AV operators, and performers across TV displays and mobile control.",
    siteName: "KramFlow",
    type: "website",
  },
};

export default function Home() {
  return (
    <main className="bg-background">
      <GrainOverlay />
      {/* Skip link: the first focusable element, hidden until keyboard focus (KF-020). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:border focus:border-line focus:bg-raised focus:px-4 focus:py-2 focus:text-console-sm focus:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Skip to content
      </a>
      <div id="main-content" tabIndex={-1} className="focus:outline-none">
        <NewLanding />
      </div>
    </main>
  );
}
