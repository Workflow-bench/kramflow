"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNext } from "@/lib/safe-redirect";
import { validatedNext, withNext } from "@/lib/auth/continuation";

function LoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = safeNext(rawNext);
  // Recovery keeps the same validated destination: Forgot password → reset → set-password.
  const resetHref = withNext("/reset", validatedNext(rawNext));
  // Set by the auth callback when an emailed link could not be used. The text is
  // deliberately generic: it does not say whether an account exists or which
  // failure happened (expired, already used, or invalid).
  const linkExpired = searchParams.get("link") === "expired";

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Tracks whether the *most recent* submit failed, so "Resend confirmation
  // email" only appears after an actual failed attempt (not on first load)
  // — and clears the moment the operator edits either field, so it doesn't
  // linger as a stale offer once they've changed what they're submitting.
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        // Supabase no longer distinguishes "wrong password" from "account
        // exists but hasn't confirmed its email" in the error it returns
        // (both come back as the same generic invalid-credentials error,
        // verified directly against this project's Auth API) — so rather
        // than guess, always offer the resend option once a login attempt
        // fails. It's a no-op (same response either way, by design) if the
        // account is already confirmed or doesn't exist.
        setShowResend(true);
        setSubmitting(false);
        return;
      }
      // Hard navigation (not router.push) so proxy.ts re-evaluates the
      // freshly-set session cookie on the very next request — a client
      // transition could race ahead of the cookie actually being usable.
      window.location.href = next;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim() || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Couldn't resend the confirmation email.");
      } else {
        toast.success("If that account needs confirming, we've sent a new email.");
      }
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      support="Log in to continue your show."
      footer={
        <>
          New to Kramflow?{" "}
          <Link href={`/signup${rawNext ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        {linkExpired && (
          <p role="status" className="rounded-control border border-line-soft bg-raised/60 px-4 py-3 text-[14px] leading-5 text-muted">
            That link has expired or was already used.{" "}
            <Link href={resetHref} className="text-primary hover:underline">Request a new link</Link>.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[14px] leading-5 text-muted">
            Email
          </label>
          <Input
            id="email"
            size="public"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setShowResend(false);
            }}
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="password" className="text-[14px] leading-5 text-muted">
              Password
            </label>
            <Link href={resetHref} className="text-[14px] leading-5 text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            size="public"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setShowResend(false);
            }}
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>

        {/* Persistent (not a toast) and tied to both fields via aria-describedby, so a
            screen-reader user returning to a field hears what is wrong with it. */}
        {error && (
          <p id="login-error" className="text-[14px] leading-5 text-status-red" role="alert">
            {error}
          </p>
        )}

        {showResend && (
          <p className="text-[14px] leading-5 text-muted-2">
            If your account isn&apos;t confirmed yet,{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim()}
              className="text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              resend the confirmation email
            </button>
            .
          </p>
        )}

        <Button type="submit" variant="primary" size="public" loading={submitting} className="w-full">
          Log In
        </Button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    // useSearchParams requires a Suspense boundary during static
    // generation — the fallback matches the form's own background so
    // there's no flash between it and the real form on hydration.
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
