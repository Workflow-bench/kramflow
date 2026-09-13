import Link from "next/link";
import { Wordmark } from "./wordmark";

export function Footer() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex items-center gap-2.5">
          <Wordmark />
          <span className="ml-3 text-console-meta text-muted-2">Live operations for live events.</span>
        </div>
        <Link
          href="/login"
          // Measured, not guessed: py-3 gave ~38px, py-3.5 gave 42px —
          // still short. py-4 measures 44px exactly.
          className="-my-4 self-start rounded-chip py-4 text-console-label uppercase text-muted-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Operator log in
        </Link>
      </div>
    </footer>
  );
}
