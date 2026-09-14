/** A static message the profile itself sets (wifi password, venue rules,
 *  a sponsor line) — the persistent-widget equivalent of what events were
 *  already working around via a pinned Broadcast Center info message
 *  (see the seed data's "Wi-Fi" broadcast) — per
 *  docs/CUSTOM-DISPLAY-REQUIREMENTS.md section 2.1. */
export function CustomTextWidget({ text }: { text: string | null }) {
  if (!text) {
    return <p className="text-body text-muted-2 italic">No text set for this widget yet.</p>;
  }
  return (
    <div className="flex items-center justify-center h-full text-center">
      <p className="text-subtitle text-primary text-pretty">{text}</p>
    </div>
  );
}
