"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button, LinkButton } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { inviteDestination, validatedNext } from "@/lib/auth/continuation";

function SignupForm() {
  const searchParams = useSearchParams();
  // Present when this signup was reached from an invite link
  // (/invite/[token] redirects here for an email with no existing
  // account) — carried through so the freshly-created account lands back
  // on that invite page and AutoAccept can claim it, instead of the
  // generic dashboard.
  const inviteToken = searchParams.get("invite");
  // `next` carries the destination through login → signup → login (CD-F3). A validated
  // `next` wins over the invite fallback; an unsafe or absent `next` falls through to it.
  // An unsafe `next` falls back to a validated invite destination, then to the dashboard.
  const next = validatedNext(searchParams.get("next")) ?? inviteDestination(inviteToken) ?? "/dashboard";
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
      <AuthShell
        title="Check your email"
        support={`We sent a confirmation link to ${email}. Click it to activate your account, then log in.`}
        showArt={false}
      >
        <LinkButton href={`/login?next=${encodeURIComponent(next)}`} variant="secondary" size="public" className="w-full">
          Back to log in
        </LinkButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your Kramflow account"
      support="Plan your cues. Run your show."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-[14px] leading-5 text-muted">
            Name
          </label>
          <Input
            id="name"
            size="public"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

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
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[14px] leading-5 text-muted">
            Password
          </label>
          <PasswordInput
            id="password"
            size="public"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            aria-describedby="password-help"
          />
          <p id="password-help" className="text-[13px] leading-5 text-muted-2">
            At least 8 characters.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="confirmPassword" className="text-[14px] leading-5 text-muted">
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            size="public"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="text-[14px] leading-5 text-status-red" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="public" loading={submitting} className="w-full">
          Sign Up
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    // useSearchParams requires a Suspense boundary during static
    // generation — matches app/login/page.tsx's own wrapper exactly.
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignupForm />
    </Suspense>
  );
}
