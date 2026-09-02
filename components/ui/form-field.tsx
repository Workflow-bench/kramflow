import { cn } from "@/lib/utils";

// Canonical label+control+error wrapper — Broadcast Center and the Add/Edit
// Item form (program-form.tsx) each independently built the same "label
// span, children, optional error line" shape before this existed. This is
// the one implementation; both now use it instead of their own copy.
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
  return (
    <label className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-console-meta text-muted-2">{label}</span>
      {children}
      {errors.length > 0 && (
        <span role="alert" className="text-console-meta text-status-red">
          {errors.join(", ")}
        </span>
      )}
    </label>
  );
}
