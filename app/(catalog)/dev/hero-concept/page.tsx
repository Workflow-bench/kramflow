import { notFound } from "next/navigation";

// SYNTHETIC HARNESS, development only (404 in production, same gate as the other
// catalog harnesses). A side experiment for a possible future landing hero + nav —
// see docs/landing-redesign-v2 for the design notes. Not linked from the real site,
// not wired into app/page.tsx. If this direction is kept, it moves into
// components/site/ for real; until then it stays isolated here.
export default async function HeroConceptPage() {
  if (process.env.NODE_ENV !== "production") {
    const { HeroConceptHarness } = await import("./harness");
    return <HeroConceptHarness />;
  }
  notFound();
}
