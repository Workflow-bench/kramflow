"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center w-full max-w-sm">
        <h1 className="text-title text-primary">KramFlow</h1>
        <p className="text-body text-muted mt-2">Log in to the operator console</p>

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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-console-meta text-status-red" role="alert">
              {error}
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
