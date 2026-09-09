import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
      <div className="h-12 w-12 rounded-full bg-raised border border-line flex items-center justify-center text-muted">
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
    </main>
  );
}
