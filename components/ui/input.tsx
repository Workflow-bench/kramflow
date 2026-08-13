import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-control bg-background border border-line px-3 text-console-sm text-primary",
        "placeholder:text-muted-2 outline-none",
        "transition-[border-color,box-shadow] duration-[140ms] ease-out",
        // Focus is the accent, never a status hue — a blue ring on a focused
        // field would read as "this item is next".
        "focus:border-accent focus:ring-[3px] focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}
