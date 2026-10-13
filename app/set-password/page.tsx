"use client";
import { requestSignOut } from "@/lib/auth/sign-out";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/auth/password-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { safeNext } from "@/lib/safe-redirect";
import { validatedNext, withNext } from "@/lib/auth/continuation";

const MIN_PASSWORD_LENGTH = 8;

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const next = safeNext(rawNext);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Navigates to login only after the server confirms sign-out (KF-016 contract).
  async function handleLogout() {
    setLoggingOut(true);
    setError(null);
    if (!(await requestSignOut())) {
      setLoggingOut(false);
      setError("Couldn't sign you out. Try again.");
      return;
    }
    window.location.href = "/login";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data: { ok: boolean; error?: string; reauthFailed?: boolean } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (data.reauthFailed) {
        // The password itself changed successfully — only the automatic
        // re-sign-in after it did not — so send them to log in with the
        // new password rather than a destination the now-stale session
        // can't actually reach.
        // Keeps the validated destination, so the next login continues where recovery began.
        window.location.href = withNext("/login", validatedNext(rawNext));
        return;
      }
      // Hard navigation, same reasoning as login's own — proxy.ts needs to
      // see the cleared must_change_password flag on the very next
      // request, which a client-side transition could race ahead of.
      window.location.href = next;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Set your password"
      support="You are logged in with a temporary password. Choose a new one to continue."
      footer={
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Not you? Log out
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[14px] leading-5 text-muted">
                New password
              </label>
              <PasswordInput
                size="public"
                id="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                disabled={submitting}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "set-password-error" : undefined}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-[14px] leading-5 text-muted">
                Confirm new password
              </label>
              <PasswordInput
                size="public"
                id="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                disabled={submitting}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "set-password-error" : undefined}
              />
            </div>

            {error && (
              <p id="set-password-error" className="text-[14px] leading-5 text-status-red" role="alert">
                {error}
              </p>
            )}

            <AuthSubmitButton loading={submitting}>Set Password &amp; Continue</AuthSubmitButton>
          </form>
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
