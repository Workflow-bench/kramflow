import type { Metadata } from "next";
import { TvConnectForm } from "./tv-connect-form";

export const metadata: Metadata = {
  title: "Connect this display",
};

// The no-login entry point for a TV: type the six-digit code shown on the
// operator's Share Display card, then pick a screen. Public by design (the
// proxy only gates /dashboard, /e, and the four display routes), and it holds
// no data of its own, the code is resolved server-side by /api/tv/connect.
export default function TvPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background px-6 py-16">
      <div className="flex flex-col items-center gap-10 w-full max-w-2xl text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-title text-primary">KramFlow</h1>
          <p className="text-subtitle text-muted">Connect this display</p>
        </div>
        <TvConnectForm />
      </div>
    </main>
  );
}
