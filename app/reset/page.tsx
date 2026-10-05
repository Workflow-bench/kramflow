"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
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
    <AuthShell
      title="Reset your password"
      support="Enter the email on your account and we will send a reset link."
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-control border border-line-soft bg-raised/60 px-4 py-3 text-[14px] leading-5 text-primary">
          {GENERIC_RESET_MESSAGE}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-email" className="text-[14px] leading-5 text-muted">
              Email
            </label>
            <Input
              id="reset-email"
              size="public"
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
            <p id="reset-error" role="alert" className="text-[14px] leading-5 text-status-red">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="public" loading={submitting} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
