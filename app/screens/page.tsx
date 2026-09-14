import Link from "next/link";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";
import { DISPLAY_TYPES } from "@/lib/display-engine/types";
import { DISPLAY_TYPE_META } from "@/lib/display-engine/display-meta";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LayoutGrid } from "lucide-react";

// The no-login screen-selection page a Share Display Link/QR code actually
// opens: no auth, nothing but the token in the URL. This is the deliberate
// departure from StageTimer's model (confirmed in the KramFlow research
// pass) — StageTimer hands out one separate signed link per output/role
// with no in-page picker; KramFlow hands out one link and lets whoever
// opens it choose the screen here. Sourced from DISPLAY_TYPES/
// DISPLAY_TYPE_META, the same single source of truth the Displays fleet
// page's preview/provisioning rows use, instead of a hand-duplicated copy.
//
// "custom" is handled separately from the 4 fixed types (fixedScreens
// below): there's no one "/custom" tile the way there's one "/av" tile —
// an event can define any number of DisplayProfiles, and each is its own
// selectable screen (?profileId=...). Fetched fresh per page load rather
// than baked into DISPLAY_TYPES, since profiles are per-event data, not a
// fixed catalog.
const FIXED_SCREENS = DISPLAY_TYPES.filter((t) => t.value !== "custom").map((t) => {
  const meta = DISPLAY_TYPE_META[t.value];
  return { href: t.route, label: t.label, desc: meta.desc, icon: meta.Icon };
});

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const access = await verifyDisplayAccess(token, undefined);

  if (!access.ok) return <LinkInvalid reason={access.reason} />;

  const { data: profiles } = await supabaseAdmin()
    .from("display_profiles")
    .select("id, name")
    .eq("event_id", access.eventId)
    .order("name", { ascending: true });

  const customScreens = (profiles ?? []).map((p) => ({
    href: `/custom?profileId=${p.id}`,
    label: p.name,
    desc: DISPLAY_TYPE_META.custom.desc,
    icon: LayoutGrid,
  }));

  const SCREENS = [...FIXED_SCREENS, ...customScreens];

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background px-6 py-16">
      <div className="flex flex-col items-center gap-10 w-full max-w-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-title text-primary">KramFlow</h1>
          <p className="text-body text-muted">Choose a screen to display</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          {SCREENS.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={token ? `${href}${href.includes("?") ? "&" : "?"}token=${token}` : href}
              className="rounded-card bg-card hover:bg-card-hover transition-colors px-6 py-8 flex flex-col items-center gap-3 text-center"
            >
              <Icon className="h-8 w-8 text-accent" strokeWidth={1.75} />
              <span className="text-subtitle text-primary">{label}</span>
              <span className="text-caption text-muted">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
