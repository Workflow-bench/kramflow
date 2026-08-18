import Link from "next/link";

// No more 6-surface screen-picker here — that was reachable by anyone with
// the URL, including direct links to /operator and /remote. Authenticated
// operators never actually see this page: proxy.ts redirects them straight
// to /dashboard. Anyone else gets a minimal landing page whose only job is
// to point at /login. The old picker's tile-grid pattern lives on, but
// repurposed and scoped down to the four public display types only, behind
// a valid share-link token: app/screens/page.tsx.
export default function Home() {
  return (
    <main className="min-h-screen flex-1 flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-title text-primary">KramFlow</h1>
        <p className="text-body text-muted max-w-md">
          Order in motion — a live event operating system for stage managers, AV operators, and performers.
        </p>
        <Link
          href="/login"
          className="mt-2 rounded-control bg-primary text-background px-6 py-3 text-console-sm font-medium hover:bg-white transition-colors"
        >
          Operator Log In
        </Link>
      </div>
    </main>
  );
}
