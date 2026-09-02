"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";

function SignupForm() {
  const searchParams = useSearchParams();
  // Present when this signup was reached from an invite link
  // (/invite/[token] redirects here for an email with no existing
  // account) — carried through so the freshly-created account lands back
  // on that invite page and AutoAccept can claim it, instead of the
  // generic dashboard.
  const inviteToken = searchParams.get("invite");
  const next = inviteToken ? `/invite/${inviteToken}` : "/dashboard";
  const prefillEmail = searchParams.get("email") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data: { ok: boolean; error?: string; needsEmailConfirmation?: boolean } = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (data.needsEmailConfirmation) {
        setConfirmationSent(true);
        setSubmitting(false);
        return;
      }
      // Account created and already signed in (email confirmation is off
      // for this project) — hard navigation so proxy.ts sees the fresh
      // session cookie on the next request.
      window.location.href = next;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center w-full max-w-sm text-center">
          <h1 className="text-title text-primary">Check your email</h1>
          <p className="text-body text-muted mt-3">
            We sent a confirmation link to <span className="text-primary">{email}</span>. Click it to activate your
            account, then come back and log in.
          </p>
          <LinkButton href={`/login?next=${encodeURIComponent(next)}`} className="mt-8" variant="secondary" size="lg">
            Back to Log In
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center w-full max-w-sm">
        <Link href="/" className="text-title text-primary hover:opacity-80 transition-opacity">
          KramFlow
        </Link>
        <p className="text-body text-muted mt-2">Create your operator account</p>

        <form onSubmit={handleSubmit} className="w-full mt-10 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-console-meta text-muted-2">
              Name
            </label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

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
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-console-meta text-muted-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <p className="text-console-meta text-muted-2">At least 8 characters.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-console-meta text-muted-2">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-console-meta text-status-red" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full mt-2">
            Sign Up
          </Button>
        </form>

        <p className="text-console-meta text-muted-2 mt-6">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    // useSearchParams requires a Suspense boundary during static
    // generation — matches app/login/page.tsx's own wrapper exactly.
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <SignupForm />
    </Suspense>
  );
}
