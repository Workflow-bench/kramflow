"use client";

import { useEffect } from "react";

// Root-level exception boundary (KF-010). Replaces the root layout when it fails,
// so it renders its own html and body and uses no app providers.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/observability/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message, stack: error.stack, action: "root-render" }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0c0b09", color: "#f4efe5", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ color: "#a79d8b" }}>The error was recorded. Try again, or reload the page.</p>
          <button type="button" onClick={() => reset()} style={{ padding: "10px 20px", borderRadius: 8, background: "#1a1814", color: "#f4efe5", border: "1px solid #3a342b", cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
