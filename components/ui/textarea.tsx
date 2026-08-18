import { cn } from "@/lib/utils";

// Input's multi-line counterpart — same tokens, so a form mixing single-
// and multi-line fields (Broadcast compose, Add Item's notes field) reads
// as one system rather than two independently-styled field types.
export function Textarea({
  className,
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-control bg-background border border-line px-3 py-2 text-console-sm text-primary",
        "placeholder:text-muted-2 outline-none resize-y",
        "transition-[border-color,box-shadow] duration-[110ms] ease-out",
        "focus:border-accent focus:ring-[3px] focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}
