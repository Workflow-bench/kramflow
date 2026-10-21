"use client";

import { useEffect } from "react";

// Route-level exception boundary (KF-010). Reports a redacted summary to the
// bounded endpoint, then shows a generic message. No stack or input is shown.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/observability/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        action: "render",
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-title text-primary">Something went wrong</h1>
      <p className="text-body text-muted">The error was recorded. Try again, or reload the page.</p>
      <button type="button" onClick={() => reset()} className="rounded-control bg-raised border border-line px-5 py-2.5 text-console-sm text-primary cursor-pointer">
        Try again
      </button>
    </div>
  );
}
