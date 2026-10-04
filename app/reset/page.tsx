"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Wordmark } from "@/components/site/wordmark";
import { GENERIC_RESET_MESSAGE } from "@/lib/reset-message";

// Password reset request. The success message is the same for every address,
// so this page never says whether an account exists. Only a validation error
// or a rate limit is shown as different.
export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: { ok: boolean; error?: string } = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="flex flex-col items-center w-full max-w-sm">
        <Link href="/" className="-my-3 rounded-chip py-3 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Wordmark />
        </Link>
        <h1 className="text-console-sm text-muted mt-2">Reset your password</h1>

        <Panel className="w-full mt-8 p-6">
          {sent ? (
            <p role="status" className="text-console-sm text-primary">
              {GENERIC_RESET_MESSAGE}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reset-email" className="text-console-meta text-muted-2">
                  Email
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={submitting}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "reset-error" : undefined}
                />
              </div>
              {error && (
                <p id="reset-error" role="alert" className="text-console-meta text-status-red">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
                Send reset link
              </Button>
            </form>
          )}
        </Panel>

        <p className="text-console-meta text-muted-2 mt-6">
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
