"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

// A password field with a show/hide control. The control is a real button
// (type="button", so it never submits the form), it reports its state with
// aria-pressed, and it names the field it controls. Autocomplete and every
// other attribute pass straight through to the input.
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg" | "public" }) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const { className, size, ...rest } = props;
  // Public forms get a 44px visibility target (landing-auth design D02); console forms are unchanged.
  const isPublic = size === "public";
  return (
    <div className="relative">
      <Input
        {...rest}
        size={size}
        id={props.id ?? inputId}
        type={visible ? "text" : "password"}
        className={className ? `${className} pr-10` : "pr-10"}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id ?? inputId}
        disabled={props.disabled}
        className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-control text-muted-2 hover:text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isPublic ? "h-11 w-11" : "h-7 w-7 right-2"}`}
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> : <Eye className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
      </button>
    </div>
  );
}
