"use client";

import { usePathname } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { useEventId } from "@/lib/event-context";

/**
 * Screens and Broadcast are one job (what the venue's screens show), so they
 * share a tab in the event nav. This switch is how you move between them;
 * before it, Broadcast had no nav home and was only reachable from a card.
 */
export function DisplaysSubnav() {
  const eventId = useEventId();
  const pathname = usePathname();
  const onBroadcast = pathname.includes("/broadcast");
  const items = [
    { label: "Screens", href: `/e/${eventId}/displays`, active: !onBroadcast },
    { label: "Broadcast", href: `/e/${eventId}/broadcast`, active: onBroadcast },
  ];
  return (
    <div className="px-4 sm:px-6 xl:px-12 pt-4">
      <div role="group" aria-label="Display tools" className="inline-flex gap-1 rounded-full border border-line-soft bg-card/50 p-1">
        {items.map((i) => (
          <LinkButton
            key={i.label}
            href={i.href}
            size="sm"
            variant={i.active ? "secondary" : "ghost"}
            className="rounded-full"
            aria-current={i.active ? "page" : undefined}
          >
            {i.label}
          </LinkButton>
        ))}
      </div>
    </div>
  );
}
