import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { LiquidBackdrop } from "@/components/site/liquid-backdrop";

export default function NotFound() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background overflow-hidden">
      <LiquidBackdrop />
      <div className="glass-panel relative z-10 flex flex-col items-center gap-4 rounded-panel border border-line px-10 py-12 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)]">
        <div className="h-12 w-12 rounded-full bg-raised border border-line flex items-center justify-center text-status-green">
          <Compass className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-title text-primary">Page not found</h1>
          <p className="text-body text-muted max-w-sm">
            That page doesn&apos;t exist, or it moved. Check the link, or head back to your events.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Go to dashboard
          </LinkButton>
          <LinkButton href="/" variant="ghost" size="md">
            Go home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
