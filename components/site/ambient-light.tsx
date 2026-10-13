/** Static, neutral depth. The console and recorded cue sequence carry the motion. */
export function AmbientLight({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "echo";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 ambient-light-${variant} ${className}`}
    />
  );
}
