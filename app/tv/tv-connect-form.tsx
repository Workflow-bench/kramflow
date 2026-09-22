"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TV_CODE_LENGTH, formatTvCode, normalizeTvCode } from "@/lib/tv-code";

// Keeps only digits, capped at six, and shows them grouped ("482 731") as
// they are typed. The value sent to the server is always the plain digits.
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, TV_CODE_LENGTH);
}

export function TvConnectForm() {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event?: React.SyntheticEvent) {
    event?.preventDefault();
    if (busy) return;

    const code = normalizeTvCode(digits);
    if (!code) {
      setError("Enter all six digits.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tv/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data: { ok: boolean; href?: string; error?: string } = await res.json();
      if (data.ok && data.href) {
        router.push(data.href);
        return;
      }
      setError(data.error ?? "Invalid or expired code.");
    } catch {
      setError("Could not reach KramFlow. Check the connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-6 w-full" noValidate>
      <label htmlFor="tv-code" className="text-body text-muted">
        Enter your 6-digit code
      </label>
      <input
        id="tv-code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        value={formatTvCode(digits)}
        onChange={(e) => {
          setDigits(digitsOnly(e.target.value));
          setError(null);
        }}
        // Explicit rather than relying on the browser's implicit form
        // submission: TV browsers and remote controls do not all trigger it
        // from the OK/Enter key. preventDefault stops the native path from
        // also firing, and `busy` already guards a double submit.
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit(e);
        }}
        placeholder="000 000"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "tv-code-error" : undefined}
        className="w-full max-w-md h-24 rounded-card bg-card border border-line px-6 text-center text-[3.5rem] leading-none font-semibold tabular-nums tracking-[0.12em] text-primary placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      <div className="min-h-7" aria-live="polite">
        {error && (
          <p id="tv-code-error" role="alert" className="text-body text-status-red">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" size="xl" loading={busy} className="w-full max-w-md">
        Connect
      </Button>
    </form>
  );
}
