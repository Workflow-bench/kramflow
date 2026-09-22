"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Wordmark } from "@/components/site/wordmark";
import { safeNext } from "@/lib/safe-redirect";

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

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
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
        window.location.href = "/login";
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
    <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center w-full max-w-sm">
        <Wordmark />
        <p className="text-console-sm text-muted mt-2">Set your password</p>
        <p className="text-console-meta text-muted-2 mt-1 text-center">
          You&rsquo;re logged in with a temporary password. Choose a new one to continue.
        </p>

        <Panel className="w-full mt-8 p-6">
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-console-meta text-muted-2">
                New password
              </label>
              <Input
                id="password"
                type="password"
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
              <label htmlFor="confirmPassword" className="text-console-meta text-muted-2">
                Confirm new password
              </label>
              <Input
                id="confirmPassword"
                type="password"
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
              <p id="set-password-error" className="text-console-meta text-status-red" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-2">
              Set Password &amp; Continue
            </Button>
          </form>
        </Panel>

        <p className="text-console-meta text-muted-2 mt-6">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Not you? Log out
          </button>
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
