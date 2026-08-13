import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { MotionPreferences } from "@/components/motion-preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Scoped to measurement — start times, durations, countdowns, sort indices.
// See the .tnum rule in globals.css for why titles stay on Inter.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "KramFlow",
    template: "%s · KramFlow",
  },
  description:
    "KramFlow — a live event operating system for coordinating stage managers, AV operators, and performers across TV displays and mobile control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-primary">
        <MotionPreferences>
          <ToastProvider>{children}</ToastProvider>
        </MotionPreferences>
      </body>
    </html>
  );
}
