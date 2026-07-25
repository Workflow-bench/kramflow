"use client";

import { useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { useAuth } from "./auth-context";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 4;
const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export function PinGate({ children }: { children: React.ReactNode }) {
  const { status, unlock } = useAuth();

  if (status === "checking") {
    // Matches the server render (no flash of either the app or the PIN
    // screen while we read sessionStorage on mount).
    return <div className="h-screen w-screen bg-background" />;
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  return <PinScreen onUnlock={unlock} />;
}

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Triggered from event handlers (typing/tapping the last digit), not an
  // effect — the fetch is a direct response to user input, not a
  // synchronization of state with an external system.
  async function submitPin(pin: string) {
    setVerifying(true);
    setError(false);
    setLockedMessage(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data: { ok: boolean; retryAfterSeconds?: number } = await res.json();
      if (data.ok) {
        onUnlock();
        return;
      }
      if (res.status === 429) {
        const wait = data.retryAfterSeconds ?? 30;
        setLockedMessage(`Too many attempts — wait ${wait}s`);
        setDigits("");
        setVerifying(false);
        return;
      }
    } catch {
      // fall through to the same error state as a wrong PIN
    }
    setError(true);
    setDigits("");
    setVerifying(false);
  }

  function setDigitsAndMaybeSubmit(next: string) {
    setError(false);
    setLockedMessage(null);
    setDigits(next);
    if (next.length === PIN_LENGTH) submitPin(next);
  }

  function appendDigit(d: string) {
    if (verifying || digits.length >= PIN_LENGTH) return;
    setDigitsAndMaybeSubmit(digits + d);
  }

  function backspace() {
    if (verifying) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center w-full max-w-xs">
        <h1 className="text-title text-primary">KramFlow</h1>
        <p className="text-body text-muted mt-2">Enter PIN to continue</p>

        {/* Real keyboard input — visually hidden, drives the same state as the keypad. */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={PIN_LENGTH}
          autoComplete="off"
          value={digits}
          disabled={verifying}
          aria-label="4-digit PIN"
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
            setDigitsAndMaybeSubmit(next);
          }}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="flex items-center gap-4 mt-10 cursor-text"
          aria-hidden="true"
          tabIndex={-1}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3.5 w-3.5 rounded-full border transition-colors",
                i < digits.length ? "bg-primary border-primary" : "border-white/20",
                (error || lockedMessage) && "border-status-red"
              )}
            />
          ))}
        </button>

        <p
          className={cn(
            "text-caption mt-4 h-5 transition-opacity",
            error || lockedMessage ? "text-status-red opacity-100" : "opacity-0"
          )}
          role="alert"
        >
          {lockedMessage ?? "Incorrect PIN"}
        </p>

        <div className="grid grid-cols-3 gap-4 mt-2">
          {KEYPAD_ROWS.flat().map((d) => (
            <KeypadButton key={d} onClick={() => appendDigit(d)} disabled={verifying}>
              {d}
            </KeypadButton>
          ))}
          <span />
          <KeypadButton onClick={() => appendDigit("0")} disabled={verifying}>
            0
          </KeypadButton>
          <KeypadButton onClick={backspace} disabled={verifying} aria-label="Backspace">
            <Delete className="h-5 w-5" strokeWidth={2} />
          </KeypadButton>
        </div>
      </div>
    </div>
  );
}

function KeypadButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "h-16 w-16 rounded-full bg-card hover:bg-card-hover active:scale-95 text-subtitle text-primary flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
