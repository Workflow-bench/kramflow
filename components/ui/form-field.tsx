"use client";

import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/utils";

// Canonical label+control+error wrapper — Broadcast Center and the Add/Edit
// Item form (program-form.tsx) each independently built the same "label
// span, children, optional error line" shape before this existed. This is
// the one implementation; both now use it instead of their own copy.
//
// R2 (2026-10 correction pass): this used to be a wrapping <label>. Any click
// inside a label re-activates its first labelable control, so choosing an
// option in Select's popup (rendered inside the label) re-clicked the
// trigger and reopened the list. Now an explicit <label htmlFor> plus a
// context that Input / Textarea / Select read to take the id and the error
// description — the popup is no longer inside a label at all.
interface FormFieldContextValue {
  id: string;
  labelId: string;
  errorId: string | undefined;
  invalid: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function useFormField() {
  return useContext(FormFieldContext);
}

export function FormField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  /** A single message, several, or omitted entirely — renders nothing when empty. */
  error?: string | string[];
  className?: string;
  children: React.ReactNode;
}) {
  const errors = !error ? [] : Array.isArray(error) ? error : [error];
  const id = useId();
  const errorId = errors.length > 0 ? `${id}-error` : undefined;
  return (
    <FormFieldContext.Provider value={{ id, labelId: `${id}-label`, errorId, invalid: errors.length > 0 }}>
      <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
        <label id={`${id}-label`} htmlFor={id} className="text-console-meta text-muted-2">
          {label}
        </label>
        {children}
        {errors.length > 0 && (
          <span id={errorId} role="alert" className="text-console-meta text-status-red">
            {errors.join(", ")}
          </span>
        )}
      </div>
    </FormFieldContext.Provider>
  );
}
