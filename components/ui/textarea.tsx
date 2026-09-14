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
        // text-base below sm: — same iOS zoom-on-focus fix as Input.
        "w-full rounded-control bg-background border border-line px-3 py-2 text-base sm:text-console-sm text-primary",
        // max-h + overflow-y-auto caps the manual resize-y drag handle —
        // without it, dragging past a modal's height (e.g. Add/Edit Item's
        // Remarks field, above its sticky Save/Cancel footer) grows the
        // textarea's own box past the visible viewport, so that footer's
        // `sticky` position ends up pinned partway *through* the textarea
        // instead of below it, splitting it visually in two. Past this
        // cap the field scrolls internally, same as any other overflowing
        // content, instead of growing the page around it.
        "placeholder:text-muted-2 outline-none resize-y max-h-64 overflow-y-auto",
        "transition-[border-color,box-shadow] duration-[110ms] ease-out",
        "focus:border-accent focus:ring-[3px] focus:ring-accent/15",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}
