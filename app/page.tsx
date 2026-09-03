import Link from "next/link";
import { ListChecks, Radio, MonitorPlay, PauseCircle, QrCode, Check } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colorTagTone } from "@/lib/color-tags";
import { cn } from "@/lib/utils";

// The public marketing page — proxy.ts redirects a signed-in operator
// straight to /dashboard, so this only ever renders for a logged-out
// visitor. Previously a wordmark, one tagline, and a single "Operator Log
// In" button with signup buried a click away on the login page — flagged
// directly in the persona UX study (kramflow_ux_report.md, finding #3 /
// Section 3.1) as a real first-impression problem: signup wasn't
// discoverable at all without already knowing it existed.
//
// Structurally modeled on stagetimer.io's own landing page (studied live,
// 2026-08-18): a concrete, literal headline over a vague one, a
// no-friction primary CTA next to the trust line that removes the biggest
// objection ("no credit card required"), a product visual in the hero
// instead of only prose, and feature sections that show what the product
// actually does rather than adjectives about it. Copy and features below
// are Kramflow's own — not StageTimer's product, audience, or wording —
// and every claim here is something the app actually does today (see
// kramflow_ux_report.md Section 3 for what was hands-on verified working:
// live sync, the four display screens, Hold, Raise Alert, Share Link+QR).
// No fabricated testimonials or usage stats — Kramflow has no real
// customers yet, and StageTimer's social-proof section (customer quotes,
// "808,942 rooms created") has no honest equivalent to reach for here.
export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Features />
      <GetStarted />
      <BuiltFor />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-background/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        <span className="text-console-md text-primary font-semibold tracking-tight">KramFlow</span>
        <nav className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="md">
            Log In
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="md">
            Sign Up
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 pt-16 sm:pt-24 pb-20 flex flex-col items-center text-center">
      <h1 className="text-title text-primary max-w-3xl text-balance">
        Run the show from one screen. Sync it to every display.
      </h1>
      <p className="text-body text-muted mt-5 max-w-xl">
        Kramflow is a live-show control console for event coordinators, AV operators, and stage managers. Build your
        cue sheet, then run Start, Next, Hold, and alerts with every connected screen updating instantly.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <LinkButton href="/signup" variant="primary" size="xl">
          Sign up free
        </LinkButton>
        <p className="text-console-sm text-muted-2">No credit card required. Set up your first event in minutes.</p>
      </div>

      <div className="mt-16 w-full max-w-2xl">
        <HeroMockup />
      </div>
    </section>
  );
}

