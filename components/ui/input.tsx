import { cn } from "@/lib/utils";

// "lg" is the Remote/TV counterpart to Button's size scale — added so
// Remote's own text fields (jump-to-item, alert text, stage notes) render
// through Input instead of each hand-rolling an h-14/rounded-xl/ring-white
// treatment that drifted from this component's own tokens.
export function Input({
  size = "md",
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg" }) {
  return (
    <input
      className={cn(
        "w-full rounded-control bg-background border border-line text-primary",
        "placeholder:text-muted-2 outline-none",
        "transition-[border-color,box-shadow] duration-[110ms] ease-out",
        // Focus is the accent, never a status hue — a blue ring on a focused
        // field would read as "this item is next".
        "focus:border-accent focus:ring-[3px] focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        size === "md" && "h-9 px-3 text-console-sm",
        size === "lg" && "h-14 px-4 text-lg rounded-card",
        className
      )}
      {...props}
    />
  );
}
