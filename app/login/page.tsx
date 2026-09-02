"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// proxy.ts sets `next` to the pathname a signed-out operator was redirected
// from, but it's still an attacker-controllable query param on a public
// URL — must be a same-origin path (starts with a single `/`, not `//` or
// `/\`, both of which browsers treat as protocol-relative and will happily
// navigate off-site) before it's ever handed to window.location.href.
function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

function LoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = rawNext && isSafeRedirect(rawNext) ? rawNext : "/dashboard";

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
    <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center w-full max-w-sm">
        {/* The one recovery path missing from this page for anyone who
            landed here by accident or a stray bookmark — there was
            previously no way back to the public site short of editing the
            URL (2026-09-01 UI/UX audit finding #17). */}
        <Link href="/" className="text-title text-primary hover:opacity-80 transition-opacity">
          KramFlow
        </Link>
        <p className="text-body text-muted mt-2">Log in to your account</p>

        <form onSubmit={handleSubmit} className="w-full mt-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-console-meta text-muted-2">
              Email
            </label>
            <Input
              id="email"
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-console-meta text-muted-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
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

          {/* Persistent (not a toast) and tied to both fields via
              aria-describedby — previously a failed login rendered this
              text but never marked the fields themselves invalid, so a
              screen-reader user tabbing back to correct a field wouldn't
              hear anything wrong with it (2026-09-01 UI/UX audit finding
              #16). */}
          {error && (
            <p id="login-error" className="text-console-meta text-status-red" role="alert">
              {error}
            </p>
          )}

          {showResend && (
            <p className="text-console-meta text-muted-2">
              If your account isn&apos;t confirmed yet,{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !email.trim()}
                className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                resend the confirmation email
              </button>
              .
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-2">
            Log In
          </Button>
        </form>

        <p className="text-console-meta text-muted-2 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    // useSearchParams requires a Suspense boundary during static
    // generation — the fallback matches the form's own background so
    // there's no flash between it and the real form on hydration.
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