// A stylized recreation of the real Cue Sheet + live-status chrome, built
// from the app's own tokens (ColorTag, rounded-panel, the same queue-row
// shape as app/e/[eventId]/operator/cue-sheet) — "show the product," per
// the brief, not a stock illustration. Item names are generic-but-real
// event content, not lorem ipsum and not a claimed real customer's event.
function HeroMockup() {
  const rows = [
    { name: "Welcome Remarks", meta: "Opening · 5 min", tag: "ready" as const },
    { name: "Keynote Address", meta: "Main Hall · 20 min", tag: "vip" as const },
    { name: "Closing Video", meta: "Needs confirmation · 3 min", tag: "needs_confirmation" as const },
  ];
  return (
    <Card className="p-0 overflow-hidden text-left rounded-2xl border border-line-soft shadow-float">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-status-green animate-pulse" aria-hidden="true" />
          <span className="text-console-sm text-primary font-medium">Saturday · Evening Gala</span>
        </div>
        <span className="text-console-meta text-muted-2 uppercase tracking-wide">Live</span>
      </div>
      <ul className="flex flex-col">
        {rows.map((row, i) => (
          <li
            key={row.name}
            className={`flex items-center justify-between gap-3 px-5 py-3.5 ${i === 0 ? "bg-card-hover" : ""} ${
              i > 0 ? "border-t border-line-soft" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  colorTagTone(row.tag) === "green" && "bg-status-green",
                  colorTagTone(row.tag) === "blue" && "bg-status-blue",
                  colorTagTone(row.tag) === "orange" && "bg-status-orange",
                  colorTagTone(row.tag) === "red" && "bg-status-red"
                )}
              />
              <div className="min-w-0">
                <p className="text-console-row text-primary truncate">{row.name}</p>
                <p className="text-console-meta text-muted-2 truncate">{row.meta}</p>
              </div>
            </div>
            {i === 0 && (
              <span className="shrink-0 text-console-meta font-medium text-status-green bg-status-green/10 rounded-chip px-2 py-0.5">
                On air
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 px-5 py-3.5 border-t border-line-soft bg-raised/40">
        <Radio className="h-3.5 w-3.5 text-status-green shrink-0" strokeWidth={2} />
        <p className="text-console-meta text-muted-2">
          Synced to 4 displays: General, AV, Green Room, Presenter
        </p>
      </div>
    </Card>
  );
}

interface Feature {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Cue Sheet",
    title: "Build your run of show like a spreadsheet, run it like software",
    description:
      "Sections, presenters, durations, and color tags (Ready, VIP, Needs Confirmation, Urgent) keep a long show scannable at a glance. Already have a rundown? Import it straight from Excel.",
    icon: ListChecks,
  },
  {
    eyebrow: "Live Sync",
    title: "One console, every screen, always in sync",
    description:
      "Press Start, Next, Previous, or Hold from the Operator Console and every connected display updates immediately. No refresh, no lag between what you press and what the room sees.",
    icon: Radio,
  },
  {
    eyebrow: "Four Displays",
    title: "A different view for every role",
    description:
      "General for the audience, AV for the tech booth (with a live look-ahead at what's coming next), Green Room for backstage, and Presenter as a confidence monitor. Each shows only what that person actually needs.",
    icon: MonitorPlay,
  },
  {
    eyebrow: "Hold & Alerts",
    title: "Handle the unexpected without breaking stride",
    description:
      "Put the whole show on Hold without ending it, or raise an alert that reaches the right screens instantly. Built for the moments a live show doesn't go exactly to plan.",
    icon: PauseCircle,
  },
];

function Features() {
  return (
    <section className="border-t border-line-soft bg-card/40">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-14">
          {FEATURES.map((f) => (
            <FeatureBlock key={f.eyebrow} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-2" strokeWidth={2} />
        <span className="text-console-label text-muted-2 uppercase tracking-wide">{feature.eyebrow}</span>
      </div>
      <h3 className="text-subtitle text-primary text-balance">{feature.title}</h3>
      <p className="text-console-sm text-muted leading-relaxed">{feature.description}</p>
    </div>
  );
}

const STEPS = [
  {
    title: "Create your event",
    description: "Name it, and you're in a real cue sheet in seconds. No setup wizard in the way.",
  },
  {
    title: "Build your cue sheet",
    description: "Add items, presenters, durations, and color tags. Or import an existing rundown from Excel.",
  },
  {
    title: "Share your displays & run the show",
    description:
      "Generate a no-login link and QR code for each screen, then control everything live from the Operator Console.",
  },
];

function GetStarted() {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
      <h2 className="text-title text-primary text-center">Get started in three steps</h2>
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center text-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raised border border-line text-console-md text-primary font-semibold tnum">
              {i + 1}
            </span>
            <h3 className="text-console-md text-primary">{step.title}</h3>
            <p className="text-console-sm text-muted leading-relaxed max-w-xs">{step.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <LinkButton href="/signup" variant="primary" size="lg">
          Sign up free
        </LinkButton>
      </div>
    </section>
  );
}

const AUDIENCES = [
  {
    role: "Event Coordinators",
    description: "Keep the full run of show, production requirements, and day-of changes in one place, not a spreadsheet three people are editing separately.",
  },
  {
    role: "AV Operators",
    description: "A dedicated display shows exactly what the current and next item need (lighting, sidescreen, curtains) before you're asked for it.",
  },
  {
    role: "Stage Managers",
    description: "Call the show from a console built for one-handed, under-pressure use, with Hold and alerts a click away when something changes.",
  },
];

function BuiltFor() {
  return (
    <section className="border-t border-line-soft">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <h2 className="text-title text-primary text-center">Built for the people actually running the show</h2>
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {AUDIENCES.map((a) => (
            <Card key={a.role} className="rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-status-green">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <h3 className="text-console-md text-primary">{a.role}</h3>
              </div>
              <p className="text-console-sm text-muted leading-relaxed">{a.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-line-soft bg-card/40">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-20 flex flex-col items-center text-center gap-5">
        <QrCode className="h-8 w-8 text-muted-2" strokeWidth={1.75} />
        <h2 className="text-title text-primary">Ready to run your next show?</h2>
        <p className="text-body text-muted max-w-md">
          Set up your event, share a link to your displays, and you&rsquo;re already running the show that same session.
        </p>
        <LinkButton href="/signup" variant="primary" size="xl">
          Sign up free
        </LinkButton>
        <p className="text-console-sm text-muted-2">Free to start, no credit card required.</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line-soft">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap items-center justify-between gap-4">
        <span className="text-console-sm text-muted-2">KramFlow</span>
        <Link href="/login" className="text-console-sm text-muted-2 hover:text-primary transition-colors">
          Operator Log In
        </Link>
      </div>
    </footer>
  );
}
