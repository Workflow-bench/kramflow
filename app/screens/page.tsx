import Link from "next/link";
import { Tv, Sliders, Sparkles, Presentation } from "lucide-react";
import { verifyDisplayAccess } from "@/lib/server/verify-display-access";
import { LinkInvalid } from "@/components/auth/link-invalid";

// The no-login screen-selection page a Share Display Link/QR code actually
// opens: no auth, nothing but the token in the URL. This is the deliberate
// departure from StageTimer's model (confirmed in the KramFlow research
// pass) — StageTimer hands out one separate signed link per output/role
// with no in-page picker; KramFlow hands out one link and lets whoever
// opens it choose the screen here.
const SCREENS = [
  { href: "/general", label: "General", desc: "Public / lobby display", icon: Tv },
  { href: "/av", label: "AV", desc: "Technical requirements TV", icon: Sliders },
  { href: "/green-room", label: "Green Room", desc: "Performer display", icon: Sparkles },
  { href: "/presenter", label: "Presenter", desc: "Confidence monitor", icon: Presentation },
];

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const access = await verifyDisplayAccess(token, undefined);

  if (!access.ok) return <LinkInvalid reason={access.reason} />;

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
              href={token ? `${href}?token=${token}` : href}
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
