import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { MotionPreferences } from "@/components/motion-preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Scoped to measurement — start times, durations, countdowns, sort indices.
// See the .tnum rule in globals.css for why titles stay on Inter. IBM Plex
// Mono over the more common JetBrains Mono — a face with more mechanical,
// less "developer-tool" character (Phase 3 design system).
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "KramFlow",
    template: "%s · KramFlow",
  },
  description:
    "KramFlow is a live-event operating system for coordinating stage managers, AV operators, and performers across TV displays and mobile control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-primary">
        <MotionPreferences>
          <ToastProvider>{children}</ToastProvider>
        </MotionPreferences>
      </body>
    </html>
  );
}
